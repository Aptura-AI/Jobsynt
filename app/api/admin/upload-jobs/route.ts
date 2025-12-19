import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ALLOWED_JOB_TYPES, isValidJobType, DEFAULT_JOB_TYPE, type JobType } from '@/lib/job-types';
import { extractPlatformFromJob, extractSecondaryPlatforms } from '@/lib/matching/extractPlatform';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// ============================================
// FIX 1: CANONICAL EXCEL COLUMN NORMALIZATION
// ============================================

/**
 * Normalize Excel row to canonical internal keys
 * Handles ALL known column name variations
 * NEVER causes data loss due to column naming
 */
function normalizeExcelRow(row: Record<string, any>): Record<string, any> {
  const normalized: Record<string, any> = {};

  for (const [rawKey, value] of Object.entries(row)) {
    // Skip empty keys or values
    if (!rawKey || value === null || value === undefined) continue;
    
    const key = rawKey.toLowerCase().trim().replace(/\s+/g, '_');

    // Title
    if (['job_title', 'title', 'jobtitle'].includes(key)) {
      normalized.title = value;
    }
    
    // Company
    if (['company', 'company_name', 'companyname'].includes(key)) {
      normalized.company = value;
    }
    
    // Location
    if (['location', 'job_location', 'city'].includes(key)) {
      normalized.location = value;
    }
    
    // Job Type
    if (['job_type', 'jobtype', 'type', 'employment_type'].includes(key)) {
      normalized.job_type = value;
    }
    
    // URL
    if (['job_link', 'url', 'link', 'job_url', 'joblink', 'joburl'].includes(key)) {
      normalized.url = value;
    }
    
    // Must Have Skills (CRITICAL)
    if (['must_have_skills', 'must_have', 'musthave', 'musthaveskills', 
         'primary_skills', 'required_skills', 'requiredskills', 'skills'].includes(key)) {
      normalized.must_have_skills = value;
    }
    
    // Good To Have Skills
    if (['good_to_have_skills', 'good_to_have', 'goodtohave', 'goodtohaveskills',
         'nice_to_have', 'nicetohave', 'secondary_skills', 'optional_skills'].includes(key)) {
      normalized.good_to_have_skills = value;
    }
    
    // Experience / Years (CRITICAL)
    if (['experience', 'years', 'years_experience', 'experience_years',
         'required_years_experience', 'min_experience', 'minexperience', 'exp'].includes(key)) {
      normalized.required_years_experience = value;
    }
    
    // Pay Rate
    if (['pay_rate', 'rate', 'salary', 'compensation', 'payrate', 'pay'].includes(key)) {
      normalized.pay_rate = value;
    }
    
    // Description
    if (['description', 'key_requirements', 'keyrequirements', 'requirements',
         'job_description', 'jobdescription', 'req'].includes(key)) {
      normalized.description = value;
    }
    
    // Is Remote
    if (['remote', 'is_remote', 'isremote', 'work_type', 'worktype'].includes(key)) {
      normalized.is_remote = value;
    }
    
    // Posted Date
    if (['posted_date', 'posteddate', 'posted', 'date'].includes(key)) {
      normalized.posted_date = value;
    }
    
    // Source
    if (['source'].includes(key)) {
      normalized.source = value;
    }
    
    // Target Candidate IDs
    if (['target_candidate_ids', 'target_candidates', 'targetcandidateids',
         'candidate_ids', 'candidateids', 'assigned_to', 'assignedto'].includes(key)) {
      normalized.target_candidate_ids = value;
    }
  }

  return normalized;
}

// ============================================
// FIX 2: HELPER FUNCTIONS WITH SAFE DEFAULTS
// ============================================

/**
 * Parse skills string into array
 * ALWAYS returns array, NEVER null
 * Lowercases, tokenizes, deduplicates
 */
function parseSkills(skillsValue: any): string[] {
  if (!skillsValue) return []; // Empty array, NEVER null
  
  const skillsStr = String(skillsValue).trim();
  if (!skillsStr) return []; // Empty array, NEVER null
  
  const skills = skillsStr
    .split(/[,;|]/) // Split by comma, semicolon, or pipe
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 0);
  
  // Deduplicate
  return [...new Set(skills)];
}

/**
 * Parse experience value into integer
 * ALWAYS returns integer, NEVER null
 * Default is 0
 */
