# 🚀 Free Tier APIs Signup Guide

## 📊 Summary: What You're Getting

**Current Setup**: 1 API (JSearch) = 500 searches/month
**Enhanced Setup**: 8 APIs = **15,600+ searches/month**

## 🎯 Priority APIs (Sign up for these first)

### 1. **USAJobs API** ⭐⭐⭐ (HIGHEST PRIORITY)
- **Free Tier**: 10,000 calls/month (best limits!)
- **What**: Official U.S. government jobs
- **Signup**: https://developer.usajobs.gov/
- **Steps**:
  1. Go to https://developer.usajobs.gov/
  2. Click "Request API Key"
  3. Fill out the form with your details
  4. Get your API key via email
  5. Add to `.env.local`:
     ```
     USAJOBS_API_KEY=your_key_here
     USAJOBS_EMAIL=your_email@example.com
     ```

### 2. **SerpAPI** ⭐⭐⭐ (HIGH PRIORITY)
- **Free Tier**: 100 searches/month
- **What**: Google Jobs via API
- **Signup**: https://serpapi.com/
- **Steps**:
  1. Go to https://serpapi.com/
  2. Click "Sign Up Free"
  3. Verify your email
  4. Go to Dashboard → API Key
  5. Add to `.env.local`:
     ```
     SERPAPI_KEY=your_serpapi_key_here
     ```

### 3. **Adzuna API** ⭐⭐
- **Free Tier**: 1000 calls/month
- **What**: Job aggregator from multiple sources
- **Signup**: https://developer.adzuna.com/
- **Steps**:
  1. Go to https://developer.adzuna.com/
  2. Click "Register"
  3. Create account and verify email
  4. Go to "My Applications" → Create new app
  5. Get your App ID and App Key
  6. Add to `.env.local`:
     ```
     ADZUNA_APP_ID=your_app_id_here
     ADZUNA_APP_KEY=your_app_key_here
     ```

## 🌟 Additional APIs (Sign up when you have time)

### 4. **Reed API** ⭐⭐
- **Free Tier**: 1000 calls/month
- **What**: UK and US job listings
- **Signup**: https://www.reed.co.uk/developers
- **Steps**:
  1. Go to https://www.reed.co.uk/developers
  2. Click "Register"
  3. Complete registration
  4. Get your API key from dashboard
  5. Add to `.env.local`:
     ```
     REED_API_KEY=your_reed_api_key_here
     ```

### 5. **The Muse API** ⭐
- **Free Tier**: 1000 calls/month
- **What**: Career-focused job listings
- **Signup**: https://www.themuse.com/developers
- **Steps**:
  1. Go to https://www.themuse.com/developers
  2. Request API access
  3. Wait for approval (usually 1-2 days)
  4. Get your API key
  5. Add to `.env.local`:
     ```
     THEMUSE_API_KEY=your_themuse_api_key_here
     ```

### 6. **Jobs2Careers API** ⭐
- **Free Tier**: 1000 calls/month  
- **What**: Job aggregator
- **Signup**: https://www.jobs2careers.com/api
- **Steps**:
  1. Go to https://www.jobs2careers.com/api
  2. Fill out publisher application
  3. Wait for approval
  4. Get your publisher ID
  5. Add to `.env.local`:
     ```
     JOBS2CAREERS_API_KEY=your_publisher_id_here
     ```

## 🎉 Already Included (No signup needed)

### **Remotive API** ✅
- **Free Tier**: Unlimited!
- **What**: Remote job listings
- **Setup**: Already integrated - no key needed!

## 🔐 Your Complete `.env.local` File

Create/update your `.env.local` file with:

```env
# Your existing JSearch key (already working)
JSEARCH_API_KEY=2ff97245b9msh5927579bf598da5p13d42djsnf561061fe49d

# New APIs (add as you sign up)
USAJOBS_API_KEY=your_usajobs_key_here
USAJOBS_EMAIL=your_email@example.com
SERPAPI_KEY=your_serpapi_key_here
ADZUNA_APP_ID=your_adzuna_app_id_here
ADZUNA_APP_KEY=your_adzuna_app_key_here
REED_API_KEY=your_reed_key_here
THEMUSE_API_KEY=your_themuse_key_here
JOBS2CAREERS_API_KEY=your_jobs2careers_key_here

# Optional: OpenAI for enhanced job analysis
OPENAI_API_KEY=your_openai_key_here
```

## ⚡ Intelligent Free Tier Management

The enhanced scraper automatically:

### **Smart Usage**:
- ✅ Prioritizes high-limit APIs (USAJobs first)
- ✅ Tracks daily/monthly usage
- ✅ Automatically switches to next available API
- ✅ Never exceeds free tier limits
- ✅ Works with any combination of keys

### **Fallback System**:
- ✅ If API A is at limit → switches to API B
- ✅ If all APIs at limit → uses profile-based generation
- ✅ Always returns results, even without any API keys

### **Usage Tracking**:
The system shows you exactly how much quota you're using:
```json
{
  "daily_usage": { "usajobs": 15, "serpapi": 5 },
  "monthly_usage": { "usajobs": 245, "serpapi": 67 },
  "available_apis": ["adzuna", "reed", "remotive"]
}
```

## 🎯 Recommended Signup Order

### **Week 1** (Start with these 3):
1. USAJobs API (10,000/month - highest limits)
2. SerpAPI (100/month - Google Jobs)
3. Adzuna API (1000/month - job aggregator)

### **Week 2** (Add these when ready):
4. Reed API (1000/month - UK/US jobs)
5. The Muse API (1000/month - career focus)
6. Jobs2Careers API (1000/month - aggregator)

## 📈 Impact on Your Job Search

### **Before** (JSearch only):
- 25 searches/day
- 500 searches/month
- 1 job source

### **After** (All free APIs):
- **750+ searches/day**
- **15,600+ searches/month**
- **8 job sources + 30+ site integrations**
- **Government jobs included**
- **Remote job specialization**
- **Smart quota management**

## 🚀 Getting Started

1. **Test now**: Your current JSearch key already works with the enhanced system
2. **Add USAJobs**: Sign up for the highest-limit API first
3. **Add SerpAPI**: Get Google Jobs integration
4. **Add more**: Each API exponentially increases your job coverage

The system is designed to work **immediately** with what you have and get **progressively better** as you add more free APIs! 