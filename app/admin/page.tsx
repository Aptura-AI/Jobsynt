import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import AdminDashboardClient from './AdminDashboardClient';

/**
 * Admin Page
 * 
 * JWT verification happens in API route (Node runtime).
 * This page only fetches from API and redirects if unauthorized.
 */
export default async function AdminPage() {
  // Get cookies for server-side fetch
  const cookieStore = cookies();
  const token = cookieStore.get('jobsynth_token')?.value;
  
  // Build cookie header manually
  const cookieHeader = token ? `jobsynth_token=${token}` : '';
  
  // Fetch admin session from API (JWT verified server-side)
  // Use relative URL for internal API calls (Next.js handles this)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
                  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
                  'http://localhost:3000');
  
  let adminSession;
  try {
    const response = await fetch(`${baseUrl}/api/admin/me`, {
      cache: 'no-store',
      headers: cookieHeader ? {
        Cookie: cookieHeader,
      } : {},
    });

    if (response.status === 401) {
      redirect('/login?next=/admin');
    }

    if (!response.ok) {
      redirect('/login?next=/admin');
    }

    adminSession = await response.json();
  } catch (error) {
    console.error('Admin session fetch error:', error);
    redirect('/login?next=/admin');
  }

  // Verify we have admin session
  if (!adminSession?.email || adminSession?.role !== 'admin') {
    redirect('/login?next=/admin');
  }

  return <AdminDashboardClient />;
}