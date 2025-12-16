/**
 * Semi-manual Dice.com scraper for internal JobSynth use.
 * Run manually:  npx ts-node scripts/diceScraper.ts
 * (or)          node --loader ts-node/esm scripts/diceScraper.ts
 *
 * Requirements:
 *   npm install playwright @supabase/supabase-js
 *   npx playwright install
 */

import 'dotenv/config';
import { chromium, Page } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

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
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
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
  console.log(`Found ${unique.length} job links`);
  return unique.slice(0, MAX_JOBS_TO_SCRAPE);
}

async function scrapeJobDetail(browserPage: Page, jobUrl: string) {
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

  const work_mode = WORK_MODE_FILTER !== 'Any'
    ? WORK_MODE_FILTER
    : inferWorkMode(location, description);

  const employment_type = EMPLOYMENT_TYPE_FILTER !== 'Any'
    ? EMPLOYMENT_TYPE_FILTER
    : inferEmploymentType(description);

  const skills = extractSkills(description);
  const source_job_id = getSourceJobId(jobUrl);
  const dedupHash = hashString(`${title}|${company}|${location}`);

  return {
    source: 'Dice',
    source_job_id: source_job_id || dedupHash,
    title,
    company,
    location,
    work_mode,
    employment_type,
    skills,
    description,
    url: jobUrl, // Use 'url' column for deduplication (unique index)
    job_url: jobUrl, // Keep for backward compatibility if needed
    scraped_at: new Date().toISOString(),
    hash: dedupHash,
  };
}

// =========================
// Main scraper flow
// =========================
async function main() {
  console.log('Opening Dice search…');
  const searchUrl = buildSearchUrl();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const shutdown = async () => {
    console.log('\nStopping scraper (Ctrl+C)…');
    await browser.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);

  await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 45_000 });

  // Apply simple client-side filters if possible (best-effort)
  // NOTE: Dice filters are often query-parameter based; adjust above constants into the URL as needed.
  const jobLinks = await collectJobLinks(page);

  let processed = 0;
  for (const link of jobLinks) {
    processed += 1;
    console.log(`Scraping job ${processed} of ${jobLinks.length}: ${link}`);
    try {
      const detailPage = await context.newPage();
      const job = await scrapeJobDetail(detailPage, link);
      await detailPage.close();

      // Validate URL before insert/upsert
      if (!isValidUrl(job.url)) {
        console.log(`Skipped job with invalid URL: ${job.title} (${job.url})`);
        continue;
      }

      // Use upsert with onConflict: 'url' for automatic deduplication
      // The database has a unique index on scraped_jobs.url
      const { error } = await supabase
        .from('scraped_jobs')
        .upsert(job, { onConflict: 'url' });
      
      if (error) {
        // Handle unique constraint violations gracefully
        if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
          console.log(`Skipped duplicate job (URL already exists): ${job.title}`);
        } else {
          console.error(`Upsert failed for ${job.title}:`, error.message);
        }
      } else {
        console.log(`Saved job: ${job.title} (${job.url})`);
      }
    } catch (err) {
      console.error(`Error scraping ${link}:`, (err as Error).message);
    }
  }

  console.log('Scraping finished.');
  await browser.close();
}

main().catch((err) => {
  console.error('Scraper failed:', err);
  process.exit(1);
});

