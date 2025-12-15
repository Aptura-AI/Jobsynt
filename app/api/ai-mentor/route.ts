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
    const { resumeText, userMessage, messages } = await req.json();

    let profileCtx = '';
    let finalResumeText = resumeText;

    // Fetch profile + resume from Supabase to give AI full context
    if (session?.user?.email) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();

        if (profile) {
          profileCtx = `Profile:
Name: ${profile.name || ''}
Title: ${profile.title || ''}
Location: ${profile.location || ''}
Experience: ${profile.experience_years || 0} years
Skills: ${(profile.skills || []).join(', ')}
Contract Type: ${(profile.contract_type || []).join(', ')}
Work Mode: ${(profile.work_mode || []).join(', ')}
Availability: ${profile.availability || ''}
Visa: ${profile.visa_status || ''}
Rate Expectation: ${profile.rate_expectation || ''}`;

          const { data: resumeRow } = await supabase
            .from('resumes')
            .select('extracted_text')
            .eq('profile_id', profile.id)
            .order('uploaded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (resumeRow?.extracted_text && !finalResumeText) {
            finalResumeText = resumeRow.extracted_text;
          }
        }
      } catch (dbError) {
        console.error('Error fetching profile/resume from DB:', dbError);
      }
    }

    // If no resume and no message, allow questions without resume
    if (!finalResumeText && !userMessage) {
      return NextResponse.json({ 
        error: 'Please provide a question or upload a resume.' 
      }, { status: 400 });
    }

    const baseUserMessage = finalResumeText
      ? `Analyze this resume, use the provided profile context, and respond in JSON.\n\n${profileCtx}\n\nResume:\n${finalResumeText}`
      : `${profileCtx}\n\nQuestion: ${userMessage}\n\nRespond in JSON as per the schema.`;

    const chatHistory = Array.isArray(messages) ? messages : [];
    const openAIMessages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...chatHistory.map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: baseUserMessage },
    ];

    console.log('Calling OpenAI API...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: openAIMessages,
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

    // No automatic scraping - jobs are manually uploaded

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
