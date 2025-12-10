require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getRandomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.70 Safari/537.36'
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

class GlassdoorScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    console.log('Initializing browser...');
    this.browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-features=SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure',
      ]
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(getRandomUserAgent());
    await this.page.setViewport({ width: 1366, height: 768 });
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Referer': 'https://www.google.com/',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    console.log('Navigating to Glassdoor job search page...');
    await this.page.goto('https://www.glassdoor.com/Job/', { waitUntil: 'networkidle2', timeout: 90000 });
    console.log('\n=== MANUAL LOGIN REQUIRED ===');
    console.log('Please log in to Glassdoor in the opened browser window.');
    console.log('After logging in, perform your desired job search.');
    console.log('Navigate to the search results page you want to scrape.');
    console.log('When ready, return here and press Enter to continue...');
    await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.pause();
        resolve();
      });
    });
    console.log(`[${new Date().toISOString()}] Enter pressed, proceeding to scrape current page...`);
  }

  async scrapeJobs() {
    console.log(`[${new Date().toISOString()}] Starting scrapeJobs (current page only)`);
    console.log('Scraping jobs from the current Glassdoor search results page...');
    // DEBUG: Print job card count and outer HTML of job list container
    const debugInfo = await this.page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-test="jobListing"]'));
      let container = null;
      if (cards.length > 0) {
        container = cards[0].parentElement ? cards[0].parentElement.outerHTML : null;
      }
      return {
        jobCardCount: cards.length,
        containerHTML: container
      };
    });
    console.log('DEBUG: Job card count:', debugInfo.jobCardCount);
    if (debugInfo.containerHTML) {
      console.log('DEBUG: Outer HTML of job list container (truncated):', debugInfo.containerHTML.substring(0, 1000));
    } else {
      console.log('DEBUG: No job card container found.');
    }
    const jobsOnPage = await this.page.evaluate(() => {
      function getText(el, sel) {
        const node = el.querySelector(sel);
        return node ? node.innerText.trim() : null;
      }
      function getAttr(el, sel, attr) {
        const node = el.querySelector(sel);
        return node ? node.getAttribute(attr) : null;
      }
      const cards = Array.from(document.querySelectorAll('[data-test="jobListing"]'));
      return cards.map(card => {
        const title = getText(card, 'div.job-title.mt-xsm');
        const company = getText(card, 'div.job-search-gx72iw > div.job-search-8wag7x');
        let url = getAttr(card, "a[data-test='job-link']", 'href');
        if (url && url.startsWith('/')) url = 'https://www.glassdoor.com' + url;
        const location = getText(card, '.location') || getText(card, "[data-test='job-location']");
        const salary = getText(card, '.salary') || getText(card, "[data-test='job-salary']");
        const description = getText(card, '.job-description') || getText(card, "[data-test='job-description']");
        return {
          title,
          company,
          location,
          salary,
          description,
          url,
          source: 'Glassdoor',
          scraped_at: new Date().toISOString()
        };
      }).filter(j => j.title && j.company && j.url);
    });
    console.log(`✅ Scraped ${jobsOnPage.length} jobs from current page`);
    // Deduplicate by URL
    const seen = new Set();
    const uniqueJobs = jobsOnPage.filter(j => {
      if (!j.url || seen.has(j.url)) return false;
      seen.add(j.url);
      return true;
    });
    return uniqueJobs;
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

class JobStorage {
  static async saveJobs(jobs) {
    if (!supabase) {
      console.log('⚠️ Supabase not configured, jobs will not be saved to database');
      return false;
    }
    try {
      const { error } = await supabase
        .from('scraped_jobs')
        .upsert(jobs, { onConflict: 'url' });
      if (error) {
        console.error('❌ Database error:', error);
        return false;
      }
      return true;
    } catch (error) {
      console.error('❌ Failed to save jobs:', error);
      return false;
    }
  }
}

if (require.main === module) {
  (async () => {
    const scraper = new GlassdoorScraper();
    await scraper.init();
    const jobs = await scraper.scrapeJobs();
    if (jobs.length > 0) {
      const saved = await JobStorage.saveJobs(jobs);
      if (saved) {
        console.log(`💾 Saved ${jobs.length} new jobs to Supabase`);
      } else {
        console.log('⚠️ Failed to save jobs to database');
      }
    } else {
      console.log('❌ No jobs found to save');
    }
    // Leave browser open for manual inspection
    // await scraper.close();
  })();
} 