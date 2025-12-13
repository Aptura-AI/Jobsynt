import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG_ID || undefined,
});

const SYSTEM_PROMPT = `You are an AI Career Mentor for Jobsynt, a job marketplace for ERP, Cloud & IT professionals.

Your role is to:
1. Analyze resumes and provide feedback
2. Match candidates with relevant job opportunities
3. Identify potential ghost jobs (fake listings)
4. Provide career guidance and job search tips
5. Generate relevant keywords for job searches

Always respond in JSON format with this structure:
{
  "summary": "Brief analysis summary",
  "strengths": ["list of candidate strengths"],
  "improvements": ["areas for improvement"],
  "matchedJobs": [{"title": "", "company": "", "fitScore": 0-100, "reasons": []}],
  "ghostJobWarnings": ["any suspicious job indicators"],
  "keywords": ["relevant search keywords"],
  "careerTips": ["actionable advice"],
  "nextSteps": ["recommended actions"]
}

Be helpful, encouraging, and specific in your feedback.`;

export async function POST(req: NextRequest) {
  try {
    const { resumeText, userMessage } = await req.json();

    if (!resumeText && !userMessage) {
      return NextResponse.json({ 
        error: 'Please provide a resume or ask a question' 
      }, { status: 400 });
    }

    const userInput = resumeText
      ? `Please analyze this resume and provide career guidance. Return your response as JSON.\n\nResume:\n${resumeText}`
      : `${userMessage}\n\nPlease respond in JSON format.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userInput },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let result;
    try {
      result = JSON.parse(raw);
    } catch {
      result = { 
        summary: raw,
        error: 'AI response was not valid JSON',
      };
    }

    // If keywords exist, trigger job scanning (async, don't block response)
    const keywords = result.keywords || [];
    if (keywords.length > 0 && (process.env.APIFY_TOKEN || process.env.APIFY_API_TOKEN)) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL 
        || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
        || 'http://localhost:3000';
      
      // Fire and forget - don't await
      fetch(`${baseUrl}/api/scan-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords }),
      }).catch(console.error);
      
      result.scanning = true;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('AI Mentor error:', error);
    return NextResponse.json({ 
      error: error.message || 'AI service error' 
    }, { status: 500 });
  }
}
