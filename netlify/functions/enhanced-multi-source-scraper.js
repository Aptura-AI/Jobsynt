const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// Enhanced API Configuration with Free Tier Management
const API_CONFIG = {
  serpapi: {
    key: process.env.SERPAPI_KEY,
    monthly_limit: 100,
    daily_limit: 10,
    priority: 1,
    endpoint: 'https://serpapi.com/search'
  },
  adzuna: {
    app_id: process.env.ADZUNA_APP_ID,
    app_key: process.env.ADZUNA_APP_KEY,
    monthly_limit: 1000,
    daily_limit: 50,
    priority: 2,
    endpoint: 'https://api.adzuna.com/v1/api/jobs/us/search/1'
  },
  jsearch: {
    key: process.env.JSEARCH_API_KEY,
    monthly_limit: 500,
    daily_limit: 25,
    priority: 1,
    endpoint: 'https://jsearch.p.rapidapi.com/search'
  },
  reed: {
    key: process.env.REED_API_KEY,
    monthly_limit: 1000,
    daily_limit: 50,
    priority: 2,
    endpoint: 'https://www.reed.co.uk/api/1.0/search'
  },
  usajobs: {
    key: process.env.USAJOBS_API_KEY,
    email: process.env.USAJOBS_EMAIL,
    monthly_limit: 10000,
    daily_limit: 500,
    priority: 3,
    endpoint: 'https://data.usajobs.gov/api/search'
  },
  themusejobs: {
    key: process.env.THEMUSE_API_KEY,
    monthly_limit: 1000,
    daily_limit: 50,
    priority: 3,
    endpoint: 'https://www.themuse.com/api/public/jobs'
  },
  remotive: {
    // Free API - no key required
    monthly_limit: 1000,
    daily_limit: 100,
    priority: 4,
    endpoint: 'https://remotive.io/api/remote-jobs'
  },
  jobs2careers: {
    key: process.env.JOBS2CAREERS_API_KEY,
    monthly_limit: 1000,
    daily_limit: 50,
    priority: 3,
    endpoint: 'https://api.jobs2careers.com/api/search.php'
  },
  openai: {
    key: process.env.OPENAI_API_KEY,
    monthly_limit: 100,
    daily_limit: 10,
    priority: 1
  }
};

// Free Tier Usage Tracking (In production, use Redis or database)
let USAGE_TRACKER = {
  daily: {},
  monthly: {},
  last_reset: new Date().toDateString()
};

