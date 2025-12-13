import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/utils/supabase';
import { getServerSession } from '@/lib/auth';
import OpenAI from 'openai';

const APIFY_BASE = 'https://api.apify.com/v2';
const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const { keywords, skills, work_mode, contract_type, rate_expectation, profile_id } = await req.json();

    if (!APIFY_TOKEN) {
      return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 });
    }

    // Use provided keywords or generate from skills
    let searchKeywords = keywords || [];
    if (!searchKeywords.length && skills && Array.isArray(skills) && skills.length > 0) {
      searchKeywords = skills.slice(0, 5); // Use top 5 skills
    }

    if (!searchKeywords.length) {
      return NextResponse.json({ error: 'Keywords or skills required' }, { status: 400 });
    }

    let allJobs: any[] = [];

    // Scrape jobs from Apify
    for (const keyword of searchKeywords.slice(0, 3)) { // Limit to 3 keywords
      try {
        const res = await fetch(`${APIFY_BASE}/acts/apify~indeed-jobs-scraper/runs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${APIFY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            search: keyword,
            location: 'US',
            limit: 20,
          }),
        });

        if (!res.ok) {
          console.error(`Apify error for keyword "${keyword}"`);
          continue;
        }

        const run = await res.json();
        const datasetId = run.data?.defaultDatasetId;

        if (!datasetId) continue;

        // Poll for results
        for (let attempts = 0; attempts < 10; attempts++) {
          await new Promise((r) => setTimeout(r, 2000));

          const dataRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?format=json&clean=true`, {
            headers: { Authorization: `Bearer ${APIFY_TOKEN}` },
          });

          if (dataRes.ok) {
            const data = await dataRes.json();
            if (data && data.length > 0) {
              allJobs.push(...data.map((job: any) => ({
                title: job.title || job.jobTitle || 'Unknown',
                company: job.company || job.companyName || 'Unknown',
                location: job.location || job.city || 'Unknown',
                salary: job.salary || job.salaryText || '',
                description: job.description || job.summary || '',
                url: job.url || job.jobUrl || '',
                postedDate: job.postedDate || new Date().toISOString().split('T')[0],
                source: 'indeed',
              })));
              break;
            }
          }
        }
      } catch (error) {
        console.error(`Error processing keyword "${keyword}":`, error);
        continue;
      }
    }

    // Remove duplicates
    const uniqueJobs = allJobs.filter((job, index, self) => {
      return index === self.findIndex((j) => j.title === job.title && j.company === job.company);
    });

    if (!isSupabaseConfigured() || !session?.user?.email) {
      return NextResponse.json({ 
        newJobs: uniqueJobs.length,
        message: 'Jobs scraped but not saved (database not configured)'
      });
    }

    // Get user profile for matching
    let profile;
    if (profile_id) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profile_id)
        .maybeSingle();
      profile = data;
    } else if (session?.user?.email) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', session.user.email)
        .maybeSingle();
      profile = data;
    }

    if (!profile) {
      return NextResponse.json({ 
        newJobs: uniqueJobs.length,
        message: 'Profile not found - jobs scraped but not matched'
      });
    }

    // Use AI to match and score jobs (80%+ matches)
    const matchedJobs = [];
    for (const job of uniqueJobs.slice(0, 50)) { // Limit to 50 for AI processing
      try {
        const matchPrompt = `Rate this job match for a candidate with:
Skills: ${profile.skills?.join(', ') || 'None'}
Experience: ${profile.experience_years} years
Work Mode Preference: ${profile.work_mode?.join(', ') || 'Any'}
Contract Type Preference: ${profile.contract_type?.join(', ') || 'Any'}

Job Title: ${job.title}
Company: ${job.company}
Description: ${job.description?.substring(0, 500)}

Return JSON: {"fitScore": 0-100, "matchReasons": ["reason1", "reason2"], "isGhost": false}`;

        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.1,
          max_tokens: 200,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'You are a job matching expert. Rate job matches 0-100 based on skills, experience, and preferences.' },
            { role: 'user', content: matchPrompt },
          ],
        });

        const matchResult = JSON.parse(completion.choices[0]?.message?.content || '{}');
        const fitScore = matchResult.fitScore || 0;

        // Only save 80%+ matches
        if (fitScore >= 80) {
          matchedJobs.push({
            ...job,
            fit_score: fitScore,
            match_reasons: matchResult.matchReasons || [],
            is_ghost: matchResult.isGhost || false,
          });
        }
      } catch (aiError) {
        console.error('AI matching error:', aiError);
        // Skip this job if AI fails
      }
    }

    // Save to Supabase jobs table
    let savedCount = 0;
    if (matchedJobs.length > 0) {
      const jobsToSave = matchedJobs.map(job => ({
        title: job.title,
        company: job.company,
        location: job.location,
        rate: job.salary,
        summary: job.description?.substring(0, 500),
        url: job.url,
        source: 'indeed',
        profile_id: profile.id,
        user_id: profile.id, // For filtering
        fit_score: job.fit_score,
        contract_type: profile.contract_type || [],
        match_reasons: job.match_reasons,
        tier: 'free', // Default tier
        is_active: true,
      }));

      // Insert in batches
      for (const job of jobsToSave) {
        try {
          const { error } = await supabase
            .from('jobs')
            .upsert(job, { onConflict: 'url' })
            .select();
          
          if (!error) savedCount++;
        } catch (err) {
          console.error('Error saving job:', err);
        }
      }
    }

    return NextResponse.json({
      newJobs: savedCount,
      totalScraped: uniqueJobs.length,
      matched: matchedJobs.length,
      message: `Scraped ${uniqueJobs.length} jobs, matched ${matchedJobs.length} (80%+), saved ${savedCount} to database`,
    });
  } catch (error: any) {
    console.error('Job scanning error:', error);
    return NextResponse.json({ error: error.message || 'Job scanning failed' }, { status: 500 });
  }
}
