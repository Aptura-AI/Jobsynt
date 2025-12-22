import { readJSON } from '@/utils/fs';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';
import { notFound, redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import ApplyButton from './ApplyButton';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  skills: string[];
  workMode: string;
  rate?: string;
  responsibilities?: string[];
  requirements?: string[];
  summary?: string;
};

async function getJob(id: string): Promise<Job | undefined> {
  const jobs = await readJSON<Job[]>('jobs.json');
  return jobs.find((j) => j.id === id);
}

import { hasCandidateAccessServer } from '@/lib/utils/accessCheck';

export default async function JobDetails({ params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) return notFound();
  
  const session = await getServerSession();
  
  // If user is logged in, check access
  if (session?.user?.email) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();
      
      if (profile) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const hasAccess = await hasCandidateAccessServer(profile.id, supabase);
        if (!hasAccess) {
          // Redirect to pricing with job_id in query
          redirect(`/pricing?source=job_click&job_id=${params.id}`);
        }
      }
    }
  } else {
    // Not logged in - redirect to pricing
    redirect(`/pricing?source=job_click&job_id=${params.id}`);
  }
  
  const token = getAuthTokenFromCookies();
  const sessionToken = token ? verifyToken(token) : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-3xl font-bold text-ink">{job.title}</h1>
            <p className="text-sm text-muted">
              {job.company} • {job.location} • {job.workMode}
            </p>
          </div>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">{job.experience} yrs</span>
        </div>
        {job.rate && <p className="mt-2 text-sm font-semibold text-ink">Rate: {job.rate}</p>}
        {job.summary && <p className="mt-3 text-muted">{job.summary}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {job.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-ink">
              {skill}
            </span>
          ))}
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold text-ink">Responsibilities</h3>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-muted">
              {job.responsibilities?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink">Requirements</h3>
            <ul className="mt-2 list-disc space-y-2 pl-4 text-muted">
              {job.requirements?.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-8">
          <ApplyButton jobId={job.id} isLoggedIn={Boolean(sessionToken)} />
        </div>
      </div>
    </div>
  );
}