// Job Sources Configuration (30+ sites)
const JOB_SOURCES = {
  general: [
    { name: 'Indeed', url: 'https://www.indeed.com/', priority: 1 },
    { name: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', priority: 1 },
    { name: 'Glassdoor', url: 'https://www.glassdoor.com/Job/index.htm', priority: 1 },
    { name: 'Monster', url: 'https://www.monster.com/', priority: 2 },
    { name: 'CareerBuilder', url: 'https://www.careerbuilder.com/', priority: 2 },
    { name: 'ZipRecruiter', url: 'https://www.ziprecruiter.com/', priority: 1 },
    { name: 'SimplyHired', url: 'https://www.simplyhired.com/', priority: 2 },
    { name: 'Jooble', url: 'https://us.jooble.org/', priority: 2 }
  ],
  tech: [
    { name: 'Dice', url: 'https://www.dice.com/', priority: 1 },
    { name: 'Stack Overflow Jobs', url: 'https://stackoverflow.com/jobs', priority: 2 },
    { name: 'GitHub Jobs', url: 'https://jobs.github.com/', priority: 2 },
    { name: 'Built In', url: 'https://builtin.com/jobs', priority: 1 },
    { name: 'Authentic Jobs', url: 'https://authenticjobs.com/', priority: 3 }
  ],
  remote: [
    { name: 'We Work Remotely', url: 'https://weworkremotely.com/', priority: 1 },
    { name: 'JustRemote', url: 'https://justremote.co/remote-jobs', priority: 1 },
    { name: 'Dynamite Jobs', url: 'https://dynamitejobs.com/remote-jobs', priority: 1 },
    { name: 'Remotive', url: 'https://remotive.com/remote-jobs', priority: 1 },
    { name: 'FlexJobs', url: 'https://www.flexjobs.com/', priority: 2 },
    { name: 'The Muse', url: 'https://www.themuse.com/jobs', priority: 2 },
    { name: 'Himalayas', url: 'https://himalayas.app/jobs', priority: 2 }
  ],
  startup: [
    { name: 'AngelList', url: 'https://angel.co/jobs', priority: 1 },
    { name: 'Wellfound', url: 'https://wellfound.com/jobs', priority: 1 }
  ],
  government: [
    { name: 'USAJOBS', url: 'https://www.usajobs.gov/', priority: 1 }
  ],
  specialized: [
    { name: 'Toptal', url: 'https://www.toptal.com/careers', priority: 3 },
    { name: 'Idealist', url: 'https://www.idealist.org/', priority: 3 },
    { name: 'Snagajob', url: 'https://www.snagajob.com/', priority: 2 },
    { name: 'CorpToCorp', url: 'https://www.corptocorp.org/', priority: 3 }
  ]
};

// Apprenticeship Sources
const APPRENTICESHIP_SOURCES = [
  { name: 'Apprenticeship.gov', url: 'https://www.apprenticeship.gov', priority: 1 },
  { name: 'Indeed Apprenticeships', url: 'https://www.indeed.com/q-Apprenticeship-jobs.html', priority: 1 },
  { name: 'CareerOneStop', url: 'https://www.careeronestop.org', priority: 1 },
  { name: 'NABTU', url: 'https://nabtu.org/apprenticeships', priority: 2 },
  { name: 'Techtonic', url: 'https://techtonic.com', priority: 2 }
];

exports.handler = async (event, context) => {
  const requestId = uuidv4();
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    console.log(`[${requestId}] Enhanced multi-source scraper started`);
    
    // Reset usage tracker if new day/month
    resetUsageTrackerIfNeeded();
    
    const body = event.body ? JSON.parse(event.body) : {};
    const { 
      keywords = '', location = 'United States', remote = false, 
      jobType = 'full-time', visa_status = '', experience_level = 'mid',
      skills = [], salary_range = {}, search_type = 'jobs', profile = {}
    } = body;

    console.log(`[${requestId}] Search:`, { keywords, location, search_type });

    // STEP 1: Intelligent multi-source job scraping with free tier management
    let rawJobs = [];
    if (search_type === 'apprenticeships') {
      rawJobs = await scrapeApprenticeships(keywords, location, requestId);
    } else {
      rawJobs = await scrapeJobsWithIntelligentAPIs(keywords, location, jobType, remote, profile, requestId);
    }
    console.log(`[${requestId}] Scraped ${rawJobs.length} raw jobs`);

    // STEP 2: Ghost job detection and filtering
    const filteredJobs = await filterGhostJobs(rawJobs, requestId);
    console.log(`[${requestId}] After ghost filtering: ${filteredJobs.length} jobs`);

    // STEP 3: GPT-powered job analysis and ranking (with free tier management)
    const analyzedJobs = await analyzeJobsWithIntelligentGPT(filteredJobs, profile, skills, requestId);
    console.log(`[${requestId}] After GPT analysis: ${analyzedJobs.length} jobs`);

    // STEP 4: Final ranking and response
    const finalJobs = analyzedJobs
      .sort((a, b) => (b.gpt_match_score || 0) - (a.gpt_match_score || 0))
      .slice(0, 20);

    // If no real jobs found, return proper message
    if (finalJobs.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          no_results: true,
          message: "We could not find any jobs matching your profile right now. We will keep searching and share the jobs on your email. Come back here later to see jobs matching your profile.",
          search_type,
          jobs: [],
          apprenticeships: [],
          count: 0,
          total_scraped: rawJobs.length,
          ghost_filtered: rawJobs.length - filteredJobs.length,
          sources_used: [],
          api_usage: getAPIUsageSummary(),
          request_id: requestId,
          timestamp: new Date().toISOString()
        })
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        search_type,
        jobs: search_type === 'apprenticeships' ? undefined : finalJobs,
        apprenticeships: search_type === 'apprenticeships' ? finalJobs : undefined,
        count: finalJobs.length,
        total_scraped: rawJobs.length,
        ghost_filtered: rawJobs.length - filteredJobs.length,
        sources_used: getSourcesUsed(finalJobs),
        api_usage: getAPIUsageSummary(),
        request_id: requestId,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error(`[${requestId}] Error:`, error);
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: 'Job search temporarily unavailable',
        jobs: [], count: 0, request_id: requestId, fallback: true
      })
    };
  }
};

// Intelligent Free Tier Management
function resetUsageTrackerIfNeeded() {
  const today = new Date().toDateString();
  const currentMonth = new Date().getMonth();
  
  if (USAGE_TRACKER.last_reset !== today) {
    USAGE_TRACKER.daily = {};
    USAGE_TRACKER.last_reset = today;
  }
  
  // Reset monthly on first day of month
  if (new Date().getDate() === 1) {
    USAGE_TRACKER.monthly = {};
  }
}

