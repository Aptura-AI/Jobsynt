// Additional Job Site Scrapers
// Import this file into job-scraper.js to add more job sources

const axios = require('axios');
const cheerio = require('cheerio');

// Tech-focused job sites
async function scrapeDice(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const searchUrl = `https://www.dice.com/jobs/q-${encodeURIComponent(keywords)}-l-${encodeURIComponent(location)}-jobs`;
    
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('[data-testid="job-card"]');
      return Array.from(jobElements).map(job => {
        const titleElement = job.querySelector('[data-testid="job-title"]');
        const companyElement = job.querySelector('[data-testid="job-company"]');
        const locationElement = job.querySelector('[data-testid="job-location"]');
        const linkElement = job.querySelector('a[data-testid="job-title"]');
        
        return {
          title: titleElement?.textContent?.trim() || '',
          company: companyElement?.textContent?.trim() || '',
          location: locationElement?.textContent?.trim() || '',
          url: linkElement?.href || '',
          source: 'Dice',
          posted_date: new Date().toISOString(),
          type: 'full-time',
          remote: job.textContent?.toLowerCase().includes('remote') || false
        };
      }).filter(job => job.title && job.company);
    });
    
    await page.close();
    return jobs;
  } catch (error) {
    console.error('Dice scraping failed:', error);
    return [];
  }
}

async function scrapeGlassdoor(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const searchUrl = `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(keywords)}&locT=&locId=&jobType=`;
    
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('[data-test="job-listing"]');
      return Array.from(jobElements).map(job => {
        const titleElement = job.querySelector('[data-test="job-title"]');
        const companyElement = job.querySelector('[data-test="employer-name"]');
        const locationElement = job.querySelector('[data-test="job-location"]');
        const linkElement = job.querySelector('a[data-test="job-title"]');
        
        return {
          title: titleElement?.textContent?.trim() || '',
          company: companyElement?.textContent?.trim() || '',
          location: locationElement?.textContent?.trim() || '',
          url: linkElement?.href ? `https://www.glassdoor.com${linkElement.href}` : '',
          source: 'Glassdoor',
          posted_date: new Date().toISOString(),
          type: 'full-time',
          remote: job.textContent?.toLowerCase().includes('remote') || false
        };
      }).filter(job => job.title && job.company);
    });
    
    await page.close();
    return jobs;
  } catch (error) {
    console.error('Glassdoor scraping failed:', error);
    return [];
  }
}

// Remote-first job sites
async function scrapeFlexJobs(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const axiosInstance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const { data } = await axiosInstance.get('https://www.flexjobs.com/search', {
      params: {
        search: keywords,
        location: location
      }
    });
    
    const $ = cheerio.load(data);
    
    return $('.job').map((i, elem) => ({
      title: $(elem).find('.job-title a').text().trim(),
      company: $(elem).find('.job-company').text().trim(),
      location: $(elem).find('.job-location').text().trim() || 'Remote',
      url: `https://www.flexjobs.com${$(elem).find('.job-title a').attr('href')}`,
      source: 'FlexJobs',
      posted_date: $(elem).find('.job-posted').text().trim() || new Date().toISOString(),
      type: 'flexible',
      remote: true,
      description: $(elem).find('.job-description').text().trim()
    })).get().filter(job => job.title && job.company);
  } catch (error) {
    console.error('FlexJobs scraping failed:', error);
    return [];
  }
}

async function scrapeZipRecruiter(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const searchUrl = `https://www.ziprecruiter.com/Jobs/${encodeURIComponent(keywords)}/${encodeURIComponent(location)}`;
    
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('article[data-testid="job_result_item"]');
      return Array.from(jobElements).map(job => {
        const titleElement = job.querySelector('h2 a');
        const companyElement = job.querySelector('[data-testid="job-company"]');
        const locationElement = job.querySelector('[data-testid="job-location"]');
        const salaryElement = job.querySelector('[data-testid="job-salary"]');
        
        return {
          title: titleElement?.textContent?.trim() || '',
          company: companyElement?.textContent?.trim() || '',
          location: locationElement?.textContent?.trim() || '',
          salary: salaryElement?.textContent?.trim() || '',
          url: titleElement?.href || '',
          source: 'ZipRecruiter',
          posted_date: new Date().toISOString(),
          type: 'full-time',
          remote: job.textContent?.toLowerCase().includes('remote') || false
        };
      }).filter(job => job.title && job.company);
    });
    
    await page.close();
    return jobs;
  } catch (error) {
    console.error('ZipRecruiter scraping failed:', error);
    return [];
  }
}

