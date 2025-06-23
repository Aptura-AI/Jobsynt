# GPT API Setup Guide for AI Resume Assistant

## Overview
The AI Resume Assistant now uses the **real OpenAI GPT-4 API** for intelligent resume analysis, optimization, and cover letter generation. This guide will help you set up the GPT API integration.

## Prerequisites
1. OpenAI account with API access
2. Supabase project with storage buckets configured
3. Environment variables properly set

## Step 1: Get OpenAI API Key

1. Go to [OpenAI API Platform](https://platform.openai.com/api-keys)
2. Sign in to your account
3. Click "Create new secret key"
4. Copy the API key (starts with `sk-`)
5. **Important**: Store this key securely - you won't be able to see it again

## Step 2: Add Environment Variable

Add the following environment variable to your Netlify environment:

```
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### In Netlify Dashboard:
1. Go to your site dashboard
2. Navigate to Site settings → Environment variables
3. Add new variable:
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key

## Step 3: Set Up Supabase Storage

Run the SQL commands in `SUPABASE_STORAGE_SETUP.sql` in your Supabase SQL editor to create the storage buckets:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `SUPABASE_STORAGE_SETUP.sql`
4. Click "Run"

This will create:
- **resumes** bucket (private) - for storing resume files
- **cover-letters** bucket (public) - for storing generated cover letters

## Step 4: Test the Integration

1. Deploy your updated code to Netlify
2. Go to the AI Resume Assistant section
3. Try the "Analyze Resume" feature
4. Test job optimization with a job description

## Features Now Available

### 1. **AI-Powered Resume Analysis**
- Real GPT-4 analysis of resume and profile
- Personalized recommendations
- Career guidance based on current market trends
- Scoring and improvement suggestions

### 2. **Job-Specific Optimization**
- Tailored resume summaries for specific jobs
- Skills analysis and keyword optimization
- ATS-friendly suggestions
- Priority-based skill highlighting

### 3. **AI-Generated Cover Letters**
- Personalized cover letters for each job application
- Company name extraction from job descriptions
- Automatic saving to Supabase storage
- Download functionality for easy use

### 4. **ATS Compatibility Check**
- AI analysis of resume compatibility with ATS systems
- Specific recommendations for improvement
- File format optimization suggestions

## API Usage and Costs

- **Model**: GPT-4 (for best quality analysis)
- **Average tokens per request**: 1,500-3,000
- **Estimated cost per analysis**: $0.03-0.09
- **Monthly estimate** (100 analyses): $3-9

## Troubleshooting

### Common Issues:

1. **"AI service not available"**
   - Check that `OPENAI_API_KEY` is set correctly
   - Verify the API key is active and has credits

2. **"Cover letter not saving"**
   - Ensure Supabase storage buckets are created
   - Check storage policies are configured correctly

3. **"Analysis taking too long"**
   - GPT-4 can take 10-30 seconds for complex analysis
   - This is normal for high-quality AI analysis

### Testing API Connection:

You can test the API connection by checking the Netlify function logs:
1. Go to Netlify dashboard → Functions
2. Look for `ai-resume-assistant` function
3. Check logs for any API errors

## Security Notes

- API keys are server-side only (not exposed to frontend)
- Cover letters are stored with user-specific permissions
- Resume files remain private to the user
- All API calls are logged for debugging

## Next Steps

Once set up, users can:
1. **Analyze their resume** for general feedback
2. **Optimize for specific jobs** with tailored content
3. **Generate cover letters** that are automatically saved
4. **Download cover letters** for job applications
5. **Check ATS compatibility** for better application success

The AI Resume Assistant is now a comprehensive tool that provides real AI-powered career assistance! 