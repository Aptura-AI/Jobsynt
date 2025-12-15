import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import AdminDashboardClient from './AdminDashboardClient';

export default async function AdminPage() {
  const session = await getServerSession();
  
  if (!session?.user?.email) {
    redirect('/login?next=/admin');
  }

  // Check if user is master admin
  const isMasterAdmin = (session as any).admin_master === true || 
    (session.user.email.toLowerCase() === 'info@jobsynt.com' && session.user.role === 'admin');

  if (!isMasterAdmin) {
    redirect('/dashboard');
  }

  return <AdminDashboardClient />;
}

