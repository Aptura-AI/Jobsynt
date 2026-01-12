import Link from 'next/link';
import Button from '@/components/Button';

export default function HomePage() {
  // C2C/1099 Niche Platform - Candidate-First
  return (
    <>
      {/* For Candidates - Main Focus */}
      <section className="bg-gradient-to-br from-primary/5 via-white to-blue-50">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary mb-6">
              C2C & 1099 Contractors Only
            </div>
            <h1 className="text-4xl font-bold leading-tight text-ink sm:text-5xl lg:text-6xl mb-6">
              Your Personal AI Job Agent for C2C & 1099 Contracts
            </h1>
            <p className="text-lg sm:text-xl text-muted mb-8 max-w-2xl mx-auto">
              We find real, high-paying corp-to-corp and 1099 opportunities tailored to your skills. Our mission: Get you placed within 90 days.
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              <Link href="/signup">
                <Button className="px-8 py-3 text-lg">Create Your Profile</Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost" className="px-8 py-3 text-lg">Sign In</Button>
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl mx-auto">
              <div className="card p-4 text-center">
                <div className="text-2xl mb-2">🤖</div>
                <p className="text-sm font-semibold text-ink">AI-Powered Matching</p>
                <p className="text-xs text-muted mt-1">Verified contract roles</p>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl mb-2">👤</div>
                <p className="text-sm font-semibold text-ink">Personal Agent</p>
                <p className="text-xs text-muted mt-1">Finds hidden opportunities</p>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl mb-2">✅</div>
                <p className="text-sm font-semibold text-ink">No Ghost Jobs</p>
                <p className="text-xs text-muted mt-1">Only real C2C/1099 positions</p>
              </div>
              <div className="card p-4 text-center">
                <div className="text-2xl mb-2">💰</div>
                <p className="text-sm font-semibold text-ink">7-Day Free Trial</p>
                <p className="text-xs text-muted mt-1">Then $99/month</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Divider */}
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>

      {/* For Companies/Recruiters - Secondary Section */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 lg:py-20">
          <div className="mx-auto max-w-3xl">
            <div className="text-center mb-8">
              <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-4">
                Access Pre-Vetted C2C & 1099 IT Contractors
              </h2>
              <p className="text-lg text-muted max-w-2xl mx-auto">
                Post your corp-to-corp and 1099 contract roles to our specialized talent pool of experienced consultants.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-3 mb-8">
              <div className="card p-6 text-center">
                <div className="text-3xl mb-3">🇺🇸</div>
                <h3 className="font-semibold text-ink mb-2">US-Based Consultants</h3>
                <p className="text-sm text-muted">Ready for contract work</p>
              </div>
              <div className="card p-6 text-center">
                <div className="text-3xl mb-3">🆓</div>
                <h3 className="font-semibold text-ink mb-2">Free Job Posting</h3>
                <p className="text-sm text-muted">No cost to post</p>
              </div>
              <div className="card p-6 text-center">
                <div className="text-3xl mb-3">🔍</div>
                <h3 className="font-semibold text-ink mb-2">Verified Profiles</h3>
                <p className="text-sm text-muted">Direct access to talent</p>
              </div>
            </div>
            <div className="text-center">
              <Link href="/company/register">
                <Button className="px-8 py-3 text-lg">Post a Job for Free</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="bg-slate-50 border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <div className="text-center">
            <p className="text-sm font-semibold text-muted mb-4">Trusted by C2C & 1099 Contractors</p>
            <div className="flex flex-wrap justify-center gap-6 text-xs text-muted">
              <span className="flex items-center gap-2">
                <span className="text-green-600">✓</span> AI-Powered Matching
              </span>
              <span className="flex items-center gap-2">
                <span className="text-green-600">✓</span> Real Opportunities Only
              </span>
              <span className="flex items-center gap-2">
                <span className="text-green-600">✓</span> 90-Day Placement Goal
              </span>
              <span className="flex items-center gap-2">
                <span className="text-green-600">✓</span> No Ghost Jobs
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
