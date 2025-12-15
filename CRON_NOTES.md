# Cron Jobs Configuration

## Current Status: Disabled (Hobby Plan)

Cron jobs have been removed from `vercel.json` due to Vercel Hobby plan limitations:

- **Hobby Plan Limits:**
  - Maximum 2 cron jobs per account
  - Each cron job can only run **once per day**
  - Cannot run multiple times per day (e.g., 11 AM and 4 PM)

## AI Matching

AI matching is currently triggered **on-demand** when:
- Candidates view their dashboard (`/dashboard`)
- Profile is created/updated
- Manual trigger via `/api/ai-match` endpoint

## To Enable Scheduled Matching

If you upgrade to **Vercel Pro plan**, you can enable scheduled matching by updating `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/ai-match",
      "schedule": "0 11,16 * * *"
    }
  ]
}
```

This will run AI matching twice daily at 11 AM and 4 PM.

## Manual Trigger

You can manually trigger AI matching for all profiles by calling:
```
GET /api/cron/ai-match
```

With authorization header (if CRON_SECRET is set):
```
Authorization: Bearer YOUR_CRON_SECRET
```

