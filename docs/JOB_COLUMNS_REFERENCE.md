# Job Columns Reference

## Match Scoring Alignment

**Current System Threshold: 70%**

All endpoints and UI components are aligned to use **70%** as the minimum match score threshold:

- ✅ `/api/matched-jobs` - Uses `fit_score >= 70`
- ✅ `/api/ai-match` - Uses `minScore: 70` 
- ✅ `/api/cron/daily-job-email` - Uses `fit_score >= 70`
- ✅ Dashboard UI - Shows "Matched Jobs (70%+ Match)"
- ✅ Matching system (`lib/matching/getEligibleJobs.ts`) - Default threshold: 70%

## scraped_jobs Table Columns

### Core Job Information
| Column Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `id` | UUID | Primary key | Yes | Auto-generated |
| `title` | TEXT | Job title | Yes | "Senior PeopleSoft Developer" |
| `company` | TEXT | Company name | Yes | "Tech Corp" |
| `location` | TEXT | Job location | Yes | "New York, NY" or "Remote" |
| `url` | TEXT | Job posting URL | Yes (unique) | "https://jobs.example.com/123" |
| `description` | TEXT | Job description/requirements | No | Full job description text |
| `salary` | TEXT | Pay rate/salary | No | "$80/hr" or "$150k/year" |
| `posted_date` | DATE | When job was posted | Yes | "2025-01-03" |
| `source` | TEXT | Where job came from | Yes | "dice", "indeed", "manual" |

### Job Type & Classification
| Column Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `job_type` | TEXT | Contract type | Yes | "w2-contract", "c2c", "1099", "full-time" |
| `is_remote` | BOOLEAN | Remote work flag | No | true/false |
| `is_active` | BOOLEAN | Active status | Yes | true/false |
| `is_real` | BOOLEAN | Real job flag | Yes | true/false |

### Matching & Scoring (Added in 20250103_add_job_matching_fields.sql)
| Column Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `skills` | JSONB | Array of required skills | No | ["JavaScript", "React", "Node.js"] |
| `required_years_experience` | INTEGER | Minimum years required | No | 5 |
| `required_degree` | TEXT | Required degree/certification | No | "Bachelor's", "Master's" |
| `pay_rate_min` | NUMERIC | Minimum pay rate (hourly) | No | 80.00 |
| `pay_rate_max` | NUMERIC | Maximum pay rate (hourly) | No | 120.00 |

### Matching Results (Set by AI matching system)
| Column Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `profile_id` | UUID | Matched candidate profile | No | UUID reference |
| `fit_score` | INTEGER | Match score (0-100) | No | 85 |
| `match_reasons` | JSONB | Array of match reasons | No | ["Skills match", "Experience match"] |

### Metadata & Tracking
| Column Name | Type | Description | Required | Example |
|------------|------|-------------|----------|---------|
| `is_constant_search` | BOOLEAN | Constant search flag | No | true/false |
| `constant_search_type` | TEXT | Type of constant search | No | "peoplesoft" |
| `search_type` | TEXT | Search type | No | "it-c2c" |
| `scraped_at` | TIMESTAMP | When job was scraped | No | Auto-set |
| `created_at` | TIMESTAMP | Record creation time | Yes | Auto-set |
| `updated_at` | TIMESTAMP | Last update time | Yes | Auto-set |

## Recommended Job List Display Columns

For displaying jobs in a list/table format, use these columns in order:

### Primary Display (Always Show)
1. **Title** - `title`
2. **Company** - `company`
3. **Location** - `location` (or "Remote" if `is_remote = true`)
4. **Job Type** - `job_type` (display label: "W2 Contract", "C2C", etc.)
5. **Posted Date** - `posted_date` (formatted: "2 days ago")
6. **Match Score** - `fit_score` (if matched, show as percentage badge)

### Secondary Display (Show on Expand/Details)
7. **Salary/Rate** - `salary` or `pay_rate_min`-`pay_rate_max`
8. **Description** - `description` (truncated to 200 chars)
9. **Required Skills** - `skills` (as tags)
10. **Required Experience** - `required_years_experience` (if available)
11. **Required Degree** - `required_degree` (if available)
12. **Match Reasons** - `match_reasons` (if matched)
13. **Source** - `source` (badge: "Dice", "Indeed", etc.)
14. **Job URL** - `url` (link to original posting)

### Optional/Admin Columns
15. **ID** - `id` (for admin/debugging)
16. **Is Active** - `is_active` (toggle for admin)
17. **Is Remote** - `is_remote` (checkbox/badge)
18. **Created At** - `created_at` (for admin)

## Column Mapping for Job Upload

When uploading jobs via Excel/CSV, map columns as follows:

| Excel Column Name | Maps To | Required |
|------------------|---------|----------|
| Job Title / Title | `title` | ✅ Yes |
| Company | `company` | ✅ Yes |
| Location | `location` | ✅ Yes |
| Job Type / Type | `job_type` | ✅ Yes |
| Pay Rate / Salary / Rate | `salary` | No |
| Posted Date / Date | `posted_date` | ✅ Yes |
| Source | `source` | ✅ Yes |
| Job Link / URL / Link | `url` | ✅ Yes |
| Key Requirements / Description | `description` | No |

## Match Score Breakdown

When displaying match scores, show the breakdown from `score_breakdown`:

- **Skills Match**: 0-25 points
- **Job Title Match**: 0-25 points  
- **Experience Match**: 0-20 points (can be negative)
- **Degree Match**: 0-20 points (can be negative)
- **Pay Rate Match**: 0-10 points (can be negative)

**Total Score**: Sum of all components, clamped to 0-100

## Notes

- All jobs must have a unique `url` (enforced by unique index)
- Jobs older than 30 days are automatically filtered out
- Only `is_active = true` jobs are shown to users
- Match scores (`fit_score`) are only set when jobs are matched to candidates via `/api/ai-match`
- The matching system uses deterministic scoring (no AI) before passing to AI for final review

