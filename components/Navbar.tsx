import Link from 'next/link';
import { getAuthTokenFromCookies, verifyToken } from '@/utils/auth';

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/talent-pool', label: 'Talent Pool' },
  { href: '/candidates', label: 'For Candidates' },
];

export default function Navbar() {
  const token = getAuthTokenFromCookies();
  const session = token ? verifyToken(token) : null;
  const isAdmin = session?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold text-primary">
          Jobsynt
        </Link>
        <nav className="flex items-center gap-6 text-sm font-semibold text-ink">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-primary">
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link href="/dashboard" className="hover:text-primary">
              Dashboard
            </Link>
          )}
          {!session && (
            <Link href="/login" className="hover:text-primary">
              Login
            </Link>
          )}
          {!session && (
            <Link href="/signup" className="rounded-md bg-primary px-3 py-1 text-white hover:bg-blue-700">
              Sign up
            </Link>
          )}
          {session && <span className="text-muted">Hi, {session.email}</span>}
        </nav>
      </div>
    </header>
  );
}

