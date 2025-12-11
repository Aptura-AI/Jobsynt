import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: NextRequest) {
  const { resumeText, userMessage } = await req.json();

  // Load live data - try real jobs first, fallback to sample data
  let jobs = [];
  let candidates = [];

  try {
    // Try to load from actual data files
    const { readJSON } = await import('@/utils/fs');
    jobs = await readJSON<any[]>('jobs.json');
  } catch {
    // Fallback to sample data
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    try {
      const jobsRes = await fetch(`${baseUrl}/ai-data/jobs.json`);
      jobs = await jobsRes.json();
    } catch {
      jobs = [];
    }
  }

  try {
    const { readJSON } = await import('@/utils/fs');
    candidates = await readJSON<any[]>('candidates.json');
  } catch {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
    try {
      const candidatesRes = await fetch(`${baseUrl}/ai-data/candidates.json`);
      candidates = await candidatesRes.json();
    } catch {
      candidates = [];
    }
  }

  try {
    // Use OpenAI Responses API with saved prompt
    const completion = await openai.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_output_tokens: 4096,
      text: {
        format: {
          type: 'json_object',
        },
      },
      prompt: {
        id: 'pmpt_693a19adbe988194a90c57840fb224b80cd9872f8d8138ea',
        version: '1', // or latest if updated
      },
      input: resumeText
        ? `Analyze my resume and find matching jobs:\n\n${resumeText}`
        : userMessage || 'Give me career guidance',
    });

    // Extract response from Responses API format
    // Responses API returns output array with content items
    const outputItems = completion.output || [];
    const textContent = outputItems
      .filter((item: any) => item.type === 'message' && item.content)
      .flatMap((item: any) => item.content)
      .filter((content: any) => content.type === 'text')
      .map((content: any) => content.text)
      .join('');
    
    const raw = textContent || '{}';
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { error: 'AI returned invalid JSON', raw };
    }

    // If keywords exist, trigger job scanning (async, don't block response)
    const keywords = result.keywords || [];
    if (keywords.length > 0 && (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN)) {
      // Trigger scan in background (fire and forget)
      // Construct the correct URL for server-side fetch
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000';
      
      // Fire and forget - don't await, let it run in background
      fetch(`${baseUrl}/api/scan-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      }).then(async (scanRes) => {
        if (scanRes.ok) {
          const scanData = await scanRes.json();
          console.log(`Scanned ${scanData.newJobs || 0} new jobs`);
        }
      }).catch((error) => {
        console.error('Job scanning error:', error);
      });
      
      // Add scanning status to response
      result.scanning = true;
      result.keywords = keywords;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Mentor error:', error);
    return NextResponse.json({ error: error.message || 'AI service error' }, { status: 500 });
  }
}

