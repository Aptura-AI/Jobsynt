# 🚨 Quick Fix for Job Search 500 Error

## The Problem
You're getting a 500 Internal Server Error when searching for jobs. This is likely due to missing environment variables.

## Quick Fix Options

### Option 1: Set Up Environment Variables (Recommended)
1. Create a `.env` file in your Netlify dashboard or add these environment variables:

```env
# Required for basic functionality
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional but recommended for better job results
JSEARCH_API_KEY=2ff97245b9msh5927579bf598da5p13d42djsnf561061fe49d
```

2. **Get your Supabase credentials**:
   - Go to https://supabase.com
   - Create a new project (free)
   - Go to Settings > API
   - Copy your Project URL and service_role key

### Option 2: Use Simple Job Search (Immediate Fix)
If you want to test the app immediately without setting up Supabase:

1. The system will automatically fallback to the simple job search
2. You'll get sample jobs to test the interface
3. Add API keys later for real job data

## Test the Fix

1. Try searching for jobs again
2. Check browser console for any remaining errors
3. If you see "simple-job-search" in the logs, the fallback is working

## Environment Variables Priority

1. **SUPABASE_URL** + **SUPABASE_SERVICE_ROLE_KEY** - Required for full functionality
2. **JSEARCH_API_KEY** - For real job data (500 free searches/month)
3. **URL** - Your Netlify site URL (optional, for background jobs)

## Debugging

If you're still getting errors:

1. Check the Netlify Functions logs
2. Visit `/.netlify/functions/debug-job-search` to see detailed error info
3. Ensure all environment variables are set correctly

## Success Indicators

✅ No 500 errors in browser console
✅ Job search returns results (even if sample data)
✅ No red error messages on the page

The fix ensures your job search works immediately while you set up the full environment! 