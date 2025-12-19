# Job Excel Upload - Column Reference

## ✅ REQUIRED COLUMNS (Upload will fail without these)

| Column Name | Accepted Variations | Example | Notes |
|------------|-------------------|---------|-------|
| **Title** | `Title`, `Job Title`, `JobTitle` | "Oracle HCM Developer" | Job title/position name |
| **Company** | `Company`, `Company Name`, `CompanyName` | "Valiant Technologies" | Company/employer name |
| **URL** | `URL`, `Link`, `Job Link`, `Job URL`, `JobLink`, `JobURL` | "https://example.com/job/123" | Must start with "http" or "https" |

---

## 📋 OPTIONAL COLUMNS (Have defaults if missing)

| Column Name | Accepted Variations | Default Value | Example | Notes |
|------------|-------------------|---------------|---------|-------|
| **Location** | `Location`, `Job Location`, `City` | Empty string | "Remote", "New York, NY" | Job location |
| **Is Remote** | `Is Remote`, `Remote`, `IsRemote`, `Work Type`, `WorkType` | `false` | "Yes", "True", "1" | **If "Yes", overrides location and forces Remote** |
| **Job Type** | `Job Type`, `JobType`, `Type`, `Employment Type` | `w2-contract` | "c2c", "1099", "full-time" | Valid: c2c, 1099, w2-contract, full-time |
| **Must Have Skills** | `Must Have Skills`, `Must Have`, `MustHave`, `Primary Skills`, `Required Skills`, `Skills` | Empty array `[]` | "Oracle, HCM, Payroll" | Comma/semicolon/pipe separated |
| **Good To Have Skills** | `Good To Have Skills`, `Good To Have`, `GoodToHave`, `Nice To Have`, `Secondary Skills`, `Optional Skills` | Empty array `[]` | "BI, Reporting, SQL" | Comma/semicolon/pipe separated |
| **Experience / Years** | `Experience`, `Years`, `Years Experience`, `Experience Years`, `Required Years Experience`, `Min Experience`, `Exp` | `0` | "5", "10+", "5-7 years" | Extracts first number |
| **Pay Rate** | `Pay Rate`, `Rate`, `Salary`, `Compensation`, `PayRate`, `Pay` | `null` | "$80/hr", "$100k", "80-100" | Stored as-is |
| **Description** | `Description`, `Key Requirements`, `Requirements`, `Job Description`, `JobDescription`, `Req` | Empty string `""` | "Full job description..." | Job description text |
| **Posted Date** | `Posted Date`, `PostedDate`, `Posted`, `Date` | Today's date | "12/18/2024", "today", "3 days ago" | Formats: mm/dd/yyyy, mm-dd-yyyy, "today", "yesterday", "X days ago" |
| **Source** | `Source` | `"manual"` | "LinkedIn", "Dice" | Job source identifier |
| **Target Candidate IDs** | `Target Candidate IDs`, `Target Candidates`, `TargetCandidateIds`, `Candidate IDs`, `Assigned To` | `null` | "uuid1,uuid2" | Comma-separated UUIDs for explicit targeting |

---

## 📝 Column Name Examples (All Accepted)

The system is flexible with column naming. These all work:

### Title
- `Title`
- `Job Title`
- `JobTitle`

### Company
- `Company`
- `Company Name`
- `CompanyName`

### URL
- `URL`
- `Link`
- `Job Link`
- `Job URL`
- `JobLink`
- `JobURL`

### Skills
- `Must Have Skills` or `Must Have` or `Skills`
- `Good To Have Skills` or `Good To Have` or `Nice To Have`

### Experience
- `Experience` or `Years` or `Experience Years` or `Required Years Experience`

---

## ⚠️ Important Notes

1. **Is Remote Priority**: If `Is Remote = "Yes"`, the job is ALWAYS treated as Remote, regardless of Location column
2. **Skills Format**: Can be comma, semicolon, or pipe separated: `"Oracle, HCM, Payroll"` or `"Oracle; HCM; Payroll"`
3. **Experience Format**: Can be `"5"`, `"10+"`, `"5-7 years"` - system extracts first number
4. **Date Format**: Supports `mm/dd/yyyy`, `mm-dd-yyyy`, `"today"`, `"yesterday"`, `"3 days ago"`
5. **Job Type**: If invalid, defaults to `w2-contract`. Valid values: `c2c`, `1099`, `w2-contract`, `full-time`
6. **Platform Extraction**: Platform is automatically extracted from Title + Skills (no column needed)

---

## 📊 Minimum Excel Template

**Minimum required columns:**
```
Title | Company | URL
```

**Recommended columns:**
```
Title | Company | URL | Location | Is Remote | Job Type | Must Have Skills | Experience | Pay Rate | Posted Date
```

**Full template (all columns):**
```
Title | Company | URL | Location | Is Remote | Job Type | Must Have Skills | Good To Have Skills | Experience | Pay Rate | Description | Posted Date | Source | Target Candidate IDs
```

