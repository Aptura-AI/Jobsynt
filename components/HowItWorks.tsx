const steps = [
  {
    title: 'Post roles & needs',
    desc: 'Share skill, experience, and work-mode requirements for Oracle/Cloud roles.',
  },
  {
    title: 'Candidates build profiles',
    desc: 'Structured profile builder with resume upload and taggable skills.',
  },
  {
    title: 'Filter & shortlist fast',
    desc: 'Search by skills, location, experience, and work mode across jobs and talent.',
  },
  {
    title: 'Manage internally',
    desc: 'Admin dashboard to mark status, add notes, and export resumes.',
  },
];

export default function HowItWorks() {
  return (
    <section className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-ink">How JobSynth works</h2>
          <p className="mt-2 text-muted">Simple steps to move from req to shortlist.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-4">
          {steps.map((step, idx) => (
            <div key={step.title} className="card p-5">
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-primary">
                {idx + 1}
              </div>
              <h3 className="text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-muted">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

