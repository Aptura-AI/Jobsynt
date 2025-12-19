# Admin Dashboard Enhancement Plan

## Overview
Enhance the admin dashboard with:
1. **Job Editing Interface** - Edit and align job information
2. **Candidate Targeting** - Add candidate UUIDs to jobs
3. **Candidate Management** - View all candidates, profiles, and download resumes

---

## 🎯 PHASE 1: Job Management Interface

### 1.1 New API Endpoints

#### `GET /api/admin/jobs`
- Fetch all jobs from `scraped_jobs` table
- Support pagination, filtering, and search
- Return: `{ jobs: [], total: number, page: number }`

#### `GET /api/admin/jobs/[id]`
- Fetch single job with full details
- Return all fields including `target_candidate_ids`

#### `PATCH /api/admin/jobs/[id]`
- Update job fields (title, company, description, skills, etc.)
- Update `target_candidate_ids` (add/remove candidate UUIDs)
- Validate data before saving
- Return updated job

#### `POST /api/admin/jobs/[id]/target-candidates`
- Add candidate UUIDs to job's `target_candidate_ids`
- Accept: `{ candidate_ids: string[] }`
- Merge with existing targets (no duplicates)
- Return updated job

#### `DELETE /api/admin/jobs/[id]/target-candidates`
- Remove candidate UUIDs from job
- Accept: `{ candidate_ids: string[] }`
- Return updated job

### 1.2 UI Components

#### `app/admin/jobs/page.tsx` (New Page)
- Job list table with:
  - Title, Company, Location, Platform, Source
  - Status badges (Active/Inactive)
  - Quick actions (Edit, View, Target)
  - Search and filter
  - Pagination

#### `app/admin/jobs/[id]/page.tsx` (Job Edit Page)
- Full job editing form with sections:
  - **Basic Info**: Title, Company, URL, Location, Job Type
  - **Skills**: Must Have, Good To Have (editable text areas)
  - **Requirements**: Experience, Salary, Description
  - **Platform**: Primary Platform, Secondary Platforms
  - **Targeting**: Candidate UUID input (comma-separated or multi-select)
  - **Metadata**: Source, Posted Date, Active Status
- Save/Cancel buttons
- Real-time validation
- Success/error notifications

#### `components/admin/JobList.tsx`
- Reusable job list component
- Sortable columns
- Row actions (Edit, Delete, Target)

#### `components/admin/JobEditForm.tsx`
- Reusable job edit form
- Field validation
- Auto-save draft (optional)

---

## 🎯 PHASE 2: Candidate Management Interface

### 2.1 Enhanced API Endpoints

#### `GET /api/admin/candidates` (Enhance Existing)
- Fetch ALL candidates (not just `created_by_admin = true`)
- Add pagination, search, filtering
- Return: `{ candidates: [], total: number }`

#### `GET /api/admin/candidates/[id]` (New)
- Fetch full candidate profile from `profiles` table
- Include: skills, experience, resume_url, summary, etc.
- Return complete profile data

#### `GET /api/admin/candidates/[id]/resume` (New)
- Download candidate resume
- Stream file from Supabase storage
- Set proper headers for download

### 2.2 UI Components

#### `app/admin/candidates/page.tsx` (Enhance Existing)
- Candidate list table:
  - Name, Email, Location, Experience, Skills
  - Status, Created Date
  - Actions: View Profile, Download Resume, Edit
- Search and filter
- Click name → opens profile modal/page

#### `app/admin/candidates/[id]/page.tsx` (New - Profile View)
- Full candidate profile display:
  - **Personal Info**: Name, Email, Phone, Location
  - **Experience**: Years, Title, Summary
  - **Skills**: Primary, Secondary, Adjacent, Generic
  - **Preferences**: Job Types, Work Mode, Rate Expectation
  - **Visa Status**: Current status
  - **Resume**: Download button (if available)
  - **Platform**: Primary/Secondary platforms
- Edit button (opens edit form)
- Back to list button

#### `components/admin/CandidateList.tsx`
- Reusable candidate list component
- Clickable rows (navigate to profile)
- Quick actions

#### `components/admin/CandidateProfile.tsx`
- Reusable profile display component
- Resume download functionality
- Edit mode toggle

---

## 🎯 PHASE 3: Navigation & Integration

### 3.1 Admin Dashboard Navigation
- Add tabs/sections:
  - **Dashboard** (existing metrics)
  - **Jobs** (new - job management)
  - **Candidates** (enhanced - full candidate list)
  - **Upload Jobs** (existing)
  - **Analytics** (existing)

### 3.2 Quick Actions
- From job edit page: "Target Candidates" button → opens candidate selector
- From candidate profile: "Target to Job" button → opens job selector
- Cross-linking between jobs and candidates

