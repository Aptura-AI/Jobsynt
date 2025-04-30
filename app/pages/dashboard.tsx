// Example: app/pages/dashboard.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const session = supabase.auth.getSession();
    if (!session) {
      router.push('/signin');
    }
  }, []);

  return <div>Dashboard Content</div>;
}
