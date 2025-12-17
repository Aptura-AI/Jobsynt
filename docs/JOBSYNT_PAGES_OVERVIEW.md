# JobSynt.com - Pages & Features Overview

## 🌐 Public Pages

### 1. **Homepage** (`/`)
**Features:**
- Landing page for candidates and companies
- Hero section: "Your Personal AI Job Agent for C2C & 1099 Contracts"
- Value propositions: AI-Powered Matching, Personal Agent, No Ghost Jobs, 7-Day Free Trial
- Company section: "Access Pre-Vetted C2C & 1099 IT Contractors"
- Trust indicators and call-to-action buttons
- Links to signup/login

### 2. **Privacy Policy** (`/privacy`)
**Features:**
- Privacy policy page
- Data collection and usage information
- OAuth data handling details

---

## 🔐 Authentication Pages

### 3. **Sign Up** (`/signup`)
**Features:**
- Candidate registration
- OAuth options: Google, LinkedIn
- Email/password signup
- Email pre-fill from URL parameter (for admin-created candidates)
- Redirects to profile setup after registration

### 4. **Login** (`/login`)
**Features:**
- Candidate login
- OAuth options: Google, LinkedIn
- Email/password login
- Magic link option
- Redirects based on user role and onboarding status

### 5. **Reset Password** (`/reset-password`)
**Features:**
- Password reset flow for admin-created candidates
- Email auto-verification via link
- Password setting form
- Redirects to profile confirmation after password set

### 6. **Auth Callback** (`/auth/callback`)
**Features:**
- Handles OAuth callbacks (Google, LinkedIn)
- Email verification redirects
- Profile linking and creation
- Role-based redirects (admin → /admin, candidate → /dashboard or /candidates)

---

## 👤 Candidate Pages

### 7. **Dashboard** (`/dashboard`)
**Features:**
- **Stats Cards**: Total matches, applications, profile completion
- **Matched Jobs Section**: Shows jobs with 70%+ match score
  - Job cards with title, company, location, job type
  - Match score badges
  - "View All Jobs" link
- **AI Career Mentor**: Chat interface for job advice
  - To-and-fro conversation
  - Resume-aware responses
- **Quick Actions**: 
  - Update Profile
  - View All Jobs
  - Upload Resume
- **Profile Summary**: Skills, experience, location preview
- **Recent Matches**: Latest matched jobs
- Mobile responsive design

### 8. **Profile Setup** (`/candidates`)
**Features:**
- First-time profile creation form
- Pre-filled with admin-provided data (if admin-created)
- Fields:
  - Name, Email (disabled), Phone
  - Job Title, Location
  - Years of Experience
  - Skills (tag input)
  - Preferred Job Types (W2 Contract, C2C, 1099, Full-time)
  - Visa Status, Rate Expectation
  - Availability, Summary
  - Resume Upload
- Auto-loads existing data if profile exists
- Redirects to dashboard after save

### 9. **Update Profile** (`/dashboard` → Update Profile button)
**Features:**
- Same form as profile setup
- All fields pre-filled with saved data
- Email field disabled
- Can update any information
- Resume upload/replace
- Saves changes and redirects to dashboard

### 10. **Jobs Listing** (`/jobs`)
**Features:**
- Displays real jobs from `scraped_jobs` table
- Filtered: Active jobs from last 30 days
- Ordered: Latest first
- **Filters**:
  - Search (title, company, description)
  - Location
  - Experience level
  - Work mode (Remote, Onsite, Hybrid)
  - Skills
- **Job Cards**:
  - Title, Company, Location
  - Job Type badge
  - Description summary
  - Skills tags
  - Rate/Salary
  - "View Job" link
- Mobile responsive grid layout

### 11. **Job Detail** (`/jobs/[id]`)
**Features:**
- Full job description
- Company details
- Location, Job Type, Salary
- Skills required
- Apply button (if logged in)
- Link to original posting
- Application tracking

### 12. **Talent Pool** (`/talent-pool`)
**Features:**
- Browse other professionals (candidates)
- View candidate profiles
- Search and filter candidates
- **Note**: Removed from candidate dashboard (only visible to companies)

---

## 🏢 Company Pages

### 13. **Company Login** (`/company/login`)
**Features:**
- Company/recruiter login
- Email/password authentication
- Redirects to company dashboard

### 14. **Company Register** (`/company/register`)
**Features:**
- Company signup form
- Company information collection
- Creates company profile

### 15. **Company Dashboard** (`/company`)
**Features:**
- Company dashboard for recruiters
- Post jobs
- View applications
- Access talent pool
- Manage job postings

---

## 👨‍💼 Admin Pages

### 16. **Admin Dashboard** (`/admin`)
**Features:**
- **Executive Metrics** (6 cards):
  - Total Candidates
  - Active Candidates (7d)
  - Active Jobs
  - Jobs Matched Today
  - Avg Match Score
  - Email Open Rate (24h)
  
