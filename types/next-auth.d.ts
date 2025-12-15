import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      email: string;
      name?: string;
      image?: string;
      role: 'admin' | 'user';
    };
    admin_master?: boolean;
  }

  interface User {
    id?: string;
    role?: 'admin' | 'user';
    admin_master?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: 'admin' | 'user';
    admin_master?: boolean;
  }
}


