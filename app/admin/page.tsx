import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  const session = await getServerSession();
  
  if (!session?.user?.email) {
    redirect('/login?next=/admin');
  }

  // Check if user is admin using role from database (single source of truth)
  const isAdmin = session.user.role === 'admin';

  if (!isAdmin) {
    // Non-admin trying to access admin page - redirect to their dashboard
    redirect('/dashboard');
  }

  return <AdminDashboardClient />;
}

