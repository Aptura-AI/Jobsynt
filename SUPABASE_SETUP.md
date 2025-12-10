# Supabase Setup Instructions

## Environment Variables

Add these to your `.env` or `.env.local` file in the root directory:

```env
# Supabase Configuration (supports both formats)
NEXT_PUBLIC_SUPABASE_URL=https://yhrwamhdiiggsapmfwas.supabase.co
# OR use: SUPABASE_URL=https://yhrwamhdiiggsapmfwas.supabase.co

NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
# OR use: SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Site URL (for email redirects)
NEXT_PUBLIC_SITE_URL=https://www.jobsynt.com

# JWT Secret (for app session tokens)
JWT_SECRET=your_jwt_secret_here
```

**Note:** For Vercel deployment, add these as environment variables in your Vercel project settings.

## Getting Your Supabase Anon Key

1. Go to your Supabase project: https://supabase.com/dashboard/project/yhrwamhdiiggsapmfwas
2. Navigate to Settings → API
3. Copy the "anon" or "public" key
4. Paste it in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Supabase Auth Configuration

1. Go to Authentication → Settings in your Supabase dashboard
2. Enable "Email" provider
3. Configure email templates (optional but recommended)
4. Set Site URL to: `https://www.jobsynt.com`
5. Add redirect URL: `https://www.jobsynt.com/auth/callback`

## Features

- **Password Signup**: Users can sign up with email and password
- **Magic Link Signup**: Passwordless signup via email magic link
- **Email Verification**: Automatic email verification on signup
- **OAuth Flow**: Smooth email-based authentication

