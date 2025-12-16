import 'next-auth';
import 'next-auth/jwt';
import type { UserRole } from '@/lib/auth-routing';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      email: string;
      name?: string;
      image?: string;
      role: UserRole;
    };
    admin_master?: boolean;
  }

  interface User {
    id?: string;
    role?: UserRole;
    admin_master?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    admin_master?: boolean;
  }
}


