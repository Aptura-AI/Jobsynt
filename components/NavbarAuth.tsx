'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Session = { user?: { name?: string; email?: string; role?: string } } | null;

/**
 * NavbarAuth - Client component that uses useSession
 * Runtime-only: dynamically import next-auth after mount.
 * No module-scope references to next-auth/react; no dynamic() or Suspense.
 */
export default function NavbarAuth() {
  const [mounted, setMounted] = useState(false);
  const [session, setSession] = useState<Session>(null);
  const [signOutFn, setSignOutFn] = useState<((opts?: { callbackUrl?: string }) => Promise<void>) | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setMounted(true);
    let active = true;
    import('next-auth/react')
      .then(async (mod) => {
        if (!active) return;
        setSignOutFn(() => mod.signOut);
        try {
          const s = await mod.getSession();
          if (active) setSession(s as Session);
        } finally {
          if (active) setLoaded(true);
        }
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  // Strict guard: do not render anything until mounted and auth API loaded
  if (!mounted || !loaded) {
    return null;
  }

  const isAdmin = session?.user?.role === 'admin';

  if (!session) {
    return (
      <>
        <Link href="/login" className="hover:text-primary">
          Login
        </Link>
        <Link href="/signup" className="rounded-md bg-primary px-3 py-1 text-white hover:bg-blue-700">
          Sign up
        </Link>
      </>
    );
  }

  return (
    <>
      {isAdmin && (
        <Link href="/dashboard" className="hover:text-primary">
          Dashboard
        </Link>
      )}
      <span className="text-muted">Hi, {session.user?.name || session.user?.email}</span>
      <button
        onClick={() => signOutFn?.({ callbackUrl: '/' })}
        className="text-sm text-muted hover:text-primary"
      >
        Sign out
      </button>
    </>
  );
}
