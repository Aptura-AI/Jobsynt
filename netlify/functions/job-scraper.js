const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('axios-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('redis');

// Configuration
const CONFIG = {
  timeout: 8000,
  maxResults: 50,
  cacheDuration: 30 * 60 * 1000,
  rateLimit: {
    maxRequests: 20,
    perMilliseconds: 60000,
    maxRPS: 3
  },
  retry: {
    retries: 2,
    retryDelay: 1000
  },
  jobTypes: ['full-time', 'part-time', 'contract', 'freelance', 'internship']
};

// Rate Limited Axios Instance
const axiosInstance = rateLimit(
  axios.create({
    timeout: CONFIG.timeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0',
      'Accept': 'application/json, text/html, application/xml',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  }),
  { maxRequests: CONFIG.rateLimit.maxRequests, perMilliseconds: CONFIG.rateLimit.perMilliseconds }
);

// Redis Client
let redisClient;
let useRedis = false;

(async () => {
  try {
    if (process.env.REDIS_URL) {
      redisClient = createClient({ url: process.env.REDIS_URL });
      await redisClient.connect();
      useRedis = true;
      console.log('Connected to Redis');
    }
  } catch (err) {
    console.error('Redis connection failed:', err.message);
  }
})();

// Cache Implementation
const cache = {
  async get(key) {
    if (useRedis) {
      try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        console.error('Redis get failed:', err.message);
        return null;
      }
    }
    return inMemoryCache[key] || null;
  },

  async set(key, value, ttl = CONFIG.cacheDuration) {
    if (useRedis) {
      try {
        await redisClient.set(key, JSON.stringify(value), { PX: ttl });
      } catch (err) {
        console.error('Redis set failed:', err.message);
      }
    } else {
      inMemoryCache[key] = value;
    }
  }
};

let inMemoryCache = {};

// Job Sources
const JOB_SOURCES = [
  {
    name: 'Remote.co',
    scraper: scrapeRemoteCo,
    enabled: true
  },
  {
    name: 'AngelList',
    scraper: scrapeAngelList,
    enabled: true
  },
  {
    name: 'Stack Overflow',
    scraper: scrapeStackOverflow,
    enabled: true
  },
  {
    name: 'We Work Remotely',
    scraper: scrapeWeWorkRemotely,
    enabled: true
  }
];

// Main Handler
exports.handler = async (event, context) => {
  const requestId = uuidv4();
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
    'X-Request-ID': requestId
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const { keywords = '', location = '', remote = false, category = '', jobType = '' } = 
      event.body ? JSON.parse(event.body) : {};

    const filteredJobTypes = jobType 
      ? jobType.split(',').filter(type => CONFIG.jobTypes.includes(type))
      : CONFIG.jobTypes;

    const cacheKey = `jobs:${keywords}:${location}:${remote}:${category}:${filteredJobTypes.join(',')}`;
    const cachedData = await cache.get(cacheKey);

    if (cachedData) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        })
      };
    }

    const results = await Promise.allSettled(
      JOB_SOURCES.filter(source => source.enabled).map(source => 
        withRetry(
          () => scrapeWithTimeout(() => source.scraper(keywords, location, category, filteredJobTypes)),
          CONFIG.retry.retries,
          CONFIG.retry.retryDelay
        ).catch(err => {
          console.error(`Scraper failed: ${source.name}`, err.message);
          return [];
        })
    ));

    const allJobs = results.reduce((acc, result) => 
      result.status === 'fulfilled' ? [...acc, ...result.value] : acc, []);

    const processedJobs = processJobs(allJobs, filteredJobTypes);
    await cache.set(cacheKey, {
      success: true,
      count: processedJobs.length,
      jobs: processedJobs
    }, CONFIG.cacheDuration);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: processedJobs.length,
        jobs: processedJobs,
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Job scraping service unavailable',
        requestId
      })
    };
  }
};

// Helper Functions
async function withRetry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}

async function scrapeWithTimeout(fn, timeout = CONFIG.timeout) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Scrape timeout after ${timeout}ms`)), timeout)
    )
  ]);
}

function processJobs(jobs, jobTypes) {
  return removeDuplicates(jobs)
    .filter(job => jobTypes.includes(job.type || 'full-time'))
    .sort((a, b) => new Date(b.posted) - new Date(a.posted))
    .slice(0, CONFIG.maxResults);
}

// Scraper Implementations
async function scrapeRemoteCo(keywords, location, category, jobTypes) {
  try {
    const url = category 
      ? `https://remote.co/remote-jobs/${category}/`
      : `https://remote.co/remote-jobs/search?search_keywords=${encodeURIComponent(keywords)}`;
    
    const { data } = await axiosInstance.get(url);
    const $ = cheerio.load(data);
    
    return $('.job_listings .job_listing').map((i, elem) => ({
      title: $(elem).find('.job_listing-title a').text().trim(),
      company: $(elem).find('.job_listing-company').text().trim(),
      location: 'Remote',
      link: `https://remote.co${$(elem).find('.job_listing-title a').attr('href')}`,
      source: 'Remote.co',
      posted: $(elem).find('.job_listing-date').text().trim() || 'Recently',
      remote: true,
      type: extractJobType($(elem).find('.job_listing-type').text().trim()) || 'full-time',
      salary: $(elem).find('.job_listing-salary').text().trim() || null,
      tags: $(elem).find('.job_listing-tags a').map((i, el) => $(el).text().trim()).get()
    })).get().filter(j => j.title);
  } catch (err) {
    throw new Error(`Remote.co failed: ${err.message}`);
  }
}

