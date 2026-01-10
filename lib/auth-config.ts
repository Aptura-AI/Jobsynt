import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';
import { readJSON, writeJSON } from '@/utils/fs';
import { verifyPassword } from '@/utils/auth.server';
import { getPostAuthRedirect, ensureProfileExists, getUserOnboardingStatus, type UserRole } from '@/lib/auth-routing';

// TEMPORARY: Open candidate registration disabled (Invite-only mode)
// Set to false to re-enable open signup
export const SIGNUP_DISABLED = true;

/**
 * Check if signup should be allowed based on invite context
 * @param searchParams - URL search parameters
 * @returns true if signup should be allowed (invite token or email param present)
 */
export function isInviteSignup(searchParams: URLSearchParams): boolean {
  // Allow signup if:
  // 1. Signup is not disabled (feature flag)
  // 2. Invite token is present (Supabase invite link)
  // 3. Email parameter is present (admin-created candidate invite)
  if (!SIGNUP_DISABLED) {
    return true;
  }

  const token = searchParams.get('token') || searchParams.get('token_hash') || searchParams.get('invite_token');
  const email = searchParams.get('email');
  const code = searchParams.get('code'); // Supabase auth callback code

  // Allow if any invite indicator is present
  return !!(token || email || code);
}

/**
 * NextAuth configuration for OAuth providers (Google, LinkedIn)
 * Note: OAuth signups are also blocked when SIGNUP_DISABLED is true
 */
export const authOptions: NextAuthOptions = {
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

        const email = credentials.email as string;
        const password = credentials.password as string;

        // Master admin login (fixed credentials)
        if (email.toLowerCase() === 'info@jobsynt.com' && password === 'Jobsynt@2026') {
          return {
            id: 'admin-master',
            email: 'info@jobsynt.com',
            name: 'Jobsynt Admin',
            role: 'admin',
            admin_master: true,
          };
        }

        // Try Supabase first
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!error && data.user) {
            const status = await getUserOnboardingStatus(data.user.email!, data.user.id);
            return {
              id: data.user.id,
              email: data.user.email!,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
              role: status.role,
            };
          }
        }

        // Fallback to JSON file storage
        type User = {
          email: string;
          passwordHash?: string;
          role: UserRole;
          name?: string;
        };
        const users: User[] = (await readJSON<User[]>('users.json').catch(() => null)) || [];
        const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
        
        if (!user || !user.passwordHash) {
          return null;
        }

        const valid = await verifyPassword(password, user.passwordHash);
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
    async signIn({ user, account, profile }: any) {
      // TEMPORARY: Block OAuth signups when signup is disabled
      // Allow only if user already exists (login) or if invite context is present
      if (SIGNUP_DISABLED) {
        // Check if user already exists in database
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
        
        if (supabaseUrl && supabaseServiceKey && user.email) {
          try {
            const { createClient } = await import('@supabase/supabase-js');
            const supabase = createClient(supabaseUrl, supabaseServiceKey);
            const { data: userProfile } = await supabase
              .from('profiles')
              .select('id, pending_auth')
              .eq('email', user.email)
              .maybeSingle();

            // Allow if profile exists (existing user or admin-created candidate)
            if (userProfile) {
              return true;
            }
          } catch (error) {
            console.error('Error checking user existence:', error);
          }
        }

        // Block new OAuth signups when signup is disabled
        return false;
      }

      return true;
    },
    async jwt({ token, user, account }: any) {
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.id = user.id;
        token.admin_master = (user as any).admin_master || false;
        
        try {
          const status = await getUserOnboardingStatus(user.email, user.id);
          token.role = status.role as UserRole;
        } catch (error) {
          token.role = ((user as any).role as UserRole) || 'candidate';
          if (process.env.NODE_ENV === 'development') {
            console.warn('⚠️  Could not fetch role from database, using fallback:', error);
          }
        }
      }
      return token;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.email = token.email as string;
        session.user.name = token.name as string;
        session.user.role = token.role as UserRole;
        session.user.image = token.picture as string | undefined;
        session.user.id = token.id as string;
        (session as any).admin_master = token.admin_master || false;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
