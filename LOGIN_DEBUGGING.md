# Login Debugging Guide

## Current Issue
Profile is correctly set up, but login is failing and stuck on login page.

## Debugging Steps

### 1. Check Browser Console
Open browser DevTools (F12) → Console tab, then try to login. Look for:
- Any error messages
- "Login successful:" or "Login failed:" messages
- Network errors

### 2. Check Network Tab
Open DevTools → Network tab, then try to login:
- Find the `/api/login` request
- Check the **Response** tab - what does it return?
- Check the **Status Code** - is it 200 or 401?
- Check **Response Headers** - is `Set-Cookie` header present?

### 3. Check Application → Cookies
After attempting login:
- Open DevTools → Application → Cookies → `https://www.jobsynt.com`
- Look for cookie named `jobsynth_token`
- If it exists, check:
  - **Value**: Should be a JWT token
  - **HttpOnly**: Should be checked
  - **Secure**: Should be checked (in production)
  - **SameSite**: Should be "Lax"
  - **Path**: Should be "/"

### 4. Verify Password
The most common issue is **password mismatch**:
- When you created the user in Supabase Dashboard, what password did you set?
- Are you using the exact same password when logging in?
- Try resetting the password in Supabase Dashboard if unsure

### 5. Check Supabase Auth
In Supabase Dashboard → Authentication → Users:
- Find `info@jobsynt.com`
- Check:
  - **Email Confirmed**: Should be ✅ (green checkmark)
  - **Created At**: Should show when user was created
  - **Last Sign In**: Should update after login attempt

### 6. Test Login API Directly
Run this in browser console (on https://www.jobsynt.com):

```javascript
fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    email: 'info@jobsynt.com', 
    password: 'YOUR_PASSWORD_HERE' 
  })
})
.then(res => res.json())
.then(data => console.log('Response:', data))
.catch(err => console.error('Error:', err));
```

Replace `YOUR_PASSWORD_HERE` with your actual password.

**Expected response if successful:**
```json
{
  "email": "info@jobsynt.com",
  "role": "admin"
}
```

**If you get an error:**
- Check the error message
- Common errors:
  - `"Invalid login credentials"` → Password is wrong
  - `"Email not confirmed"` → User needs email verification
  - `"User not found"` → User doesn't exist in Supabase Auth

### 7. Check Server Logs
If you have access to Vercel logs or server logs:
- Look for "Supabase auth error:" messages
- Check for any exceptions during login

## Common Issues & Solutions

### Issue: "Invalid login credentials"
**Cause**: Password doesn't match what's in Supabase

**Solution**:
1. Go to Supabase Dashboard → Authentication → Users
2. Find `info@jobsynt.com`
3. Click the three dots (⋯) → "Reset Password"
4. Or manually update password via Supabase Admin API

### Issue: Cookie not being set
**Cause**: Cookie settings might be blocking in production

**Solution**:
- Check if `secure: true` is causing issues (should be true in production)
- Check if domain is correct
- Try clearing all cookies and trying again

### Issue: Login succeeds but redirect doesn't work
**Cause**: `window.location.href` might be blocked or cookie not readable

**Solution**:
- Check browser console for errors
- Verify cookie exists after login
- Try manually navigating to `/admin` after login

### Issue: "Email not confirmed"
**Cause**: User was created but email verification is required

**Solution**:
1. Go to Supabase Dashboard → Authentication → Users
2. Find `info@jobsynt.com`
3. Click "Confirm Email" or check "Auto Confirm User" when creating

## Quick Fix: Reset Password

If you're unsure about the password:

1. **Option A: Reset via Supabase Dashboard**
   - Go to Authentication → Users
   - Find `info@jobsynt.com`
   - Click three dots → "Reset Password"
   - This will send a password reset email

2. **Option B: Update password directly (requires service role)**
   ```sql
   -- This requires Supabase Admin API or service role
   -- Cannot be done via SQL directly
   ```

3. **Option C: Delete and recreate user**
   - Delete user from Supabase Dashboard
   - Recreate with known password
   - Run the profile creation SQL again

## Verification Checklist

After debugging, verify:

- [ ] `/api/login` returns 200 with `{ email, role: 'admin' }`
- [ ] Cookie `jobsynth_token` is set in browser
- [ ] Cookie has correct value (JWT token)
- [ ] Browser console shows "Login successful:"
- [ ] Redirect to `/admin` happens
- [ ] Middleware allows access to `/admin`

