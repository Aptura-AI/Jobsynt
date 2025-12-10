import Button from './Button';
import Link from 'next/link';

export default function Hero() {
  return (
    <section className="bg-gradient-to-br from-blue-50 via-white to-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-flex rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-primary">
            Oracle, Cloud & IT Talent
          </div>
          <h1 className="text-4xl font-bold leading-tight text-ink sm:text-5xl">
            Your AI-Powered Talent Marketplace for Oracle, Cloud & IT Professionals
          </h1>
          <p className="text-lg text-muted">
            Find vetted specialists or showcase your expertise. JobSynth connects enterprises with niche Oracle & cloud talent, faster.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/talent-pool">
              <Button>Find Talent</Button>
            </Link>
            <Link href="/candidates">
              <Button variant="ghost">Join as Candidate</Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-muted">
            <span className="flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm">✅ Vetted Oracle experts</span>
            <span className="flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm">🔒 Secure, role-based access</span>
            <span className="flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm">⚡ Fast matching</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-ink">Trusted by Oracle & Cloud teams</h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-muted">
              <div className="rounded-md bg-surface p-3 shadow-inner">
                <p className="font-semibold text-ink">Roles we fill</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Oracle Cloud ERP & HCM</li>
                  <li>OCI Architects</li>
                  <li>DBAs & Performance</li>
                </ul>
              </div>
              <div className="rounded-md bg-surface p-3 shadow-inner">
                <p className="font-semibold text-ink">Delivery</p>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  <li>Remote / Hybrid / Onsite</li>
                  <li>Contract & FTE</li>
                  <li>Rapid shortlisting</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

