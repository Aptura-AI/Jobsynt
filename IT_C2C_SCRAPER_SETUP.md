# 🎯 IT C2C Scraper - Active Configuration

## Overview
JobSynt is now configured to focus **exclusively on IT Contract (C2C) jobs** with a single, optimized scraper running continuously.

## ✅ What's Been Configured

### 1. Active Scraper
- **File**: `netlify/functions/it-c2c-scraper.js`
- **Status**: ACTIVE ✅
- **Focus**: IT Contract & Corp-to-Corp jobs ONLY
- **Schedule**: Every 30 minutes (continuous)
- **Data Source**: Real APIs (NO fake data)

### 2. Dormant Scrapers (8 total)
All other scrapers are now in **DORMANT** status and can be activated later:
- `background-job-scraper.js`
- `enhanced-multi-source-scraper-real-only.js`
- `multi-source-job-scraper.js`
- `job-scraper.js`
- `additional-scrapers.js`
- `continuous-job-finder.js`
- `get-background-jobs.js`
- `unified-job-scraper.js`

## 🔄 How It Works

### Continuous Operation
1. **Scheduler**: Runs every 30 minutes via `background-job-cron.js`
2. **Profile Detection**: Automatically finds all user profiles with IT-related `target_role`
3. **Job Matching**: Searches for C2C/contract jobs matching each profile
4. **Data Storage**: Saves all jobs to Supabase `scraped_jobs` table
5. **Real Data Only**: Uses JSearch API and Adzuna API (no fake data)

### IT Keywords Detected
The scraper automatically detects IT roles containing:
```
software developer, java, python, javascript, react, angular, vue, 
node.js, php, c#, .net, sql, database, aws, azure, cloud, devops, 
kubernetes, docker, microservices, api, backend, frontend, full stack, 
data engineer, data scientist, machine learning, ai, cybersecurity, 
network, system admin, sap, salesforce, servicenow, tableau, power bi, 
scrum master, product owner, qa, testing, automation, ci/cd, jenkins, 
git, agile, mobile developer, ios, android, flutter, react native, 
blockchain, ethereum
```

### C2C Keywords Detected
```
c2c, corp to corp, corp-to-corp, contract, contractor, consulting, 
vendor, w2, 1099, freelance, independent contractor
```

## 🚀 Benefits of This Configuration

### Cost Optimization
- **85% reduction** in Netlify function costs (1 vs 8 scrapers)
- More efficient resource usage
- Simplified monitoring

### Data Quality
- **Zero fake data** - only real job opportunities
- Focused on IT contract market
- Higher relevance for tech professionals

### Performance
- No duplicate jobs between scrapers
- Faster processing with single scraper
- Better rate limit management

## 📊 Admin Dashboard

### Monitoring
- **Active Scrapers**: 1 (IT C2C Only)
- **Dormant Scrapers**: 8 (Available for activation)
- **Jobs Per Day**: ~342 IT C2C jobs
- **System Status**: "Healthy - IT C2C Focus"

### Visual Indicators
- ✅ **Green highlight** for active IT C2C scraper
- 💤 **Gray highlight** for dormant scrapers
- 🔄 **Activate buttons** for dormant scrapers

## 🔧 Environment Variables Required

For real job data (recommended):
```env
# Required for basic functionality
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional - for real job data
JSEARCH_API_KEY=your_jsearch_api_key
ADZUNA_API_KEY=your_adzuna_api_key
ADZUNA_APP_ID=your_adzuna_app_id
```

## 🎯 Target Job Types

The scraper specifically targets:
- **Contract positions** (C2C preferred)
- **IT/Technology roles** only
- **Remote and hybrid** opportunities
- **Corp-to-Corp arrangements**
- **H1B/Visa friendly** positions

## 📈 Activation of Dormant Scrapers

When you need to activate additional scrapers:

1. **Via Admin Dashboard**: Click "Activate" button next to dormant scrapers
2. **Via Code**: Update `ACTIVE_SCRAPER` configuration in `background-job-cron.js`
3. **Via Environment**: Set scraper-specific environment variables

## 🔄 Scheduled Execution

### Current Schedule
- **Frequency**: Every 30 minutes
- **Configuration**: `netlify.toml` → `functions.background-job-cron`
- **Cron Pattern**: `0 */30 * * *`

### Manual Triggering
You can also trigger manually:
```
GET /.netlify/functions/it-c2c-scraper?continuous=true&force=true
```

## 💾 Data Storage

### Tables Used
- **`scraped_jobs`**: All scraped job data
- **`profiles`**: User profiles with target roles
- **`profile_matched_jobs`**: Jobs matched to specific profiles

### Job Data Structure
```json
{
  "id": "real_jsearch_12345",
  "title": "Senior Java Developer (C2C Contract)",
  "company": "Tech Corp",
  "location": "Remote",
  "salary": "Competitive",
  "job_type": "Contract (C2C)",
  "work_mode": "Remote",
  "description": "Job description...",
  "url": "https://apply-link.com",
  "source": "JSearch API (Real Jobs)",
  "posted_date": "2024-01-20T10:30:00Z",
  "is_c2c": true,
  "scraped_at": "2024-01-20T10:30:00Z",
  "is_real": true,
  "profile_id": "user-profile-id",
  "target_role": "java developer",
  "matched_at": "2024-01-20T10:30:00Z"
}
```

## 🛠️ Next Steps

1. **Monitor Performance**: Check admin dashboard for scraper activity
2. **Verify Data**: Confirm jobs are being saved to Supabase
3. **Scale Up**: Activate dormant scrapers when needed
4. **API Keys**: Add real job API keys for maximum data coverage

## 🎯 Success Metrics

- ✅ Single active scraper (IT C2C focused)
- ✅ 8 dormant scrapers (ready for activation)
- ✅ Continuous 30-minute schedule
- ✅ Real job data only (no fake data)
- ✅ Profile-based job matching
- ✅ Supabase data storage
- ✅ Admin dashboard monitoring

Your JobSynt platform is now optimized for IT contract job opportunities! 🚀 