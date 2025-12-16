import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';
import CredentialsProvider from 'next-auth/providers/credentials';
import { createClient } from '@supabase/supabase-js';
import { readJSON, writeJSON } from '@/utils/fs';
import { verifyPassword } from '@/utils/auth';
import { getPostAuthRedirect, ensureProfileExists, getUserOnboardingStatus, type UserRole } from '@/lib/auth-routing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

type User = {
  email: string;
  passwordHash?: string;
  role: UserRole;
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
        role: 'candidate',
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
    role: 'candidate' as const,
  };
}

export const authOptions = {
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
        if (supabaseUrl && supabaseAnonKey) {
          const supabase = createClient(supabaseUrl, supabaseAnonKey);
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (!error && data.user) {
            // Role will be fetched from database in jwt callback
            return {
              id: data.user.id,
              email: data.user.email!,
              name: data.user.user_metadata?.name || data.user.email?.split('@')[0],
              role: 'candidate', // Default, will be updated from database in jwt callback
            };
          }
        }

        // Fallback to JSON file storage
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
    async redirect({ url, baseUrl, token }: any) {
      // Use centralized routing logic
      if (token?.email) {
        try {
          const redirectPath = await getPostAuthRedirect(token.email, token.id);
          return redirectPath;
        } catch (error) {
          console.error('Redirect error:', error);
          // Fallback to dashboard on error
          return '/dashboard';
        }
      }
      // Default fallback
      return '/dashboard';
    },
    async signIn({ user, account, profile }: any) {
      if (account?.provider === 'google' || account?.provider === 'linkedin') {
        // For OAuth, ensure profile exists in Supabase
        if (supabaseUrl && supabaseAnonKey && user.email && user.id) {
          try {
            await ensureProfileExists(
              user.id,
              user.email,
              user.name || profile?.name,
              user.image || profile?.picture
            );
          } catch (error) {
            console.error('Error ensuring profile exists:', error);
            // Continue anyway - profile creation is non-blocking
          }
        }
        return true;
      }

      if (account?.provider === 'credentials') {
        // Credentials login — already validated in authorize
        return true;
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
        
        // SINGLE SOURCE OF TRUTH: Fetch role from database
        // This ensures role comes from profiles.role, not hardcoded values
        try {
          const status = await getUserOnboardingStatus(user.email, user.id);
          token.role = status.role as UserRole;
        } catch (error) {
          // Fallback to user.role if database check fails
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

