require('dotenv').config();
const axios = require('axios');
const cheerio = require('cheerio');
const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

// Configuration
const CONFIG = {
  dice: {
    baseUrl: 'https://www.dice.com',
    searchUrl: 'https://www.dice.com/jobs?q=peoplesoft%20OR%20sap&employmenttype=Contract&pay=70&radius=30',
    selectors: {
      jobCard: '[data-testid="search-result-card"]',
      jobCardAlt: '.search-result-card',
      jobCardAlt2: '[class*="search-result"]',
      title: 'h2 a[data-testid="card-title-link"], h2 a[href*="/jobs/detail/"], .card-title-link, h2 a',
      company: '[data-testid="search-result-company-name"], .company-name, [class*="company"]',
      location: '[data-testid="search-result-location"], .location, [class*="location"]',
      postedDate: '[data-testid="posted-date"], .posted-date, [class*="posted"]',
      salary: '[data-testid="search-result-salary"], .salary, [class*="salary"]',
      isRemote: '[data-testid="search-result-is-remote"], .remote-indicator, [class*="remote"]',
      nextButton: 'button[aria-label="Go to next page"], .pagination-next, [class*="next"]',
      jobsContainer: '.search-results-container, [data-testid="search-results"], .search-results'
    },
    filters: {
      contractTypes: ['C2C', 'Contract', 'Contract to Hire', 'Corp-to-Corp', 'W2'],
      minPayRate: 70,
      technologies: ['peoplesoft', 'sap', 'oracle', 'erp', 'financials', 'hcm']
    }
  },
  scraping: {
    maxJobsPerRun: 200,
    maxPages: 10,
    headlessBrowser: false,
    timeout: 90000,
    pageWait: 1000,
    scrollDelay: 1000
  }
};

// Initialize Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5993.70 Safari/537.36'
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

class DiceScraper {
  constructor() {
    this.browser = null;
    this.page = null;
    this.isLoggedIn = false;
  }

  async init() {
    console.log('Initializing browser...');
    // Placeholder for proxy support
    // const proxy = getNextProxy();
    this.browser = await puppeteer.launch({
      headless: CONFIG.scraping.headlessBrowser,
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
        // proxy ? `--proxy-server=${proxy}` : null
      ].filter(Boolean)
    });

