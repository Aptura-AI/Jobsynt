import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/utils/supabase'; // still used for anon reads if needed
import OpenAI from 'openai';

const APIFY_BASE = 'https://api.apify.com/v2';
const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;
const DEBUG_APIFY = process.env.DEBUG_APIFY === 'true';
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  try {
    const { keywords, skills, work_mode, contract_type, rate_expectation, profile_id } = await req.json();

    if (!APIFY_TOKEN) {
      return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 });
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Supabase service key not configured' }, { status: 500 });
    }

    // Use service-role client for writes
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Default keyword set (Oracle/PeopleSoft/SAP/Cloud Data Engineer) remote C2C/1099
    const defaultKeywords = [
      'Oracle consultant remote C2C 1099',
      'PeopleSoft consultant remote C2C 1099',
      'SAP consultant remote C2C 1099',
      'Cloud data engineer remote C2C 1099',
    ];

    // Use provided keywords or generate from skills or fallback defaults
    let searchKeywords = keywords || [];
    if (!searchKeywords.length && skills && Array.isArray(skills) && skills.length > 0) {
      searchKeywords = skills.slice(0, 5); // Use top 5 skills
    }
    if (!searchKeywords.length) {
      searchKeywords = defaultKeywords;
    }

    let allJobs: any[] = [];
    const scrapeDiagnostics: any[] = [];

    // Scrape jobs from Apify
    for (const keyword of searchKeywords.slice(0, 4)) { // Limit to 4 keywords (5-10 jobs each => ~20-40)
      try {
        const res = await fetch(`${APIFY_BASE}/acts/apify~indeed-jobs-scraper/runs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${APIFY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            search: keyword,
            location: 'Remote',
            limit: 10,
          }),
        });

        if (!res.ok) {
          console.error(`Apify error for keyword "${keyword}"`);
          scrapeDiagnostics.push({ keyword, error: `actor_run_failed_${res.status}` });
          continue;
        }

        const run = await res.json();
        const datasetId = run.data?.defaultDatasetId;

        if (!datasetId) {
          scrapeDiagnostics.push({ keyword, error: 'no_dataset_id' });
          continue;
        }

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
              scrapeDiagnostics.push({ keyword, datasetId, items: data.length });
              break;
            }
          }
          if (attempts === 9) {
            scrapeDiagnostics.push({ keyword, datasetId, items: 0, note: 'empty_dataset' });
          }
        }
      } catch (error) {
        console.error(`Error processing keyword "${keyword}":`, error);
        scrapeDiagnostics.push({ keyword, error: 'exception', details: (error as Error).message });
        continue;
      }
    }

    // Remove duplicates
    const uniqueJobs = allJobs.filter((job, index, self) => {
      return index === self.findIndex((j) => j.title === job.title && j.company === job.company);
    });

    // Optional: Get user profile for matching (if profile_id provided)
    let profile: any = null;
    if (profile_id) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', profile_id)
        .maybeSingle();
      profile = data;
    }

    // Use AI to match and score jobs (80%+ matches)
    const matchedJobs = [];
    if (profile) {
      for (const job of uniqueJobs.slice(0, 50)) { // Limit to 50 for AI processing
        try {
          const matchPrompt = `Rate this job match for a candidate with:
Skills: ${profile.skills?.join(', ') || 'None'}
Experience: ${profile.experience_years || 0} years
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
    } else {
      // No profile: save all unique jobs without AI scoring
      matchedJobs.push(...uniqueJobs.map((job) => ({
        ...job,
        fit_score: null,
        match_reasons: [],
        is_ghost: false,
      })));
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
        profile_id: profile?.id || null,
        user_id: profile?.id || null, // For filtering
        fit_score: job.fit_score,
        contract_type: profile?.contract_type || [],
        match_reasons: job.match_reasons,
        tier: 'free', // Default tier
        is_active: true,
      }));

      // Insert in batches
      for (const job of jobsToSave) {
        try {
          const { error } = await supabaseAdmin
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
      message: `Scraped ${uniqueJobs.length} jobs, matched ${matchedJobs.length} (80%+ if profiled), saved ${savedCount} to database`,
      diagnostics: DEBUG_APIFY ? scrapeDiagnostics : undefined,
    });
  } catch (error: any) {
    console.error('Job scanning error:', error);
    return NextResponse.json({ error: error.message || 'Job scanning failed' }, { status: 500 });
  }
}
