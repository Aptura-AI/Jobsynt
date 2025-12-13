'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

export default function NavbarAuth() {
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.role === 'admin';

  if (status === 'loading') {
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
      <span className="text-muted">Hi, {session.user.name || session.user.email}</span>
      <button
        onClick={() => signOut({ callbackUrl: '/' })}
        className="text-sm text-muted hover:text-primary"
      >
        Sign out
      </button>
    </>
  );
}


