# Admin User Setup Guide

## Problem
If you're stuck on the login page and cannot access `/admin`, the most likely cause is that **`info@jobsynt.com` does not exist in Supabase Auth**.

## Prerequisites
Before you can login, you MUST:

1. ✅ **Create the user in Supabase Auth** (`auth.users` table)
2. ✅ **Create/update the profile** in `profiles` table with `role='admin'`

## Step 1: Create User in Supabase Auth

### Option A: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Users**
3. Click **"Add user"** or **"Invite user"**
4. Enter:
   - **Email**: `info@jobsynt.com`
   - **Password**: `Jobsynt@2026` (or your preferred password)
   - **Auto Confirm User**: ✅ Check this box (so email verification is skipped)
5. Click **"Create user"**

### Option B: Via SQL (If you have service role access)

Run this SQL in Supabase SQL Editor:

```sql
-- Create admin user in Supabase Auth
-- Note: This requires service role key or admin access

-- First, check if user already exists
SELECT id, email FROM auth.users WHERE email = 'info@jobsynt.com';

-- If user doesn't exist, you'll need to use Supabase Admin API or Dashboard
-- The auth.users table is managed by Supabase and cannot be directly inserted into
```

**Important**: The `auth.users` table is protected. You cannot directly INSERT into it via SQL. You must use:
- Supabase Dashboard (Authentication → Users)
- Supabase Admin API
- Supabase Auth functions

## Step 2: Verify Profile Exists

Run this SQL in Supabase SQL Editor:

```sql
-- Check if profile exists
SELECT email, role, onboarding_complete, user_id 
FROM profiles 
WHERE email = 'info@jobsynt.com';

-- If profile doesn't exist or role is wrong, update it:
UPDATE profiles
SET 
  role = 'admin',
  onboarding_complete = true
WHERE email = 'info@jobsynt.com';

-- If profile doesn't exist at all, you need to link it to the auth user:
-- First get the user_id from auth.users:
SELECT id FROM auth.users WHERE email = 'info@jobsynt.com';

-- Then insert/update the profile (replace USER_ID_HERE with actual UUID):
INSERT INTO profiles (user_id, email, role, onboarding_complete)
VALUES (
  'USER_ID_HERE',  -- Replace with actual UUID from auth.users
  'info@jobsynt.com',
  'admin',
  true
)
ON CONFLICT (user_id) 
DO UPDATE SET 
  role = 'admin',
  onboarding_complete = true,
  email = 'info@jobsynt.com';
```

## Step 3: Test Login

1. Go to `https://www.jobsynt.com/login`
2. Enter:
   - **Email**: `info@jobsynt.com`
   - **Password**: `Jobsynt@2026` (or the password you set)
3. You should be redirected to `/admin`

## Troubleshooting

### Issue: "Invalid credentials" error

**Cause**: User doesn't exist in Supabase Auth.

**Solution**: 
- Create the user in Supabase Dashboard (Authentication → Users)
- Ensure email matches exactly: `info@jobsynt.com`
- Ensure password matches what you set

### Issue: Login succeeds but stuck on login page

**Cause**: Cookie not being set or middleware not reading it.

**Solution**:
1. Check browser console for errors
2. Check Network tab - verify `/api/login` returns 200 with `{ email, role: 'admin' }`
3. Check Application → Cookies - verify `jobsynth_token` cookie exists
4. Clear cookies and try again

### Issue: "User may not exist in Supabase" error

**Cause**: User was not created in Supabase Auth.

**Solution**: Follow Step 1 above to create the user.

## Verification Checklist

After setup, verify:

- [ ] User exists in `auth.users` table (Supabase Dashboard → Authentication → Users)
- [ ] Profile exists in `profiles` table with `role='admin'`
- [ ] `user_id` in profiles matches `id` in auth.users
- [ ] Login API returns `{ email: 'info@jobsynt.com', role: 'admin' }`
- [ ] Cookie `jobsynth_token` is set after login
- [ ] Middleware allows access to `/admin`

## Quick SQL Verification

Run this to check everything at once:

```sql
-- Check auth user
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'info@jobsynt.com';

-- Check profile
SELECT user_id, email, role, onboarding_complete 
FROM profiles 
WHERE email = 'info@jobsynt.com';

-- Verify they're linked
SELECT 
  u.id as auth_user_id,
  u.email as auth_email,
  p.user_id as profile_user_id,
  p.email as profile_email,
  p.role,
  p.onboarding_complete
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
WHERE u.email = 'info@jobsynt.com';
```

Expected result:
- `auth_user_id` should exist
- `profile_user_id` should match `auth_user_id`
- `role` should be `'admin'`
- `onboarding_complete` should be `true`

