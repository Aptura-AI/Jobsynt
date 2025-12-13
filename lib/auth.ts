import { getServerSession as nextAuthGetServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Helper to get session in server components for NextAuth v4 with error handling
export async function getServerSession() {
  try {
    const session = await nextAuthGetServerSession(authOptions);
    return session;
  } catch (error) {
    return null;
  }
}

