import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import AdminDashboardClient from './AdminDashboardClient';

/**
 * Admin Page
 * 
 * Reads custom JWT token (jobsynth_token) directly.
 * Server components run in Node runtime, so verifyToken() is safe here.
 */
export default async function AdminPage() {
  // Get custom JWT token from cookies
  const cookieStore = cookies();
  const rawToken = cookieStore.get('jobsynth_token')?.value;
  
  if (!rawToken) {
    redirect('/login?next=/admin');
  }

  // Verify JWT signature (safe in Node runtime - server components)
  const token = verifyToken(rawToken);
  
  if (!token || !token.email) {
    redirect('/login?next=/admin');
  }

  // Check if user is admin
  if (token.role !== 'admin') {
    redirect('/dashboard');
  }

  return <AdminDashboardClient />;
}