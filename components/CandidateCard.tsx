export type Candidate = {
  id: string;
  name: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  summary?: string;
  status?: string;
  resumeUrl?: string;
};

export default function CandidateCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-ink">{candidate.name}</h3>
          <p className="text-sm text-muted">
            {candidate.title} • {candidate.location}
          </p>
        </div>
        <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">{candidate.experience} yrs</span>
      </div>
      {candidate.summary && <p className="mt-3 text-sm text-muted">{candidate.summary}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {candidate.skills.map((skill) => (
          <span key={skill} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-ink">
            {skill}
          </span>
        ))}
      </div>
      {candidate.status && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">{candidate.status}</p>}
      {candidate.resumeUrl && (
        <a href={candidate.resumeUrl} className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
          View Profile
        </a>
      )}
    </div>
  );
}