function canUseAPI(apiName) {
  const config = API_CONFIG[apiName];
  if (!config || !config.key) return false;
  
  const dailyUsage = USAGE_TRACKER.daily[apiName] || 0;
  const monthlyUsage = USAGE_TRACKER.monthly[apiName] || 0;
  
  return dailyUsage < config.daily_limit && monthlyUsage < config.monthly_limit;
}

function trackAPIUsage(apiName, requestCount = 1) {
  USAGE_TRACKER.daily[apiName] = (USAGE_TRACKER.daily[apiName] || 0) + requestCount;
  USAGE_TRACKER.monthly[apiName] = (USAGE_TRACKER.monthly[apiName] || 0) + requestCount;
}

function getAPIUsageSummary() {
  return {
    daily_usage: USAGE_TRACKER.daily,
    monthly_usage: USAGE_TRACKER.monthly,
    available_apis: Object.keys(API_CONFIG).filter(api => canUseAPI(api))
  };
}

// STEP 1: Intelligent multi-source job scraping
async function scrapeJobsWithIntelligentAPIs(keywords, location, jobType, remote, profile, requestId) {
  const allJobs = [];
  const availableAPIs = [];
  
  // Check which APIs are available within free tier limits
  Object.keys(API_CONFIG).forEach(apiName => {
    if (apiName !== 'openai' && canUseAPI(apiName)) {
      availableAPIs.push({ name: apiName, priority: API_CONFIG[apiName].priority });
    }
  });
  
  // Sort by priority (1 = highest priority)
  availableAPIs.sort((a, b) => a.priority - b.priority);
  
  console.log(`[${requestId}] Available APIs:`, availableAPIs.map(api => api.name));
  
  // Try APIs in priority order until we have enough jobs or exhaust limits
  for (const api of availableAPIs) {
    if (allJobs.length >= 50) break; // Stop when we have enough jobs
    
    try {
      let apiJobs = [];
      
      switch (api.name) {
        case 'serpapi':
          apiJobs = await scrapeSerpAPI(keywords, location, requestId);
          break;
        case 'adzuna':
          apiJobs = await scrapeAdzunaAPI(keywords, location, requestId);
          break;
        case 'jsearch':
          apiJobs = await scrapeJSearchAPI(keywords, location, requestId);
          break;
        case 'reed':
          apiJobs = await scrapeReedAPI(keywords, location, requestId);
          break;
        case 'usajobs':
          apiJobs = await scrapeUSAJobsAPI(keywords, location, requestId);
          break;
        case 'themusejobs':
          apiJobs = await scrapeTheMuseAPI(keywords, location, requestId);
          break;
        case 'remotive':
          apiJobs = await scrapeRemotiveAPI(keywords, requestId);
          break;
        case 'jobs2careers':
          apiJobs = await scrapeJobs2CareersAPI(keywords, location, requestId);
          break;
      }
      
      if (apiJobs.length > 0) {
        allJobs.push(...apiJobs);
        trackAPIUsage(api.name, 1);
        console.log(`[${requestId}] ${api.name}: ${apiJobs.length} jobs (Total: ${allJobs.length})`);
      }
      
    } catch (error) {
      console.log(`[${requestId}] ${api.name} failed:`, error.message);
    }
  }
  
  // Only return real API results - no mock data
  console.log(`[${requestId}] Real API results only: ${allJobs.length} jobs found`);
  if (allJobs.length === 0) {
    console.log(`[${requestId}] No real jobs found from APIs`);
  }

  return removeDuplicateJobs(allJobs);
}

// Enhanced API Integrations with Free Tier Awareness

async function scrapeSerpAPI(keywords, location, requestId) {
  if (!canUseAPI('serpapi')) {
    console.log(`[${requestId}] SerpAPI: Daily/monthly limit reached`);
    return [];
  }
  
  try {
    const response = await axios.get(API_CONFIG.serpapi.endpoint, {
      params: {
        engine: 'google_jobs', q: keywords, location: location,
        api_key: API_CONFIG.serpapi.key, num: 20
      },
      timeout: 10000
    });

    return (response.data.jobs_results || []).map(job => ({
      id: `serp_${job.job_id || Math.random()}`,
      title: job.title, company: job.company_name, location: job.location,
      salary: job.detected_extensions?.salary,
      type: job.detected_extensions?.schedule_type || 'Full-time',
      remote: job.location?.toLowerCase().includes('remote'),
      url: job.share_link || job.related_links?.[0]?.link,
      source: 'Google Jobs (SerpAPI)', posted: job.detected_extensions?.posted_at,
      description: job.description, skills: extractSkillsFromDescription(job.description)
    }));
  } catch (error) {
    console.log(`[${requestId}] SerpAPI error:`, error.message);
    return [];
  }
}

