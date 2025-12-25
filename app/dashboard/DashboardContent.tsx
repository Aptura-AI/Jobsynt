'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import JobCard from '@/components/JobCard';
import AIMentorUpload from '@/components/AIMentorUpload';
import { getPricingUrl, hasCandidateAccess as checkAccess } from '@/lib/utils/accessCheck';

type Profile = {
  id: string;
  name: string;
  email: string;
  title: string;
  location: string;
  experience_years: number;
  skills: string[];
  preferred_job_type: string;
  summary: string;
  resume_url?: string;
  contract_type?: string[];
  work_mode?: string[];
  trial_ends_at?: string | null;
  is_paid?: boolean | null;
  paid_at?: string | null;
};

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience?: string;
  skills?: string[];
  workMode?: string;
  rate?: string;
  summary?: string;
  fit_score?: number;
  match_reasons?: string[];
};

type DashboardContentProps = {
  profile: Profile;
  isAdmin: boolean;
  userEmail: string;
};

/**
 * Check if candidate has access (active trial or paid)
 * Uses centralized hasCandidateAccess() - no duplicated logic
 */
function hasCandidateAccess(profile: Profile, isAdmin: boolean): boolean {
  // Admin always has access
  if (isAdmin) {
    return true;
  }

  // Use centralized access check
  return checkAccess(profile);
}

/**
 * Calculate days remaining in trial
 */
function getTrialDaysRemaining(trialEndsAt: string | null | undefined): number | null {
  if (!trialEndsAt) return null;
  
  const trialEnd = new Date(trialEndsAt);
  const now = new Date();
  const diffTime = trialEnd.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 0 ? diffDays : null;
}

