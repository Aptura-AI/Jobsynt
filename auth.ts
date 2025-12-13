import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';
import { readJSON, writeJSON } from '@/utils/fs';
import { verifyPassword } from '@/utils/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

type User = {
  email: string;
  passwordHash?: string;
  role: 'admin' | 'user';
  name?: string;
  image?: string;
};

// Helper to create or get user (for JSON fallback)
async function createOrGetUser(email: string, name?: string, image?: string, provider?: string) {
  // For Supabase, OAuth users are automatically created by NextAuth
  // We just need to handle JSON file fallback
  if (!supabaseUrl || !supabaseAnonKey) {
    // Fallback to JSON file storage
    const users: User[] = (await readJSON<User[]>('users.json').catch(() => null)) || [];
    let user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      // Create new user
      user = {
        email,
        name: name || email.split('@')[0],
        image,
        role: 'user',
      };
      users.push(user);
      await writeJSON('users.json', users);
    } else {
      // Update user info if provided
      if (name && !user.name) user.name = name;
      if (image && !user.image) user.image = image;
      await writeJSON('users.json', users);
    }
    
    return user;
  }
  
  // For Supabase, return user data (user is created by NextAuth automatically)
  return {
    email,
    name: name || email.split('@')[0],
    image,
    role: 'user' as const,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    LinkedInProvider({
      clientId: process.env.LINKEDIN_CLIENT_ID || '',
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
      authorization: { params: { scope: 'openid profile email' } },
    }),
    CredentialsProvider({
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Try Supabase first
        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (!error && data.user) {
            return {
              id: data.user.id,
              email: data.user.email!,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
              role: data.user.user_metadata?.role || 'user',
            };
          }
        }

        // Fallback to JSON file storage
        const users: User[] = (await readJSON<User[]>('users.json').catch(() => null)) || [];
        const user = users.find((u) => u.email.toLowerCase() === credentials.email.toLowerCase());
        
        if (!user || !user.passwordHash) {
          return null;
        }

        const valid = await verifyPassword(credentials.password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.email,
          email: user.email,
          name: user.name || user.email.split('@')[0],
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google' || account?.provider === 'linkedin') {
        // Auto-create user on first OAuth sign-in
        await createOrGetUser(
          user.email!,
          user.name || profile?.name,
          user.image || profile?.picture,
          account.provider
        );
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.role = (user as any).role || 'user';
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as 'admin' | 'user';
        session.user.image = token.picture as string | undefined;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

