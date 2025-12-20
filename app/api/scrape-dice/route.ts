/**
 * Dice.com Job Scraper API
 * 
 * Reinstated Dice scraper endpoint
 * Scrapes jobs from Dice.com and saves them to scraped_jobs table
 * 
 * POST /api/scrape-dice
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
  return `https://www.dice.com/jobs?q=${q}&location=${loc}&radius=30`;
};

const getSourceJobId = (url: string) => {
  const match = url.match(/job-detail\/([^/?#]+)/i);
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

  const links = await page.$$eval('a[href*="/job-detail/"]', (anchors: any[]) =>
    anchors.map((a: any) => a.href).filter(Boolean)
  );

  return uniqueStringArray(links);
}

async function scrapeJobDetail(browserPage: any, jobUrl: string) {
  await browserPage.goto(jobUrl, { waitUntil: 'networkidle', timeout: 45_000 });
  await sleep(1500);

  const title = (await browserPage.textContent('h1'))?.trim() || 'Unknown Title';
  const company = (await browserPage.textContent('[data-testid="job-company-name"], a[href*="/company/"]'))?.trim() || 'Unknown Company';
  const location = (await browserPage.textContent('[data-testid="job-location"]'))?.trim()
    || (await browserPage.textContent('span:has-text("Remote")'))?.trim()
    || 'Unknown';
  const description = (await browserPage.textContent('[data-testid="job-description"]'))?.trim()
    || (await browserPage.textContent('div[data-cy="job-description"]'))?.trim()
    || (await browserPage.textContent('article'))?.trim()
    || '';

  const work_mode = inferWorkMode(location, description);
  const employment_type = inferEmploymentType(description);
  const skills = extractSkills(description);
  const source_job_id = getSourceJobId(jobUrl);
  const dedupHash = hashString(`${title}|${company}|${location}`);
  
  // Infer job_type from description
  const job_type: JobType = inferJobTypeFromDescription(description);

  // Determine location_type and is_remote
  const locationLower = location.toLowerCase();
  const isRemote = locationLower.includes('remote') || work_mode === 'Remote';
  const locationType = isRemote ? 'Remote' : (work_mode === 'Hybrid' ? 'Hybrid' : 'Onsite');

  // Parse skills into must_have_skills and good_to_have_skills
  const mustHaveSkills = skills.length > 0 ? skills.join(', ') : '';
  const goodToHaveSkills = ''; // Dice doesn't separate, so we put all in must_have

  return {
    source: 'Dice',
    source_job_id: source_job_id || dedupHash,
    title,
    company,
    location,
    location_type: locationType,
    is_remote: isRemote,
    description,
    url: jobUrl,
    job_type,
    must_have_skills: mustHaveSkills,
    good_to_have_skills: goodToHaveSkills,
    skills: skills, // Keep for backward compatibility during migration
    scraped_at: new Date().toISOString(),
    posted_date: new Date().toISOString().split('T')[0], // Today's date as default
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

    console.log(`[Dice Scraper] Starting scrape: ${jobTitle} in ${location}`);

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

      console.log(`[Dice Scraper] Found ${jobLinks.length} jobs, scraping ${linksToScrape.length}`);

      let savedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const link of linksToScrape) {
        try {
          const detailPage = await context.newPage();
          const job = await scrapeJobDetail(detailPage, link);
          await detailPage.close();

          if (!isValidUrl(job.url)) {
            console.log(`[Dice Scraper] Skipped invalid URL: ${job.title}`);
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
              console.error(`[Dice Scraper] Upsert failed for ${job.title}:`, error.message);
              errorCount++;
            }
          } else {
            savedCount++;
            console.log(`[Dice Scraper] Saved: ${job.title} at ${job.company}`);
          }
        } catch (err: any) {
          console.error(`[Dice Scraper] Error scraping ${link}:`, err.message);
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
        message: `Scraped ${linksToScrape.length} jobs from Dice, saved ${savedCount} new jobs`,
      });
    } catch (error: any) {
      await browser.close();
      throw error;
    }
  } catch (error: any) {
    console.error('[Dice Scraper] Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Dice scraping failed',
      details: error.stack 
    }, { status: 500 });
  }
}

