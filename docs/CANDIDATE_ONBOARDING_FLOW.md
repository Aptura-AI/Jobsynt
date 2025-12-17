# Candidate Onboarding Flow

## Overview

When an admin adds a candidate through the admin dashboard, the system creates a profile and sends an authentication email. The candidate must authenticate to access their account.

## Step-by-Step Flow

### 1. Admin Creates Candidate (`/api/candidates` POST)

**Location**: `app/api/candidates/route.ts`

**What Happens**:
1. Admin fills out candidate form in admin dashboard
2. Form submits to `/api/candidates` with candidate data (name, email, phone, skills, etc.)
3. System validates admin authentication (requires `jobsynth_token` with `role: 'admin'`)
4. System uses admin Supabase client (service role) to bypass RLS

**Database Operations**:
- Creates/updates record in `candidates` table
- Creates/updates record in `profiles` table with:
  - All candidate information (name, email, phone, skills, etc.)
  - `pending_auth: true` (if user hasn't authenticated yet)
  - `user_id: null` (until candidate authenticates)
  - `onboarding_complete: false` (until profile is completed)

**Email Sent**:
- If profile is new OR user hasn't authenticated (`user_id` is null):
  - Calls `sendAuthEmail(candidate.email, candidate.name)`
  - Email contains link: `https://www.jobsynt.com/auth/signup?email={email}`
  - Email explains they need to authenticate to access their account

### 2. Candidate Receives Authentication Email

**Email Content** (`lib/email.ts`):
- Subject: "Authenticate Your Jobsynt Profile"
- Contains:
  - Welcome message
  - Link to authenticate: `/auth/signup?email={email}`
  - Explanation of what they can do after authentication:
    - View detailed job descriptions
    - Access personalized dashboard
    - Track job applications
    - Receive daily job recommendations

**Email Link Format**:
```
https://www.jobsynt.com/auth/signup?email=candidate@example.com
```

### 3. Candidate Clicks Authentication Link

**What Happens**:
1. Candidate is redirected to `/auth/signup` page (or `/signup` page)
2. Email is pre-filled from URL parameter
3. Candidate must:
   - Set a password
   - Click "Sign Up" button

### 4. Candidate Signs Up (`/api/signup` POST)

**Location**: `app/api/signup/route.ts`

**What Happens**:
1. System calls `supabase.auth.signUp()` with email and password
2. Supabase creates user in `auth.users` table
3. Supabase sends email verification (if email confirmation is enabled)
4. Response: "Check your email to verify your account"

**Note**: If user already exists, returns error: "User already exists. Please sign in instead."

### 5. Candidate Verifies Email (if required)

**What Happens**:
1. Candidate receives verification email from Supabase
2. Clicks verification link
3. Redirected to: `/auth/callback?type=signup&code={verification_code}`

### 6. Auth Callback Links Profile (`/auth/callback` GET)

**Location**: `app/auth/callback/route.ts`

**What Happens**:
1. System exchanges verification code for session
2. Gets `user.id` from Supabase Auth
3. Calls `ensureProfileExists()` to link profile:
   - Finds existing profile by email
   - Updates `user_id` field (links profile to auth user)
   - Sets `pending_auth: false`
   - Preserves all existing profile data (name, skills, etc.)

**Profile Linking Logic** (`lib/auth-routing.ts`):
```typescript
// If profile exists but user_id is missing:
updateData.user_id = userId; // Link auth user to profile
// Profile data is preserved (name, skills, etc.)
```

### 7. Post-Auth Redirect

**Location**: `lib/auth-routing.ts` → `getPostAuthRedirect()`

**Routing Rules**:
1. **IF** `role === 'admin'` → `/admin`
2. **ELSE IF** `onboarding_complete === false` → `/candidates` (profile setup page)
3. **ELSE** → `/dashboard` (main dashboard)

**For Admin-Created Candidates**:
- Profile already has data (name, skills, etc.)
- `onboarding_complete` may be `true` if all required fields are present
- If `onboarding_complete === true` → Goes directly to `/dashboard`
- If `onboarding_complete === false` → Goes to `/candidates` to complete profile

### 8. Candidate Accesses Dashboard

**What They Can Do**:
- View matched jobs (70%+ match score)
- See AI career mentor chat
- Update profile information
- Track job applications
- Receive daily job digest emails

## Key Database Fields

### `profiles` Table Fields Used:

| Field | Purpose | Initial Value (Admin-Created) |
|-------|---------|-------------------------------|
| `email` | Candidate email | From admin form |
| `name` | Candidate name | From admin form |
| `phone` | Mobile number | From admin form |
| `user_id` | Links to `auth.users.id` | `null` (until auth) |
| `pending_auth` | Auth status flag | `true` (until auth) |
| `onboarding_complete` | Profile completion | `true` if all fields present |
| `skills` | Candidate skills | From admin form |
| `title` | Job title | From admin form |
| `location` | Location | From admin form |
| `experience_years` | Years of experience | From admin form |

### `candidates` Table Fields:

| Field | Purpose |
|-------|---------|
| `id` | Primary key |
| `email` | Candidate email (unique identifier) |
| `name` | Candidate name |
| `phone` | Mobile number |
| `status` | Candidate status (default: "Good") |
| All other fields | Same as profiles table |

## Email Configuration

**Required Environment Variables**:
- `SMTP_HOST` - SMTP server (default: smtp.zoho.com)
- `SMTP_PORT` - SMTP port (default: 587)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password
- `EMAIL_FROM` - Sender email (default: info@jobsynt.com)
- `SENDER_NAME` - Sender name (default: JobSynt)
- `NEXT_PUBLIC_SITE_URL` - Site URL (default: https://www.jobsynt.com)

**If Email Not Configured**:
- Auth email is skipped (logged as warning)
- Candidate creation still succeeds
- Admin should manually notify candidate

## Security Features

1. **Admin Authentication Required**: Only admins can create candidates (verified via JWT token)
2. **RLS Bypass**: Admin uses service role key to bypass Row Level Security
3. **Profile Linking**: Profile is linked to auth user only after email verification
4. **Pending Auth Flag**: Tracks which profiles need authentication
5. **Email Verification**: Supabase handles email verification (if enabled)

## Daily Job Emails

**Location**: `app/api/cron/daily-job-email/route.ts`

**What Happens**:
- Runs daily at 12:00 PM (via Vercel cron)
- Sends job matches to ALL profiles (including `pending_auth: true`)
- Email includes login link: `/auth/login?email={email}`
- Even unauthenticated candidates receive job emails (they can see preview)

## Troubleshooting

### Candidate Can't Access Account

**Check**:
1. Did they receive authentication email? (Check email logs)
2. Did they click the link and set password?
3. Is `user_id` set in profiles table? (Should match `auth.users.id`)
4. Is `pending_auth` set to `false`?

**Fix**:
- Resend auth email manually (call `/api/candidates` POST again)
- Or have candidate go to `/signup` and sign up with their email

### Profile Not Linked After Auth

**Check**:
- `profiles.user_id` should match `auth.users.id` for the email
- Check `app/auth/callback/route.ts` logs

**Fix**:
- `ensureProfileExists()` should automatically link on next login
- Or manually update: `UPDATE profiles SET user_id = '{auth_user_id}' WHERE email = '{email}'`

### Email Not Sent

**Check**:
- SMTP environment variables configured?
- Check server logs for email errors
- Email might be in spam folder

**Fix**:
- Configure SMTP settings in Vercel environment variables
- Check email service (Zoho) logs

## Summary

**Admin-Created Candidate Flow**:
1. Admin creates candidate → Profile created with `pending_auth: true`
2. Auth email sent → Candidate receives link
3. Candidate signs up → Creates `auth.users` record
4. Email verified → Callback links `user_id` to profile
5. `pending_auth` set to `false` → Candidate can access dashboard

**Key Point**: Profile data is preserved throughout authentication. The candidate doesn't lose any information when they authenticate.