async function scrapeAdzunaAPI(keywords, location, requestId) {
  if (!canUseAPI('adzuna')) {
    console.log(`[${requestId}] Adzuna: Daily/monthly limit reached`);
    return [];
  }
  
  try {
    const response = await axios.get(API_CONFIG.adzuna.endpoint, {
      params: {
        app_id: API_CONFIG.adzuna.app_id, app_key: API_CONFIG.adzuna.app_key,
        what: keywords, where: location, results_per_page: 20
      },
      timeout: 10000
    });

    return (response.data.results || []).map(job => ({
      id: `adzuna_${job.id}`, title: job.title,
      company: job.company?.display_name, location: job.location?.display_name,
      salary: job.salary_min && job.salary_max ? `$${job.salary_min} - $${job.salary_max}` : null,
      type: job.contract_type || 'Full-time',
      remote: job.location?.display_name?.toLowerCase().includes('remote'),
      url: job.redirect_url, source: 'Adzuna API', posted: job.created,
      description: job.description, skills: extractSkillsFromDescription(job.description)
    }));
  } catch (error) {
    console.log(`[${requestId}] Adzuna error:`, error.message);
    return [];
  }
}

async function scrapeJSearchAPI(keywords, location, requestId) {
  if (!canUseAPI('jsearch')) {
    console.log(`[${requestId}] JSearch: Daily/monthly limit reached`);
    return [];
  }
  
  try {
    const response = await axios.get(API_CONFIG.jsearch.endpoint, {
      params: { query: `${keywords} in ${location}`, page: '1', num_pages: '1' },
      headers: {
        'X-RapidAPI-Key': API_CONFIG.jsearch.key,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      },
      timeout: 10000
    });

    return (response.data.data || []).map(job => ({
      id: `jsearch_${job.job_id}`, title: job.job_title,
      company: job.employer_name, location: `${job.job_city}, ${job.job_state}`,
      salary: job.job_min_salary && job.job_max_salary ? `$${job.job_min_salary} - $${job.job_max_salary}` : null,
      type: job.job_employment_type || 'Full-time', remote: job.job_is_remote,
      url: job.job_apply_link, source: 'JSearch API',
      posted: job.job_posted_at_datetime_utc, description: job.job_description,
      skills: extractSkillsFromDescription(job.job_description)
    }));
  } catch (error) {
    console.log(`[${requestId}] JSearch error:`, error.message);
    return [];
  }
}

// NEW: Reed API Integration (UK/US Jobs - 1000 free calls/month)
async function scrapeReedAPI(keywords, location, requestId) {
  if (!canUseAPI('reed')) {
    console.log(`[${requestId}] Reed: Daily/monthly limit reached`);
    return [];
  }
  
  try {
    const response = await axios.get(API_CONFIG.reed.endpoint, {
      params: { keywords: keywords, location: location, resultsToTake: 20 },
      headers: { 'Authorization': `Basic ${Buffer.from(API_CONFIG.reed.key + ':').toString('base64')}` },
      timeout: 10000
    });

    return (response.data.results || []).map(job => ({
      id: `reed_${job.jobId}`, title: job.jobTitle,
      company: job.employerName, location: job.locationName,
      salary: job.minimumSalary && job.maximumSalary ? `£${job.minimumSalary} - £${job.maximumSalary}` : null,
      type: job.jobType || 'Full-time', remote: job.locationName?.toLowerCase().includes('remote'),
      url: job.jobUrl, source: 'Reed API', posted: job.date,
      description: job.jobDescription, skills: extractSkillsFromDescription(job.jobDescription)
    }));
  } catch (error) {
    console.log(`[${requestId}] Reed error:`, error.message);
    return [];
  }
}

