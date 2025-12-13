import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from '@/lib/auth';
import { supabase } from '@/utils/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG_ID || undefined,
});

const SYSTEM_PROMPT = `You are an AI Career Mentor for Jobsynt, a job marketplace for ERP, Cloud & IT professionals.

Your role is to:
1. Analyze resumes and provide feedback
2. Match candidates with relevant job opportunities using weighted criteria
3. Identify potential ghost jobs (fake listings)
4. Provide career guidance and job search tips
5. Generate relevant keywords for job searches

**Job Matching Weights:**
- 50% weight on last 2 jobs (30% to the longer one, 20% to the shorter)
- 30% weight on previous work experience
- 20% weight on education and certifications

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
    const session = await getServerSession();
    const { resumeText, userMessage } = await req.json();

    // If no resume text provided, try to get from Supabase
    let finalResumeText = resumeText;
    if (!finalResumeText && session?.user?.email) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', session.user.email)
          .maybeSingle();

        if (profile) {
          const { data: resumes } = await supabase
            .from('resumes')
            .select('extracted_text')
            .eq('profile_id', profile.id)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (resumes?.extracted_text) {
            finalResumeText = resumes.extracted_text;
          }
        }
      } catch (dbError) {
        console.error('Error fetching resume from DB:', dbError);
      }
    }

    if (!finalResumeText && !userMessage) {
      return NextResponse.json({ 
        error: 'Please provide a resume or ask a question' 
      }, { status: 400 });
    }

    const userInput = finalResumeText
      ? `Please analyze this resume and provide career guidance. Return your response as JSON.\n\nResume:\n${finalResumeText}`
      : `${userMessage}\n\nPlease respond in JSON format.`;

    console.log('Calling OpenAI API...');
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
    console.log('OpenAI response received:', raw.substring(0, 200));

    let result;
    try {
      result = JSON.parse(raw);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      result = { 
        summary: raw,
        error: 'AI response was not valid JSON',
      };
    }

    if (!result || Object.keys(result).length === 0) {
      return NextResponse.json({ 
        error: 'AI returned an empty response. Please try again.' 
      }, { status: 500 });
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
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    
    return NextResponse.json({ 
      error: error.message || 'AI service error',
      details: error.status ? `Status: ${error.status}` : undefined
    }, { status: 500 });
  }
}
