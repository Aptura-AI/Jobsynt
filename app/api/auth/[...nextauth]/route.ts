import NextAuth, { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import externalAuthOptions from './authOptions';

// Declare extended session and token types (for use across app)
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      provider?: string;
      name?: string | null;
      email?: string | null;
    };
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

// Define auth options (not exported directly to avoid type issues)
const authOptions: NextAuthOptions = externalAuthOptions || {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID!,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.provider = account?.provider;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.provider = token.provider as string;
      }
      return session;
    },
    async redirect({ baseUrl }) {
      return baseUrl;
    },
  },
  pages: {
    signIn: '/signin',
    error: '/auth/error',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Instantiate handler with options
const handler = NextAuth(authOptions);

// Export for Next.js API routes
export { handler as GET, handler as POST };