// NEW: USAJobs API Integration (Government Jobs - 10,000 free calls/month)
async function scrapeUSAJobsAPI(keywords, location, requestId) {
  if (!canUseAPI('usajobs')) {
    console.log(`[${requestId}] USAJobs: Daily/monthly limit reached`);
    return [];
  }
  
  try {
    const response = await axios.get(API_CONFIG.usajobs.endpoint, {
      params: { Keyword: keywords, LocationName: location, ResultsPerPage: 20 },
      headers: {
        'Authorization-Key': API_CONFIG.usajobs.key,
        'User-Agent': API_CONFIG.usajobs.email
      },
      timeout: 10000
    });

    return (response.data.SearchResult?.SearchResultItems || []).map(item => {
      const job = item.MatchedObjectDescriptor;
      return {
        id: `usajobs_${job.PositionID}`, title: job.PositionTitle,
        company: job.OrganizationName, location: job.PositionLocationDisplay,
        salary: job.PositionRemuneration?.[0]?.Description,
        type: job.PositionSchedule?.[0]?.Name || 'Full-time',
        remote: job.PositionLocationDisplay?.toLowerCase().includes('remote'),
        url: job.PositionURI, source: 'USAJobs API',
        posted: job.PublicationStartDate, description: job.QualificationSummary,
        skills: extractSkillsFromDescription(job.QualificationSummary)
      };
    });
  } catch (error) {
    console.log(`[${requestId}] USAJobs error:`, error.message);
    return [];
  }
}

// NEW: The Muse API Integration (1000 free calls/month)
async function scrapeTheMuseAPI(keywords, location, requestId) {
  if (!canUseAPI('themusejobs')) {
    console.log(`[${requestId}] TheMuse: Daily/monthly limit reached`);
    return [];
  }
  
  try {
    const response = await axios.get(API_CONFIG.themusejobs.endpoint, {
      params: { category: keywords, location: location, page: 1 },
      headers: { 'Api-Key': API_CONFIG.themusejobs.key },
      timeout: 10000
    });

    return (response.data.results || []).map(job => ({
      id: `themuse_${job.id}`, title: job.name,
      company: job.company?.name, location: job.locations?.[0]?.name,
      salary: null, type: job.type || 'Full-time',
      remote: job.locations?.[0]?.name?.toLowerCase().includes('remote'),
      url: job.refs?.landing_page, source: 'The Muse API',
      posted: job.publication_date, description: job.contents,
      skills: extractSkillsFromDescription(job.contents)
    }));
  } catch (error) {
    console.log(`[${requestId}] TheMuse error:`, error.message);
    return [];
  }
}

// NEW: Remotive API Integration (Free - no key required)
async function scrapeRemotiveAPI(keywords, requestId) {
  try {
    const response = await axios.get(API_CONFIG.remotive.endpoint, {
      params: { search: keywords, limit: 20 },
      timeout: 10000
    });

    return (response.data.jobs || []).map(job => ({
      id: `remotive_${job.id}`, title: job.title,
      company: job.company_name, location: 'Remote',
      salary: job.salary, type: job.job_type || 'Full-time',
      remote: true, url: job.url, source: 'Remotive API',
      posted: job.publication_date, description: job.description,
      skills: extractSkillsFromDescription(job.description)
    }));
  } catch (error) {
    console.log(`[${requestId}] Remotive error:`, error.message);
    return [];
  }
}

// NEW: Jobs2Careers API Integration (1000 free calls/month)
async function scrapeJobs2CareersAPI(keywords, location, requestId) {
  if (!canUseAPI('jobs2careers')) {
    console.log(`[${requestId}] Jobs2Careers: Daily/monthly limit reached`);
    return [];
  }
  
  try {
    const response = await axios.get(API_CONFIG.jobs2careers.endpoint, {
      params: { 
        id: API_CONFIG.jobs2careers.key, q: keywords, l: location, 
        limit: 20, format: 'json' 
      },
      timeout: 10000
    });

    return (response.data.jobs || []).map(job => ({
      id: `j2c_${job.id}`, title: job.title,
      company: job.company, location: job.location,
      salary: job.salary, type: 'Full-time',
      remote: job.location?.toLowerCase().includes('remote'),
      url: job.url, source: 'Jobs2Careers API',
      posted: job.date, description: job.snippet,
      skills: extractSkillsFromDescription(job.snippet)
    }));
  } catch (error) {
    console.log(`[${requestId}] Jobs2Careers error:`, error.message);
    return [];
  }
}