// Traditional job boards
async function scrapeSimplyHired(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const searchUrl = `https://www.simplyhired.com/search?q=${encodeURIComponent(keywords)}&l=${encodeURIComponent(location)}`;
    
    const axiosInstance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const { data } = await axiosInstance.get(searchUrl);
    const $ = cheerio.load(data);
    
    return $('.SerpJob-jobCard').map((i, elem) => ({
      title: $(elem).find('.jobposting-title a').text().trim(),
      company: $(elem).find('.jobposting-company').text().trim(),
      location: $(elem).find('.jobposting-location').text().trim(),
      url: $(elem).find('.jobposting-title a').attr('href'),
      source: 'SimplyHired',
      posted_date: $(elem).find('.jobposting-posted').text().trim() || new Date().toISOString(),
      type: 'full-time',
      description: $(elem).find('.jobposting-snippet').text().trim(),
      remote: $(elem).text().toLowerCase().includes('remote')
    })).get().filter(job => job.title && job.company);
  } catch (error) {
    console.error('SimplyHired scraping failed:', error);
    return [];
  }
}

async function scrapeCareerBuilder(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const searchUrl = `https://www.careerbuilder.com/jobs?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}`;
    
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('[data-test-id="job-listing-item"]');
      return Array.from(jobElements).map(job => {
        const titleElement = job.querySelector('[data-test-id="job-title"]');
        const companyElement = job.querySelector('[data-test-id="job-company"]');
        const locationElement = job.querySelector('[data-test-id="job-location"]');
        const linkElement = job.querySelector('a[data-test-id="job-title"]');
        
        return {
          title: titleElement?.textContent?.trim() || '',
          company: companyElement?.textContent?.trim() || '',
          location: locationElement?.textContent?.trim() || '',
          url: linkElement?.href || '',
          source: 'CareerBuilder',
          posted_date: new Date().toISOString(),
          type: 'full-time',
          remote: job.textContent?.toLowerCase().includes('remote') || false
        };
      }).filter(job => job.title && job.company);
    });
    
    await page.close();
    return jobs;
  } catch (error) {
    console.error('CareerBuilder scraping failed:', error);
    return [];
  }
}

// Remote-specific sites
async function scrapeJustRemote(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const axiosInstance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const { data } = await axiosInstance.get('https://justremote.co/remote-jobs', {
      params: { q: keywords }
    });
    
    const $ = cheerio.load(data);
    
    return $('.job-card').map((i, elem) => ({
      title: $(elem).find('.job-title').text().trim(),
      company: $(elem).find('.company-name').text().trim(),
      location: 'Remote',
      url: `https://justremote.co${$(elem).find('a').attr('href')}`,
      source: 'JustRemote',
      posted_date: $(elem).find('.posted-date').text().trim() || new Date().toISOString(),
      type: 'full-time',
      remote: true,
      salary: $(elem).find('.salary').text().trim()
    })).get().filter(job => job.title && job.company);
  } catch (error) {
    console.error('JustRemote scraping failed:', error);
    return [];
  }
}

async function scrapeRemoteOK(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const axiosInstance = axios.create({
      headers: {
        'User-Agent': 'JobsyntBot/1.0'
      }
    });

    const { data } = await axiosInstance.get('https://remoteok.io/api');
    
    // RemoteOK API returns JSON directly
    const jobs = data.slice(1); // First item is metadata
    
    return jobs.filter(job => 
      job.position?.toLowerCase().includes(keywords.toLowerCase()) ||
      job.description?.toLowerCase().includes(keywords.toLowerCase())
    ).map(job => ({
      title: job.position || '',
      company: job.company || '',
      location: 'Remote',
      url: `https://remoteok.io/remote-jobs/${job.id}`,
      source: 'RemoteOK',
      posted_date: job.date ? new Date(job.date * 1000).toISOString() : new Date().toISOString(),
      type: 'full-time',
      remote: true,
      salary: job.salary_min && job.salary_max ? `$${job.salary_min} - $${job.salary_max}` : '',
      description: job.description || '',
      tags: job.tags || []
    })).filter(job => job.title && job.company);
  } catch (error) {
    console.error('RemoteOK scraping failed:', error);
    return [];
  }
}