function parseExperience(expValue: any): number {
  if (!expValue) return 0; // Default 0, NEVER null
  
  const expStr = String(expValue).trim();
  if (!expStr) return 0; // Default 0, NEVER null
  
  // Extract first number from strings like "5", "5+", "5 years", "5-7"
  const match = expStr.match(/(\d+)/);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return 0; // Default 0 if parsing fails, NEVER null
}

/**
 * Parse boolean value for is_remote
 * Priority: Explicit is_remote flag > location string
 * If is_remote is "Yes", "true", "1", etc. → always Remote
 */
function parseIsRemote(remoteValue: any, location: string): boolean {
  // PRIORITY 1: Check explicit is_remote value first (highest priority)
  // If is_remote is explicitly set to "Yes", "true", "1", etc. → ALWAYS Remote
  if (remoteValue !== null && remoteValue !== undefined && remoteValue !== '') {
    const remoteStr = String(remoteValue).trim().toLowerCase();
    // Accept: "yes", "true", "1", "y", "remote"
    if (['yes', 'true', '1', 'y', 'remote'].includes(remoteStr)) {
      return true; // Explicit remote flag overrides location string
    }
    // Explicit "no", "false", "0" → not remote
    if (['no', 'false', '0', 'n'].includes(remoteStr)) {
      return false;
    }
  }
  
  // PRIORITY 2: Check location string for remote keywords (fallback)
  const locationLower = (location || '').toLowerCase();
  if (locationLower.includes('remote') || locationLower.includes('anywhere') || locationLower.includes('work from home')) {
    return true;
  }
  
  return false;
}

/**
 * Determine location_type from is_remote and location
 * Returns: 'Remote' | 'Hybrid' | 'Onsite'
 */
function determineLocationType(isRemote: boolean, location: string): 'Remote' | 'Hybrid' | 'Onsite' {
  const locationLower = location.toLowerCase();
  
  if (isRemote || locationLower.includes('remote')) {
    return 'Remote';
  }
  if (locationLower.includes('hybrid')) {
    return 'Hybrid';
  }
  return 'Onsite';
}

/**
 * Parse date from various formats
 * Supported formats:
 * - "today" / "todays" → current system date
 * - "yesterday" → yesterday's date
 * - "N days ago" / "N day ago" → N days before current date
 * - "mm/dd/yyyy" or "mm-dd-yyyy" → US date format (month/day/year)
 * - "yyyy-mm-dd" → ISO format
 * - Any other format → fallback to JavaScript Date parsing
 */
function parseDate(dateValue: any): string | null {
  if (!dateValue) return null;
  
  const dateStr = String(dateValue).trim().toLowerCase();
  if (!dateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Handle relative dates: "today" or "todays"
  if (dateStr === 'today' || dateStr === 'todays') {
    console.log(`[parseDate] "${dateValue}" → today: ${today.toISOString().split('T')[0]}`);
    return today.toISOString().split('T')[0];
  }
  
  // Handle "yesterday"
  if (dateStr === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    console.log(`[parseDate] "${dateValue}" → yesterday: ${yesterday.toISOString().split('T')[0]}`);
    return yesterday.toISOString().split('T')[0];
  }

  // Handle "X days ago" or "X day ago" format (e.g., "3 days ago", "1 day ago")
  const daysAgoMatch = dateStr.match(/^(\d+)\s*(day|days)\s*ago$/i);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysAgo);
    console.log(`[parseDate] "${dateValue}" → ${daysAgo} days ago: ${pastDate.toISOString().split('T')[0]}`);
    return pastDate.toISOString().split('T')[0];
  }

  // Handle mm/dd/yyyy or mm-dd-yyyy format (US date format)
  const mmDDyyyyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (mmDDyyyyMatch) {
    const [, month, day, year] = mmDDyyyyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      console.log(`[parseDate] "${dateValue}" → mm/dd/yyyy: ${date.toISOString().split('T')[0]}`);
      return date.toISOString().split('T')[0];
    }
  }

  // Handle yyyy-mm-dd format (ISO format)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    console.log(`[parseDate] "${dateValue}" → ISO format: ${dateStr}`);
    return dateStr;
  }

  // Fallback: Try JavaScript Date parsing
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    console.log(`[parseDate] "${dateValue}" → JS Date fallback: ${parsed.toISOString().split('T')[0]}`);
    return parsed.toISOString().split('T')[0];
  }

  // If all parsing fails, return null (will default to today in the main logic)
  console.log(`[parseDate] "${dateValue}" → Could not parse, returning null`);
  return null;
}

