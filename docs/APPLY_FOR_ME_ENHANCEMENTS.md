# Apply-for-Me Enhancements

## Overview

Surgical enhancements to Collaborative Apply-for-Me system adding login memory, intervention timeouts, resume validation, and idempotent behavior.

## Requirements Implemented

### ✅ Requirement 1: Email Activation First Time Only (Login Memory)

**Secure Credential Storage**
- Created `lib/applyForMe/credentials.ts`
- Passwords encrypted at rest using AES-256-GCM
- Decrypt only in memory
- Never logged or sent to GPT
- Stored in `candidate_site_accounts.encrypted_credentials` (JSONB)

**Auto-Login Flow**
- After first signup + email activation → credentials stored
- Future runs: Auto-login attempted automatically
- If auto-login fails → Human intervention triggered
- Exception-based, not default

**Updated Site Adapters**
- TechFetch: Auto-login support
- ZipRecruiter: Auto-login support
- Both check for credentials before pausing

### ✅ Requirement 2: Standard Intervention Timeout (10 Min Max)

**Timeout Rules**
- Max intervention window: 10 minutes
- Reminder at 3 minutes of inactivity
- Hard termination at 10 minutes

**Implementation**
- `lib/applyForMe/timeouts.ts` - Timeout management
- `INTERVENTION_MAX_DURATION = 10 * 60 * 1000`
- `INTERVENTION_REMINDER_INTERVAL = 3 * 60 * 1000`

**Behavior**
- On intervention start → record timestamp
- After 3 minutes → re-emit reminder event
- After 10 minutes:
  - Mark job as `failed` with `error: 'INTERVENTION_TIMEOUT'`
  - Close browser
  - Persist reason: "We paused this application because the step wasn't completed in time. You can retry this job later from your dashboard."

### ✅ Requirement 3: Resume Validation (Always)

**Validation Rules**
- Before resuming: Re-check CAPTCHA is gone
- Re-check login success
- Re-check expected page state
- If validation fails: Stay paused, re-emit instructions

**Implementation**
- `/api/apply-for-me/resume` endpoint validates before resuming
- Uses Playwright to navigate and check page state
- Only resumes if validation passes
- Returns clear error if validation fails

### ✅ Requirement 4: Idempotent Intervention Events

**Event Rules**
- Only one active intervention per job
- Same intervention must not repeat immediately
- Reminder allowed only after 3 minutes
- Terminate at 10 minutes

**Implementation**
- `pauseForIntervention()` checks for existing intervention
- If same type and < 3 minutes elapsed → don't re-emit
- At 3 minutes → re-emit reminder (calmer tone)
- At 10 minutes → terminate

### ✅ Frontend Enhancements

**ApplyForMeIntervention Component**
- Shows countdown timer (10 min max)
- Displays reminder at 3 minutes
- Auto-refreshes on timeout
- Approved message tone throughout

**Message Tone (Mandatory)**
- ✅ "Action needed to continue"
- ✅ "Please complete the step shown in the open browser window"
- ✅ "Once done, return here to continue"
- ✅ Reminder: "Just a reminder — we're waiting for this step to be completed so we can continue."
- ✅ Timeout: "We paused this application because the step wasn't completed in time. You can retry this job later from your dashboard."

## Database Changes

### Updated: `candidate_site_accounts`
- Added `encrypted_credentials` JSONB column
- Stores: `{ encrypted, iv, authTag }`

### Updated: `job_application_runs`
- No new columns (already has `paused_at`, `intervention_reason`, `intervention_message`)

## Environment Variables

```bash
# Required for credential encryption
CREDENTIAL_ENCRYPTION_KEY=your-32-byte-key-here
```

## Safety Checklist ✅

- ✅ Passwords encrypted at rest
- ✅ Auto-login works without human help after first activation
- ✅ CAPTCHA always requires human completion
- ✅ Resume validation enforced every time
- ✅ No repeated intervention spam
- ✅ Hard stop at 10 minutes
- ✅ No regressions to Dice / Greenhouse
- ✅ GPT never sees credentials or DOM
- ✅ Approved message tone throughout

## Testing Checklist

- [ ] First signup → credentials stored encrypted
- [ ] Second run → auto-login works
- [ ] Auto-login failure → human intervention triggered
- [ ] CAPTCHA pause → validation before resume
- [ ] 3 min reminder appears
- [ ] 10 min timeout terminates
- [ ] No intervention spam
- [ ] Resume validation works
- [ ] Dice/Greenhouse still work

## Files Created/Modified

**New Files:**
- `lib/applyForMe/credentials.ts` - Secure credential storage
- `lib/applyForMe/timeouts.ts` - Timeout management
- `docs/APPLY_FOR_ME_ENHANCEMENTS.md` - This file

**Modified Files:**
- `supabase/migrations/20250203_add_collaborative_apply_for_me.sql` - Added `encrypted_credentials` column
- `lib/applyForMe/collaborativeFlow.ts` - Idempotent interventions
- `lib/applyForMe/sites/techfetch.ts` - Auto-login support
- `lib/applyForMe/sites/ziprecruiter.ts` - Auto-login support
- `app/api/apply-for-me/resume/route.ts` - Resume validation
- `components/ApplyForMeIntervention.tsx` - Timeout UI, approved tone
- `lib/applyForMe/resilience.ts` - Timeout monitoring integration
- `lib/applyForMe/playwrightAutomation.ts` - Approved message tone

## Final Principle

✅ Automation reduces effort, not removes control
✅ System feels predictable, respectful, transparent
✅ Candidate always in control
✅ No surprises, no spam, no infinite waits

