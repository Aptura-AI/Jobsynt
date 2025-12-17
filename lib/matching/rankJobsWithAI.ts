/**
 * Rank Jobs with AI
 * 
 * Uses OpenAI Responses API (prompt version 3) to rank and curate pre-matched jobs.
 * The AI acts as a recruiter agent, taking charge of job prioritization.
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// OpenAI Prompt ID for job matching (version 3)
const PROMPT_ID = 'pmpt_693a19adbe988194a90c57840fb224b80cd9872f8d8138ea';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

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

export type MatchedJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  job_type?: string | null;
  location_type?: string | null;
  is_remote?: boolean | null;
  description?: string | null;
  salary?: string | null;
  pay_rate_min?: number | null;
  pay_rate_max?: number | null;
  url?: string | null;
  posted_date?: string | null;
  match_score: number;
  reasons?: string[] | null;
};

export type RankedJob = {
  id: string;
  title: string;
  company: string;
  priority: 'High' | 'Medium' | 'Low';
  fitScore: number;
  whyItFits: string[];
  recommendedAction: string;
};

export type RankingResult = {
  jobs: RankedJob[];
  guidance: {
    summary: string;
    nextSteps: string[];
  };
  explanation?: string; // Natural language explanation
};

/**
 * Rank and curate jobs using AI (Recruiter Agent)
 * 
 * Fetches matched jobs from candidate_job_matches and ranks them using OpenAI Responses API.
 */
