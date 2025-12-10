// whatsapp-channel-job-scraper.js
// Scrapes all messages from a WhatsApp channel for job URLs, extracts job details, and saves to Supabase (deduplicated by URL)

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const readline = require('readline');

puppeteer.use(StealthPlugin());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CHANNEL_URL = 'https://web.whatsapp.com/channel/0029Va8bFtmEquiQ4FPXin32';
const JOB_URL_REGEX = /(https?:\/\/(corptocorp\.org|remblu\.com)\/job\/[\w\-\/?=&%\.]+)/gi;

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

async function extractJobDetails(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);
    const data = await page.evaluate(() => {
      // Try to extract job details from corptocorp.org/remblu.com job page
      const title = document.querySelector('h1, h2, .job-title')?.innerText?.trim() || '';
      const company = document.querySelector('.company, .job-company, .company-name')?.innerText?.trim() || '';
      const location = document.querySelector('.location, .job-location')?.innerText?.trim() || '';
      let description = '';
      const descEl = document.querySelector('.job-description, .description, .entry-content, .post-content, article');
      if (descEl) {
        description = descEl.innerText.split('\n').slice(0,2).join(' ');
      }
      const contract_type = /c2c|w2|contract/i.test(document.body.innerText) ? (document.body.innerText.match(/c2c|w2|contract/i) || [''])[0].toUpperCase() : '';
      const salary = document.body.innerText.match(/\$[\d,]+(\s*-\s*\$[\d,]+)?/)?.[0] || '';
      // Try to find recruiter email in apply button or anywhere on page
      let recruiter_email = '';
      const mailto = document.querySelector('a[href^="mailto:"]');
      if (mailto) {
        recruiter_email = mailto.href.replace('mailto:', '').split('?')[0];
      } else {
        // Fallback: search for email in text
        const emailMatch = document.body.innerText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        recruiter_email = emailMatch ? emailMatch[0] : '';
      }
      return { title, company, location, description, contract_type, salary, recruiter_email };
    });
    return {
      ...data,
      url,
      source: url.includes('corptocorp.org') ? 'corptocorp.org' : 'remblu.com',
      scraped_at: new Date().toISOString().split('T')[0],
    };
  } catch (e) {
    console.error('❌ Failed to extract job details:', url, e);
    return null;
  }
}

async function main() {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'], executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome1.exe' });
  const page = await browser.newPage();
  await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2' });
  console.log('Scan the QR code with your phone to log in to WhatsApp Web.');
  await page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 0 }).catch(() => {});
  // Wait for the main UI (message list) to load
  // Instead of waiting for a selector, prompt the user
  console.log('After logging in, manually navigate to the WhatsApp channel page in the browser window.');
  console.log('When you are on the correct channel page, press Enter here in the terminal to continue...');
  await new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('', () => {
      rl.close();
      resolve();
    });
  });
  console.log('Continuing after Enter...');
  try {
    // Scroll up to load past messages
    let lastHeight = 0;
    while (true) {
      const height = await page.evaluate(() => {
        const list = document.querySelector('div[role="list"]') || document.querySelector('div[tabindex][aria-label]');
        return list ? list.scrollHeight : 0;
      });
      if (height === lastHeight) break;
      lastHeight = height;
      await page.evaluate(() => {
        const list = document.querySelector('div[role="list"]') || document.querySelector('div[tabindex][aria-label]');
        if (list) list.scrollTo(0, 0);
      });
      await wait(2000);
    }
    console.log('Finished scrolling. Extracting messages...');
    // Extract all messages robustly
    const messages = await page.evaluate(() => {
      const items = document.querySelectorAll('div[role="listitem"]');
      return Array.from(items).map(el => el.innerText);
    });
    console.log(`Found ${messages.length} messages.`);
    // Extract job URLs
    const jobUrlRegex = /(https?:\/\/(corptocorp\.org|remblu\.com)\/job\/[\w\-\/?=&%\.]+)/gi;
    const jobUrls = new Set();
    for (const msg of messages) {
      const urls = msg.match(jobUrlRegex);
      if (urls) urls.forEach(url => jobUrls.add(url.split('?')[0]));
    }
    console.log(`Found ${jobUrls.size} unique job URLs.`);
    // For each job URL, open in a new tab, extract details, and save to Supabase
    let consecutiveAlreadySaved = 0;
    for (const url of jobUrls) {
      // Check if already saved
      const { data: existing, error } = await supabase
        .from('scraped_jobs')
        .select('url, contract_type')
        .eq('url', url)
        .maybeSingle();
      if (existing && existing.contract_type && existing.contract_type.toLowerCase().includes('contract')) {
        consecutiveAlreadySaved++;
        if (consecutiveAlreadySaved >= 3) {
          console.log('Found 3 contract jobs in a row that are already saved. Stopping scrape.');
          break;
        }
        continue;
      } else {
        consecutiveAlreadySaved = 0;
      }
      // Open job URL in a new tab
      const jobPage = await browser.newPage();
      try {
        await jobPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(2000);
        // Extract job details (robust selectors, fallback to null if not found)
        const job = await jobPage.evaluate(() => {
          function getText(sel) {
            const el = document.querySelector(sel);
            return el ? el.innerText.trim() : null;
          }
          // Try common selectors for job title, company, etc.
          const title = getText('h1, .job-title, .entry-title');
          const company = getText('.company, .job-company, .employer, .job-header-company');
          const location = getText('.location, .job-location, .job-header-location');
          let description = getText('.job-description, .entry-content, .description, .job-desc');
          if (description) {
            description = description.split('\n').slice(0,2).join(' ');
          }
          // Try to find contract type and salary in the page text
          let contract_type = null;
          let salary = null;
          const pageText = document.body.innerText;
          if (/contract,? third party/i.test(pageText)) contract_type = 'C2C';
          else if (/contract/i.test(pageText)) contract_type = 'W2';
          if (/\$[\d,]+/i.test(pageText)) salary = pageText.match(/\$[\d,]+/i)[0];
          // Try to find recruiter email in apply button or anywhere in the page
          let apply_email = null;
          const mailto = document.querySelector('a[href^="mailto:"]');
          if (mailto) apply_email = mailto.getAttribute('href').replace('mailto:', '');
          else {
            const emailMatch = pageText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) apply_email = emailMatch[0];
          }
          return {
            title,
            company,
            location,
            description,
            contract_type,
            salary,
            apply_email
          };
        });
        job.url = url;
        job.source = url.includes('corptocorp.org') ? 'corptocorp.org' : 'remblu.com';
        job.posted_date = new Date().toISOString().split('T')[0];
        job.scraped_at = new Date().toISOString();
        // Save to Supabase
        const { error: saveError } = await supabase.from('scraped_jobs').insert([job]);
        if (saveError) {
          console.error('Failed to save job:', job.title, saveError.message);
        } else {
          console.log('Saved job:', job.title, job.url);
        }
      } catch (err) {
        console.error('Error scraping job URL:', url, err.message);
      } finally {
        await jobPage.close();
      }
      await wait(1000);
    }
    console.log('Scraping complete. You may now close the browser window.');
    await browser.close();
    console.log('Done.');
  } catch (err) {
    console.error('Error during scraping:', err);
  }
}

// Replace all page.waitForTimeout with setTimeout for compatibility
function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

main(); 