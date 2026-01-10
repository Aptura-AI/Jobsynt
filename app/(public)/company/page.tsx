import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import CompanyDashboardClient from './CompanyDashboardClient';

export const dynamic = 'force-dynamic';

export default async function CompanyPage() {
  const session = await getServerSession();
  
  // For now, allow access if logged in (we'll check company_id in the client)
  if (!session?.user?.email) {
    redirect('/company/login');
  }

  return <CompanyDashboardClient />;
}

