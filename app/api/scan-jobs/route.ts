import { NextRequest, NextResponse } from 'next/server';
import { readJSON, writeJSON } from '@/utils/fs';

const APIFY_BASE = 'https://api.apify.com/v2';
const APIFY_TOKEN = process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN;

export async function POST(req: NextRequest) {
  if (!APIFY_TOKEN) {
    return NextResponse.json({ error: 'Apify token not configured' }, { status: 500 });
  }

  const { keywords } = await req.json();

  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return NextResponse.json({ error: 'Keywords array is required' }, { status: 400 });
  }

  let allJobs: any[] = [];

  try {
    for (const keyword of keywords) {
      try {
        // Call Apify Indeed Actor
        const res = await fetch(`${APIFY_BASE}/acts/apify~indeed-jobs-scraper/runs`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${APIFY_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            search: keyword,
            location: 'US', // Customize per candidate
            limit: 10, // Fetch 10 per keyword
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          console.error(`Apify error for keyword "${keyword}":`, errorData);
          continue; // Skip this keyword and continue with others
        }

        const run = await res.json();
        const datasetId = run.data?.defaultDatasetId;

        if (!datasetId) {
          console.error(`No dataset ID for keyword "${keyword}"`);
          continue;
        }

        // Wait & fetch results (poll for completion)
        let attempts = 0;
        while (attempts < 10) {
          await new Promise((r) => setTimeout(r, 2000)); // 2s poll

          const dataRes = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?format=json&clean=true`, {
            headers: {
              Authorization: `Bearer ${APIFY_TOKEN}`,
            },
          });

          if (!dataRes.ok) {
            attempts++;
            continue;
          }

          const data = await dataRes.json();
          if (data && data.length > 0) {
            // Transform Apify data to our format
            const transformedJobs = data.map((job: any, idx: number) => ({
              id: `apify_${Date.now()}_${idx}`,
              title: job.title || job.jobTitle || 'Unknown',
              company: job.company || job.companyName || 'Unknown',
              location: job.location || job.city || 'Unknown',
              salary: job.salary || job.salaryText || 'Not specified',
              requirements: job.description || job.summary || '',
              postedDate: job.postedDate || new Date().toISOString().split('T')[0],
              description: job.description || job.summary || '',
              url: job.url || job.jobUrl || '',
              source: 'indeed',
            }));
            allJobs.push(...transformedJobs);
            break;
          }
          attempts++;
        }
      } catch (error) {
        console.error(`Error processing keyword "${keyword}":`, error);
        continue; // Continue with next keyword
      }
    }

    // Filter matches (basic keyword matching)
    const filteredJobs = allJobs.filter((job) => {
      const jobText = `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
      return keywords.some((kw: string) => {
        const kwWords = kw.toLowerCase().split(' ');
        return kwWords.some((word) => word.length > 2 && jobText.includes(word));
      });
    });

    // Remove duplicates based on title + company
    const uniqueJobs = filteredJobs.filter((job, index, self) => {
      return index === self.findIndex((j) => j.title === job.title && j.company === job.company);
    });

    // Save to JSON file
    try {
      const currentJobs = await readJSON<any[]>('jobs.json').catch(() => []);
      const updatedJobs = [...currentJobs, ...uniqueJobs];

      // Keep latest 100 jobs
      const latestJobs = updatedJobs.slice(-100);

      await writeJSON('jobs.json', latestJobs);

      return NextResponse.json({
        newJobs: uniqueJobs.length,
        total: latestJobs.length,
        jobs: uniqueJobs.slice(0, 5), // Return first 5 for preview
      });
    } catch (fileError) {
      console.error('Error saving jobs:', fileError);
      return NextResponse.json({
        newJobs: uniqueJobs.length,
        total: uniqueJobs.length,
        jobs: uniqueJobs.slice(0, 5),
        warning: 'Could not save to file, but jobs were scraped',
      });
    }
  } catch (error: any) {
    console.error('Job scanning error:', error);
    return NextResponse.json({ error: error.message || 'Job scanning failed' }, { status: 500 });
  }
}

