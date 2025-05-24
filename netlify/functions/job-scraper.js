const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('axios-rate-limit');
const { v4: uuidv4 } = require('uuid');
const { createClient } = require('redis');

// 1. Configuration
const CONFIG = {
  timeout: 8000,
  maxResults: 50,
  cacheDuration: 30 * 60 * 1000, // 30 minutes
  rateLimit: {
    maxRequests: 20,
    perMilliseconds: 60000, // 20 requests per minute
    maxRPS: 3 // 3 requests per second
  },
  retry: {
    retries: 2,
    retryDelay: 1000
  },
  jobTypes: ['full-time', 'part-time', 'contract', 'freelance', 'internship']
};

// 2. Rate Limited Axios Instance
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

// 3. Redis Client (fallback to in-memory cache if Redis not available)
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
    console.error('Redis connection failed, using in-memory cache:', err.message);
  }
})();

// 4. Logging setup
const logger = {
  info: (message, meta = {}) => console.log(JSON.stringify({ level: 'info', message, ...meta })),
  error: (message, meta = {}) => console.error(JSON.stringify({ level: 'error', message, ...meta })),
  warn: (message, meta = {}) => console.warn(JSON.stringify({ level: 'warn', message, ...meta })))
};

// 5. Cache implementation
const cache = {
  async get(key) {
    if (useRedis) {
      try {
        const data = await redisClient.get(key);
        return data ? JSON.parse(data) : null;
      } catch (err) {
        logger.error('Redis get failed', { error: err.message });
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
        logger.error('Redis set failed', { error: err.message });
      }
    } else {
      inMemoryCache[key] = value;
      }
    }
  }
};

let inMemoryCache = {};

// 6. Job Sources Configuration
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
  },
  {
    name: 'GitHub Jobs',
    scraper: scrapeGitHubJobs,
    enabled: true
  },
  {
    name: 'LinkedIn (API)',
    scraper: scrapeLinkedIn,
    enabled: false // Requires API keys
  }
];

exports.handler = async (event, context) => {
  const requestId = uuidv4();
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=300',
    'X-Request-ID': requestId
  };

  logger.info('Request received', { requestId, method: event.httpMethod });

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Rate limiting by IP (basic implementation)
    const clientIp = event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown';
    const rateLimitKey = `rate_limit:${clientIp}`;
    const requestCount = (await cache.get(rateLimitKey) || 0) + 1;

    if (requestCount > CONFIG.rateLimit.maxRequests) {
      logger.warn('Rate limit exceeded', { clientIp, requestCount });
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Too many requests. Please try again later.'
        })
      };
    }

    await cache.set(rateLimitKey, requestCount, CONFIG.rateLimit.perMilliseconds);

    // Parse request parameters
    const { keywords = '', location = '', remote = false, category = '', jobType = '' } = 
      event.body ? JSON.parse(event.body) : {};

    // Validate job type
    const filteredJobTypes = jobType 
      ? jobType.split(',').filter(type => CONFIG.jobTypes.includes(type))
      : CONFIG.jobTypes;

    // Generate cache key
    const cacheKey = `jobs:${keywords}:${location}:${remote}:${category}:${filteredJobTypes.join(',')}`;

    // Check cache
    const cachedData = await cache.get(cacheKey);
    if (cachedData) {
      logger.info('Serving from cache', { cacheKey });
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

    // Scrape all enabled sources with retry logic
    const scrapingPromises = JOB_SOURCES
      .filter(source => source.enabled)
      .map(source => 
        withRetry(
          () => scrapeWithTimeout(() => source.scraper(keywords, location, category, filteredJobTypes)),
          CONFIG.retry.retries,
          CONFIG.retry.retryDelay
        ).catch(err => {
          logger.error(`Scraper failed: ${source.name}`, { error: err.message });
          return [];
        })
      );

    const results = await Promise.allSettled(scrapingPromises);

    // Combine results
    const allJobs = results.reduce((acc, result) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        return [...acc, ...result.value];
      }
      return acc;
    }, []);

    // Process and cache results
    const processedJobs = processJobs(allJobs, filteredJobTypes);
    await cache.set(cacheKey, {
      success: true,
      count: processedJobs.length,
      jobs: processedJobs
    }, CONFIG.cacheDuration);

    logger.info('Request completed successfully', { 
      requestId, 
      jobCount: processedJobs.length,
      sourcesUsed: JOB_SOURCES.filter(s => s.enabled).map(s => s.name)
    });

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
    logger.error('Request failed', { 
      requestId, 
      error: error.message,
      stack: error.stack 
    });
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Job scraping service unavailable',
        requestId,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

// Helper functions with retry logic
async function withRetry(fn, retries = 3, delay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(resolve => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2); // Exponential backoff
  }
}

async function scrapeWithTimeout(fn, timeout = CONFIG.timeout) {
  return Promise.race([
    fn(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Scrape timeout after ${timeout}ms`)), timeout)
  ]);
}

function processJobs(jobs, jobTypes) {
  return removeDuplicates(jobs)
    .filter(job => jobTypes.includes(job.type || 'full-time')) // Filter by job type
    .sort((a, b) => new Date(b.posted) - new Date(a.posted)) // Newest first
    .slice(0, CONFIG.maxResults);
}

// Improved scrapers with job type support
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
        r: true // Remote only
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

async function scrapeGitHubJobs(keywords, location, category) {
  try {
    const { data } = await axiosInstance.get('https://jobs.github.com/positions.json', {
      params: {
        description: keywords,
        location: remote ? '' : location,
        full_time: !jobTypes.includes('contract') && !jobTypes.includes('freelance')
      }
    });
    
    return data.map(job => ({
      title: job.title,
      company: job.company,
      location: job.location,
      link: job.url,
      source: 'GitHub Jobs',
      posted: formatDate(job.created_at),
      remote: job.location.toLowerCase().includes('remote') || job.type.toLowerCase().includes('remote'),
      type: job.type.toLowerCase() || 'full-time',
      salary: null // GitHub Jobs doesn't provide salary
    }));
  } catch (err) {
    throw new Error(`GitHub Jobs failed: ${err.message}`);
  }
}

// Utility functions
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

// 7. Test cases (would normally be in separate test files)
const TEST_CASES = {
  formatDate: [
    { input: new Date().toISOString(), expected: 'Today' },
    { input: new Date(Date.now() - 86400000).toISOString(), expected: 'Yesterday' },
    { input: 'invalid date', expected: 'Recently' }
  ],
  extractJobType: [
    { input: 'Full-time Developer', expected: 'full-time' },
    { input: 'Contract Position', expected: 'contract' },
    { input: 'Part-time Designer', expected: 'part-time' }
  ]
};

function runTests() {
  if (process.env.NODE_ENV === 'test') {
    logger.info('Running tests');
    Object.entries(TEST_CASES).forEach(([name, cases]) => {
      cases.forEach(({ input, expected }) => {
        const result = eval(name)(input);
        if (result !== expected) {
          logger.error(`Test failed: ${name}(${input})`, { expected, result });
        }
      });
    });
  }
}

runTests();