/**
 * TechFetch.com Job Scraper API
 * 
 * Scrapes jobs from TechFetch.com and saves them to scraped_jobs table
 * 
 * POST /api/scrape-techfetch
 * Body: {
 *   job_title?: string,      // Default: "Oracle Cloud Consultant"
 *   location?: string,        // Default: "Remote"
 *   max_jobs?: number,       // Default: 20
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import crypto from 'crypto';
import { inferJobTypeFromDescription, DEFAULT_JOB_TYPE, type JobType } from '@/lib/job-types';
import { uniqueStringArray } from '@/lib/utils/typeGuards';
import { extractPlatformFromJob, extractSecondaryPlatforms } from '@/lib/matching/extractPlatform';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Utility helpers
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

const KEY_SKILLS = ['Oracle', 'PeopleSoft', 'SAP', 'Cloud', 'Data', 'OCI', 'AWS', 'Azure', 'GCP'];

const extractSkills = (description: string): string[] => {
  const desc = description.toLowerCase();
  return KEY_SKILLS.filter((skill) => desc.includes(skill.toLowerCase()));
};

const buildSearchUrl = (jobTitle: string, location: string) => {
  const q = encodeURIComponent(jobTitle);
  const loc = encodeURIComponent(location);
  // TechFetch search format - adjust based on actual site structure
  return `https://www.techfetch.com/jobs?q=${q}&location=${loc}`;
};

const getSourceJobId = (url: string) => {
  // Extract job ID from TechFetch URL - adjust pattern based on actual URL structure
  const match = url.match(/job[s]?[\/-]?(\d+)/i) || url.match(/id[=:](\d+)/i);
  return match ? match[1] : null;
};

function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function collectJobLinks(page: any): Promise<string[]> {
  // Scroll a few times to load results
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 2000);
    await sleep(1000);
  }

  // TechFetch job link selectors - adjust based on actual site structure
  const links = await page.$$eval(
    'a[href*="/job/"], a[href*="/jobs/"], a[href*="techfetch.com/job"], .job-title a, .job-link',
    (anchors: any[]) =>
      anchors.map((a: any) => a.href).filter(Boolean)
  );

  return uniqueStringArray(links);
}

async function scrapeJobDetail(browserPage: any, jobUrl: string) {
  await browserPage.goto(jobUrl, { waitUntil: 'networkidle', timeout: 45_000 });
  await sleep(1500);

  // TechFetch job detail selectors - adjust based on actual site structure
  const title = (await browserPage.textContent('h1, .job-title, [data-testid="job-title"]'))?.trim() || 'Unknown Title';
  const company = (await browserPage.textContent('.company-name, [data-testid="company-name"], .employer-name, a[href*="/company/"]'))?.trim() || 'Unknown Company';
  const location = (await browserPage.textContent('.job-location, [data-testid="location"], .location, span:has-text("Remote")'))?.trim()
    || (await browserPage.textContent('span:has-text("Remote")'))?.trim()
    || 'Unknown';
  const description = (await browserPage.textContent('.job-description, [data-testid="description"], .description, article, .job-details'))?.trim()
    || (await browserPage.textContent('div[class*="description"]'))?.trim()
    || '';

  const work_mode = inferWorkMode(location, description);
  const employment_type = inferEmploymentType(description);
  const skills = extractSkills(description);
  const source_job_id = getSourceJobId(jobUrl);
  const dedupHash = hashString(`${title}|${company}|${location}`);
  
  // Infer job_type from description
  const job_type: JobType = inferJobTypeFromDescription(description);

  // Determine work_location_type (authoritative field), location_type and is_remote (legacy)
  const locationLower = location.toLowerCase();
  const isRemote = locationLower.includes('remote') || work_mode === 'Remote';
  const locationType = isRemote ? 'Remote' : (work_mode === 'Hybrid' ? 'Hybrid' : 'Onsite');
  const workLocationType = locationType; // Use same value for work_location_type

  // Parse skills into must_have_skills and good_to_have_skills
  const mustHaveSkills = skills.length > 0 ? skills.join(', ') : '';
  const goodToHaveSkills = ''; // TechFetch doesn't separate, so we put all in must_have

  // Extract platform from title and skills
  const allSkills = skills;
  const primaryPlatform = extractPlatformFromJob(title, allSkills) || '';
  const secondaryPlatforms = extractSecondaryPlatforms(title, allSkills) || [];

  // Extract experience years from description
  const experienceMatch = description.match(/(\d+)\+?\s*(?:years?|yrs?|year['\s]+of|year['\s]+experience)/i);
  const requiredYearsExp = experienceMatch ? parseInt(experienceMatch[1], 10) : 0;

  // Extract salary/pay rate from description
  const salaryMatch = description.match(/\$(\d+(?:,\d{3})*(?:k|K)?)\s*(?:\/hr|\/hour|per hour|annually|yearly|per year)/i) 
    || description.match(/\$(\d+(?:,\d{3})*(?:k|K)?)\s*-\s*\$(\d+(?:,\d{3})*(?:k|K)?)/i);
  const salaryRaw = salaryMatch ? (salaryMatch[0] || '') : null;

  return {
    source: 'TechFetch',
    source_job_id: source_job_id || dedupHash,
    title,
    company,
    location,
    work_location_type: workLocationType, // Authoritative field
    location_type: locationType, // Legacy - deprecated
    is_remote: isRemote, // Legacy - deprecated
    description,
    url: jobUrl,
    job_type,
    must_have_skills: mustHaveSkills,
    good_to_have_skills: goodToHaveSkills,
    // Platform identity
    primary_platform: primaryPlatform || null,
    secondary_platforms: secondaryPlatforms.length > 0 ? secondaryPlatforms : null,
    // Experience
    required_years_experience: requiredYearsExp,
    // Pay rate
    salary: salaryRaw,
    pay_rate_raw: salaryRaw,
    scraped_at: new Date().toISOString(),
    posted_date: new Date().toISOString().split('T')[0],
    is_active: true,
    is_real: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const jobTitle = body.job_title || 'Oracle Cloud Consultant';
    const location = body.location || 'Remote';
    const maxJobs = body.max_jobs || 20;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const searchUrl = buildSearchUrl(jobTitle, location);

    console.log(`[TechFetch Scraper] Starting scrape: ${jobTitle} in ${location}`);

    // Launch browser (headless mode for serverless)
    const browser = await chromium.launch({ 
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Required for serverless
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
    const page = await context.newPage();

    try {
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45_000 });
      
      const jobLinks = await collectJobLinks(page);
      const linksToScrape = jobLinks.slice(0, maxJobs);

      console.log(`[TechFetch Scraper] Found ${jobLinks.length} jobs, scraping ${linksToScrape.length}`);

      let savedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const link of linksToScrape) {
        try {
          const detailPage = await context.newPage();
          const job = await scrapeJobDetail(detailPage, link);
          await detailPage.close();

          if (!isValidUrl(job.url)) {
            console.log(`[TechFetch Scraper] Skipped invalid URL: ${job.title}`);
            skippedCount++;
            continue;
          }

          // Upsert to scraped_jobs
          const { error } = await supabase
            .from('scraped_jobs')
            .upsert(job, { onConflict: 'url' });
          
          if (error) {
            if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
              skippedCount++;
            } else {
              console.error(`[TechFetch Scraper] Upsert failed for ${job.title}:`, error.message);
              errorCount++;
            }
          } else {
            savedCount++;
            console.log(`[TechFetch Scraper] Saved: ${job.title} at ${job.company}`);
          }
        } catch (err: any) {
          console.error(`[TechFetch Scraper] Error scraping ${link}:`, err.message);
          errorCount++;
        }
      }

      await browser.close();

      return NextResponse.json({
        success: true,
        saved: savedCount,
        skipped: skippedCount,
        errors: errorCount,
        total_found: jobLinks.length,
        total_scraped: linksToScrape.length,
        message: `Scraped ${linksToScrape.length} jobs from TechFetch, saved ${savedCount} new jobs`,
      });
    } catch (error: any) {
      await browser.close();
      throw error;
    }
  } catch (error: any) {
    console.error('[TechFetch Scraper] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'TechFetch scraping failed',
      details: error.stack 
    }, { status: 500 });
  }
}