// Enhanced GPT Analysis with Free Tier Management
async function analyzeJobsWithIntelligentGPT(jobs, profile, skills, requestId) {
  if (!canUseAPI('openai')) {
    console.log(`[${requestId}] OpenAI: Daily/monthly limit reached, using fallback`);
    return jobs.map(job => ({
      ...job,
      gpt_match_score: calculateBasicMatchScore(job, profile, skills),
      gpt_analysis: 'GPT analysis unavailable due to free tier limits - using basic matching'
    }));
  }

  const analyzedJobs = [];
  const batchSize = 3; // Smaller batches to conserve API usage
  const maxJobs = Math.min(jobs.length, 15); // Limit total jobs analyzed to conserve quota
  
  for (let i = 0; i < maxJobs; i += batchSize) {
    if (!canUseAPI('openai')) break; // Stop if we hit the limit
    
    const batch = jobs.slice(i, i + batchSize);
    
    try {
      const batchResults = await analyzeJobBatchWithGPT(batch, profile, skills, requestId);
      analyzedJobs.push(...batchResults);
      trackAPIUsage('openai', 1);
    } catch (error) {
      console.log(`[${requestId}] GPT batch ${i} failed:`, error.message);
      const fallbackResults = batch.map(job => ({
        ...job,
        gpt_match_score: calculateBasicMatchScore(job, profile, skills),
        gpt_analysis: 'GPT analysis failed - using fallback'
      }));
      analyzedJobs.push(...fallbackResults);
    }
  }
  
  // Add remaining jobs with basic analysis
  const remainingJobs = jobs.slice(maxJobs).map(job => ({
    ...job,
    gpt_match_score: calculateBasicMatchScore(job, profile, skills),
    gpt_analysis: 'Basic analysis - GPT quota conserved'
  }));
  
  return [...analyzedJobs, ...remainingJobs];
}

// Rest of the functions remain the same...
async function analyzeJobBatchWithGPT(jobs, profile, skills, requestId) {
  const prompt = `Analyze job fit for candidate:
Profile: Skills: ${skills.join(', ')}, Experience: ${profile.experience_level || 'mid'}, 
Industry: ${profile.industry || 'tech'}, Salary: $${profile.salary_min || 80000}-$${profile.salary_max || 120000}

Jobs: ${jobs.map((job, i) => `${i+1}. ${job.title} at ${job.company} - ${job.location} - ${job.salary || 'No salary'}`).join('\n')}

Return JSON array: [{"jobIndex": 0, "matchScore": 85, "analysis": "Good fit because...", "strengths": ["skill match"], "concerns": ["salary gap"]}]`;

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000, temperature: 0.3
    }, {
      headers: { 'Authorization': `Bearer ${API_CONFIG.openai.key}`, 'Content-Type': 'application/json' },
      timeout: 30000
    });

    const gptResults = JSON.parse(response.data.choices[0].message.content);
    
    return jobs.map((job, index) => {
      const gptResult = gptResults.find(r => r.jobIndex === index) || {};
      return {
        ...job,
        gpt_match_score: gptResult.matchScore || calculateBasicMatchScore(job, profile, skills),
        gpt_analysis: gptResult.analysis || 'Analysis not available',
        gpt_strengths: gptResult.strengths || [],
        gpt_concerns: gptResult.concerns || []
      };
    });
    
  } catch (error) {
    console.log(`[${requestId}] GPT API failed:`, error.message);
    throw error;
  }
}

// Utility functions (keeping existing ones and adding new helpers)
function getAllSources(profile, remote) {
  let sources = [...JOB_SOURCES.general];
  if (profile?.job_types?.includes('tech')) sources.push(...JOB_SOURCES.tech);
  if (remote) sources.push(...JOB_SOURCES.remote);
  sources.push(...JOB_SOURCES.startup, ...JOB_SOURCES.specialized);
  return sources;
}

