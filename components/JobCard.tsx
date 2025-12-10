import Link from 'next/link';

export type Job = {
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

export default function JobCard({ job }: { job: Job }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-ink">{job.title}</h3>
          <p className="text-sm text-muted">
            {job.company} • {job.location} • {job.workMode}
          </p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">{job.experience} yrs</span>
      </div>
      {job.summary && <p className="mt-3 text-sm text-muted">{job.summary}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {job.skills.map((skill) => (
          <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-ink">
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between">
        {job.rate && <span className="text-sm font-semibold text-ink">{job.rate}</span>}
        <Link 
          href={`/jobs/${job.id}` as string}
          className="text-sm font-semibold text-primary hover:underline"
        >
          View Job →
        </Link>
      </div>
    </div>
  );
}

