/**
 * Semi-manual Dice.com scraper for internal JobSynth use.
 * 
 * Run with: npx tsx scripts/diceScraper.ts
 * 
 * Requirements:
 *   npm install playwright @supabase/supabase-js dotenv
 *   npx playwright install
 */

// Load environment variables
import { config } from 'dotenv';
config();
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { inferJobTypeFromDescription, DEFAULT_JOB_TYPE, type JobType } from '@/lib/job-types';
import { extractPlatformFromJob, extractSecondaryPlatforms } from '@/lib/matching/extractPlatform';

// =========================
// Manual configuration
// =========================
const JOB_TITLE_QUERY = 'Oracle Cloud Consultant';
const LOCATION_QUERY = 'Remote';
const WORK_MODE_FILTER: 'Remote' | 'Onsite' | 'Hybrid' | 'Any' = 'Any';
const EMPLOYMENT_TYPE_FILTER: 'Full-time' | 'W2' | 'C2C' | '1099' | 'Any' = 'Any';
const KEY_SKILLS = ['Oracle', 'PeopleSoft', 'SAP', 'Cloud', 'Data', 'OCI', 'AWS', 'Azure', 'GCP'];
const MAX_JOBS_TO_SCRAPE = 20;

// =========================
// Supabase setup
// =========================
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  console.error('Make sure you have a .env.local file with these variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

// =========================
// Utility helpers
// =========================
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const hashString = (input: string) =>
  crypto.createHash('sha256').update(input).digest('hex');

const inferWorkMode = (location: string, description: string): 'Remote' | 'Onsite' | 'Hybrid' | 'Unknown' => {
  const text = `${location} ${description}`.toLowerCase();
  if (text.includes('remote')) return 'Remote';
  if (text.includes('hybrid')) return 'Hybrid';
  if (text.includes('onsite') || text.includes('on-site')) return 'Onsite';
  return 'Unknown';
};

const inferEmploymentType = (description: string): 'Full-time' | 'W2' | 'C2C' | '1099' | 'Unknown' => {
  const text = description.toLowerCase();
  if (text.includes('c2c')) return 'C2C';
  if (text.includes('1099')) return '1099';
  if (text.includes('w2')) return 'W2';
  if (text.includes('full-time') || text.includes('permanent')) return 'Full-time';
  return 'Unknown';
};

const extractSkills = (description: string): string[] => {
  const desc = description.toLowerCase();
  return KEY_SKILLS.filter((skill) => desc.includes(skill.toLowerCase()));
};

const buildSearchUrl = () => {
  const q = encodeURIComponent(JOB_TITLE_QUERY);
  const loc = encodeURIComponent(LOCATION_QUERY);
  // Dice search format; this may change over time, adjust as needed.
  return `https://www.dice.com/jobs?q=${q}&location=${loc}&radius=30`;
};

const getSourceJobId = (url: string) => {
  const match = url.match(/job-detail\/([^/?#]+)/i);
  return match ? match[1] : null;
};

/**
 * Guarded primary platform fallback
 * If primary_platform is missing, use first skill from must_have_skills
 */
const applyPrimaryPlatformFallback = (
  primaryPlatform: string | null,
  mustHaveSkills: string
): string | null => {
  // If primary_platform exists, do nothing
  if (primaryPlatform) {
    return primaryPlatform;
  }

  // If must_have_skills is empty, skip fallback
  if (!mustHaveSkills || mustHaveSkills.trim() === '') {
    return null;
  }

  // Split on commas / pipes / semicolons
  const skills = mustHaveSkills
    .split(/[,|;]/)
    .map(skill => skill.trim())
    .filter(skill => skill.length > 0);

  // Use FIRST skill as primary_platform
  if (skills.length > 0) {
    const fallbackPlatform = skills[0];
    console.log(`[Primary Platform Fallback] Using first skill as platform: ${fallbackPlatform}`);
    return fallbackPlatform;
  }

  return null;
};

// =========================
// URL Validation
// =========================
function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// =========================
// Scrape helpers
// =========================
async function collectJobLinks(page: Page): Promise<string[]> {
  // Scroll a few times to load results
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2000);
    await sleep(1000);
  }

  const links = await page.$$eval('a[href*="/job-detail/"]', (anchors) =>
    anchors.map((a) => (a as HTMLAnchorElement).href).filter(Boolean)
  );

  const unique = Array.from(new Set(links));
  const validLinks = unique.filter((v): v is string => typeof v === 'string' && v.length > 0);
  console.log(`Found ${validLinks.length} job links`);
  return validLinks.slice(0, MAX_JOBS_TO_SCRAPE);
}

async function scrapeJobDetail(browserPage: Page, jobUrl: string) {
  // Use 'load' instead of 'networkidle' - Dice.com has continuous network activity
  // 'load' waits for page to load, which is sufficient for scraping
  // Note: If called from main loop, page.goto is already done, so this is just extraction
  await sleep(2000); // Give page time to render dynamic content

  const title = (await browserPage.textContent('h1'))?.trim() || 'Unknown Title';
  const company = (await browserPage.textContent('[data-testid="job-company-name"], a[href*="/company/"]'))?.trim() || 'Unknown Company';
  const location = (await browserPage.textContent('[data-testid="job-location"]'))?.trim()
    || (await browserPage.textContent('span:has-text("Remote")'))?.trim()
    || 'Unknown';
  const description = (await browserPage.textContent('[data-testid="job-description"]'))?.trim()
    || (await browserPage.textContent('div[data-cy="job-description"]'))?.trim()
    || (await browserPage.textContent('article'))?.trim()
    || '';

  const work_mode = WORK_MODE_FILTER !== 'Any'
    ? WORK_MODE_FILTER
    : inferWorkMode(location, description);

  const employment_type = EMPLOYMENT_TYPE_FILTER !== 'Any'
    ? EMPLOYMENT_TYPE_FILTER
    : inferEmploymentType(description);

  const skills = extractSkills(description);
  const source_job_id = getSourceJobId(jobUrl);
  const dedupHash = hashString(`${title}|${company}|${location}`);
  
  // Infer job_type from description, default to w2-contract if cannot be determined
  const job_type: JobType = inferJobTypeFromDescription(description);

  // Determine work_location_type (authoritative field), location_type and is_remote (legacy)
  const locationLower = location.toLowerCase();
  const isRemote = locationLower.includes('remote') || work_mode === 'Remote';
  const locationType = isRemote ? 'Remote' : (work_mode === 'Hybrid' ? 'Hybrid' : 'Onsite');
  const workLocationType = locationType; // Use same value for work_location_type

  // Parse skills into must_have_skills and good_to_have_skills
  const mustHaveSkills = skills.length > 0 ? skills.join(', ') : '';
  const goodToHaveSkills = ''; // Dice doesn't separate, so we put all in must_have

  // Extract platform from title and skills
  const allSkills = skills; // Combined skills for platform extraction
  let primaryPlatform = extractPlatformFromJob(title, allSkills) || '';
  
  // Track if fallback was used (for learning signals)
  const originalPlatform = primaryPlatform;
  
  // Apply guarded fallback if primary_platform is missing
  primaryPlatform = applyPrimaryPlatformFallback(primaryPlatform, mustHaveSkills) || '';
  
  const fallbackUsed = !originalPlatform && !!primaryPlatform;
  
  const secondaryPlatforms = extractSecondaryPlatforms(title, allSkills) || [];

  // Extract experience years from description (look for patterns like "5+ years", "10 years experience")
  const experienceMatch = description.match(/(\d+)\+?\s*(?:years?|yrs?|year['\s]+of|year['\s]+experience)/i);
  const requiredYearsExp = experienceMatch ? parseInt(experienceMatch[1], 10) : 0;

  // Extract salary/pay rate from description (look for patterns like "$80/hr", "$100k", "$80-100/hr")
  const salaryMatch = description.match(/\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|annually|yearly|per year)/i) 
    || description.match(/\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$(\d+(?:,\d{3})*(?:k|K)?)/i);
  const salaryRaw = salaryMatch ? (salaryMatch[0] || '') : null;

  return {
    source: 'Dice',
    source_job_id: source_job_id || dedupHash,
    title,
    company,
    location,
    location_raw: location, // Preserve original location
    work_location_type: workLocationType, // Authoritative field
    location_type: locationType, // Legacy - deprecated
    is_remote: isRemote, // Legacy - deprecated
    description,
    description_raw: description, // Preserve original description
    url: jobUrl, // Use 'url' column for deduplication (unique index)
    job_type, // Required for job type filtering
    must_have_skills: mustHaveSkills,
    good_to_have_skills: goodToHaveSkills,
    // Platform identity (extracted at ingestion, stored once)
    primary_platform: primaryPlatform || null,
    secondary_platforms: secondaryPlatforms.length > 0 ? secondaryPlatforms : null,
    // Experience - extracted from description
    required_years_experience: requiredYearsExp,
    // Pay rate (optional)
    salary: salaryRaw,
    pay_rate_raw: salaryRaw,
    scraped_at: new Date().toISOString(),
    posted_date: new Date().toISOString().split('T')[0], // Today's date as default
    is_active: true,
    is_real: true,
    uploaded_by: 'scraper', // Job source tracking
    fallback_primary_platform_used: fallbackUsed, // Learning signal: track fallback usage
  };
}

// =========================
// Main scraper flow
// =========================
async function main() {
  console.log('========================================');
  console.log('DICE SCRAPER - SEMI-AUTOMATIC MODE');
  console.log('========================================');
  console.log('1. Browser will open Dice.com');
  console.log('2. Please LOGIN manually to your Dice account');
  console.log('3. SEARCH for jobs (apply any filters you want)');
  console.log('4. Once you see the job results, press ENTER in this terminal');
  console.log('5. The scraper will then scrape all jobs on the current page');
  console.log('========================================\n');

  const browser = await chromium.launch({ 
    headless: false, // Show browser so user can login
    slowMo: 100 // Slow down for visibility
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();

  const shutdown = async () => {
    console.log('\nStopping scraper (Ctrl+C)…');
    await browser.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);

  // Navigate to Dice homepage (not search URL - user will search manually)
  console.log('Opening Dice.com...');
  await page.goto('https://www.dice.com', { waitUntil: 'networkidle', timeout: 45_000 });
  
  console.log('\n⏳ WAITING FOR YOU TO:');
  console.log('   1. Login to your Dice account');
  console.log('   2. Search for jobs (use any filters you want)');
  console.log('   3. Wait for job results to load');
  console.log('\nPress ENTER when you are ready for the scraper to start...\n');
  
  // Wait for user to press Enter (simple approach that works on Windows)
  await new Promise<void>((resolve) => {
    process.stdin.once('data', () => {
      resolve();
    });
    // Also handle if stdin is not available
    if (!process.stdin.isTTY) {
      console.log('⚠️  Running in non-interactive mode, starting in 5 seconds...');
      setTimeout(resolve, 5000);
    }
  });

  console.log('✅ Starting to scrape jobs from current page...\n');

  // Now scrape the current page (whatever the user has navigated to)
  const jobLinks = await collectJobLinks(page);

  let processed = 0;
  let savedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const link of jobLinks) {
    processed += 1;
    console.log(`Scraping job ${processed} of ${jobLinks.length}: ${link}`);
    try {
      // Navigate to job detail page using existing page (maintains session)
      // Use 'load' instead of 'networkidle' - Dice.com has continuous network activity
      await page.goto(link, { waitUntil: 'load', timeout: 30_000 });
      const job = await scrapeJobDetail(page, link);

      // Validate URL before insert/upsert
      if (!isValidUrl(job.url)) {
        console.log(`⚠️  Skipped job with invalid URL: ${job.title} (${job.url})`);
        skippedCount++;
        continue;
      }

      // Use upsert with onConflict: 'url' for automatic deduplication
      // The database has a unique index on scraped_jobs.url
      const { data, error } = await supabase
        .from('scraped_jobs')
        .upsert(job, { onConflict: 'url' })
        .select();
      
      if (error) {
        // Handle unique constraint violations gracefully
        if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
          console.log(`⚠️  Skipped duplicate job (URL already exists): ${job.title}`);
          skippedCount++;
        } else {
          console.error(`❌ Upsert FAILED for ${job.title}:`, error.message);
          errorCount++;
        }
      } else {
        savedCount++;
        console.log(`✅ Saved job: ${job.title} at ${job.company} (${job.url})`);
        if (data && data.length > 0) {
          console.log(`   Job ID: ${data[0].id}`);
        }
      }
    } catch (err) {
      errorCount++;
      const errorMsg = (err as Error).message;
      console.error(`❌ Error scraping ${link}:`, errorMsg);
      
      // If timeout, suggest retry
      if (errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        console.log(`   💡 Tip: This might be a network issue. The page may still be loading.`);
      }
    }
    
    // Small delay between jobs to avoid rate limiting
    if (processed < jobLinks.length) {
      await sleep(1000);
    }
  }

  console.log('\n========================================');
  console.log('Scraping Summary:');
  console.log(`  Total found: ${jobLinks.length}`);
  console.log(`  ✅ Saved: ${savedCount}`);
  console.log(`  ⚠️  Skipped: ${skippedCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log('========================================\n');
  await browser.close();
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});

