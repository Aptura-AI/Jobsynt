/**
 * Admin Job Edit Page
 * 
 * Edit job details and target candidates
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import JobEditClient from './JobEditClient';

export default async function AdminJobEditPage({
  params,
}: {
  params: { id: string };
}) {
  // Verify admin authentication
  const cookieStore = cookies();
  const rawToken = cookieStore.get('jobsynth_token')?.value;
  
  if (!rawToken) {
    redirect('/login?next=/admin/jobs');
  }

  const token = verifyToken(rawToken);
  
  if (!token || token.role !== 'admin') {
    redirect('/dashboard');
  }

  return <JobEditClient jobId={params.id} />;
}