---

## 🔒 Security & Authorization

### All New Endpoints Must:
1. Verify admin JWT token (`/api/admin/me`)
2. Check `role === 'admin'`
3. Use service role key for database operations
4. Validate all inputs
5. Log admin actions (optional audit trail)

---

## 📋 Implementation Order

### Step 1: API Endpoints (Backend First)
1. ✅ `GET /api/admin/jobs` - List all jobs
2. ✅ `GET /api/admin/jobs/[id]` - Get single job
3. ✅ `PATCH /api/admin/jobs/[id]` - Update job
4. ✅ `GET /api/admin/candidates` - Enhanced list
5. ✅ `GET /api/admin/candidates/[id]` - Get profile
6. ✅ `GET /api/admin/candidates/[id]/resume` - Download resume

### Step 2: Job Management UI
1. Create job list page
2. Create job edit page
3. Add navigation link
4. Test job editing flow

### Step 3: Candidate Management UI
1. Enhance candidate list (show all, not just admin-created)
2. Create candidate profile page
3. Add resume download
4. Test candidate viewing flow

### Step 4: Integration
1. Add targeting UI to job edit form
2. Add candidate selector component
3. Test end-to-end targeting flow

---

## 🛡️ Safety Measures

### To Prevent Breaking Changes:
1. ✅ All new routes are `/admin/*` - isolated
2. ✅ Existing `/api/admin/*` endpoints unchanged
3. ✅ Existing admin dashboard remains functional
4. ✅ New features are additive only
5. ✅ Database schema changes are backward compatible
6. ✅ No changes to candidate-facing pages
7. ✅ No changes to matching logic

### Testing Checklist:
- [ ] Existing admin dashboard still works
- [ ] Job upload still works
- [ ] Metrics still load
- [ ] New job edit page works
- [ ] New candidate list works
- [ ] Resume download works
- [ ] Targeting works
- [ ] No console errors
- [ ] Mobile responsive (if needed)

---

## 📁 File Structure

```
app/
  admin/
    page.tsx                    # Existing dashboard (unchanged)
    AdminDashboardClient.tsx    # Existing (unchanged)
    jobs/                       # NEW
      page.tsx                  # Job list
      [id]/
        page.tsx                # Job edit page
    candidates/                 # NEW
      page.tsx                  # Enhanced candidate list
      [id]/
        page.tsx                # Candidate profile view

app/api/admin/
  jobs/                         # NEW
    route.ts                    # GET all jobs
    [id]/
      route.ts                  # GET/PATCH single job
      target-candidates/
        route.ts                # POST/DELETE targeting
  candidates/                    # NEW
    [id]/
      route.ts                  # GET candidate profile
      resume/
        route.ts                # GET resume download

components/admin/               # NEW
  JobList.tsx
  JobEditForm.tsx
  CandidateList.tsx
  CandidateProfile.tsx
  CandidateSelector.tsx         # For targeting
```

---

## 🎨 UI/UX Considerations

### Job Edit Form:
- **Layout**: Two-column form (left: basic info, right: skills/requirements)
- **Targeting Section**: 
  - Text input for UUIDs (comma-separated)
  - OR multi-select dropdown with candidate names
  - Show currently targeted candidates
  - Add/remove buttons
- **Validation**: Real-time field validation
- **Save**: Save button with loading state
- **Cancel**: Discard changes confirmation

### Candidate List:
- **Table View**: Sortable columns
- **Search**: By name, email, skills
- **Filters**: By location, experience, platform
- **Actions**: View, Download Resume, Edit (if needed)

### Candidate Profile:
- **Layout**: Card-based sections
- **Resume**: Large download button if available
- **Edit**: Inline edit or separate edit page
- **Navigation**: Breadcrumbs (Admin > Candidates > [Name])

---

## ✅ Acceptance Criteria

### Job Management:
- [ ] Admin can view all jobs in a table
- [ ] Admin can edit any job field
- [ ] Admin can add candidate UUIDs to target jobs
- [ ] Changes save successfully
- [ ] Validation prevents invalid data

### Candidate Management:
- [ ] Admin can view ALL candidates (not just admin-created)
- [ ] Admin can click candidate name to view full profile
- [ ] Admin can download candidate resume
- [ ] Profile shows all candidate information
- [ ] Navigation works smoothly

### Integration:
- [ ] Targeting works from job edit page
- [ ] Candidate UUIDs are saved correctly
- [ ] Targeted jobs appear for candidates
- [ ] No breaking changes to existing features

---

## 🚀 Ready to Implement?

This plan ensures:
- ✅ No breaking changes
- ✅ Isolated new features
- ✅ Backward compatible
- ✅ Secure (admin-only)
- ✅ Testable incrementally

Should I proceed with implementation?

