import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Helper to get session in server components for NextAuth v4
export async function getServerSessionHelper() {
  try {
    const session = await getServerSession(authOptions);
    return session;
  } catch (error) {
    return null;
  }
}

