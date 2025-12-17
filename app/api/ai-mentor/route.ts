import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from '@/lib/auth';
import { supabase } from '@/utils/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG_ID || undefined,
});

const SYSTEM_PROMPT = `You are Jobsynt AI — a recruiter-led, AI-powered job agent acting on behalf of the candidate.

You are not a chatbot and not a search engine.
You are the candidate's dedicated job agent, entrusted to own their job discovery, prioritization, and guidance using already-curated, high-quality job data.

The platform has already done the heavy lifting:
- Jobs are scraped, vetted, and pre-matched (70–80% fit)
- Profiles, summaries, and resumes are structured and available
- Hard constraints (location, visa, job type, pay, experience) are enforced before you see jobs

Your responsibility starts after that.

Your mission is to:
- Take charge
- Rank jobs intelligently
- Keep the candidate focused on the best opportunities
- Act like a senior recruiter who understands the candidate deeply

CORE RESPONSIBILITIES (NON-NEGOTIABLE)

1️⃣ Candidate Ownership
- Fully understand the candidate's profile fields, resume content, and summary
- Remember what roles fit them best
- Continuously refine job ordering and recommendations
- Do NOT summarize the candidate's profile unless explicitly asked

2️⃣ Job Ranking & Curation (PRIMARY FUNCTION)
- Rank jobs with recruiter-level judgment, prioritizing:
  * Role alignment with resume + summary
  * Depth of skill overlap (not just keywords)
  * Career progression logic
  * Rate / seniority fit
  * Stability and realism of the role
- Always present best-aligned jobs first with clear, confident reasoning
- Actively de-prioritize weak or stale roles

3️⃣ Job Communication Rules
- Always assume jobs are real and already vetted
- Never tell candidates to search external job boards
- Never suggest jobs outside the platform
- If no strong matches exist, reassure and explain that matching is actively running

4️⃣ Career Guidance (SECONDARY, CONTROLLED)
- Be concise by default, expand only if asked
- Focus on positioning for jobs already surfaced
- Small, high-impact improvements
- Interview readiness for current matches

5️⃣ Authority & Tone
- Confident, calm, decisive, recruiter-like
- Think: "I've reviewed your profile and the jobs available. Here's what you should focus on."
- You own the process

STRICT LIMITATIONS (VERY IMPORTANT)
You must NEVER:
- Invent jobs
- Modify job facts
- Recommend external job boards
- Repeatedly summarize the candidate profile
- Over-explain unless asked
- Ask the candidate to "search" for jobs

OUTPUT FORMAT:
Always return JSON:
{
  "response": "Short recruiter-style guidance",
  "jobs": [{"id": "...", "priority": "High|Medium|Low", "whyItFits": [...], "recommendedAction": "..."}],
  "guidance": {"summary": "...", "nextSteps": [...]},
  "explanation": "Natural language explanation (short, confident)"
}

You are not assisting the candidate. You are representing them. Act accordingly.`;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const { resumeText, userMessage, messages } = await req.json();

    let profileCtx = '';
    let finalResumeText = resumeText;
    let matchedJobsContext = '';

    // Fetch profile + resume + matched jobs from Supabase to give AI full context
    if (session?.user?.email) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', session.user.email)
          .maybeSingle();

        if (profile) {
          // Build comprehensive profile context with all details
          profileCtx = `Candidate Profile (Complete):
Name: ${profile.name || ''}
Email: ${profile.email || ''}
Title: ${profile.title || ''}
Location: ${profile.location || ''}
Phone: ${profile.phone || ''}
Experience: ${profile.experience_years || 0} years
Skills: ${(profile.skills || []).join(', ') || 'None'}
Preferred Job Types: ${(profile.preferred_job_types || []).join(', ') || 'All'}
Contract Type: ${(profile.contract_type || []).join(', ') || 'Not specified'}
Work Mode: ${(profile.work_mode || []).join(', ') || 'Not specified'}
Availability: ${profile.availability || 'Not specified'}
Visa Status: ${profile.visa_status || ''}
Rate Expectation: ${profile.rate_expectation || 'Not specified'}
Summary: ${profile.summary || 'No summary provided'}`;

          // Get resume text from profiles.resume_text (preferred) or resumes table (fallback)
          if (profile.resume_text && !finalResumeText) {
            finalResumeText = profile.resume_text;
          } else {
            // Fallback to resumes table if resume_text not in profile
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

          // Add resume text to profile context if available
          if (finalResumeText) {
            profileCtx += `\n\nResume Text:\n${finalResumeText.substring(0, 2000)}${finalResumeText.length > 2000 ? '...' : ''}`;
          }

          // Fetch matched jobs for context (AI agent needs to know what jobs are available)
          // Only fetch active jobs from last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const { data: matches } = await supabase
            .from('candidate_job_matches')
            .select(`
              match_score,
              reasons,
              scraped_jobs (
                id,
                title,
                company,
                location,
                job_type,
                description,
                salary,
                posted_date,
                is_active
              )
            `)
            .eq('candidate_id', profile.id)
            .eq('job_status', 'active') // Only active jobs
            .gte('scraped_jobs.posted_date', thirtyDaysAgo.toISOString().split('T')[0])
            .eq('scraped_jobs.is_active', true) // Only active jobs
            .order('match_score', { ascending: false })
            .limit(10);

          if (matches && matches.length > 0) {
            matchedJobsContext = `\n\nMatched Jobs Available (${matches.length} total, showing top 10):\n${matches.map((match: any, idx: number) => {
              const job = match.scraped_jobs;
              return `${idx + 1}. ${job.title} at ${job.company} (${job.location}) - ${match.match_score}% match`;
            }).join('\n')}`;
          }
        }
      } catch (dbError) {
        console.error('Error fetching profile/resume/jobs from DB:', dbError);
      }
    }

    // If no resume and no message, allow questions without resume
    if (!finalResumeText && !userMessage) {
      return NextResponse.json({ 
        error: 'Please provide a question or upload a resume.' 
      }, { status: 400 });
    }

    // Only include profile context if user explicitly asks for profile analysis
    const userWantsProfileAnalysis = userMessage && (
      userMessage.toLowerCase().includes('profile') ||
      userMessage.toLowerCase().includes('summarize') ||
      userMessage.toLowerCase().includes('analyze my profile')
    );

    const baseUserMessage = finalResumeText && userWantsProfileAnalysis
      ? `User asked: ${userMessage}\n\nAnalyze this resume and respond in JSON.\n\n${profileCtx}${matchedJobsContext}\n\nResume:\n${finalResumeText}`
      : userMessage
        ? `${userMessage}\n\n${profileCtx ? `Candidate Profile (do NOT summarize unless asked):\n${profileCtx}` : ''}${matchedJobsContext}\n\nAs the candidate's recruiter agent, provide guidance based on their profile and available matched jobs. Respond in JSON format. Keep response SHORT and recruiter-like unless user asks for details.`
        : `User uploaded resume but no question. Wait for user question.`;

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
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch (e) {
          result = { 
            response: raw,
            error: 'AI response was not valid JSON',
          };
        }
      } else {
        result = { 
          response: raw,
          error: 'AI response was not valid JSON',
        };
      }
    }

    if (!result || Object.keys(result).length === 0) {
      return NextResponse.json({ 
        error: 'AI returned an empty response. Please try again.' 
      }, { status: 500 });
    }

    // Ensure response format matches new structure
    // If old format, transform to new format
    if (result.response && !result.guidance) {
      result.guidance = {
        summary: result.response,
        nextSteps: result.careerAdvice || [],
      };
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
