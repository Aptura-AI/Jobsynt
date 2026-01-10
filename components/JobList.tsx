import JobCard, { Job } from './JobCard';

type JobListProps = {
  jobs: Job[];
  selectedJobs?: Set<string>;
  onToggleSelection?: (jobId: string) => void;
  showCheckbox?: boolean;
};

export default function JobList({ jobs, selectedJobs, onToggleSelection, showCheckbox }: JobListProps) {
  if (jobs.length === 0) {
    return <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-muted">No jobs match your filters.</div>;
  }
  return (
    <div className="grid gap-4">
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  );
}