export async function rankJobsWithAI(
  candidateId: string,
  candidate: CandidateProfile
): Promise<RankingResult> {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Database not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch matched jobs from candidate_job_matches
    // Only fetch active jobs (exclude applied, dismissed, expired)
    const { data: matches, error: matchesError } = await supabase
      .from('candidate_job_matches')
      .select(`
        job_id,
        match_score,
        reasons,
        job_status,
        scraped_jobs (
          id,
          title,
          company,
          location,
          job_type,
          location_type,
          is_remote,
          description,
          salary,
          pay_rate_min,
          pay_rate_max,
          url,
          posted_date,
          is_active
        )
      `)
      .eq('candidate_id', candidateId)
      .eq('job_status', 'active') // Only active jobs
      .order('match_score', { ascending: false })
      .limit(20); // Limit to top 20 for AI ranking

    if (matchesError || !matches || matches.length === 0) {
      return {
        jobs: [],
        guidance: {
          summary: 'I\'ve reviewed your profile and the current job market. No strong matches are available right now, but our matching system is actively running and will surface opportunities as they become available.',
          nextSteps: [
            'Your profile is being continuously matched against new job postings',
            'You\'ll be notified when high-quality matches are found'
          ],
        },
      };
    }

    // Transform to MatchedJob format
    // Filter out inactive jobs and jobs older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const matchedJobs: MatchedJob[] = matches
      .filter((match: any) => {
        const job = match.scraped_jobs;
        // Filter out inactive jobs
        if (job.is_active === false) return false;
        // Filter out jobs older than 30 days
        if (job.posted_date) {
          const postedDate = new Date(job.posted_date);
          if (postedDate < thirtyDaysAgo) return false;
        }
        return true;
      })
      .map((match: any) => {
        const job = match.scraped_jobs;
        return {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          job_type: job.job_type,
          location_type: job.location_type,
          is_remote: job.is_remote,
          description: job.description,
          salary: job.salary,
          pay_rate_min: job.pay_rate_min,
          pay_rate_max: job.pay_rate_max,
          url: job.url,
          posted_date: job.posted_date,
          match_score: match.match_score,
          reasons: match.reasons || [],
        };
      });

    // If all jobs were filtered out, return no jobs response
    if (matchedJobs.length === 0) {
      return {
        jobs: [],
        guidance: {
          summary: 'I\'ve reviewed your profile and the current job market. No strong matches are available right now, but our matching system is actively running and will surface opportunities as they become available.',
          nextSteps: [
            'Your profile is being continuously matched against new job postings',
            'You\'ll be notified when high-quality matches are found'
          ],
        },
      };
    }

    // Prepare candidate data for AI
    const candidateData = {
      name: candidate.name,
      title: candidate.title,
      location: candidate.location,
      experience: candidate.experience_years || 0,
      skills: candidate.skills || [],
      preferredJobTypes: candidate.preferred_job_types || [],
      contractType: candidate.contract_type || [],
      workMode: candidate.work_mode || [],
      visaStatus: candidate.visa_status,
      rateExpectation: candidate.rate_expectation,
      expectedPayMin: candidate.expected_pay_min,
      availability: candidate.availability,
      summary: candidate.summary,
      resumeText: candidate.resume_text ? candidate.resume_text.substring(0, 3000) : undefined, // Limit for API
      degrees: candidate.degrees || [],
      certifications: candidate.certifications || [],
    };

    // Prepare jobs data for AI
    const jobsData = matchedJobs.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      jobType: job.job_type,
      locationType: job.location_type,
      isRemote: job.is_remote,
      description: job.description ? job.description.substring(0, 1000) : undefined,
      salary: job.salary,
      payRateMin: job.pay_rate_min,
      payRateMax: job.pay_rate_max,
      url: job.url,
      postedDate: job.posted_date,
      matchScore: job.match_score,
      systemReasons: job.reasons || [],
    }));

    // Call OpenAI Responses API with prompt version 3
    try {
      const response = await openai.responses.create({
        prompt: {
          id: PROMPT_ID,
          version: '3',
        },
        input: {
          candidate: candidateData,
          jobs: jobsData,
          note: 'These jobs have already passed hard filters (location, job type, experience, rate) and scored ≥70% on deterministic matching. Your role is to rank, curate, and provide recruiter-level guidance.',
        } as any,
      });

      // Parse response - structure should match RankingResult
      // The response format is defined by the prompt
      const result = response as any;
      
      // Extract jobs and guidance from response
      // Apply ranking stability: clamp AI score influence to ±10 from deterministic base
      const rankedJobs: RankedJob[] = (result.jobs || []).map((aiJob: any) => {
        // Find the original job to get deterministic score
        const originalJob = matchedJobs.find(j => j.id === aiJob.id);
        if (!originalJob) return null;

        // Clamp AI fitScore to ±10 from deterministic base (ranking stability)
        const baseScore = originalJob.match_score;
        const aiScore = aiJob.fitScore || baseScore;
        // Clamp: baseScore - 10 <= clampedScore <= baseScore + 10, within 0-100 range
        const clampedScore = Math.max(
          0,
          Math.min(100, Math.max(baseScore - 10, Math.min(baseScore + 10, aiScore)))
        );

        return {
          id: aiJob.id || originalJob.id,
          title: aiJob.title || originalJob.title,
          company: aiJob.company || originalJob.company,
          priority: aiJob.priority || (clampedScore >= 85 ? 'High' : clampedScore >= 75 ? 'Medium' : 'Low'),
          fitScore: clampedScore, // Use clamped score
          whyItFits: aiJob.whyItFits || originalJob.reasons || [],
          recommendedAction: aiJob.recommendedAction || 'Review and apply',
        };
      }).filter(Boolean) as RankedJob[];

      // If AI didn't return jobs, use deterministic ranking with stability
      if (rankedJobs.length === 0) {
        const stableRankedJobs: RankedJob[] = matchedJobs.map(job => ({
          id: job.id,
          title: job.title,
          company: job.company,
          priority: job.match_score >= 85 ? 'High' : job.match_score >= 75 ? 'Medium' : 'Low',
          fitScore: job.match_score, // Use deterministic score as anchor
          whyItFits: job.reasons || [],
          recommendedAction: job.match_score >= 85 ? 'Apply now' : 'Review carefully',
        }));
        
        return {
          jobs: stableRankedJobs,
          guidance: result.guidance || {
            summary: `Found ${matchedJobs.length} matching opportunities. Prioritize roles with highest fit scores.`,
            nextSteps: [
              'Focus on High priority jobs first',
              'Review Medium priority jobs',
            ],
          },
          explanation: result.explanation,
        };
      }

      const guidance = result.guidance || {
        summary: `Found ${matchedJobs.length} matching opportunities. Focus on the highest priority roles first.`,
        nextSteps: [
          'Review top priority jobs',
          'Apply to best matches',
        ],
      };

      return {
        jobs: rankedJobs,
        guidance,
        explanation: result.explanation,
      };
    } catch (responsesError: any) {
      console.warn('OpenAI Responses API error, using fallback ranking:', responsesError.message);
      
      // Fallback: Deterministic ranking based on match score (stable anchor)
      const rankedJobs: RankedJob[] = matchedJobs.map(job => ({
        id: job.id,
        title: job.title,
        company: job.company,
        priority: job.match_score >= 85 ? 'High' : job.match_score >= 75 ? 'Medium' : 'Low',
        fitScore: job.match_score, // Deterministic score as stable anchor
        whyItFits: job.reasons || [],
        recommendedAction: job.match_score >= 85 ? 'Apply now' : 'Review carefully',
      }));

      return {
        jobs: rankedJobs,
        guidance: {
          summary: `Found ${matchedJobs.length} matching opportunities. Prioritize roles with highest fit scores.`,
          nextSteps: [
            'Focus on High priority jobs first',
            'Review Medium priority jobs',
            'Consider Low priority jobs if needed',
          ],
        },
      };
    }
  } catch (error: any) {
    console.error('Error ranking jobs with AI:', error);
    throw error;
  }
}

