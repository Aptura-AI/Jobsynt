# Collaborative Apply-for-Me Feature

## Overview

Extended Apply-for-Me feature with human-in-the-loop automation, making Jobsynt the candidate's control center for job applications.

## Key Features

### 1. **Collaborative Mode (Default)**
- Human intervention when needed (CAPTCHA, login, signup)
- Candidate remains in control
- Transparent process with clear instructions
- Resume from exactly where paused

### 2. **Supported Sites**
- ✅ Dice (existing)
- ✅ Greenhouse (existing)
- ✅ TechFetch (new)
- ✅ ZipRecruiter (new)

### 3. **Human Intervention Flow**
- CAPTCHA detection → Pause → Candidate completes → Resume
- Login required → Pause → Candidate logs in → Resume
- Signup required → Navigate → Pause for email verification → Resume
- All interventions logged and resumable

### 4. **Safety & Compliance**
- ✅ GPT never receives HTML/DOM/credentials
- ✅ No credential persistence
- ✅ No CAPTCHA bypassing
- ✅ One job failure doesn't stop batch
- ✅ Browser crash recovery
- ✅ Abandoned pause cleanup (24h)

## Database Changes

### New Table: `candidate_site_accounts`
Tracks account status per site:
- `NOT_CREATED` - No account yet
- `CREATED` - Account created, awaiting activation
- `ACTIVATED` - Email verified
- `VERIFIED` - Fully verified and ready

### Updated: `job_application_runs`
New columns:
- `status`: Added `WAITING_FOR_CANDIDATE`
- `intervention_reason`: Why paused
- `intervention_message`: Human-readable message
- `paused_at`: When paused
- `resume_token`: Secure resume token

## API Endpoints

### `POST /api/apply-for-me`
Initiates applications (existing, enhanced)

### `POST /api/apply-for-me/resume`
Resumes paused applications after human intervention

### `GET /api/apply-for-me/status`
Returns application status including paused interventions

## Components

### `ApplyForMeIntervention.tsx`
Modal shown when intervention required:
- Clear instructions
- "I've completed this step" button
- "Resume Later" option
- Notification sound

### `ApplicationStatus.tsx` (Enhanced)
Shows:
- All application statuses including `WAITING_FOR_CANDIDATE`
- Intervention details
- Auto-displays intervention modal when needed

## Site Adapters

### TechFetch (`lib/applyForMe/sites/techfetch.ts`)
- Site-specific login detection
- Signup navigation
- CAPTCHA handling

### ZipRecruiter (`lib/applyForMe/sites/ziprecruiter.ts`)
- Site-specific login detection
- Signup navigation
- CAPTCHA handling (common on ZipRecruiter)

## Configuration

### Feature Flags
- `AUTO_APPLY_ENABLED` (default: `false`)
  - When `true`: Full automation mode
  - When `false`: Collaborative mode (default)

### Environment Variables
```bash
AUTO_APPLY_ENABLED=false  # Keep collaborative mode
```

## Flow Diagram

```
1. Candidate selects jobs → Clicks "Apply for Me"
2. System creates application runs (status: pending)
3. Orchestrator processes sequentially:
   a. Navigate to job URL
   b. Check for CAPTCHA → If found: PAUSE
   c. Check for login → If needed: PAUSE
   d. Extract form questions
   e. Get GPT answers (structured data only)
   f. Fill form
   g. Submit
4. If paused:
   a. Update status to WAITING_FOR_CANDIDATE
   b. Show intervention modal
   c. Wait for candidate action
   d. On resume: Continue from step where paused
5. Log all outcomes
```

## Safety Guarantees

1. **No Breaking Changes**: All existing functionality preserved
2. **Isolated Modules**: Site adapters don't share logic
3. **GPT Safety**: Only structured JSON, never HTML/DOM
4. **No Credential Storage**: Passwords generated in memory only
5. **Resumable**: All paused applications can be resumed
6. **Crash Recovery**: Browser crashes detected and handled
7. **One Failure ≠ Batch Failure**: Each job isolated

## Testing Checklist

- [ ] Dice applications still work
- [ ] Greenhouse applications still work
- [ ] TechFetch signup flow pauses correctly
- [ ] TechFetch resume works after pause
- [ ] ZipRecruiter CAPTCHA pauses correctly
- [ ] ZipRecruiter resume works after pause
- [ ] No credentials persisted
- [ ] GPT only receives structured data
- [ ] Dashboard shows intervention status
- [ ] Resume API works correctly
- [ ] Browser crash recovery works
- [ ] No regressions in existing features

## Migration

Run the SQL migration:
```sql
-- Run: supabase/migrations/20250203_add_collaborative_apply_for_me.sql
```

This adds:
- New status `WAITING_FOR_CANDIDATE`
- Intervention tracking columns
- `candidate_site_accounts` table

## Future Enhancements

- Full automation mode (when `AUTO_APPLY_ENABLED=true`)
- More site adapters
- Batch resume capability
- Intervention analytics

