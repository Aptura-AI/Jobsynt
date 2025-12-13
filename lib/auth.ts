import { auth } from '@/app/api/auth/[...nextauth]/route';

// Helper to get session in server components for NextAuth v5
export async function getServerSession() {
  try {
    const session = await auth();
    return session;
  } catch (error) {
    return null;
  }
}

