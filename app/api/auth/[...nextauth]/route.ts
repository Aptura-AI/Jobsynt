// app/api/auth/[...nextauth]/route.ts
import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions } from 'next-auth';
import LinkedInProvider from "next-auth/providers/linkedin";

// Authentication options
export const authOptions: NextAuthOptions = {
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
    async redirect({ url, baseUrl }) {
      return baseUrl;  // Redirect users to the homepage after sign-in
    },
  },
  pages: {
    signIn: '/signin',   // Custom sign-in page
    error: '/auth/error', // Custom error page
  },
  secret: process.env.NEXTAUTH_SECRET, // Add secret for NextAuth session management
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