async function scrapeAngelList(keywords, location, category, jobTypes) {
  try {
    const { data } = await axiosInstance.get('https://angel.co/job_listings/search.json', {
      params: {
        query: keywords,
        location: location,
        'filter_data[remote]': true,
        'filter_data[roles][]': category || 'Developer',
        'filter_data[job_types][]': jobTypes,
        'page': 1
      }
    });
    
    return data.jobs.map(job => ({
      title: job.title,
      company: job.startup?.name || 'Unknown',
      location: job.location || 'Remote',
      link: job.angellist_url,
      source: 'AngelList',
      posted: formatDate(job.created_at),
      remote: job.remote,
      type: job.job_type?.toLowerCase() || 'full-time',
      salary: job.salary || null,
      equity: job.equity || null
    })).filter(job => job.title);
  } catch (err) {
    throw new Error(`AngelList failed: ${err.message}`);
  }
}

async function scrapeStackOverflow(keywords, location, category) {
  try {
    const { data } = await axiosInstance.get('https://stackoverflow.com/jobs/feed', {
      params: { 
        q: `${keywords} ${category || ''}`.trim(),
        r: true
      }
    });
    
    const $ = cheerio.load(data, { xmlMode: true });
    return $('item').map((i, elem) => ({
      title: $(elem).find('title').first().text(),
      company: $(elem).find('a10\\:name, name').first().text() || 'Unknown',
      location: $(elem).find('location').text() || 'Remote',
      link: $(elem).find('link').text(),
      source: 'Stack Overflow',
      posted: formatDate($(elem).find('pubDate').text()),
      remote: $(elem).find('remote').length > 0 || 
              $(elem).find('description').text().toLowerCase().includes('remote'),
      type: extractJobType($(elem).find('category').text()) || 'full-time',
      salary: extractSalary($(elem).find('description').text())
    })).get();
  } catch (err) {
    throw new Error(`StackOverflow failed: ${err.message}`);
  }
}

async function scrapeWeWorkRemotely(keywords, location, category) {
  try {
    const url = category 
      ? `https://weworkremotely.com/categories/remote-${category}-jobs.rss`
      : 'https://weworkremotely.com/categories/remote-programming-jobs.rss';
    
    const { data } = await axiosInstance.get(url);
    const $ = cheerio.load(data, { xmlMode: true });
    
    return $('item').map((i, elem) => {
      const title = $(elem).find('title').text();
      const description = $(elem).find('description').text();
      
      return {
        title: title,
        company: extractCompanyFromTitle(title) || $(elem).find('author').text() || 'Unknown',
        location: 'Remote',
        link: $(elem).find('link').text(),
        source: 'We Work Remotely',
        posted: formatDate($(elem).find('pubDate').text()),
        remote: true,
        type: extractJobType(description) || 'full-time',
        description: description.length > 200 ? description.substring(0, 200) + '...' : description
      };
    }).get();
  } catch (err) {
    throw new Error(`WWR failed: ${err.message}`);
  }
}

// Utility Functions
function removeDuplicates(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.title}-${job.company}-${job.link}`.toLowerCase();
    return !seen.has(key) && seen.add(key);
  });
}

function formatDate(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  if (isNaN(date)) return 'Recently';
  
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays/7)} weeks ago`;
  
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function extractSalary(text) {
  if (!text) return null;
  const matches = text.match(/\$[\d,]+(?:\.\d{2})?(?:\s*-\s*\$[\d,]+(?:\.\d{2})?)?/g);
  return matches ? matches[0] : null;
}

function extractCompanyFromTitle(title) {
  if (!title) return null;
  const parts = title.split(':');
  return parts.length > 1 ? parts[0].trim() : null;
}

function extractJobType(text) {
  if (!text) return 'full-time';
  const lowerText = text.toLowerCase();
  if (lowerText.includes('contract')) return 'contract';
  if (lowerText.includes('freelance')) return 'freelance';
  if (lowerText.includes('part-time')) return 'part-time';
  if (lowerText.includes('internship')) return 'internship';
  return 'full-time';
}