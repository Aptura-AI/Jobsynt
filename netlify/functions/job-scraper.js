const axios = require('axios');
const cheerio = require('cheerio');

// 1. Configure axios with proper headers
const axiosInstance = axios.create({
  timeout: 8000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  }
});

// 2. Define your scrapers FIRST
async function scrapeRemoteCo() {
  try {
    const { data } = await axiosInstance.get('https://remote.co/remote-jobs/developer/');
    const $ = cheerio.load(data);
    
    const jobs = $('.job_listings .job_listing').map((i, elem) => ({
      title: $(elem).find('.job_listing-title a').text().trim(),
      company: $(elem).find('.job_listing-company').text().trim(),
      location: 'Remote',
      link: `https://remote.co${$(elem).find('.job_listing-title a').attr('href')}`
    })).get();
    
    return jobs.filter(job => job.title);
  } catch (err) {
    console.error('Remote.co scrape failed:', err.message);
    return [];
  }
}

// 3. Main handler function
exports.handler = async (event) => {
  console.log('Function execution started');
  
  try {
    const jobs = await scrapeRemoteCo();
    console.log(`Found ${jobs.length} jobs`);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        count: jobs.length,
        jobs: jobs.slice(0, 10),
        timestamp: new Date().toISOString()
      })
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Job scraping failed',
        details: process.env.NETLIFY_DEV ? error.message : 'Enable dev mode for details'
      })
    };
  }
};