/**
 * Check if a date is older than 30 days
 */
function isOlderThan30Days(dateStr: string | null): boolean {
  if (!dateStr) return false;
  
  const jobDate = new Date(dateStr);
  if (isNaN(jobDate.getTime())) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  jobDate.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - jobDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays > 30;
}

/**
 * Normalize job type to valid enum value
 */
function normalizeJobType(jobTypeValue: any): JobType {
  if (!jobTypeValue) return DEFAULT_JOB_TYPE;
  
  let jobType = String(jobTypeValue).trim().toLowerCase();
  
  // Check for valid type first
  if (isValidJobType(jobType)) {
    return jobType as JobType;
  }
  
  // Check for C2C or 1099 first (higher priority for contract roles)
  if (jobType.includes('c2c') || jobType.includes('corp to corp') || jobType.includes('corp-to-corp')) {
    return 'c2c';
  }
  if (jobType.includes('1099')) {
    return '1099';
  }
  if (jobType.includes('w2') || jobType.includes('w-2')) {
    return 'w2-contract';
  }
  if (jobType.includes('fulltime') || jobType.includes('full time') || jobType.includes('full-time')) {
    return 'full-time';
  }
  if (jobType.includes('contract')) {
    return 'w2-contract';
  }
  
  return DEFAULT_JOB_TYPE;
}

// ============================================
// MAIN UPLOAD HANDLER
// ============================================

