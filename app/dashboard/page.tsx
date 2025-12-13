import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import DashboardContent from './DashboardContent';
import ProfileSetupWrapper from './ProfileSetupWrapper';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

async function getUserProfile(email: string) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching profile:', error);
  }

  return profile;
}

export default async function DashboardPage() {
  const session = await getServerSession();
  
  if (!session?.user?.email) {
    redirect('/login');
  }

  const profile = await getUserProfile(session.user.email);
  const isAdmin = session.user.role === 'admin';

  // If user has no profile, show profile setup form
  if (!profile) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <ProfileSetupWrapper 
          userEmail={session.user.email} 
          userName={session.user.name || ''} 
        />
      </div>
    );
  }

  // Show dashboard based on role
  return (
    <DashboardContent 
      profile={profile} 
      isAdmin={isAdmin} 
      userEmail={session.user.email}
    />
  );
}
