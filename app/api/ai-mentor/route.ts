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
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are Jobsynt AI, an expert career mentor. Use the attached jobs.json and candidates.json to provide real, accurate matches.

KEY RULES:
- Always respond in valid JSON (see format below)
- Extract skills, experience, strengths from resume
- Find top 3-5 real job matches from jobs.json
- Flag ghost jobs (vague, old posting, "rockstar/ninja", unrealistic reqs)
- Give encouraging, specific feedback
- Suggest courses if gaps exist
- End with next steps

OUTPUT FORMAT (exact JSON):
{
  "analysis": { "strengths": string[], "skills": string[], "gaps": string[], "profileScore": number },
  "matches": [{ "id": string, "title": string, "company": string, "fitScore": number, "reasons": string[], "isGhost": boolean }],
  "guidance": { "advice": string, "courses": string[], "nextSteps": string[] },
  "keywords": ["query1", "query2", "query3"]
}

IMPORTANT: After analysis, generate 3-5 precise keyword queries for job scanning (e.g., "React developer remote 2 years exp", "frontend engineer US salary 60k+", "ERP consultant cloud"). These will be used to scrape fresh jobs from the web.

Jobs data: ${JSON.stringify(jobs)}
Candidates data: ${JSON.stringify(candidates)}
Resume text: """${resumeText || 'No resume provided'}"""
User message: """${userMessage || 'Analyze my profile and find jobs'}"""
`,
        },
      ],
    });

    const raw = completion.choices[0].message.content || '{}';
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

