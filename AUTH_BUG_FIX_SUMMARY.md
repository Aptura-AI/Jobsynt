# Auth Bug Fix - Production Issue Resolution

## Problem
- Supabase `profiles` table did NOT contain a `role` column
- Code assumed `profiles.role` exists
- Admin detection failed and `info@jobsynt.com` was redirected to index instead of `/admin`

## Solution Summary

### 1. Database Schema Fix ✅
**File:** `supabase/migrations/20250101_add_role_and_onboarding_to_profiles.sql`

- Added `role TEXT NOT NULL DEFAULT 'candidate'` column with idempotent checks
- Added `onboarding_complete BOOLEAN NOT NULL DEFAULT false` column if missing
- Ensured `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` exists
- Added UNIQUE constraint on `user_id` (where not null)
- Created indexes for performance
- Backfilled admin user: `info@jobsynt.com` → `role='admin'`, `onboarding_complete=true`

**To apply:** Run this SQL migration in Supabase Dashboard SQL Editor.

### 2. Single Source of Truth for Admin ✅
**Files Updated:**
- `lib/auth-routing.ts`
- `middleware.ts`
- `app/auth/callback/route.ts`
- `lib/auth-config.ts`

**Changes:**
- Removed email hardcoding from runtime admin detection
- `isAdminUser()` now ONLY checks `profiles.role === 'admin'`
- Email (`info@jobsynt.com`) is ONLY used for initial backfill, not runtime checks
- All role checks now query `profiles.role` from database

### 3. Post-Login Redirect Logic ✅
**File:** `lib/auth-routing.ts` - `getPostAuthRedirect()`

**Exact Rules Implemented:**
```
IF role === 'admin'
  → redirect to /admin (always, no exceptions)

ELSE IF onboarding_complete === false
  → redirect to /candidates

ELSE
  → redirect to /dashboard
```

### 4. Auth Callback Hardening ✅
**File:** `app/auth/callback/route.ts`

- Ensures profile is created if missing
- Role defaults to 'candidate' (unless already admin in DB)
- `onboarding_complete` defaults to `false`
- Admin users NEVER redirected to `/candidates`
- Role fetched from database before redirect

### 5. Middleware Enforcement ✅
**File:** `middleware.ts`

**Route Protection:**
- `/admin` → admin only (role === 'admin')
- `/candidates` → non-admin AND `onboarding_complete === false`
- `/dashboard` → non-admin AND `onboarding_complete === true`

**Prevents:**
- Admin seeing candidate pages (redirects to `/admin`)
- Candidates seeing admin (redirects to their dashboard)
- Candidates skipping onboarding (redirects to `/candidates`)

### 6. Logging ✅
Added minimal server-side logging (development mode only):
- Role and onboarding status
- Redirect decisions
- Blocked access attempts

## Verification

After applying the migration, run this query in Supabase:

```sql
SELECT email, role, onboarding_complete
FROM profiles
WHERE email = 'info@jobsynt.com';
```

**Expected Result:**
```
email              | role  | onboarding_complete
-------------------+-------+--------------------
info@jobsynt.com   | admin | true
```

## Testing Checklist

- [ ] Run SQL migration in Supabase Dashboard
- [ ] Verify `info@jobsynt.com` has `role='admin'` and `onboarding_complete=true`
- [ ] Test admin login → should redirect to `/admin`
- [ ] Test first-time candidate signup → should redirect to `/candidates`
- [ ] Test returning candidate login → should redirect to `/dashboard`
- [ ] Test admin cannot access `/candidates` or `/dashboard` → should redirect to `/admin`
- [ ] Test candidate cannot access `/admin` → should redirect to their dashboard
- [ ] Test candidate with incomplete onboarding cannot access `/dashboard` → should redirect to `/candidates`

## Files Changed

1. `supabase/migrations/20250101_add_role_and_onboarding_to_profiles.sql` (NEW)
2. `lib/auth-routing.ts` (UPDATED)
3. `middleware.ts` (UPDATED)
4. `app/auth/callback/route.ts` (UPDATED)
5. `lib/auth-config.ts` (UPDATED)

## Notes

- Email hardcoding (`info@jobsynt.com`) is ONLY used for:
  1. Initial backfill in migration
  2. Master admin credentials check in `auth-config.ts` (acceptable for login)
- All runtime role checks use `profiles.role` from database
- Migration is idempotent - safe to run multiple times

