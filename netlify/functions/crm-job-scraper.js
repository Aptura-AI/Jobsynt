const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
  dice: {
    baseUrl: 'https://www.dice.com',
    searchUrl: 'https://www.dice.com/jobs?q=peoplesoft%20OR%20sap&employmenttype=Contract&pay=70&radius=30',
    selectors: {
      jobsContainer: 'dhi-search-card',
      title: '[data-cy="card-title-link"]',
      company: '[data-cy="search-result-company-name"]',
      location: '[data-cy="search-result-location"]',
      postedDate: '[data-cy="posted-date"]',
      salary: '[data-cy="search-result-salary"]',
      jobId: '[data-cy="card-title-link"]@href',
      isRemote: '[data-cy="search-result-is-remote"]'
    },
    filters: {
      contractTypes: ['C2C', 'Contract', 'Contract to Hire'],
      minPayRate: 70,
      technologies: ['peoplesoft', 'sap', 'oracle']
    }
  },
  scraping: {
    interval: '0 * * * *', // Every hour
    maxJobsPerRun: 50,
    headlessBrowser: true,
    timeout: 60000
  }
};

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

class DiceScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: CONFIG.scraping.headlessBrowser,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.google.com/'
    });
  }

  async scrapeJobs() {
    try {
      console.log(`Navigating to Dice search URL: ${CONFIG.dice.searchUrl}`);
      await this.page.goto(CONFIG.dice.searchUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.scraping.timeout
      });

      await this.page.waitForSelector(CONFIG.dice.selectors.jobsContainer, {
        timeout: CONFIG.scraping.timeout
      });

      const html = await this.page.content();
      const $ = cheerio.load(html);
      const jobs = [];

      $(CONFIG.dice.selectors.jobsContainer).each((i, element) => {
        if (jobs.length >= CONFIG.scraping.maxJobsPerRun) return false;

        const job = {
          source: 'Dice',
          is_remote: $(element).find(CONFIG.dice.selectors.isRemote).text().includes('Remote'),
          url: $(element).find(CONFIG.dice.selectors.title).attr('href')
        };

        ['title', 'company', 'location', 'postedDate', 'salary'].forEach(field => {
          job[field] = $(element).find(CONFIG.dice.selectors[field]).text().trim();
        });

        if (this.isValidJob(job)) {
          jobs.push(this.transformJob(job));
        }
      });

      return jobs;
    } catch (error) {
      console.error('Scraping error:', error);
      return [];
    }
  }

  isValidJob(job) {
    const techMatch = CONFIG.dice.filters.technologies.some(tech =>
      job.title.toLowerCase().includes(tech) ||
      (job.description && job.description.toLowerCase().includes(tech))
    );
    const contractMatch = CONFIG.dice.filters.contractTypes.some(type =>
      job.title.includes(type) ||
      (job.description && job.description.includes(type))
    );
    const payMatch = this.extractPayRate(job.salary) >= CONFIG.dice.filters.minPayRate;
    return techMatch && contractMatch && payMatch;
  }

  extractPayRate(salaryText) {
    if (!salaryText) return 0;
    const matches = salaryText.match(/\$(\d+)/);
    return matches ? parseInt(matches[1]) : 0;
  }

  transformJob(job) {
    return {
      title: job.title,
      company: job.company,
      location: job.location,
      salary: job.salary,
      posted_date: job.postedDate,
      url: job.url && job.url.startsWith('http') ? job.url : `${CONFIG.dice.baseUrl}${job.url}`,
      source: 'Dice',
      is_remote: job.is_remote,
      is_contract: true,
      technology: this.detectTechnology(job.title),
      scraped_at: new Date().toISOString()
    };
  }

  detectTechnology(title) {
    if (title.toLowerCase().includes('peoplesoft')) return 'PeopleSoft';
    if (title.toLowerCase().includes('sap')) return 'SAP';
    if (title.toLowerCase().includes('oracle')) return 'Oracle';
    return 'Other';
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}

class JobStorage {
  static async saveJobs(jobs) {
    const { error } = await supabase
      .from('scraped_jobs')
      .upsert(jobs, { onConflict: 'url' });
    if (error) {
      console.error('Database error:', error);
      return false;
    }
    return true;
  }

  static async isDuplicate(url) {
    const { data } = await supabase
      .from('scraped_jobs')
      .select('url')
      .eq('url', url)
      .maybeSingle();
    return !!data;
  }
}

class ScrapingScheduler {
  constructor() {
    this.scraper = new DiceScraper();
  }

  async start() {
    await this.scraper.init();
    await this.runScraping();
    cron.schedule(CONFIG.scraping.interval, async () => {
      await this.runScraping();
    });
  }

  async runScraping() {
    console.log('Starting scraping run at', new Date().toISOString());
    try {
      const jobs = await this.scraper.scrapeJobs();
      console.log(`Found ${jobs.length} matching jobs`);
      const uniqueJobs = [];
      for (const job of jobs) {
        if (!await JobStorage.isDuplicate(job.url)) {
          uniqueJobs.push(job);
        }
      }
      if (uniqueJobs.length > 0) {
        await JobStorage.saveJobs(uniqueJobs);
        console.log(`Saved ${uniqueJobs.length} new jobs`);
      } else {
        console.log('No new jobs to save');
      }
    } catch (error) {
      console.error('Scraping run failed:', error);
    }
  }

  async stop() {
    await this.scraper.close();
  }
}

const scheduler = new ScrapingScheduler();
scheduler.start().catch(console.error);

process.on('SIGINT', async () => {
  await scheduler.stop();
  process.exit();
});
process.on('SIGTERM', async () => {
  await scheduler.stop();
  process.exit();
});

exports.handler = async (event, context) => {
  // Manual trigger for scraping
  try {
    const scraper = new DiceScraper();
    await scraper.init();
    const jobs = await scraper.scrapeJobs();
    let saved = 0;
    if (jobs.length > 0) {
      await JobStorage.saveJobs(jobs);
      saved = jobs.length;
    }
    await scraper.close();
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        jobs_found: jobs.length,
        jobs_saved: saved,
        message: `Scraped and saved ${saved} jobs.`
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
}; 