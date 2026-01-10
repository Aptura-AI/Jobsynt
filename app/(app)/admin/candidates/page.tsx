/**
 * Admin Candidates List Page
 * 
 * Lists all candidates with search and filters
 * Click candidate name to view profile
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';

export const dynamic = 'force-dynamic';
import CandidatesListClient from './CandidatesListClient';

export default async function AdminCandidatesPage() {
  // Verify admin authentication
  const cookieStore = cookies();
  const rawToken = cookieStore.get('jobsynth_token')?.value;
  
  if (!rawToken) {
    redirect('/login?next=/admin/candidates');
  }

  const token = verifyToken(rawToken);
  
  if (!token || token.role !== 'admin') {
    redirect('/dashboard');
  }

  return <CandidatesListClient />;
}

