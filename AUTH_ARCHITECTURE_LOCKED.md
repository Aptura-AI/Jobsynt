# 🔒 AUTH ARCHITECTURE - LOCKED

**Status:** Production-ready, stable, and locked. Do not modify without explicit approval.

**Last Updated:** 2025-01-XX

---

## ✅ ADMIN AUTHENTICATION (LOCKED)

### Admin Login Flow

1. **Login API** (`/api/login`)
   - Authenticates via Supabase Auth
   - Fetches role from `profiles.role` (database)
   - Creates custom JWT token with `{ email, role, userId }`
   - Sets `jobsynth_token` cookie (httpOnly, secure, 7 days)
   - Server-side redirect: Admin → `/admin`, Others → `/dashboard`

2. **Admin Page** (`/app/admin/page.tsx`)
   - ✅ Reads `jobsynth_token` cookie directly
   - ✅ Uses `verifyToken()` for signature verification (Node runtime safe)
   - ✅ Checks `token.role === 'admin'`
   - ✅ No NextAuth dependencies
   - ✅ No Edge runtime crypto issues
   - ✅ Stable on refresh and re-login

3. **Middleware** (`/middleware.ts`)
   - ✅ Enforces `/admin` route protection
   - ✅ Uses `decodeToken()` for Edge runtime (decode only, no verification)
   - ✅ Blocks non-admins from accessing `/admin`
   - ✅ Redirects unauthorized users to `/login`

---

## 🔐 SECURITY MODEL

### JWT Token Structure
```typescript
{
  email: string;
  role: 'admin' | 'candidate' | 'company';
  userId?: string;
}
```

### Token Verification
- **API Routes & Server Components (Node runtime):** `verifyToken()` - Full signature verification
- **Middleware (Edge runtime):** `decodeToken()` - Decode only, no verification
- **Security:** Signature verified server-side before admin access granted

### Cookie Settings
- **Name:** `jobsynth_token`
- **HttpOnly:** `true` (XSS protection)
- **Secure:** `true` (production, HTTPS only)
- **SameSite:** `lax`
- **MaxAge:** 7 days
- **Path:** `/`

---

## 🚫 WHAT IS NOT USED

- ❌ NextAuth sessions for admin (admin uses custom JWT only)
- ❌ OAuth for admin login (email/password via Supabase Auth)
- ❌ Edge runtime crypto operations (only decode in middleware)
- ❌ Client-side token verification (all verification server-side)

---

## 📋 KEY FILES

### Admin Authentication
- `app/api/login/route.ts` - Login endpoint, sets JWT cookie
- `app/admin/page.tsx` - Admin page, verifies JWT token
- `middleware.ts` - Route protection, enforces `/admin` access
- `utils/auth.ts` - JWT signing/verification utilities

### Database
- `profiles.role` - Single source of truth for user roles
- `profiles.onboarding_complete` - Onboarding status
- Admin user: `info@jobsynt.com` → `role = 'admin'`

---

## ✅ VERIFICATION CHECKLIST

- [x] Admin login sets `jobsynth_token` cookie
- [x] Admin page reads `jobsynth_token` cookie
- [x] `verifyToken()` used in server components (Node runtime)
- [x] `decodeToken()` used in middleware (Edge runtime)
- [x] Middleware enforces `/admin` route
- [x] No NextAuth in admin flow
- [x] No Edge crypto issues
- [x] Stable on refresh
- [x] Stable on re-login

---

## 🚨 DO NOT MODIFY

**Without explicit approval, do NOT:**
- Change admin authentication flow
- Replace `verifyToken()` with `decodeToken()` in server components
- Add NextAuth to admin page
- Modify JWT token structure
- Change cookie settings
- Remove middleware enforcement

---

## 📝 NOTES

- Admin authentication is **completely separate** from NextAuth
- OAuth (Google/LinkedIn) is for candidates only, not admin
- Admin must use email/password login via Supabase Auth
- Role comes from database (`profiles.role`), never hardcoded
- Signature verification prevents token forgery attacks

---

**This architecture is LOCKED and PRODUCTION-READY.**