export default function DashboardContent({ profile, isAdmin, userEmail }: DashboardContentProps) {
  const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
  const [allRecommendedJobs, setAllRecommendedJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllJobs, setShowAllJobs] = useState(false);

  // Check access status
  const hasAccess = hasCandidateAccess(profile, isAdmin);
  const trialDaysRemaining = getTrialDaysRemaining(profile.trial_ends_at);
  const isTrialActive = profile.trial_ends_at && trialDaysRemaining !== null && trialDaysRemaining > 0;

  useEffect(() => {
    fetchRecommendedJobs();
  }, []);

  const fetchRecommendedJobs = async () => {
    try {
      console.log('[Dashboard] Fetching recommended jobs...');
      const res = await fetch('/api/match-jobs');
      console.log('[Dashboard] API response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[Dashboard] Jobs received:', data.jobs?.length || 0, 'jobs');
        console.log('[Dashboard] Full response:', data);
        const jobs = data.jobs || [];
        setAllRecommendedJobs(jobs);
        // Show only first 5 jobs initially
        setRecommendedJobs(jobs.slice(0, 5));
        setShowAllJobs(false);
      } else {
        console.error('[Dashboard] API error:', res.status, res.statusText);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching recommended jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFindNewJobs = async () => {
    setLoading(true);
    try {
      // Trigger matching
      const matchRes = await fetch('/api/match-jobs', {
        method: 'POST',
      });
      
      if (matchRes.ok) {
        const matchData = await matchRes.json();
        // Refresh the job list
        await fetchRecommendedJobs();
        
        // API returns newJobsQualified (new jobs added) and alreadyQualified (existing in ledger)
        const newJobs = matchData.newJobsQualified || 0;
        const existingJobs = matchData.alreadyQualified || 0;
        
        if (newJobs === 0 && existingJobs === 0) {
          alert('No matching jobs found. Try updating your profile or check back later.');
        } else if (newJobs === 0) {
          alert(`You have ${existingJobs} jobs in your feed. No new matches found right now.`);
        } else {
          alert(`Found ${newJobs} new matching jobs! (${existingJobs} already in your feed)`);
        }
      } else {
        const errorData = await matchRes.json().catch(() => ({}));
        alert(errorData.error || 'Error finding new jobs. Please try again.');
      }
    } catch (error) {
      console.error('Error finding new jobs:', error);
      alert('Error finding new jobs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-slate-200"></div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-lg bg-slate-200"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Welcome Section */}
      <div className="mb-2 space-y-2">
        <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.1em] text-primary">
          {isAdmin ? 'Admin Dashboard' : 'Your Dashboard'}
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">Welcome back, {profile.name}!</h1>
        <p className="text-sm sm:text-base text-muted">
          {isAdmin
            ? 'Manage candidates, review applications, and oversee job listings.'
            : `Track your job applications, view matched opportunities, and manage your profile.`}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-4">
        <div className="card p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">Profile Status</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">Complete</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">Skills Listed</p>
          <p className="text-xl sm:text-2xl font-bold text-ink">{profile.skills?.length || 0}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">Recommended Jobs</p>
          <p className="text-xl sm:text-2xl font-bold text-ink">{allRecommendedJobs.length}</p>
        </div>
        <div className="card p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-muted">Match Score</p>
          <p className="text-xl sm:text-2xl font-bold text-ink">
            {allRecommendedJobs.length > 0 
              ? `${Math.round(allRecommendedJobs.reduce((sum, j) => sum + (j.fit_score || 0), 0) / allRecommendedJobs.length)}%`
              : 'N/A'}
          </p>
        </div>
      </div>

      {/* Profile Summary */}
      <div className="card p-4 sm:p-6">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-ink">{profile.name}</h2>
          <p className="text-sm sm:text-base text-muted">{profile.title}</p>
        </div>
        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Location</p>
            <p className="font-semibold text-ink">{profile.location || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Experience</p>
            <p className="font-semibold text-ink">{profile.experience_years} years</p>
          </div>
          <div>
            <p className="text-xs text-muted">Work Mode</p>
            <p className="font-semibold text-ink capitalize">
              {profile.work_mode?.join(', ') || profile.preferred_job_type || 'Any'}
            </p>
          </div>
        </div>
        {profile.skills && profile.skills.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted mb-2">Skills</p>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, index) => (
                <span
                  key={index}
                  className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
        {profile.resume_url && (
          <div className="mt-4">
            <a
              href={profile.resume_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-primary hover:underline"
            >
              View Resume →
            </a>
          </div>
        )}
      </div>

      {/* AI Career Mentor */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-ink">AI Career Mentor</h2>
        <AIMentorUpload />
      </div>

      {/* Trial Banner */}
      {!isAdmin && isTrialActive && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
          <p className="text-blue-800 text-sm font-medium">
            Free trial ends in {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'}
          </p>
        </div>
      )}

      {/* Recommended Jobs */}
      <div className="space-y-4 relative">
        {!hasAccess && !isAdmin && (
          <>
            {/* Blur overlay */}
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 rounded-lg" />
            {/* CTA overlay */}
            <div className="absolute inset-0 flex items-center justify-center z-20">
              <div className="text-center bg-white rounded-lg border border-gray-200 p-6 shadow-lg max-w-md mx-4">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Unlock Full Access</h3>
                <p className="text-gray-600 mb-4">Start your free trial or unlock full access to view job details</p>
                <Link
                  href="/pricing"
                  className="inline-block bg-primary text-white font-semibold px-6 py-3 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  Start your free trial or unlock full access
                </Link>
              </div>
            </div>
          </>
        )}
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-bold text-ink">Your Matched Jobs</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleFindNewJobs}
              disabled={loading || (!hasAccess && !isAdmin)}
              className="text-sm font-semibold text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
            >
              🔄 Find New Matching Jobs
            </button>
            <Link 
              href="/jobs" 
              className={`text-sm font-semibold text-primary hover:underline ${!hasAccess && !isAdmin ? 'pointer-events-none opacity-50' : ''}`}
            >
              View All Jobs →
            </Link>
          </div>
        </div>
        {allRecommendedJobs.length > 0 ? (
          <>
            <div className={`grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${!hasAccess && !isAdmin ? 'blur-sm pointer-events-none' : ''}`}>
              {(showAllJobs ? allRecommendedJobs : recommendedJobs).map((job: any) => (
              <div key={job.id} className="card p-4">
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-ink">{job.title}</h3>
                    <p className="text-sm text-muted">{job.company} • {job.location || 'Location not specified'}</p>
                    {job.job_type && (
                      <p className="text-xs text-muted mt-1">Type: {job.job_type}</p>
                    )}
                  </div>
                  {job.fit_score && (
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                      {job.fit_score}% match
                    </span>
                  )}
                </div>
                {(job.salary || job.pay_rate_min) && (
                  <p className="text-sm font-semibold text-ink">
                    {job.salary || `$${job.pay_rate_min}${job.pay_rate_max ? ` - $${job.pay_rate_max}` : ''}/hr`}
                  </p>
                )}
                {job.description && <p className="mt-2 text-xs text-muted line-clamp-2">{job.description}</p>}
                {job.match_reasons && job.match_reasons.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold text-ink">Why it matches:</p>
                    <ul className="ml-4 list-disc text-xs text-muted">
                      {job.match_reasons.slice(0, 2).map((reason: string, idx: number) => (
                        <li key={idx}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between gap-2">
                  <Link
                    href={hasAccess || isAdmin ? `/jobs/${job.id}` : getPricingUrl(job.id)}
                    onClick={(e) => {
                      if (!hasAccess && !isAdmin) {
                        e.preventDefault();
                        window.location.href = getPricingUrl(job.id);
                      }
                    }}
                    className="text-sm font-semibold text-primary hover:underline flex-1"
                  >
                    View Job →
                  </Link>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={job.applied || false}
                      onChange={async (e) => {
                        try {
                          const res = await fetch('/api/job-applications', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ job_id: job.id, applied: e.target.checked }),
                          });
                          if (res.ok) {
                            fetchRecommendedJobs();
                          }
                        } catch (error) {
                          console.error('Error updating application:', error);
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-muted">I have applied</span>
                  </label>
                </div>
              </div>
              ))}
            </div>
            {allRecommendedJobs.length > 5 && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setShowAllJobs(!showAllJobs)}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 text-sm font-semibold"
                >
                  {showAllJobs 
                    ? `Show Less (Showing ${allRecommendedJobs.length} jobs)` 
                    : `Show ${allRecommendedJobs.length - 5} More Jobs`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
            <div className="text-4xl mb-3">🔍</div>
            <p className="text-lg font-semibold text-ink mb-2">No matched jobs yet</p>
            <p className="text-sm text-muted mb-4">
              Our AI is actively sourcing and reviewing roles for you.<br />
              New matches will appear here as they are qualified.
            </p>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={handleFindNewJobs}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 text-sm font-semibold"
              >
                {loading ? 'Searching...' : '🔄 Search for Jobs Now'}
              </button>
              <p className="text-xs text-muted mt-2">
                💡 Tip: Make sure your profile has skills and job preferences set.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/jobs"
          className="card p-4 hover:shadow-md transition-shadow text-center"
        >
          <div className="text-2xl mb-2">🔍</div>
          <p className="font-semibold text-ink">Browse Jobs</p>
          <p className="text-sm text-muted">Find your next opportunity</p>
        </Link>
        <Link
          href="/candidates"
          className="card p-4 hover:shadow-md transition-shadow text-center"
        >
          <div className="text-2xl mb-2">📝</div>
          <p className="font-semibold text-ink">Update Profile</p>
          <p className="text-sm text-muted">Keep your info current</p>
        </Link>
      </div>
    </div>
  );
}
