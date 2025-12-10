const features = [
  {
    title: 'Niche ERP & Cloud focus',
    desc: 'We curate talent specifically for ERP systems, cloud platforms, and IT roles.',
  },
  {
    title: 'AI-assisted matching',
    desc: 'Structured data and filters surface the best fits in minutes.',
  },
  {
    title: 'Fast, transparent workflows',
    desc: 'Clear status, notes, and resume links streamline recruiter decisions.',
  },
  {
    title: 'Secure role-based access',
    desc: 'Admin-only dashboard with protected routes and hashed credentials.',
  },
];

export default function FeatureList() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-bold text-ink">Why teams choose Jobsynt</h2>
          <p className="mt-2 text-muted">Built for ERP, cloud, and IT delivery teams who need vetted specialists quickly.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div key={feature.title} className="card p-6">
              <h3 className="text-lg font-semibold text-ink">{feature.title}</h3>
              <p className="mt-2 text-muted">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

