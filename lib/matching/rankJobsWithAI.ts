/**
 * Rank Jobs with AI (Ledger-Based)
 * 
 * Uses OpenAI Responses API (prompt version 3) to rank and curate pre-matched jobs.
 * The AI acts as a recruiter agent, taking charge of job prioritization.
 * 
 * LEDGER RULES:
 * - AI ONLY ranks jobs from candidate_job_matches (the ledger)
 * - AI NEVER says "no matching jobs" if records exist
 * - AI NEVER suggests external job boards
 * - AI NEVER re-evaluates job eligibility
 * - AI may: rank, explain, prioritize, recommend actions
 * - AI may NOT: remove jobs, add jobs, discard jobs
 */

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// OpenAI Prompt ID for job matching (version 4 - updated Jan 2025)
const PROMPT_ID = 'pmpt_693a19adbe988194a90c57840fb224b80cd9872f8d8138ea';
const PROMPT_VERSION = '4';

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
  // Structured skills
  primary_skills?: string[] | null;
  secondary_skills?: string[] | null;
  adjacent_skills?: string[] | null;
  generic_skills?: string[] | null;
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
  match_source?: 'explicit_target' | 'global_match';
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

    // LEDGER QUERY: Fetch jobs from candidate_job_matches
    // Only fetch jobs that are:
    // - Not applied (applied_at IS NULL)
    // - Not dismissed (dismissed_at IS NULL)
    // - Posted within 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: matches, error: matchesError } = await supabase
      .from('candidate_job_matches')
      .select(`
        job_id,
        match_score,
        match_source,
        qualified_at,
        ai_priority,
        reasons,
        scraped_jobs!inner (
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
      .is('applied_at', null)      // Not applied
      .is('dismissed_at', null)    // Not dismissed
      .order('match_score', { ascending: false })
      .limit(30); // Fetch extra to allow for filtering
    
    // Filter by date CLIENT-SIDE to handle NULL posted_date properly
    // NULL posted_date = treat as recent (job was just uploaded without date)
    const filteredMatches = (matches || []).filter((match: any) => {
      const job = match.scraped_jobs;
      if (!job) return false;
      // If posted_date is NULL, treat as recent (within 30 days)
      if (!job.posted_date) return true;
      // Check if within 30 days
      return job.posted_date >= thirtyDaysAgoStr;
    }).slice(0, 20); // Limit to top 20 for AI ranking

    // LEDGER RULE: If no jobs exist in the ledger, return appropriate message
    // AI NEVER says "no matching jobs" - instead, explain the system is working
    if (matchesError || !filteredMatches || filteredMatches.length === 0) {
      return {
        jobs: [],
        guidance: {
          summary: "I'm actively sourcing and reviewing roles for you. New matches will appear here shortly.",
          nextSteps: [
            'Your profile is being continuously matched against new job postings',
            'Recruiters are actively reviewing opportunities for your profile',
            'Check back soon for new qualified matches'
          ],
        },
      };
    }

    // Transform to MatchedJob format
    // NO additional filtering - trust the ledger query
    const matchedJobs: MatchedJob[] = filteredMatches.map((match: any) => {
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
        match_source: match.match_source || 'global_match',
        reasons: match.reasons || [],
      };
    });

    // Update last_ranked_at for these jobs
    const jobIds = matchedJobs.map(j => j.id);
    if (jobIds.length > 0) {
      await supabase
        .from('candidate_job_matches')
        .update({ last_ranked_at: new Date().toISOString() })
        .eq('candidate_id', candidateId)
        .in('job_id', jobIds);
    }

    // Prepare candidate data for AI with structured skills
    const candidateData = {
      name: candidate.name,
      title: candidate.title,
      location: candidate.location,
      experience: candidate.experience_years || 0,
      skills: candidate.skills || [],
      // STRUCTURED SKILLS - Critical for matching accuracy
      primarySkills: candidate.primary_skills || [],
      secondarySkills: candidate.secondary_skills || [],
      adjacentSkills: candidate.adjacent_skills || [],
      genericSkills: candidate.generic_skills || [],
      preferredJobTypes: candidate.preferred_job_types || [],
      contractType: candidate.contract_type || [],
      workMode: candidate.work_mode || [],
      visaStatus: candidate.visa_status,
      rateExpectation: candidate.rate_expectation,
      expectedPayMin: candidate.expected_pay_min,
      availability: candidate.availability,
      summary: candidate.summary,
      resumeText: candidate.resume_text ? candidate.resume_text.substring(0, 3000) : undefined,
      degrees: candidate.degrees || [],
      certifications: candidate.certifications || [],
    };

    // Prepare jobs data for AI
    // Include match_source so AI knows which jobs are recruiter-targeted
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
      matchSource: job.match_source, // 'explicit_target' or 'global_match'
      isRecruiterTargeted: job.match_source === 'explicit_target',
    }));

    // Count explicit targets for AI context
    const explicitTargetCount = jobsData.filter(j => j.isRecruiterTargeted).length;

    // Call OpenAI Responses API with prompt version 4
    try {
      const response = await openai.responses.create({
        prompt: {
          id: PROMPT_ID,
          version: PROMPT_VERSION,
        },
        input: {
          candidate: candidateData,
          jobs: jobsData,
          context: {
            jobCount: jobsData.length,
            explicitTargets: explicitTargetCount,
            primarySkills: candidateData.primarySkills,
            isLedgerBased: true,
            rules: [
              'Jobs are from qualified ledger - do not discard',
              'Primary platform alignment is most important',
              'Cross-platform mismatches = Medium or Low priority',
              'Recruiter-targeted jobs must never be discarded',
              'Candidate skills are signals, validate against resume',
            ],
          },
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

      // Update AI priority in the ledger for ranked jobs
      for (const rankedJob of rankedJobs) {
        await supabase
          .from('candidate_job_matches')
          .update({ 
            ai_priority: rankedJob.priority,
            last_ranked_at: new Date().toISOString(),
          })
          .eq('candidate_id', candidateId)
          .eq('job_id', rankedJob.id);
      }

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

