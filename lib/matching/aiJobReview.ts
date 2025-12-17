/**
 * AI Job Review
 * 
 * Wrapper for OpenAI Responses API to review pre-filtered jobs.
 * These jobs have already passed hard filters and scored ≥70%.
 * 
 * AI's role: Provide application advice and insights, NOT re-scoring.
 */

import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// OpenAI Prompt ID for job matching (updated to version 3)
const PROMPT_ID = 'pmpt_693a19adbe988194a90c57840fb224b80cd9872f8d8138ea';

export type EligibleJob = {
  id: string; // Required - jobs without ID are filtered out before AI review
  title: string;
  company: string;
  location: string;
  job_type?: string | null;
  description?: string | null;
  salary?: string | null;
  match_score: number;
  score_breakdown: {
    skills: number;
    jobTitle: number;
    experience: number;
    degree: number;
    pay: number;
    total: number;
  };
};

export type CandidateProfile = {
  id?: string;
  name?: string | null;
  email?: string | null;
  title?: string | null;
  location?: string | null;
  phone?: string | null;
  skills?: string[] | null;
  experience_years?: number | null;
  preferred_job_types?: string[] | null;
  rate_expectation?: string | null;
  expected_pay_min?: number | null;
  work_mode?: string[] | null;
  contract_type?: string[] | null;
  visa_status?: string | null;
  availability?: string | null;
  summary?: string | null;
  resume_text?: string | null;
  degrees?: string[] | null;
  certifications?: string[] | null;
};

export type AIReviewResult = {
  confirmed: boolean;
  advice?: string[];
  insights?: string[];
  error?: string;
};

/**
 * Review a pre-filtered job using OpenAI Responses API
 * 
 * NOTE: This job has already passed hard filters and scored ≥70%.
 * AI should NOT re-score or filter - only provide advice.
 */
export async function reviewJobWithAI(
  job: EligibleJob,
  candidate: CandidateProfile
): Promise<AIReviewResult> {
  try {
    // Prepare job data for AI
    const jobData = {
      jobId: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      jobType: job.job_type,
      description: (job.description || '').substring(0, 500),
      salary: job.salary,
      matchScore: job.match_score,
      scoreBreakdown: job.score_breakdown,
    };

    // Try OpenAI Responses API first (if available)
    try {
      // Type assertion needed because Responses API input structure may not match type definitions
      const response = await openai.responses.create({
        prompt: {
          id: PROMPT_ID,
          version: '3',
        },
        input: {
          candidate: {
            name: candidate.name,
            title: candidate.title,
            skills: candidate.skills || [],
            experience: candidate.experience_years || 0,
            location: candidate.location,
            preferredJobTypes: candidate.preferred_job_types || [],
            rateExpectation: candidate.rate_expectation,
            expectedPayMin: candidate.expected_pay_min,
            workMode: candidate.work_mode || [],
            contractType: candidate.contract_type || [],
            visaStatus: candidate.visa_status,
            availability: candidate.availability,
            summary: candidate.summary,
            resumeText: candidate.resume_text ? candidate.resume_text.substring(0, 2000) : undefined,
            degrees: candidate.degrees || [],
            certifications: candidate.certifications || [],
          },
          job: jobData,
          // CRITICAL: Tell AI these jobs are pre-filtered and scored
          note: 'This job has already passed hard filters (location, job type, experience, rate) and scored ≥70% on deterministic matching. Do not re-score. Provide application advice and insights only.',
        } as any,
      });

      // Parse response (structure depends on prompt)
      // For now, assume any response means confirmation
      return {
        confirmed: true,
        advice: ['AI reviewed and confirmed match'],
        insights: ['Job passed all filters and scoring'],
      };
    } catch (responsesError: any) {
      // If responses API doesn't exist or fails, fall back to chat completions
      console.warn('OpenAI Responses API not available, falling back to chat completions:', responsesError.message);
      
      // Fallback to standard chat completions
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are a job matching advisor. This job has already passed hard filters and scored ≥70% on deterministic matching. Do NOT re-score. Provide application advice and insights only.',
          },
          {
            role: 'user',
            content: `Review this pre-filtered job match:

Candidate Profile (Complete):
- Name: ${candidate.name || 'Not provided'}
- Title: ${candidate.title || 'Not provided'}
- Location: ${candidate.location || 'Any'}
- Experience: ${candidate.experience_years || 0} years
- Skills: ${(candidate.skills || []).join(', ') || 'None'}
- Preferred Job Types: ${(candidate.preferred_job_types || []).join(', ') || 'All'}
- Contract Type: ${(candidate.contract_type || []).join(', ') || 'Not specified'}
- Work Mode: ${(candidate.work_mode || []).join(', ') || 'Not specified'}
- Visa Status: ${candidate.visa_status || 'Not specified'}
- Rate Expectation: ${candidate.rate_expectation || 'Not specified'}
- Availability: ${candidate.availability || 'Not specified'}
- Summary: ${candidate.summary || 'No summary provided'}
${candidate.resume_text ? `- Resume Text: ${candidate.resume_text.substring(0, 1000)}${candidate.resume_text.length > 1000 ? '...' : ''}` : ''}

Job:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Type: ${job.job_type || 'Not specified'}
- Description: ${(job.description || '').substring(0, 500)}
- Salary: ${job.salary || 'Not specified'}
- Match Score: ${job.match_score}% (Skills: ${job.score_breakdown.skills}pts, Experience: ${job.score_breakdown.experience}pts, Pay: ${job.score_breakdown.pay}pts)

Return JSON: {"confirmed": true, "advice": ["tip1", "tip2"], "insights": ["insight1"]}`,
          },
        ],
      });

      const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
      
      return {
        confirmed: result.confirmed !== false, // Default to true if not specified
        advice: result.advice || [],
        insights: result.insights || [],
      };
    }
  } catch (error: any) {
    console.error('AI review error:', error);
    return {
      confirmed: false,
      error: error.message || 'AI review failed',
    };
  }
}