// Startup-focused
async function scrapeAngelCo(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const searchUrl = `https://angel.co/jobs?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}`;
    
    const page = await browser.newPage();
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });
    
    const jobs = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('[data-test="JobSearchCard"]');
      return Array.from(jobElements).map(job => {
        const titleElement = job.querySelector('[data-test="JobSearchCard-title"]');
        const companyElement = job.querySelector('[data-test="JobSearchCard-company"]');
        const locationElement = job.querySelector('[data-test="JobSearchCard-location"]');
        const linkElement = job.querySelector('a');
        
        return {
          title: titleElement?.textContent?.trim() || '',
          company: companyElement?.textContent?.trim() || '',
          location: locationElement?.textContent?.trim() || '',
          url: linkElement?.href || '',
          source: 'AngelList',
          posted_date: new Date().toISOString(),
          type: 'full-time',
          remote: job.textContent?.toLowerCase().includes('remote') || false
        };
      }).filter(job => job.title && job.company);
    });
    
    await page.close();
    return jobs;
  } catch (error) {
    console.error('AngelList scraping failed:', error);
    return [];
  }
}

// Freelance/Contract focused
async function scrapeUpwork(keywords, location, category, jobTypes, visa_status, browser) {
  try {
    const axiosInstance = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Upwork requires authentication for full API access, so this is a basic implementation
    const searchUrl = `https://www.upwork.com/search/jobs/?q=${encodeURIComponent(keywords)}`;
    
    const { data } = await axiosInstance.get(searchUrl);
    const $ = cheerio.load(data);
    
    return $('.job-tile').map((i, elem) => ({
      title: $(elem).find('.job-tile-title a').text().trim(),
      company: $(elem).find('.client-name').text().trim() || 'Upwork Client',
      location: 'Remote',
      url: `https://www.upwork.com${$(elem).find('.job-tile-title a').attr('href')}`,
      source: 'Upwork',
      posted_date: $(elem).find('.posted-on').text().trim() || new Date().toISOString(),
      type: 'contract',
      remote: true,
      salary: $(elem).find('.job-tile-budget').text().trim(),
      description: $(elem).find('.job-tile-description').text().trim()
    })).get().filter(job => job.title);
  } catch (error) {
    console.error('Upwork scraping failed:', error);
    return [];
  }
}

// Export all scrapers
module.exports = {
  scrapeDice,
  scrapeGlassdoor,
  scrapeFlexJobs,
  scrapeZipRecruiter,
  scrapeSimplyHired,
  scrapeCareerBuilder,
  scrapeJustRemote,
  scrapeRemoteOK,
  scrapeAngelCo,
  scrapeUpwork
};

// Updated JOB_SOURCES array that can be used in job-scraper.js
const ADDITIONAL_JOB_SOURCES = [
  {
    name: 'Dice',
    scraper: scrapeDice,
    enabled: true,
    category: 'tech'
  },
  {
    name: 'Glassdoor',
    scraper: scrapeGlassdoor,
    enabled: true,
    category: 'general'
  },
  {
    name: 'FlexJobs',
    scraper: scrapeFlexJobs,
    enabled: true,
    category: 'remote'
  },
  {
    name: 'ZipRecruiter',
    scraper: scrapeZipRecruiter,
    enabled: true,
    category: 'general'
  },
  {
    name: 'SimplyHired',
    scraper: scrapeSimplyHired,
    enabled: true,
    category: 'general'
  },
  {
    name: 'CareerBuilder',
    scraper: scrapeCareerBuilder,
    enabled: true,
    category: 'general'
  },
  {
    name: 'JustRemote',
    scraper: scrapeJustRemote,
    enabled: true,
    category: 'remote'
  },
  {
    name: 'RemoteOK',
    scraper: scrapeRemoteOK,
    enabled: true,
    category: 'remote'
  },
  {
    name: 'AngelList',
    scraper: scrapeAngelCo,
    enabled: true,
    category: 'startup'
  },
  {
    name: 'Upwork',
    scraper: scrapeUpwork,
    enabled: false, // Disabled by default due to API limitations
    category: 'freelance'
  }
];

module.exports.ADDITIONAL_JOB_SOURCES = ADDITIONAL_JOB_SOURCES; 