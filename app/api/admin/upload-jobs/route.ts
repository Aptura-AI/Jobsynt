import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/utils/auth';
import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import { ALLOWED_JOB_TYPES, isValidJobType, DEFAULT_JOB_TYPE, type JobType } from '@/lib/job-types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Parse date from various formats (dd/mm/yyyy, mm/dd/yyyy, yyyy-mm-dd, relative dates, etc.)
 * Returns date in YYYY-MM-DD format for database storage
 * Handles relative dates like "Today", "Yesterday", "2 days ago", etc.
 */
function parseDate(dateValue: any): string | null {
  if (!dateValue) return null;
  
  const dateStr = String(dateValue).trim().toLowerCase();
  if (!dateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Handle relative dates
  if (dateStr === 'today' || dateStr === 'todays') {
    return today.toISOString().split('T')[0];
  }
  
  if (dateStr === 'yesterday') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
  }

  // Handle "X days ago" format
  const daysAgoMatch = dateStr.match(/^(\d+)\s*(day|days)\s*ago$/);
  if (daysAgoMatch) {
    const daysAgo = parseInt(daysAgoMatch[1]);
    const pastDate = new Date(today);
    pastDate.setDate(pastDate.getDate() - daysAgo);
    return pastDate.toISOString().split('T')[0];
  }

  // Try dd/mm/yyyy format first (most common in Excel)
  const ddMMyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddMMyyyyMatch) {
    const [, day, month, year] = ddMMyyyyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD
    }
  }

  // Try mm/dd/yyyy format (US format)
  const mmDDyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmDDyyyyMatch) {
    const [, month, day, year] = mmDDyyyyMatch;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  // Try yyyy-mm-dd format (ISO format)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) {
    return dateStr; // Already in correct format
  }

  // Try JavaScript Date parsing as fallback
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

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

