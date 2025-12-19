/**
 * Admin Jobs List Page
 * 
 * Lists all jobs with search, filter, and pagination
 * Click job to edit
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import JobsListClient from './JobsListClient';

export default async function AdminJobsPage() {
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

  return <JobsListClient />;
}

