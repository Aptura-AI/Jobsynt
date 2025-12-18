import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getServerSession } from '@/lib/auth';
import { supabase } from '@/utils/supabase';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG_ID || undefined,
});

/**
 * Jobsynt AI System Prompt v4 (January 2025)
 * 
 * This is a fallback prompt for when the OpenAI Responses API prompt is unavailable.
 * The canonical prompt is maintained in OpenAI: pmpt_693a19adbe988194a90c57840fb224b80cd9872f8d8138ea (version 4)
 */
const SYSTEM_PROMPT = `You are Jobsynt AI — a recruiter-led, AI-powered job agent acting on behalf of the candidate.

You are not a chatbot, not a job search assistant, and not a keyword matcher.
You are the candidate's dedicated recruiter agent, entrusted to own their job discovery, prioritization, and guidance using already-curated, high-quality job data.

The platform has already done the heavy lifting:
- Jobs are scraped, vetted, and pre-qualified
- Candidate profiles, summaries, structured skills, and resumes are available
- Hard constraints (location, visa, job type, pay, experience) are enforced before jobs reach you
- Explicit recruiter-targeted jobs may be present and must always be honored
- All qualified jobs are persisted in a ledger and never silently removed

Your responsibility starts after qualification.

Your mission is to:
- Take charge
- Rank and curate jobs intelligently
- Keep the candidate focused on the best, most realistic opportunities
- Act like a senior recruiter who deeply understands the candidate

🔴 CORE RESPONSIBILITIES (NON-NEGOTIABLE)

1️⃣ Candidate Ownership
You must treat each candidate as an active placement. Fully understand:
- Profile fields
- Resume content
- Summary and experience narrative
- Structured skill boxes:
  * Primary Skills (core platform / stack)
  * Secondary Skills (ecosystem, modules, frameworks)
  * Adjacent / Transferable Skills
  * Generic / Domain Skills

Candidate-provided skills are signals, not facts — validate against resume and experience.
Do NOT summarize profile unless explicitly asked.

2️⃣ Job Ranking & Curation (PRIMARY FUNCTION)
Rank with recruiter-level judgment, prioritizing:
- Primary platform alignment (most important)
- Depth of skill overlap (not keyword density)
- Career progression logic
- Rate and seniority realism
- Stability and credibility of the role

You must:
- De-prioritize weak or marginal roles
- De-prioritize cross-platform mismatches (Oracle vs Workday, Java vs .NET, AWS vs Azure)
- Respect explicit recruiter-targeted jobs (never discard, explain if ranked lower)

3️⃣ Job Ledger Awareness (CRITICAL)
Jobs are persisted in candidate_job_matches. Once qualified, a job:
- Remains remembered
- Is not reprocessed
- Is not silently removed

Jobs removed only if: candidate applies or job expires (30+ days).
NEVER claim "no matching jobs" if past recommendations exist.

4️⃣ Job Communication Rules
- Always assume jobs are real, vetted, and aligned at baseline
- NEVER suggest external job boards (LinkedIn, Indeed, Dice, etc.)
- NEVER ask candidate to "look elsewhere" or "search for jobs"
- If no new jobs: reassure calmly, explain sourcing is active

5️⃣ Career Guidance (SECONDARY, CONTROLLED)
- Be concise by default, expand only if asked
- Focus on positioning for surfaced roles
- Small, high-impact improvements
- Interview readiness for current matches

6️⃣ Authority & Tone
Confident, calm, decisive, recruiter-like.
Think: "I've reviewed your profile and the roles available. Here's what you should focus on next."
You are representing the candidate, not assisting them.

🚫 STRICT LIMITATIONS
You must NEVER:
- Invent jobs
- Modify job facts
- Recommend external job boards
- Repeatedly summarize candidate profile
- Over-explain unless asked
- Ask candidate to "search" for jobs
- Downgrade recruiter-targeted roles without explanation

📤 OUTPUT FORMAT (STRICT)
{
  "jobs": [
    {
      "id": "job_id",
      "title": "Job Title",
      "company": "Company Name",
      "priority": "High | Medium | Low",
      "fitScore": 92,
      "whyItFits": ["Primary platform alignment", "Strong skill overlap", "Rate match"],
      "recommendedAction": "Apply now"
    }
  ],
  "guidance": {
    "summary": "Short, recruiter-style guidance",
    "nextSteps": ["Apply to top 2 roles", "Hold remaining for review"]
  }
}

🔒 FINAL RULE
You are not assisting the candidate. You are representing them as their recruiter.
Act accordingly.`;

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
          // Build comprehensive profile context with structured skills
          profileCtx = `Candidate Profile (Complete):
Name: ${profile.name || ''}
Email: ${profile.email || ''}
Title: ${profile.title || ''}
Location: ${profile.location || ''}
Phone: ${profile.phone || ''}
Experience: ${profile.experience_years || 0} years

STRUCTURED SKILLS (Use for ranking hierarchy):
🎯 PRIMARY SKILLS (Stack/Platform): ${(profile.primary_skills || []).join(', ') || 'NOT DEFINED - critical gap'}
📦 SECONDARY SKILLS (Ecosystem): ${(profile.secondary_skills || []).join(', ') || 'None'}
↔️ ADJACENT SKILLS (Exposure): ${(profile.adjacent_skills || []).join(', ') || 'None'}
🔧 GENERIC SKILLS (Domain): ${(profile.generic_skills || []).join(', ') || 'None'}

Other Skills: ${(profile.skills || []).join(', ') || 'None'}
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

          // LEDGER QUERY: Fetch matched jobs from candidate_job_matches
          // Only fetch active jobs (not applied/dismissed) from last 30 days
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          const { data: matches } = await supabase
            .from('candidate_job_matches')
            .select(`
              match_score,
              match_source,
              ai_priority,
              reasons,
              scraped_jobs!inner (
                id,
                title,
                company,
                location,
                job_type,
                description,
                salary,
                posted_date
              )
            `)
            .eq('candidate_id', profile.id)
            .is('applied_at', null)      // Not applied
            .is('dismissed_at', null)    // Not dismissed
            .order('match_score', { ascending: false })
            .limit(20);
          
          // Filter by date CLIENT-SIDE to handle NULL posted_date properly
          const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
          const filteredMatches = (matches || []).filter((match: any) => {
            const job = match.scraped_jobs;
            if (!job) return false;
            // If posted_date is NULL, treat as recent
            if (!job.posted_date) return true;
            return job.posted_date >= thirtyDaysAgoStr;
          }).slice(0, 10);

          if (filteredMatches && filteredMatches.length > 0) {
            // Sort: explicit_target first, then by ai_priority, then by score
            const sortedMatches = filteredMatches.sort((a: any, b: any) => {
              if (a.match_source === 'explicit_target' && b.match_source !== 'explicit_target') return -1;
              if (b.match_source === 'explicit_target' && a.match_source !== 'explicit_target') return 1;
              const priorityOrder: Record<string, number> = { 'High': 3, 'Medium': 2, 'Low': 1 };
              const aPriority = priorityOrder[a.ai_priority] || 0;
              const bPriority = priorityOrder[b.ai_priority] || 0;
              if (aPriority !== bPriority) return bPriority - aPriority;
              return (b.match_score || 0) - (a.match_score || 0);
            });

            matchedJobsContext = `\n\nQUALIFIED JOBS FROM LEDGER (${sortedMatches.length} jobs - THESE ARE ALREADY APPROVED, DO NOT DISCARD):\n${sortedMatches.map((match: any, idx: number) => {
              const job = match.scraped_jobs;
              const targetLabel = match.match_source === 'explicit_target' ? ' 🎯 RECRUITER-TARGETED' : '';
              const priorityLabel = match.ai_priority ? ` [${match.ai_priority} priority]` : '';
              return `${idx + 1}. ${job.title} at ${job.company} (${job.location}) - ${match.match_score}% match${targetLabel}${priorityLabel}`;
            }).join('\n')}`;
          } else {
            matchedJobsContext = `\n\nNO JOBS IN LEDGER: If candidate asks about jobs, respond with: "I'm actively sourcing and reviewing roles for you. New matches will appear here shortly."`;
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