export async function POST(req: NextRequest) {
  try {
    // Use custom JWT token authentication (same as admin page)
    const cookieStore = cookies();
    const rawToken = cookieStore.get('jobsynth_token')?.value;
    
    if (!rawToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify JWT signature (safe in Node runtime - API routes)
    const token = verifyToken(rawToken);
    
    if (!token || !token.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (token.role !== 'admin') {
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

    // Log first row for debugging (in development)
    if (process.env.NODE_ENV === 'development' && rows.length > 0) {
      console.log('First row keys:', Object.keys(rows[0]));
      console.log('First row sample:', rows[0]);
    }

    // Normalize column names (case-insensitive, handles variations and empty columns)
    const normalizeKey = (key: string) => {
      if (!key || typeof key !== 'string') return null;
      const lower = key.toLowerCase().trim();
      
      // Skip empty columns or columns that are just numbers/underscores (Excel artifacts)
      if (!lower || /^_?\d+$/.test(lower) || lower === '') {
        return null;
      }
      
      const mapping: Record<string, string> = {
        'job title': 'title',
        'title': 'title',
        'jobtitle': 'title',
        'company': 'company',
        'location': 'location',
        'job type': 'job_type',
        'type': 'job_type',
        'jobtype': 'job_type',
        'pay rate': 'pay_rate',
        'rate': 'pay_rate',
        'payrate': 'pay_rate',
        'salary': 'pay_rate',
        'posted date': 'posted_date',
        'date': 'posted_date',
        'posteddate': 'posted_date',
        'posted': 'posted_date',
        'source': 'source',
        'job link': 'job_link',
        'link': 'job_link',
        'url': 'job_link',
        'joblink': 'job_link',
        'job url': 'job_link',
        'key requirements': 'key_requirements',
        'requirements': 'key_requirements',
        'description': 'key_requirements',
        'keyrequirements': 'key_requirements',
        'req': 'key_requirements',
      };
      return mapping[lower] || null;
    };

    const normalizedRows = rows.map((row, index) => {
      const normalized: any = {};
      for (const [key, value] of Object.entries(row)) {
        const normKey = normalizeKey(key);
        if (normKey) {
          // Only include non-empty values
          if (value !== null && value !== undefined && value !== '') {
            normalized[normKey] = value;
          }
        }
      }
      return normalized;
    }).filter(row => Object.keys(row).length > 0); // Remove completely empty rows

    const results: Array<{
      title: string;
      company: string;
      status: 'success' | 'error';
      message: string;
    }> = [];

    for (const row of normalizedRows) {
      const jobTitle = String(row.title || '').trim();
      const jobCompany = String(row.company || '').trim();
      
      try {
        if (!jobTitle || !jobCompany) {
          results.push({
            title: jobTitle || 'Unknown',
            company: jobCompany || 'Unknown',
            status: 'error',
            message: 'Missing required field: Title or Company',
          });
          continue;
        }

        const urlValue = String(row.job_link || row.url || '').trim();
        
        // Validate URL if provided (URL is required for deduplication)
        if (urlValue && (typeof urlValue !== 'string' || !urlValue.startsWith('http'))) {
          results.push({
            title: jobTitle,
            company: jobCompany,
            status: 'error',
            message: `Invalid URL format: "${urlValue}" (must start with http)`,
          });
          continue;
        }

        // Never insert a job without a valid URL (required for deduplication)
        if (!urlValue) {
          results.push({
            title: jobTitle,
            company: jobCompany,
            status: 'error',
            message: 'Missing required field: Job Link/URL',
          });
          continue;
        }

        // Validate and normalize job_type
        const jobTypeValue = String(row.job_type || '').trim().toLowerCase();
        let job_type: JobType;
        
        if (jobTypeValue && isValidJobType(jobTypeValue)) {
          job_type = jobTypeValue as JobType;
        } else if (jobTypeValue) {
          // Handle combined types like "Full-time C2C" - prioritize C2C/1099 over full-time
          let normalizedType = jobTypeValue;
          
          // Check for C2C or 1099 first (higher priority for contract roles)
          if (normalizedType.includes('c2c') || normalizedType.includes('corp to corp') || normalizedType.includes('corp-to-corp')) {
            normalizedType = 'c2c';
          } else if (normalizedType.includes('1099')) {
            normalizedType = '1099';
          } else if (normalizedType.includes('w2') || normalizedType.includes('w-2')) {
            normalizedType = 'w2-contract';
          } else if (normalizedType.includes('fulltime') || normalizedType.includes('full time') || normalizedType.includes('full-time')) {
            normalizedType = 'full-time';
          }
          
          // Try to map common variations
          const typeMap: Record<string, JobType> = {
            'fulltime': 'full-time',
            'full time': 'full-time',
            'full-time': 'full-time',
            'w2': 'w2-contract',
            'w-2': 'w2-contract',
            'contract': 'w2-contract',
            'corp to corp': 'c2c',
            'corp-to-corp': 'c2c',
            'c2c': 'c2c',
            '1099': '1099',
          };
          
          job_type = typeMap[normalizedType] || DEFAULT_JOB_TYPE;
          if (!isValidJobType(job_type)) {
            // Log warning but continue (using default)
            console.warn(`Row "${jobTitle}": Invalid job_type "${jobTypeValue}", using default "${DEFAULT_JOB_TYPE}"`);
            job_type = DEFAULT_JOB_TYPE;
          }
        } else {
          // No job_type provided - use default
          job_type = DEFAULT_JOB_TYPE;
        }

        // Parse and validate posted date
        const parsedDate = parseDate(row.posted_date) || new Date().toISOString().split('T')[0];
        
        // Reject jobs older than 30 days
        if (isOlderThan30Days(parsedDate)) {
          results.push({
            title: jobTitle,
            company: jobCompany,
            status: 'error',
            message: `Job is older than 30 days (posted: ${parsedDate}). Jobs older than 30 days are not accepted.`,
          });
          continue;
        }

        const jobData = {
          title: jobTitle,
          company: jobCompany,
          location: String(row.location || '').trim() || 'Remote',
          url: urlValue, // Required for deduplication (unique index)
          job_type, // Required for job type filtering
          description: String(row.key_requirements || row.description || '').trim() || null,
          salary: String(row.pay_rate || row.rate || '').trim() || null,
          posted_date: parsedDate,
          source: String(row.source || 'manual').trim(),
          profile_id: null,
          is_constant_search: false,
          is_real: true,
        };

        // Use upsert with onConflict: 'url' for automatic deduplication
        // The database has a unique index on scraped_jobs.url
        const { data, error } = await supabase
          .from('scraped_jobs')
          .upsert(jobData, { onConflict: 'url' })
          .select('id, title')
          .single();

        if (error) {
          // Handle unique constraint violations gracefully
          if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
            results.push({
              title: jobTitle,
              company: jobCompany,
              status: 'error',
              message: `Duplicate: Job with this URL already exists in database`,
            });
          } else if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('RLS')) {
            results.push({
              title: jobTitle,
              company: jobCompany,
              status: 'error',
              message: `Permission error: ${error.message}. Please check service role key configuration.`,
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
            message: data ? 'Successfully added/updated' : 'Processed successfully',
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
    const successfulJobs = results.filter(r => r.status === 'success');
    const failedJobs = results.filter(r => r.status === 'error');

    // Log summary for debugging
    console.log(`📊 Job Upload Summary: ${successCount} successful, ${errorCount} failed out of ${normalizedRows.length} total rows`);

    return NextResponse.json({
      success: successCount,
      errors: failedJobs.map(job => `${job.title} at ${job.company}: ${job.message}`),
      total: normalizedRows.length,
      results, // Detailed results for UI display
      successfulJobs,
      failedJobs,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}

