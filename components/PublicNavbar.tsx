import Link from 'next/link';

/**
 * Public Navbar - Server component for public pages
 * Does NOT use NavbarAuth (which requires SessionProvider)
 * Used by public pages that need navigation but not auth context
 */
export default function PublicNavbar() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-primary">
          Jobsynt
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold text-ink">
          <Link href="/" className="hover:text-primary">Home</Link>
          <Link href="/jobs" className="hover:text-primary">Jobs</Link>
          <Link href="/talent-pool" className="hover:text-primary">Talent Pool</Link>
          <Link href="/dashboard" className="hover:text-primary">For Candidates</Link>
          <Link href="/login" className="hover:text-primary">Login</Link>
          <Link href="/signup" className="rounded-md bg-primary px-3 py-1 text-white hover:bg-blue-700">Sign up</Link>
        </nav>
      </div>
    </header>
  );
}

