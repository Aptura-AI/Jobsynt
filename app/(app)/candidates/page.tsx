import ProfileForm from '@/components/ProfileForm';

export const dynamic = 'force-dynamic';

export default function CandidateBuilderPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">Candidate Profile</p>
        <h1 className="text-3xl font-bold text-ink">Build your Jobsynt profile</h1>
        <p className="text-muted">Add your skills, experience, and upload a resume for quick matching.</p>
      </div>

      <ProfileForm />
    </div>
  );
}

