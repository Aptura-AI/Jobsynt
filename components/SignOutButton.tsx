// app/components/SignOutButton.tsx
'use client';

import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    } else {
      router.push('/signin');
    }
  };

  return (
    <button onClick={handleSignOut}>
      Sign Out
    </button>
  );
}
