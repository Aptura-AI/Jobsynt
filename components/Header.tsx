'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/signin');
  };

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white shadow-md">
      <Link href="/" className="text-xl font-bold text-gray-800">
        Jobsynt
      </Link>
      <nav className="flex items-center gap-4">
        <Link href="/jobs" className="text-gray-700 hover:text-blue-600">
          Jobs
        </Link>
        {user ? (
          <>
            <Link href="/dashboard" className="text-gray-700 hover:text-blue-600">
              Dashboard
            </Link>
            <button onClick={handleSignOut} className="text-red-600 hover:underline">
              Sign Out
            </button>
          </>
        ) : (
          <>
            <Link href="/signin" className="text-gray-700 hover:text-blue-600">
              Sign In
            </Link>
            <Link href="/signup" className="text-gray-700 hover:text-blue-600">
              Sign Up
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
