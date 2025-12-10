// whatsapp-channel-job-scraper.js
// Scrapes all messages from a WhatsApp channel for job URLs, extracts job details, and saves to Supabase (deduplicated by URL)

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const readline = require('readline');
require('dotenv').config();

puppeteer.use(StealthPlugin());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CHANNEL_URL = 'https://web.whatsapp.com/channel/0029Va8bFtmEquiQ4FPXin32';

async function saveJobToSupabase(job) {
  if (!job.url) return;
  try {
    const { error } = await supabase
      .from('scraped_jobs')
      .upsert([job], { onConflict: 'url' });
    if (error) {
      console.error('❌ Supabase error:', error);
    } else {
      console.log(`💾 Saved job: ${job.title} (${job.url})`);
    }
  } catch (e) {
    console.error('❌ Failed to save job:', e);
  }
}

async function extractJobFromMessageHTML(html) {
  const $ = cheerio.load(html);
  // Extract job URL
  const link = $('a[href^="http"]');
  const url = link.attr('href') || '';
  // Extract job title
  const title = $('span.x1iyjqo2').first().text().trim();
  // Extract job description
  const description = $('span.x1fj9vlw').first().text().trim();
  // Extract company/domain
  let company = '';
  // Try to get the domain from the visible text (e.g., remblu.com)
  const domainSpan = $('span._ao3e').filter(function() {
    return $(this).text().includes('.com');
  }).first();
  if (domainSpan.length) {
    company = domainSpan.text().trim();
  } else if (url) {
    // fallback: extract domain from URL
    try {
      company = new URL(url).hostname.replace('www.', '');
    } catch {}
  }
  return {
    url,
    title,
    description,
    company,
    scraped_at: new Date().toISOString().split('T')[0],
    source: company,
  };
}

async function main() {
  const puppeteer = require('puppeteer-extra');
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 120000 });
  console.log('Scan the QR code with your phone to log in to WhatsApp Web.');
  await page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 0 }).catch(() => {});
  await page.waitForSelector('._ak1l', { timeout: 0 }); // Wait for main UI
  console.log('Logged in. Please navigate to the C2C channel messages in WhatsApp Web.');
  console.log('When you are ready, come back to this terminal and press Enter to start scraping...');

  // Wait for Enter key press
  await new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter to start scraping jobs...\n', () => {
      rl.close();
      resolve();
    });
  });

  await page.waitForTimeout(1000); // Small delay after Enter

  // Scroll to load all messages and scrape jobs
  let lastHeight = 0;
  let consecutiveExisting = 0;
  const MAX_CONSECUTIVE_EXISTING = 5; // Stop after 5 consecutive jobs already in Supabase
  const seenUrls = new Set();
  let jobsScraped = 0;

  while (true) {
    const height = await page.evaluate('document.querySelector("._ak1l")?.scrollHeight || 0');
    if (height === lastHeight) break;
    lastHeight = height;
    await page.evaluate('document.querySelector("._ak1l").scrollTo(0, document.querySelector("._ak1l").scrollHeight)');
    await page.waitForTimeout(2000);

    // Extract all messages as HTML
    const messages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('div[role="listitem"]')).map(el => el.outerHTML);
    });
    // For each message, extract job info
    for (const html of messages) {
      const job = await extractJobFromMessageHTML(html);
      if (job.url && !seenUrls.has(job.url)) {
        seenUrls.add(job.url);
        // Check if job already exists in Supabase
        const { data, error } = await supabase
          .from('scraped_jobs')
          .select('id')
          .eq('url', job.url)
          .maybeSingle();
        if (data) {
          consecutiveExisting++;
          console.log(`Job already exists: ${job.url} (${consecutiveExisting} consecutive)`);
          if (consecutiveExisting >= MAX_CONSECUTIVE_EXISTING) {
            console.log('Reached max consecutive existing jobs. Stopping.');
            await browser.close();
            return;
          }
        } else {
          consecutiveExisting = 0;
          await saveJobToSupabase(job);
          jobsScraped++;
        }
      }
    }
  }
  await browser.close();
  console.log(`Done. Scraped ${jobsScraped} new jobs.`);
}

// Only start after Enter is pressed
if (require.main === module) {
  // Launch WhatsApp, wait for login, then wait for Enter to start scraping
  main();
}