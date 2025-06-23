# 🚨 URGENT: Environment Variables Required

## ❌ Why Your Admin Dashboard Shows Zeros

Your admin dashboard shows:
- ✅ **1 Active Scraper** (IT C2C scraper exists)
- ❌ **0 Subscribers** (can't connect to Supabase)
- ❌ **0 Jobs Scraped** (can't connect to Supabase)

## 🔍 Root Cause

The IT C2C scraper **IS running every 30 minutes**, but it can't:
1. **Connect to Supabase** (no database credentials)
2. **Find user profiles** (can't query profiles table)
3. **Save jobs** (can't write to scraped_jobs table)

## 🔧 Required Environment Variables

You need to add these to your **Netlify environment variables**:

### **Essential (Required for basic functionality)**:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### **Optional (For better job results)**:
```env
JSEARCH_API_KEY=2ff97245b9msh5927579bf598da5p13d42djsnf561061fe49d
ADZUNA_API_KEY=your_adzuna_api_key
ADZUNA_APP_ID=your_adzuna_app_id
```

## 🚀 How to Set Up Supabase (Free)

### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with GitHub/Google
4. Click "New Project"
5. Choose organization and create project

### Step 2: Get Your Credentials
1. Go to **Settings** → **API**
2. Copy your **Project URL**
3. Copy your **service_role** key (not anon key!)

### Step 3: Add to Netlify
1. Go to your Netlify dashboard
2. Click on your site
3. Go to **Site settings** → **Environment variables**
4. Add:
   - `SUPABASE_URL` = your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = your service role key

## 📊 What Will Happen After Setup

### **Immediate Results**:
- ✅ **Subscribers**: Will show actual user count
- ✅ **Jobs Scraped**: Will show real job counts
- ✅ **Database Stats**: Will show real table sizes

### **IT C2C Scraper Will**:
1. **Find all user profiles** with IT-related target roles
2. **Search for C2C jobs** matching each profile
3. **Save jobs to database** every 30 minutes
4. **Show real numbers** in admin dashboard

## 🎯 Current Status

```
✅ IT C2C Scraper: ACTIVE (running every 30 minutes)
❌ Database Connection: MISSING (needs Supabase credentials)
❌ Job APIs: OPTIONAL (has fallback job search)
⏰ Schedule: Every 30 minutes via Netlify cron
```

## 🔄 Testing After Setup

Once you add the Supabase credentials:

1. **Wait 30 minutes** for next scheduled run
2. **Or trigger manually**: Visit `/.netlify/functions/background-job-cron`
3. **Check admin dashboard**: Should show real data

## 💡 Why This Setup is Perfect

- **Cost-Free**: Only 1 scraper running (no extra costs)
- **24/7 Operation**: Runs every 30 minutes automatically
- **Real Data Only**: No fake data anywhere
- **IT C2C Focused**: Perfect for your target market

## 🚨 Next Steps

1. **Set up Supabase** (5 minutes, free)
2. **Add environment variables** to Netlify
3. **Wait 30 minutes** or trigger manually
4. **See real data** in admin dashboard

Your scraper **IS working** - it just needs database access to show results! 🎯 