import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import LinkedInProvider from 'next-auth/providers/linkedin';

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
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
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
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
