import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      email: string;
      name?: string;
      image?: string;
      role: 'admin' | 'user';
    };
  }

  interface User {
    role?: 'admin' | 'user';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: 'admin' | 'user';
  }
}


