import Link from 'next/link';
import NavbarAuth from './NavbarAuth';

type NavItem = {
  label: string;
  href: string;
};

const navItems: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/talent-pool', label: 'Talent Pool' },
  { href: '/dashboard', label: 'For Candidates' },
];

export default function Navbar() {
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
          <NavbarAuth />
        </nav>
      </div>
    </header>
  );
}