    this.page = await this.browser.newPage();
    // Set user agent before navigation
    await this.page.setUserAgent(getRandomUserAgent());
    await this.page.setViewport({ width: 1366, height: 768 });
    await this.page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Referer': 'https://www.google.com/',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    // Navigate to Dice login page
    console.log('Navigating to Dice...');
    await this.page.goto('https://www.dice.com/dashboard/login', { 
      waitUntil: 'networkidle2', 
      timeout: CONFIG.scraping.timeout 
    });
    // Now clear session/cookies after navigation
    await this.rotateUserAgentAndSession();
    await this.waitForManualLogin();
  }

  async rotateUserAgentAndSession() {
    // Rotate user agent
    const ua = getRandomUserAgent();
    await this.page.setUserAgent(ua);
    // Clear cookies
    const cookies = await this.page.cookies();
    if (cookies.length > 0) {
      await this.page.deleteCookie(...cookies);
    }
    // Clear local/session storage (must be on a loaded page)
    try {
      await this.page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
    } catch (e) {
      // Ignore errors if not on a loaded page
    }
  }

  async checkForCaptcha() {
    // Log if captcha is detected (manual handling)
    const captcha = await this.page.$('iframe[src*="captcha"], [id*="captcha"], [class*="captcha"]');
    if (captcha) {
      console.log('⚠️ Captcha detected! Please solve it manually in the browser.');
      await this.page.screenshot({ path: 'captcha_detected.png', fullPage: true });
      // Wait for user to solve captcha
      await new Promise(resolve => {
        process.stdin.resume();
        process.stdin.once('data', () => {
          process.stdin.pause();
          resolve();
        });
      });
    }
  }

  async waitForManualLogin() {
    console.log('\n=== MANUAL LOGIN REQUIRED ===');
    console.log('Please log in to Dice in the opened browser window.');
    console.log('After logging in successfully, return here and press Enter to continue...');
    console.log('Make sure you can see the Dice dashboard before continuing.');
    
    // Wait for user input
    await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.pause();
        resolve();
      });
    });
    console.log(`[${new Date().toISOString()}] Enter pressed, proceeding to scraping...`);

    // Check if logged in by looking for your name in the top right
    try {
      await this.page.waitForFunction(
        () => {
          return Array.from(document.querySelectorAll('body *')).some(el => el.textContent && el.textContent.includes('Ritesh Roy'));
        },
        { timeout: 30000 }
      );
      this.isLoggedIn = true;
      console.log('✅ Login detected successfully (Ritesh Roy found)!');
    } catch (error) {
      console.log('⚠️ Could not detect login status (Ritesh Roy not found), but continuing anyway...');
      this.isLoggedIn = true; // Assume logged in
    }
  }

  async checkIfLoggedOut() {
    try {
      // Check if we're on login page or if profile menu is missing
      const currentUrl = this.page.url();
      if (currentUrl.includes('login') || currentUrl.includes('signin')) {
        return true;
      }
      
      const profileExists = await this.page.$('[data-testid="header-profile-menu"], .profile-menu, [class*="profile"]') !== null;
      return !profileExists;
    } catch (error) {
      return false;
    }
  }

  async scrapeJobs() {
    console.log(`[${new Date().toISOString()}] Starting scrapeJobs (current page only)`);
    let allJobs = [];
    const mainPage = this.page;
    // Wait for user to press Enter to scrape the current page
    console.log('\n=== READY TO SCRAPE CURRENT PAGE ===');
    console.log('Navigate to the desired search results page in the browser.');
    console.log('When ready, press Enter here to scrape jobs from the current page...');
    await new Promise(resolve => {
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.pause();
        resolve();
      });
    });
    // DEBUG: Print parent and grandparent HTML of first job link
    const debugInfo = await mainPage.evaluate(() => {
      const jobLinks = Array.from(document.querySelectorAll('[data-testid="job-search-job-card-link"]'));
      let parentHTML = null, grandparentHTML = null, firstLinkHTML = null;
      if (jobLinks.length > 0) {
        firstLinkHTML = jobLinks[0].outerHTML;
        const parent = jobLinks[0].parentElement;
        if (parent) parentHTML = parent.outerHTML;
        const grandparent = parent && parent.parentElement ? parent.parentElement : null;
        if (grandparent) grandparentHTML = grandparent.outerHTML;
      }
      return {
        jobLinksCount: jobLinks.length,
        firstLinkHTML,
        parentHTML,
        grandparentHTML
      };
    });
    console.log('🔎 Found job links:', debugInfo.jobLinksCount);
    if (debugInfo.firstLinkHTML) console.log('🔎 First job link HTML:', debugInfo.firstLinkHTML);
    if (debugInfo.parentHTML) console.log('🔎 Parent HTML:', debugInfo.parentHTML);
    if (debugInfo.grandparentHTML) console.log('🔎 Grandparent HTML:', debugInfo.grandparentHTML);
    // Extract all job cards and their info directly from the page
    const jobsOnPage = await mainPage.evaluate(() => {
      const jobCards = Array.from(document.querySelectorAll('div[data-testid="job-search-serp-card"]'));
      return jobCards.map(card => {
        // Overlay job link
        const overlayLink = card.querySelector('a[data-testid="job-search-job-card-link"]');
        const url = overlayLink ? overlayLink.href : '';
        // Title
        const titleLink = card.querySelector('a[data-testid="job-search-job-detail-link"]');
        const title = titleLink ? titleLink.innerText.trim() : '';
        // Company
        let company = '';
        const logoSpan = card.querySelector('.header span.logo');
        if (logoSpan) {
          const companyLinks = logoSpan.querySelectorAll('a');
          if (companyLinks.length > 1) {
            const companyP = companyLinks[1].querySelector('p');
            if (companyP) company = companyP.innerText.trim();
          }
        }
        // Location and posted date
        let location = '', postedDate = '';
        const contentDiv = card.querySelector('.content');
        if (contentDiv) {
          const infoPs = contentDiv.querySelectorAll('p.text-sm.font-normal.text-zinc-600');
          if (infoPs.length > 0) location = infoPs[0].innerText.trim();
          if (infoPs.length > 1) postedDate = infoPs[infoPs.length-1].innerText.trim();
        }
        // Job type
        let jobType = '';
        const jobTypeP = card.querySelector('div[aria-labelledby="employmentType-label"] > p#employmentType-label');
        if (jobTypeP) jobType = jobTypeP.innerText.trim();
        // Salary
        let salary = '';
        const salaryP = card.querySelector('div[aria-labelledby="salary-label"] > p#salary-label');
        if (salaryP) salary = salaryP.innerText.trim();
        // Description (first 2 lines)
        let description = '';
        const descP = card.querySelector('div.mt-2.flex p.line-clamp-2');
        if (descP) description = descP.innerText.trim();
        // Apply/Easy Apply link
        let applyUrl = '';
        const applyBtn = Array.from(card.querySelectorAll('a,button')).find(b => b.textContent && b.textContent.toLowerCase().includes('apply'));
        if (applyBtn && (applyBtn.href || applyBtn.getAttribute('href'))) {
          applyUrl = applyBtn.href || applyBtn.getAttribute('href');
        } else if (overlayLink) {
          applyUrl = overlayLink.href;
        }
        // Only require title and company
        if (!title || !company) return null;
        // Intelligent location split
        let city = null, state = null, is_remote = false;
        if (location) {
          if (/remote/i.test(location)) {
            is_remote = true;
            city = null;
            state = null;
          } else {
            is_remote = false;
            // Try to split 'Austin, TX' or 'Austin, Texas'
            const match = location.match(/^([^,]+),\s*([A-Za-z]{2,})/);
            if (match) {
              city = match[1].trim();
              state = match[2].trim();
            } else {
              city = location;
              state = null;
            }
          }
        }
        // Posted date normalization
        const now = new Date();
        let posted_date = now.toISOString().split('T')[0];
        // Contract type mapping
        let contract_type = null;
        if (jobType) {
          const type = jobType.toLowerCase();
          if (type.includes('third party')) {
            contract_type = 'C2C';
          } else if (type.includes('contract')) {
            contract_type = 'W2';
          } else {
            contract_type = jobType;
          }
        }
        // Only save first 2 lines of description
        let desc2 = description ? description.split('\n').slice(0,2).join(' ') : '';
        return {
          title,
          company,
          city,
          state,
          salary,
          posted_date,
          url,
          source: 'Dice',
          is_remote,
          contract_type,
          description: desc2,
          apply_url: applyUrl
        };
      }).filter(Boolean);
    });
    console.log(`✅ Scraped ${jobsOnPage.length} jobs from current page`);
    // Deduplicate by URL
    const uniqueJobs = [];
    const seenUrls = new Set();
    for (const job of jobsOnPage) {
      if (!seenUrls.has(job.url)) {
        uniqueJobs.push(job);
        seenUrls.add(job.url);
      }
    }
    return uniqueJobs;
  }

  isValidJob(job) {
    // Basic validation
    if (!job.title || !job.company) {
      return false;
    }
    // Flexible technology and contract matching
    const titleLower = job.title.toLowerCase();
    const descriptionLower = (job.description || '').toLowerCase();
    const techMatch = CONFIG.dice.filters.technologies.some(tech =>
      titleLower.includes(tech.toLowerCase()) || descriptionLower.includes(tech.toLowerCase())
    );
    const contractMatch = CONFIG.dice.filters.contractTypes.some(type =>
      titleLower.includes(type.toLowerCase()) || descriptionLower.includes(type.toLowerCase())
    );
    // Improved salary extraction
    const payMatch = this.extractPayRate(job.salary) >= CONFIG.dice.filters.minPayRate;
    return techMatch || contractMatch || payMatch;
  }

  extractPayRate(salaryText) {
    if (!salaryText) return 0;
    // Extract the highest number in the salary string
    const matches = salaryText.match(/\$(\d{2,5})/g);
    if (!matches) return 0;
    return Math.max(...matches.map(s => parseInt(s.replace(/\$/g, ''))));
  }

  transformJob(job) {
    // No technology, use new schema
    return {
      title: job.title || '',
      company: job.company || '',
      city: job.city || null,
      state: job.state || null,
      salary: job.salary || '',
      posted_date: job.posted_date || '',
      url: job.url,
      source: job.source || 'Dice',
      is_remote: job.is_remote || false,
      contract_type: job.contract_type || '',
      description: job.description || '',
      apply_url: job.apply_url || '',
      scraped_at: new Date().toISOString()
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  async takeScreenshot(filename = 'debug_screenshot.png') {
    if (this.page) {
      await this.page.screenshot({ path: filename, fullPage: true });
      console.log(`📸 Screenshot saved: ${filename}`);
    }
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

  static async isDuplicate(url) {
    if (!supabase) return false;
    try {
      const { data } = await supabase
        .from('scraped_jobs')
        .select('url')
        .eq('url', url)
        .maybeSingle();
      return !!data;
    } catch (error) {
      console.error('Error checking duplicate:', error);
      return false;
    }
  }

  static async getJobCount() {
    if (!supabase) return 0;
    
    try {
      const { count } = await supabase
        .from('scraped_jobs')
        .select('*', { count: 'exact', head: true });
      return count || 0;
    } catch (error) {
      console.error('Error getting job count:', error);
      return 0;
    }
  }
}

class ScrapingScheduler {
  constructor() {
    this.scraper = new DiceScraper();
  }

  async startManual() {
    console.log('🚀 Starting Dice Job Scraper...');
    console.log('📊 Current database job count:', await JobStorage.getJobCount());
    try {
      await this.scraper.init();
      await this.runContinuousScraping();
    } catch (error) {
      console.error('❌ Scraper failed:', error);
    } finally {
      // await this.scraper.close();
      console.log('🔚 Scraper stopped. (Browser left open for manual inspection)');
    }
  }

  async runContinuousScraping() {
    console.log('\n🔄 Starting continuous scraping...');
    console.log('💡 The scraper will continue until you log out of Dice or close the browser.');
    let runCount = 0;
    const maxRuns = 5; // Configurable run limit
    while (runCount < maxRuns) {
      runCount++;
      console.log(`\n📊 === Scraping Run #${runCount} ===`);
      try {
        const jobs = await this.scraper.scrapeJobs();
        console.log(`📈 Found ${jobs.length} total jobs`);
        if (jobs.length > 0) {
          const validJobs = jobs
            .filter(job => this.scraper.isValidJob(job))
            .map(job => this.scraper.transformJob(job));
          console.log(`✅ ${validJobs.length} jobs passed validation`);
          const uniqueJobs = [];
          for (const job of validJobs) {
            if (!await JobStorage.isDuplicate(job.url)) {
              uniqueJobs.push(job);
            }
          }
          console.log(`🆕 ${uniqueJobs.length} unique jobs to save (not in Supabase)`);
          if (uniqueJobs.length > 0) {
            const saved = await JobStorage.saveJobs(uniqueJobs);
            if (saved) {
              console.log(`💾 Saved ${uniqueJobs.length} new jobs`);
            } else {
              console.log('⚠️ Failed to save jobs to database');
            }
          } else {
            console.log('📝 No new jobs to save (all duplicates)');
          }
        } else {
          console.log('❌ No jobs found in this run');
        }
        if (runCount < maxRuns) {
          console.log('\n⏳ Waiting 60 seconds before next run...');
          console.log('💡 You can log out of Dice now to stop the scraper');
          await new Promise(resolve => setTimeout(resolve, 60000));
        }
      } catch (error) {
        console.error('❌ Scraping run failed:', error);
        await this.scraper.takeScreenshot(`error_run_${runCount}.png`);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }
    console.log(`\n🏁 Completed ${runCount} scraping runs.`);
  }
}

// Main execution
if (require.main === module) {
  (async () => {
    const scheduler = new ScrapingScheduler();
    await scheduler.startManual();
    process.exit(0);
  })();
}

// Serverless handler
exports.handler = async (event, context) => {
  try {
    const scraper = new DiceScraper();
    await scraper.init();
    const jobs = await scraper.scrapeJobs();
    
    let saved = 0;
    if (jobs.length > 0) {
      const validJobs = jobs
        .filter(job => scraper.isValidJob(job))
        .map(job => scraper.transformJob(job));
      
      await JobStorage.saveJobs(validJobs);
      saved = validJobs.length;
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