import ProfileForm from '@/components/ProfileForm';
import AIMentorUpload from '@/components/AIMentorUpload';

export default function CandidateBuilderPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">Candidate Profile</p>
        <h1 className="text-3xl font-bold text-ink">Build your Jobsynt profile</h1>
        <p className="text-muted">Add your skills, experience, and upload a resume for quick matching.</p>
      </div>

      {/* AI Mentor Section */}
      <div className="mb-10">
        <AIMentorUpload />
      </div>

      {/* Profile Form Section */}
      <div className="mb-6 space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.1em] text-primary">Or Build Manually</p>
        <h2 className="text-2xl font-bold text-ink">Complete Your Profile</h2>
      </div>
      <ProfileForm />
    </div>
  );
}

