const axios = require('axios');
const cheerio = require('cheerio');
const rateLimit = require('axios-rate-limit');
const { v4: uuidv4 } = require('uuid');

// 1. Configuration - Simplified for initial deployment
const CONFIG = {
  timeout: 8000,
  maxResults: 50,
  rateLimit: {
    maxRequests: 20,
    perMilliseconds: 60000
  }
};

// 2. Rate Limited Axios Instance
const axiosInstance = rateLimit(
  axios.create({
    timeout: CONFIG.timeout,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/115.0'
    }
  }),
  { maxRequests: CONFIG.rateLimit.maxRequests, perMilliseconds: CONFIG.rateLimit.perMilliseconds }
);

// 3. Simplified logging
const logger = {
  log: (message) => console.log(`[${new Date().toISOString()}] ${message}`)
};

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // Start with just one scraper for testing
    const jobs = await scrapeRemoteCo();
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        count: jobs.length,
        jobs: jobs.slice(0, 10),
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    logger.log(`Error: ${error.message}`);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Job scraping service unavailable'
      })
    };
  }
};

// Simplified Remote.co scraper
async function scrapeRemoteCo() {
  try {
    const { data } = await axiosInstance.get('https://remote.co/remote-jobs/developer/');
    const $ = cheerio.load(data);
    
    return $('.job_listings .job_listing').map((i, elem) => ({
      title: $(elem).find('.job_listing-title a').text().trim(),
      company: $(elem).find('.job_listing-company').text().trim(),
      location: 'Remote',
      link: `https://remote.co${$(elem).find('.job_listing-title a').attr('href')}`,
      source: 'Remote.co',
      posted: 'Recently'
    })).get().filter(j => j.title);
  } catch (err) {
    throw new Error(`Remote.co failed: ${err.message}`);
  }
}

// Utility functions
function removeDuplicates(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.title}-${job.company}`.toLowerCase();
    return !seen.has(key) && seen.add(key);
  });
}