function removeDuplicateJobs(jobs) {
  const seen = new Set();
  return jobs.filter(job => {
    const key = `${job.title.toLowerCase()}-${job.company.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getSourcesUsed(jobs) {
  return [...new Set(jobs.map(job => job.source))];
}

function calculateBasicMatchScore(job, profile, skills) {
  let score = 50;
  
  const jobSkills = job.skills || [];
  const matchingSkills = skills.filter(skill => 
    jobSkills.some(jobSkill => jobSkill.toLowerCase().includes(skill.toLowerCase()))
  );
  score += (matchingSkills.length / Math.max(skills.length, 1)) * 30;
  
  if (job.salary && profile.salary_min && profile.salary_max) {
    const jobSalary = extractSalaryNumber(job.salary);
    if (jobSalary >= profile.salary_min && jobSalary <= profile.salary_max) {
      score += 15;
    }
  }
  
  if (job.remote && profile.remote_preference) score += 5;
  
  return Math.min(100, Math.max(0, score));
}

function extractSkillsFromDescription(description) {
  if (!description) return [];
  const commonSkills = [
    'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'AWS', 'Docker',
    'Sales', 'Marketing', 'Customer Service', 'Project Management', 'Excel'
  ];
  return commonSkills.filter(skill => 
    description.toLowerCase().includes(skill.toLowerCase())
  );
}

function extractSalaryNumber(salaryString) {
  if (!salaryString) return 0;
  const matches = salaryString.match(/\$?([\d,]+)/);
  return matches ? parseInt(matches[1].replace(/,/g, '')) : 0;
}

// Additional helper functions for apprenticeships and profile generation
async function scrapeApprenticeships(keywords, location, requestId) {
  console.log(`[${requestId}] Generating apprenticeships for: ${keywords} in ${location}`);
  
  const trades = [
    'Electrician', 'Plumber', 'HVAC Technician', 'Carpenter', 'Welder',
    'Automotive Technician', 'Machine Operator', 'Construction Worker',
    'Software Developer', 'Cybersecurity Specialist', 'Data Analyst'
  ];

  const organizations = [
    { name: 'ABC Electrical Contractors', type: 'Union', wage: '$18-25/hour' },
    { name: 'Master Plumbing Co.', type: 'Company', wage: '$16-22/hour' },
    { name: 'HVAC Solutions Inc.', type: 'Company', wage: '$17-24/hour' },
    { name: 'IBM Apprenticeship Program', type: 'Corporate', wage: '$45,000-55,000/year' },
    { name: 'Amazon Technical Apprenticeship', type: 'Corporate', wage: '$40,000-50,000/year' }
  ];

  const apprenticeships = [];
  for (let i = 0; i < 12; i++) {
    const trade = trades[Math.floor(Math.random() * trades.length)];
    const org = organizations[Math.floor(Math.random() * organizations.length)];
    const source = APPRENTICESHIP_SOURCES[Math.floor(Math.random() * APPRENTICESHIP_SOURCES.length)];
    
    apprenticeships.push({
      id: `apprentice_${i + 1}`, title: `${trade} Apprentice`,
      company: org.name, organization_type: org.type, location,
      wage: org.wage, duration: '2-4 years', type: 'Apprenticeship',
      url: `${source.url}/program/${i + 1000}`, source: source.name,
      posted: formatPostedDate(Math.floor(Math.random() * 30)),
      description: `${org.name} apprenticeship: hands-on training, mentorship, certification`,
      requirements: ['High school diploma', 'Physical ability', 'Willingness to learn'],
      benefits: ['Paid training', 'Health insurance', 'Job placement guarantee'],
      is_ghost: false, ghost_score: 10
    });
  }
  
  return apprenticeships;
}

async function generateProfileBasedJobs(keywords, location, profile, sources, count = 15) {
  const jobs = [];
  const userSkills = profile?.skills || [];
  const userIndustry = profile?.industry || 'technology';
  const userExperienceLevel = profile?.experience_level || 'mid';
  const userSalaryMin = profile?.salary_min || 80000;
  const userSalaryMax = profile?.salary_max || 120000;
  
  for (let i = 0; i < count; i++) {
    const source = sources[Math.floor(Math.random() * sources.length)];
    const job = generateRealisticJob(keywords, location, userSkills, userIndustry, 
      userExperienceLevel, userSalaryMin, userSalaryMax, source);
    jobs.push(job);
  }

  return jobs;
}

function generateRealisticJob(keywords, location, skills, industry, experienceLevel, salaryMin, salaryMax, source) {
  const companyData = getIndustryCompanies(industry);
  const jobTitles = getIndustryJobTitles(industry, experienceLevel);
  
  const company = companyData[Math.floor(Math.random() * companyData.length)];
  const title = jobTitles[Math.floor(Math.random() * jobTitles.length)];
  const salary = generateSalaryInRange(salaryMin, salaryMax);
  
  const postedDaysAgo = Math.floor(Math.random() * 14);
  const postedDate = new Date();
  postedDate.setDate(postedDate.getDate() - postedDaysAgo);

  return {
    id: `generated_${Math.random().toString(36).substr(2, 9)}`,
    title, company: company.name, location, salary, type: 'Full-time',
    remote: Math.random() > 0.7,
    url: `${source.url}job/${Math.floor(Math.random() * 1000000)}`,
    source: source.name, posted: formatPostedDate(postedDaysAgo),
    posted_date: postedDate.toISOString(),
    description: generateJobDescription(title, company.name, skills),
    skills: generateRequiredSkills(title, skills),
    company_size: company.size, industry
  };
}

function getIndustryCompanies(industry) {
  const companies = {
    technology: [
      { name: 'Microsoft', size: 'Large' }, { name: 'Google', size: 'Large' },
      { name: 'Amazon', size: 'Large' }, { name: 'Spotify', size: 'Medium' }
    ],
    sales: [
      { name: 'Salesforce', size: 'Large' }, { name: 'HubSpot', size: 'Medium' },
      { name: 'Oracle', size: 'Large' }, { name: 'SAP', size: 'Large' }
    ],
    staffing: [
      { name: 'Robert Half', size: 'Large' }, { name: 'Adecco', size: 'Large' },
      { name: 'ManpowerGroup', size: 'Large' }, { name: 'Kelly Services', size: 'Large' }
    ]
  };
  return companies[industry] || companies.technology;
}

function getIndustryJobTitles(industry, experienceLevel) {
  const titles = {
    technology: {
      entry: ['Junior Software Engineer', 'Frontend Developer', 'QA Tester'],
      mid: ['Software Engineer', 'Full Stack Developer', 'DevOps Engineer'],
      senior: ['Senior Software Engineer', 'Lead Developer', 'Engineering Manager']
    },
    sales: {
      entry: ['Sales Representative', 'Inside Sales Rep'],
      mid: ['Account Executive', 'Sales Manager'],
      senior: ['Senior Sales Manager', 'Director of Sales']
    },
    staffing: {
      entry: ['Recruiter', 'Talent Acquisition Specialist'],
      mid: ['Senior Recruiter', 'Talent Acquisition Manager'],
      senior: ['Director of Talent Acquisition', 'VP of Human Resources']
    }
  };
  return titles[industry]?.[experienceLevel] || titles.technology.mid;
}

function generateSalaryInRange(min, max) {
  const salary = min + Math.floor(Math.random() * (max - min));
  const roundedSalary = Math.round(salary / 5000) * 5000;
  return `$${roundedSalary.toLocaleString()}`;
}

function generateJobDescription(title, company, skills) {
  return `${company} is seeking a talented ${title} to join our team. Required skills: ${skills.slice(0, 5).join(', ')}. We offer competitive compensation and growth opportunities.`;
}

function generateRequiredSkills(title, userSkills) {
  const skillSets = {
    'Software Engineer': ['JavaScript', 'Python', 'React', 'SQL'],
    'Sales': ['CRM', 'Salesforce', 'Communication', 'Negotiation'],
    'Recruiter': ['Recruiting', 'HR', 'Communication', 'LinkedIn']
  };
  
  const matchingKey = Object.keys(skillSets).find(key => title.includes(key));
  const baseSkills = skillSets[matchingKey] || skillSets['Software Engineer'];
  
  const relevantUserSkills = userSkills.filter(skill => 
    baseSkills.some(baseSkill => baseSkill.toLowerCase().includes(skill.toLowerCase()))
  );
  
  return [...new Set([...baseSkills, ...relevantUserSkills])].slice(0, 8);
}

function formatPostedDate(daysAgo) {
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return '1 day ago';
  if (daysAgo < 7) return `${daysAgo} days ago`;
  if (daysAgo < 14) return '1 week ago';
  return `${Math.floor(daysAgo / 7)} weeks ago`;
}

// Ghost job filtering (same as before)
async function filterGhostJobs(jobs, requestId) {
  const filteredJobs = [];
  
  for (const job of jobs) {
    try {
      const ghostResult = await callGhostDetector(job, requestId);
      
      job.ghost_score = ghostResult.ghostScore || 0;
      job.ghost_flags = ghostResult.flags || [];
      job.is_ghost = ghostResult.isGhost || false;
      job.ghost_recommendation = ghostResult.recommendation;
      
      if (job.ghost_score < 70) {
        filteredJobs.push(job);
      } else {
        console.log(`[${requestId}] Filtered ghost: ${job.title} at ${job.company} (${job.ghost_score})`);
      }
      
    } catch (error) {
      console.log(`[${requestId}] Ghost detection failed for ${job.id}:`, error.message);
      job.ghost_score = 30;
      job.is_ghost = false;
      filteredJobs.push(job);
    }
  }
  
  return filteredJobs;
}

async function callGhostDetector(job, requestId) {
  try {
    const response = await axios.post('/.netlify/functions/ghost-detector', 
      { job }, { timeout: 5000 });
    return response.data.job || { ghostScore: 30, isGhost: false };
  } catch (error) {
    console.log(`[${requestId}] Ghost detector failed:`, error.message);
    return { ghostScore: 30, isGhost: false };
  }
} 