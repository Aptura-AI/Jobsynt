'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import JobCard from '@/components/JobCard';
import AIMentorUpload from '@/components/AIMentorUpload';

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
};

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  skills: string[];
  workMode: string;
  rate?: string;
  summary?: string;
};

type DashboardContentProps = {
  profile: Profile;
  isAdmin: boolean;
  userEmail: string;
};

export default function DashboardContent({ profile, isAdmin, userEmail }: DashboardContentProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matchedJobs, setMatchedJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch jobs
      const jobsRes = await fetch('/api/jobs');
      const jobsData = await jobsRes.json();
      setJobs(jobsData || []);

      // Fetch matched jobs for the user
      const matchedRes = await fetch('/api/matched-jobs');
      if (matchedRes.ok) {
        const matchedData = await matchedRes.json();
        setMatchedJobs(matchedData.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-slate-200"></div>
          <div className="h-4 w-1/2 rounded bg-slate-200"></div>
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
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      {/* Welcome Section */}
      <div className="mb-2 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">
          {isAdmin ? 'Admin Dashboard' : 'Your Dashboard'}
        </p>
        <h1 className="text-3xl font-bold text-ink">Welcome back, {profile.name}!</h1>
        <p className="text-muted">
          {isAdmin
            ? 'Manage candidates, review applications, and oversee job listings.'
            : `Track your job applications, view matched opportunities, and manage your profile.`}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card p-4">
          <p className="text-sm text-muted">Profile Status</p>
          <p className="text-2xl font-bold text-green-600">Complete</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Skills Listed</p>
          <p className="text-2xl font-bold text-ink">{profile.skills?.length || 0}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Matched Jobs</p>
          <p className="text-2xl font-bold text-ink">{matchedJobs.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-muted">Available Jobs</p>
          <p className="text-2xl font-bold text-ink">{jobs.length}</p>
        </div>
      </div>

      {/* Profile Summary */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-ink">{profile.name}</h2>
            <p className="text-muted">{profile.title}</p>
          </div>
          <Link
            href="/profile/edit"
            className="text-sm font-semibold text-primary hover:underline"
          >
            Edit Profile
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted">Location</p>
            <p className="font-semibold text-ink">{profile.location || 'Not specified'}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Experience</p>
            <p className="font-semibold text-ink">{profile.experience_years} years</p>
          </div>
          <div>
            <p className="text-xs text-muted">Preferred Job Type</p>
            <p className="font-semibold text-ink capitalize">{profile.preferred_job_type}</p>
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

      {/* Job Recommendations */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-ink">Recommended Jobs</h2>
          <Link href="/jobs" className="text-sm font-semibold text-primary hover:underline">
            View All Jobs →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {jobs.slice(0, 6).map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
          {jobs.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-muted">
              No jobs available at the moment. Check back later!
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-3">
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
        <Link
          href="/talent-pool"
          className="card p-4 hover:shadow-md transition-shadow text-center"
        >
          <div className="text-2xl mb-2">👥</div>
          <p className="font-semibold text-ink">Talent Pool</p>
          <p className="text-sm text-muted">Explore other professionals</p>
        </Link>
      </div>
    </div>
  );
}

