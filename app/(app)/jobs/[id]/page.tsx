import { notFound, redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import ApplyButton from './ApplyButton';
import { hasCandidateAccessServer } from '@/lib/utils/accessCheck';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience?: string;
  skills: string[];
  workMode: string;
  locationType?: string | null;
  jobType?: string | null;
  rate?: string | null;
  summary?: string;
  requirements?: string[];
  url?: string | null;
};

async function getJob(id: string): Promise<Job | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase
      .from('scraped_jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      title: data.title,
      company: data.company,
      location: data.location,
      experience: data.experience || undefined,
      skills: Array.isArray(data.skills) ? data.skills : (data.skills ? [data.skills] : []),
      workMode: data.work_location_type || data.work_mode || 'Remote',
      locationType: data.work_location_type || data.location_type || null,
      jobType: data.job_type || null,
      rate: data.salary || data.rate || null,
      summary: data.description || data.summary || '',
      requirements: data.description ? [data.description] : [],
      url: data.url || null,
    };
  } catch (error) {
    console.error('Error fetching job:', error);
    return null;
  }
}

export default async function JobDetails({ params }: { params: { id: string } }) {
  const job = await getJob(params.id);
  if (!job) return notFound();
  
  const session = await getServerSession();
  const isLoggedIn = !!session?.user?.email;
  
  // If user is logged in, check access
  if (isLoggedIn) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', session.user.email)
        .maybeSingle();
      
      if (profile) {
        const hasAccess = await hasCandidateAccessServer(profile.id, supabase);
        if (!hasAccess) {
          // Redirect to pricing with job_id in query
          redirect(`/pricing?source=job_click&job_id=${params.id}`);
        }
      }
    }
  }

  // Format job type for display
  const formatJobType = (type: string | null | undefined) => {
    if (!type) return null;
    const types: Record<string, string> = {
      'full-time': 'Full-time',
      'w2-contract': 'W2 Contract',
      'c2c': 'C2C',
      '1099': '1099',
    };
    return types[type] || type;
  };

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="card p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-ink mb-4">{job.title}</h1>
            <p className="text-muted mb-6">Please log in or sign up to view full job details and apply.</p>
            <div className="flex gap-4 justify-center">
              <a
                href={`/login?next=/jobs/${job.id}`}
                className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold"
              >
                Login
              </a>
              <a
                href={`/signup?next=/jobs/${job.id}`}
                className="px-6 py-3 bg-slate-200 text-ink rounded-lg hover:bg-slate-300 font-semibold"
              >
                Sign Up
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="card p-6">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-ink">{job.title}</h1>
            <p className="text-sm text-muted mt-2">
              <strong>Company:</strong> {job.company} • <strong>Location:</strong> {job.location}
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {job.jobType && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
                  {formatJobType(job.jobType)}
                </span>
              )}
              {job.locationType && (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  {job.locationType}
                </span>
              )}
              {job.experience && (
                <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                  {job.experience} yrs
                </span>
              )}
            </div>
          </div>
        </div>
        
        {job.rate && (
          <p className="mt-4 text-lg font-semibold text-ink">Rate: {job.rate}</p>
        )}
        
        {job.summary && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-ink mb-2">Description</h3>
            <p className="text-muted whitespace-pre-wrap">{job.summary}</p>
          </div>
        )}
        
        {job.skills && job.skills.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-ink mb-2">Skills Required</h3>
            <div className="flex flex-wrap gap-2">
              {job.skills.map((skill) => (
                <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-ink">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {job.requirements && job.requirements.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-ink mb-2">Requirements</h3>
            <ul className="list-disc space-y-2 pl-4 text-muted">
              {job.requirements.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="mt-8 flex items-center gap-4">
          {job.url && (
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-semibold"
            >
              Apply on Company Site →
            </a>
          )}
          <ApplyButton jobId={job.id} isLoggedIn={isLoggedIn} />
        </div>
      </div>
    </div>
  );
}

