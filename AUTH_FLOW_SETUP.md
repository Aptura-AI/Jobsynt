# Auth Flow Setup Instructions

## Overview

This document describes the standardized authentication, verification, and post-login routing flow for JobSynth.

## Database Schema Updates

Run the following SQL in your Supabase dashboard:

```sql
-- File: supabase_auth_flow_schema.sql
```

This adds:
- `onboarding_complete` (boolean) to `profiles` table
- `user_id` (UUID, references auth.users) to `profiles` table
- `role` (text) to `profiles` table
- Sets `info@jobsynt.com` as admin with `onboarding_complete = true`

## Supabase Auth Configuration

### 1. Email Verification Redirect

In Supabase Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://www.jobsynt.com`
- **Redirect URLs**: Add:
  - `https://www.jobsynt.com/auth/callback`
  - `https://www.jobsynt.com/candidates`
  - `https://www.jobsynt.com/dashboard`
  - `https://www.jobsynt.com/admin`

### 2. Email Templates

Update email verification template to redirect to `/auth/callback?type=signup`

## Auth Flow Logic

### Post-Auth Routing Rules

1. **Admin Users** (`info@jobsynt.com` or `role = 'admin'`)
   - → `/admin`

2. **First-Time Candidates** (`onboarding_complete = false`)
   - → `/candidates` (onboarding page)

3. **Returning Candidates** (`onboarding_complete = true`)
   - → `/dashboard`

4. **Company Users** (`role = 'company'`)
   - → `/company`

### Implementation Files

- **`lib/auth-routing.ts`**: Centralized routing logic
- **`middleware.ts`**: Route protection and redirects
- **`app/auth/callback/route.ts`**: Supabase auth callback handler
- **`lib/auth-config.ts`**: NextAuth configuration with routing

## Testing Checklist

- [ ] New email signup → verification → `/candidates`
- [ ] New Google signup → `/candidates`
- [ ] New LinkedIn signup → `/candidates`
- [ ] Candidate completes profile → next login → `/dashboard`
- [ ] Admin login (`info@jobsynt.com`) → `/admin`
- [ ] Admin never sees `/candidates`
- [ ] Returning users never see onboarding again

## Onboarding Completion

A profile is marked as `onboarding_complete = true` when:
- `name` is present
- `title` is present
- `location` is present
- `skills` array has at least one item

This is automatically set when saving via:
- `/api/profile` (POST)
- `/api/candidates` (POST)

