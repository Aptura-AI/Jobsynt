/**
 * Admin Candidate Profile Page
 * 
 * View full candidate profile and download resume
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import CandidateProfileClient from './CandidateProfileClient';

export default async function AdminCandidateProfilePage({
  params,
}: {
  params: { id: string };
}) {
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

  return <CandidateProfileClient candidateId={params.id} />;
}