export async function POST(req: NextRequest) {
  try {
    // Authentication
    const cookieStore = cookies();
    const rawToken = cookieStore.get('jobsynth_token')?.value;
    
    if (!rawToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = verifyToken(rawToken);
    
    if (!token || !token.email || token.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    let rows: any[] = [];

    if (fileExt === 'csv') {
      const text = buffer.toString('utf-8');
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      rows = parsed.data as any[];
    } else if (fileExt === 'xlsx' || fileExt === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json(worksheet);
    } else {
      return NextResponse.json({ error: 'Unsupported file type. Use .xlsx or .csv' }, { status: 400 });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in file' }, { status: 400 });
    }

    // Log first row for debugging
    console.log('[Upload] First row keys:', Object.keys(rows[0]));
    console.log('[Upload] First row sample:', rows[0]);

    const results: Array<{
      title: string;
      company: string;
      status: 'success' | 'error';
      message: string;
    }> = [];

    for (const rawRow of rows) {
      // ============================================
      // FIX 1: Use normalizeExcelRow for ALL rows
      // ============================================
      const normalized = normalizeExcelRow(rawRow);
      
      // Log normalized row for debugging
      console.log('[Upload] Normalized row:', normalized);

      const jobTitle = String(normalized.title || '').trim();
      const jobCompany = String(normalized.company || '').trim();
      
      try {
        // Validate required fields
        if (!jobTitle || !jobCompany) {
          results.push({
            title: jobTitle || 'Unknown',
            company: jobCompany || 'Unknown',
            status: 'error',
            message: 'Missing required field: Title or Company',
          });
          continue;
        }

        const urlValue = String(normalized.url || '').trim();
        
        // Validate URL
        if (!urlValue || !urlValue.startsWith('http')) {
          results.push({
            title: jobTitle,
            company: jobCompany,
            status: 'error',
            message: `Invalid or missing URL: "${urlValue}"`,
          });
          continue;
        }

        // Parse and validate posted date
        const parsedDate = parseDate(normalized.posted_date) || new Date().toISOString().split('T')[0];
        
        if (isOlderThan30Days(parsedDate)) {
          results.push({
            title: jobTitle,
            company: jobCompany,
            status: 'error',
            message: `Job is older than 30 days (posted: ${parsedDate})`,
          });
          continue;
        }

        // ============================================
        // FIX 2: ENFORCE DEFAULTS - NO NULLS
        // ============================================
        
        // Skills - ALWAYS array, NEVER null
        const mustHaveSkills = parseSkills(normalized.must_have_skills);
        const goodToHaveSkills = parseSkills(normalized.good_to_have_skills);
        
        // Combined skills array (for legacy compatibility)
        const allSkills = [...new Set([...mustHaveSkills, ...goodToHaveSkills])];
        
        // Extract platform from title and skills (deterministic, stored once at ingestion)
        const primaryPlatform = extractPlatformFromJob(jobTitle, allSkills);
        const secondaryPlatforms = extractSecondaryPlatforms(jobTitle, allSkills);
        
        // Experience - ALWAYS integer, NEVER null
        const requiredYearsExp = parseExperience(normalized.required_years_experience);
        
        // Location handling
        // IMPORTANT: If is_remote is explicitly set to "Yes", it overrides location string
        const location = String(normalized.location || '').trim() || '';
        const isRemote = parseIsRemote(normalized.is_remote, location);
        // If is_remote is true, force location_type to Remote (overrides location string)
        const locationType = isRemote ? 'Remote' : determineLocationType(isRemote, location);
        
        // Job type
        const jobType = normalizeJobType(normalized.job_type);
        
        // Description - string, default empty
        const description = String(normalized.description || '').trim();
        
        // Raw field preservation
        const payRateRaw = normalized.pay_rate ? String(normalized.pay_rate).trim() : null;
        const targetCandidateIds = normalized.target_candidate_ids 
          ? String(normalized.target_candidate_ids).trim() 
          : null;

        // ============================================
        // BUILD PAYLOAD WITH GUARANTEED DEFAULTS
        // ============================================
        const payload = {
          // Required fields
          title: jobTitle,
          company: jobCompany,
          url: urlValue,
          
          // Location
          location: location,
          location_raw: normalized.location ? String(normalized.location).trim() : null,
          is_remote: isRemote,
          location_type: locationType,
          
          // Job details
          job_type: jobType,
          description: description,
          description_raw: normalized.description ? String(normalized.description).trim() : null,
          
          // Skills - GUARANTEED ARRAYS, NEVER NULL
          must_have_skills: mustHaveSkills.join(', '), // Store as comma-separated string
          good_to_have_skills: goodToHaveSkills.join(', '), // Store as comma-separated string
          skills: allSkills, // Store as array for legacy compatibility
          
          // Platform identity (extracted at ingestion, stored once)
          primary_platform: primaryPlatform,
          secondary_platforms: secondaryPlatforms,
          
          // Experience - GUARANTEED INTEGER, NEVER NULL
          required_years_experience: requiredYearsExp,
          
          // Pay rate (nullable OK - optional field)
          // salary: Optional, used for full-time jobs (annual salary, e.g., "$100k/year")
          // pay_rate_min/max: Used for contract jobs (hourly rate)
          salary: payRateRaw, // Optional: for full-time jobs (e.g., "$100k/year", "$80k-120k")
          pay_rate_raw: payRateRaw, // Raw field preservation
          
          // Dates and metadata
          posted_date: parsedDate,
          source: String(normalized.source || 'manual').trim(),
          
          // Targeting
          target_candidate_ids: targetCandidateIds,
          
          // Status
          is_active: true,
          is_real: true,
          is_constant_search: false,
          profile_id: null,
        };

        // Log payload for debugging
        console.log('[Upload] Payload skills:', {
          must_have_skills: payload.must_have_skills,
          good_to_have_skills: payload.good_to_have_skills,
          required_years_experience: payload.required_years_experience,
        });

        // Insert with upsert on URL conflict
        const { data, error } = await supabase
          .from('scraped_jobs')
          .upsert(payload, { onConflict: 'url' })
          .select('id, title')
          .single();

        if (error) {
          if (error.code === '23505' || error.message.includes('duplicate')) {
            results.push({
              title: jobTitle,
              company: jobCompany,
              status: 'error',
              message: 'Duplicate: Job with this URL already exists',
            });
          } else {
            results.push({
              title: jobTitle,
              company: jobCompany,
              status: 'error',
              message: `Database error: ${error.message}`,
            });
          }
        } else {
          results.push({
            title: jobTitle,
            company: jobCompany,
            status: 'success',
            message: 'Successfully added/updated',
          });
        }
      } catch (err: any) {
        results.push({
          title: jobTitle || 'Unknown',
          company: jobCompany || 'Unknown',
          status: 'error',
          message: `Processing error: ${err.message || 'Unknown error'}`,
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`[Upload] Summary: ${successCount} successful, ${errorCount} failed out of ${rows.length} total rows`);

    return NextResponse.json({
      success: successCount,
      errors: results.filter(r => r.status === 'error').map(r => `${r.title} at ${r.company}: ${r.message}`),
      total: rows.length,
      results,
      successfulJobs: results.filter(r => r.status === 'success'),
      failedJobs: results.filter(r => r.status === 'error'),
    });
  } catch (error: any) {
    console.error('[Upload] Error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
