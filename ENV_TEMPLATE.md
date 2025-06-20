# 🔐 Environment Variables Template

## Add these to your `.env.local` file:

```env
# ========================================
# EXISTING APIs (You already have JSearch)
# ========================================

# JSearch API via RapidAPI (500 free calls/month)
JSEARCH_API_KEY=2ff97245b9msh5927579bf598da5p13d42djsnf561061fe49d

# SerpAPI - Google Jobs (100 free searches/month)
SERPAPI_KEY=your_serpapi_key_here

# Adzuna API - Job search (1000 free calls/month)  
ADZUNA_APP_ID=your_adzuna_app_id_here
ADZUNA_APP_KEY=your_adzuna_app_key_here

# OpenAI API - For GPT job analysis
OPENAI_API_KEY=your_openai_api_key_here

# ========================================
# NEW FREE TIER APIs (Added for you)
# ========================================

# Reed API - UK/US Jobs (1000 free calls/month)
REED_API_KEY=your_reed_api_key_here

# USAJobs API - Government Jobs (10,000 free calls/month)
USAJOBS_API_KEY=your_usajobs_api_key_here
USAJOBS_EMAIL=your_email@example.com

# The Muse API - Career resources + jobs (1000 free calls/month)
THEMUSE_API_KEY=your_themuse_api_key_here

# Jobs2Careers API - Job aggregator (1000 free calls/month)
JOBS2CAREERS_API_KEY=your_jobs2careers_api_key_here

# Note: Remotive API is completely free - no key needed!
```

## 🚀 Free API Signup Instructions

### 1. **Reed API** (1000 free calls/month)
- **What**: UK and US job listings
- **Signup**: https://www.reed.co.uk/developers
- **Free Tier**: 1000 calls/month
- **Setup**: Create account → Get API key → Add to `REED_API_KEY`

### 2. **USAJobs API** (10,000 free calls/month)
- **What**: Official U.S. government job listings
- **Signup**: https://developer.usajobs.gov/
- **Free Tier**: 10,000 calls/month (highest limit!)
- **Setup**: Register → Get API key → Add to `USAJOBS_API_KEY` and your email to `USAJOBS_EMAIL`

### 3. **The Muse API** (1000 free calls/month)
- **What**: Career-focused job listings with company insights
- **Signup**: https://www.themuse.com/developers
- **Free Tier**: 1000 calls/month
- **Setup**: Create developer account → Get API key → Add to `THEMUSE_API_KEY`

### 4. **Jobs2Careers API** (1000 free calls/month)
- **What**: Job aggregator from multiple sources
- **Signup**: https://www.jobs2careers.com/api
- **Free Tier**: 1000 calls/month
- **Setup**: Register → Get publisher ID → Add to `JOBS2CAREERS_API_KEY`

### 5. **Remotive API** (Completely FREE!)
- **What**: Remote job listings (no authentication needed)
- **Endpoint**: https://remotive.io/api/remote-jobs
- **Free Tier**: Unlimited (no key required)
- **Setup**: Already integrated - no signup needed!

## 🎯 Smart Free Tier Management Features

### **Intelligent API Usage**:
- **Priority System**: High-priority APIs (SerpAPI, JSearch) used first
- **Daily Limits**: Automatic tracking to prevent quota exhaustion
- **Monthly Limits**: Resets automatically on first day of month
- **Fallback System**: Switches to next available API when limits reached

### **Usage Tracking**:
```javascript
// The system automatically tracks:
{
  "daily_usage": {
    "jsearch": 5,
    "serpapi": 3,
    "adzuna": 12
  },
  "monthly_usage": {
    "jsearch": 45,
    "serpapi": 28,
    "adzuna": 156
  },
  "available_apis": ["reed", "usajobs", "themuse", "remotive"]
}
```

### **Free Tier Limits Built-in**:
- **SerpAPI**: 10/day, 100/month
- **Adzuna**: 50/day, 1000/month  
- **JSearch**: 25/day, 500/month
- **Reed**: 50/day, 1000/month
- **USAJobs**: 500/day, 10,000/month (best limits!)
- **TheMuse**: 50/day, 1000/month
- **Jobs2Careers**: 50/day, 1000/month
- **Remotive**: Unlimited (free)
- **OpenAI**: 10/day, 100/month (for GPT analysis)

## 📊 Total Free Tier Capacity

With all APIs combined, you get:
- **Daily**: ~750 job searches per day
- **Monthly**: ~15,600 job searches per month
- **Sources**: 8+ real job APIs + 30+ job site integrations
- **Coverage**: US, UK, Government, Remote, Tech, General jobs

## 🎉 What This Means

### **Before** (with just your JSearch key):
- 25 searches/day, 500/month
- 1 real API source

### **After** (with all free APIs):
- **750+ searches/day, 15,600+/month**
- **8 real API sources**
- **Intelligent usage management**
- **Automatic fallbacks**
- **Government jobs included**
- **Remote job specialization**

## 🚀 Quick Start

1. **Copy your existing JSearch key** (already working!)
2. **Sign up for 2-3 more APIs** (USAJobs has highest limits)
3. **Add keys to `.env.local`**
4. **Test the enhanced search** - it will automatically use available APIs

The system works **immediately** with just your JSearch key and gets **exponentially better** as you add more free APIs!

## 🔒 Security Notes

- ✅ Keep all keys in `.env.local`
- ✅ Add `.env.local` to `.gitignore`  
- ✅ Never commit API keys to version control
- ✅ The system gracefully handles missing keys 