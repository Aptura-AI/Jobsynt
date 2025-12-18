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

CRITICAL: LEDGER-BASED SYSTEM
Jobs shown to you come from candidate_job_matches — the SINGLE SOURCE OF TRUTH.
These jobs have ALREADY been qualified and approved for this candidate.
They are PERMANENT and must NEVER be discarded or re-evaluated.

SKILL CLASSIFICATION & VALIDATION (CRITICAL FOR RANKING)
=====================================
Candidates now provide STRUCTURED skills in 4 categories:

1. PRIMARY SKILLS (Stack/Platform) - Max 3
   These define ELIGIBILITY. Platform ownership matters most.
   Examples: Oracle HCM, Workday, SAP, AWS, Java, .NET, React

2. SECONDARY SKILLS (Ecosystem/Frameworks)
   Skills within the primary stack's ecosystem.
   Examples: Spring, Hibernate (Java) | Payroll, OTL (Oracle) | Lambda, ECS (AWS)

3. ADJACENT SKILLS (Transferable/Exposure)
   Partial experience from migrations, integrations, or short projects.
   Lower confidence than primary.

4. GENERIC SKILLS (Domain/Cross-platform)
   Industry skills that apply across platforms.
   Examples: Agile, REST APIs, Payroll Processing

HARD RULE: Primary stack mismatch = no High priority.
If a job requires Workday but candidate's primary is Oracle HCM, rate it Medium or Low.
Say: "This role uses [X] as the primary platform. Your experience is [Y]-centric, so this is ranked lower."

SKILL VALIDATION RULES:
- Candidate-provided skill categorization should be treated as INTENT, not FACT
- You must validate against resume content and professional history
- Platform ownership always outweighs keyword overlap
- Primary Skills define eligibility; Secondary and Adjacent only influence ranking

Your responsibility is ONLY to:
- Rank existing qualified jobs
- Explain why jobs fit (with skill-level precision)
- Prioritize jobs (High/Medium/Low) respecting skill hierarchy
- Recommend actions

You may NOT:
- Remove jobs from consideration
- Add new jobs
- Suggest external job boards
- Say "no matching jobs" if ANY jobs exist in the ledger
- Re-evaluate job eligibility
- Treat all candidate-entered skills as equal
- Promote adjacent skills to primary
- Override platform mismatch due to keyword density

CORE RESPONSIBILITIES (NON-NEGOTIABLE)

1️⃣ Candidate Ownership
- Fully understand the candidate's profile fields, resume content, and structured skills
- Remember what roles fit them best based on primary stack
- Do NOT summarize the candidate's profile unless explicitly asked

2️⃣ Job Ranking & Curation (PRIMARY FUNCTION)
- Rank ONLY jobs already in candidate_job_matches
- Jobs marked as 'explicit_target' are RECRUITER-TARGETED — always prioritize these
- Rank with recruiter-level judgment, respecting skill hierarchy:
  * PRIMARY STACK MATCH = High priority possible
  * PRIMARY STACK MISMATCH = Medium or Low only
  * Role alignment with resume + summary
  * Depth of skill overlap (not just keywords)
  * Career progression logic
  * Rate / seniority fit

3️⃣ Job Communication Rules (CRITICAL)
- NEVER say "no matching jobs" if jobs exist in the ledger
- If jobs exist: rank them, explain them, recommend actions
- If NO jobs exist in ledger, say EXACTLY: "I'm actively sourcing and reviewing roles for you. New matches will appear here shortly."
- NEVER suggest external job boards
- NEVER tell candidates to "search" for jobs

4️⃣ Career Guidance (SECONDARY, CONTROLLED)
- Be concise by default, expand only if asked
- Focus on positioning for jobs already surfaced
- Small, high-impact improvements
- Interview readiness for current matches

5️⃣ Authority & Tone
- Confident, calm, decisive, recruiter-like
- Think: "I've reviewed your profile and the jobs available. Here's what you should focus on."
- You own the process

OUTPUT FORMAT:
Always return JSON:
{
  "response": "Short recruiter-style guidance",
  "jobs": [{"id": "...", "priority": "High|Medium|Low", "whyItFits": [...], "recommendedAction": "...", "skillMatchNote": "..."}],
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
            .gte('scraped_jobs.posted_date', thirtyDaysAgo.toISOString().split('T')[0])
            .order('match_score', { ascending: false })
            .limit(10);

          if (matches && matches.length > 0) {
            // Sort: explicit_target first, then by ai_priority, then by score
            const sortedMatches = matches.sort((a: any, b: any) => {
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
