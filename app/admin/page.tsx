import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { decodeToken } from '@/utils/auth';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  // Get token from cookies (custom JWT, not NextAuth)
  const cookieStore = cookies();
  const rawToken = cookieStore.get('jobsynth_token')?.value;
  
  if (!rawToken) {
    redirect('/login');
  }

  const token = decodeToken(rawToken);
  
  if (!token || !token.email) {
    redirect('/login');
  }

  // Check if user is admin using role from token
  const isAdmin = token.role === 'admin';

  if (!isAdmin) {
    // Non-admin trying to access admin page - redirect to their dashboard
    redirect('/dashboard');
  }

  return <AdminDashboardClient />;
}