- **Candidate Funnel**:
  - Registered → Profiles Complete → With Matches → Emailed → Opened Email
  - Completion rates and percentages
  
- **AI Matching Health**:
  - Jobs Evaluated → Passed Pre-Filter → Passed AI Threshold
  - Rejection reasons breakdown (Location, Job Type, Skills, Pay, Experience, Low Score)
  
- **Email Performance**:
  - Total Sent/Opened (30d)
  - Open Rate with trend (vs last week)
  - Sent Today / Opened Today
  
- **Job Upload**:
  - Excel/CSV upload for bulk job import
  - Column mapping and validation
  - Success/error reporting
  
- **Candidate Management**:
  - Create/Edit/Delete candidates
  - View candidate list
  - Upload resumes for candidates

---

## 🔧 API Endpoints

### Candidate APIs
- `/api/profile` - Get/Update candidate profile
- `/api/matched-jobs` - Get matched jobs (70%+ score)
- `/api/resume/upload` - Upload resume file
- `/api/apply` - Apply to job
- `/api/ai-mentor` - AI chat for career advice
- `/api/job-applications` - Track applications

### Admin APIs
- `/api/admin/metrics` - Executive metrics
- `/api/admin/funnel` - Candidate funnel data
- `/api/admin/ai-health` - AI matching pipeline health
- `/api/admin/email-metrics` - Email performance metrics
- `/api/admin/upload-jobs` - Bulk job upload
- `/api/admin/me` - Admin session verification
- `/api/candidates` - CRUD operations for candidates

### Company APIs
- `/api/company/post-job` - Post new job
- `/api/company/login` - Company authentication
- `/api/company/signup` - Company registration

### System APIs
- `/api/ai-match` - AI job matching (deterministic + AI review)
- `/api/email/open` - Email open tracking pixel
- `/api/cron/daily-job-email` - Daily email cron job
- `/api/cron/ai-match` - Scheduled AI matching

---

## 🎯 Key Features Summary

### For Candidates:
✅ **Two-Layer Job Matching**
- Hard filters (location, job type)
- Deterministic scoring (skills, experience, pay, degree)
- AI review for final ranking
- 70%+ match threshold

✅ **AI Career Mentor**
- Conversational chat interface
- Resume-aware advice
- Job matching insights

✅ **Profile Management**
- Complete profile setup
- Resume upload and parsing
- Skills and preferences tracking

✅ **Job Discovery**
- Real-time job listings
- Advanced filtering
- Match score indicators
- Application tracking

✅ **Daily Email Digest**
- Personalized job matches
- Email open tracking
- One email per day (idempotent)

### For Companies:
✅ **Free Job Posting**
✅ **Talent Pool Access**
✅ **Application Management**

### For Admins:
✅ **Comprehensive Dashboard**
- Real-time metrics
- Candidate funnel visualization
- AI matching health monitoring
- Email performance tracking

✅ **Bulk Operations**
- Excel job upload
- Candidate management
- System monitoring

---

## 🔄 User Flows

### New Candidate Flow:
1. Sign up (`/signup`) → Email verification
2. Profile setup (`/candidates`) → Complete profile
3. Dashboard (`/dashboard`) → View matches, use AI mentor
4. Browse jobs (`/jobs`) → Apply to opportunities
5. Receive daily emails → Click tracking pixel → Opens tracked

### Admin-Created Candidate Flow:
1. Admin creates candidate → Profile saved
2. Password reset email sent → Auto-verified
3. Set password (`/reset-password`) → Profile linked
4. Confirm profile (`/candidates`) → Pre-filled data
5. Dashboard (`/dashboard`) → Full access

### Company Flow:
1. Register (`/company/register`) → Create account
2. Login (`/company/login`) → Access dashboard
3. Post jobs → Manage applications
4. Browse talent pool → Find candidates

---

## 📊 Data Sources

- **Jobs**: `scraped_jobs` table (Supabase)
- **Candidates**: `profiles` table (Supabase)
- **Applications**: `job_applications` table
- **Email Tracking**: `email_events` and `email_opens` tables
- **Resumes**: Supabase Storage (`resumes` bucket)

---

## 🔐 Authentication

- **Custom JWT**: `jobsynth_token` cookie
- **OAuth**: Google, LinkedIn (via Supabase Auth)
- **Email/Password**: Supabase Auth
- **Magic Links**: Passwordless login option
- **Role-Based**: Admin, Candidate, Company roles

---

## 📱 Mobile Responsiveness

All pages are mobile-responsive with:
- Responsive grids (1 column → 2 → 3 → 4 columns)
- Touch-friendly buttons
- Adaptive text sizes
- Mobile-optimized forms
- Collapsible filters

---

## 🚀 Automated Systems

- **Daily Email Cron**: Sends job matches at 12:00 PM
- **AI Matching**: Deterministic scoring + AI review
- **Email Tracking**: Open rate monitoring
- **Duplicate Prevention**: Idempotent email sending

