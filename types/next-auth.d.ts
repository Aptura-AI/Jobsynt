// types/next-auth.d.ts
import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      provider?: string;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    provider?: string;
  }

  interface JWT {
    id?: string;
    provider?: string;
  }
}

export {};
export default NextAuth;
// This file is used to extend the NextAuth types for TypeScript support.