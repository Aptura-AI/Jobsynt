import { cookies } from 'next/headers';
import { getToken } from 'next-auth/jwt';

// Helper to get session in server components for NextAuth v5
export async function getServerSession() {
  try {
    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll();
    const cookieString = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
    
    const token = await getToken({
      req: {
        headers: {
          cookie: cookieString,
        },
      } as any,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return null;
    }

    return {
      user: {
        email: token.email as string,
        name: token.name as string,
        role: (token.role as 'admin' | 'user') || 'user',
        image: token.picture as string | undefined,
      },
    };
  } catch (error) {
    return null;
  }
}

