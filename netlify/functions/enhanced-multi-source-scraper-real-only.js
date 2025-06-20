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
  openai: {
    key: process.env.OPENAI_API_KEY,
    monthly_limit: 100,
    daily_limit: 10,
    priority: 1
  }
};

// Free Tier Usage Tracking
let USAGE_TRACKER = {
  daily: {},
  monthly: {},
  last_reset: new Date().toDateString()
};

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
    console.log(`[${requestId}] Real jobs only scraper started`);
    
    resetUsageTrackerIfNeeded();
    
    const body = event.body ? JSON.parse(event.body) : {};
    const { 
      keywords = '', location = 'United States', remote = false, 
      jobType = 'full-time', search_type = 'jobs', profile = {}
    } = body;

    console.log(`[${requestId}] Search:`, { keywords, location, search_type });

    // STEP 1: Real API job scraping only
    let rawJobs = [];
    if (search_type === 'apprenticeships') {
      rawJobs = []; // No mock apprenticeships
    } else {
      rawJobs = await scrapeRealJobsOnly(keywords, location, jobType, remote, profile, requestId);
    }
    console.log(`[${requestId}] Real jobs scraped: ${rawJobs.length}`);

    // If no real jobs found, return proper message
    if (rawJobs.length === 0) {
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
          total_scraped: 0,
          ghost_filtered: 0,
          sources_used: [],
          api_usage: getAPIUsageSummary(),
          request_id: requestId,
          timestamp: new Date().toISOString()
        })
      };
    }

    // STEP 2: Ghost job detection and filtering
    const filteredJobs = await filterGhostJobs(rawJobs, requestId);
    console.log(`[${requestId}] After ghost filtering: ${filteredJobs.length} jobs`);

    // STEP 3: GPT-powered job analysis (optional)
    const analyzedJobs = await analyzeJobsWithIntelligentGPT(filteredJobs, profile, profile.skills || [], requestId);
    console.log(`[${requestId}] After analysis: ${analyzedJobs.length} jobs`);

    // STEP 4: Final ranking and response
    const finalJobs = analyzedJobs
      .sort((a, b) => (b.gpt_match_score || 0) - (a.gpt_match_score || 0))
      .slice(0, 20);

    // Final check - if no jobs after filtering, show no results message
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
        success: true,
        no_results: true,
        message: "We could not find any jobs matching your profile right now. We will keep searching and share the jobs on your email. Come back here later to see jobs matching your profile.",
        jobs: [], count: 0, request_id: requestId, fallback: true
      })
    };
  }
};

// Intelligent Free Tier Management
function resetUsageTrackerIfNeeded() {
  const today = new Date().toDateString();
  
  if (USAGE_TRACKER.last_reset !== today) {
    USAGE_TRACKER.daily = {};
    USAGE_TRACKER.last_reset = today;
  }
  
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

// STEP 1: Real API job scraping only - NO MOCK DATA
async function scrapeRealJobsOnly(keywords, location, jobType, remote, profile, requestId) {
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
  
  if (availableAPIs.length === 0) {
    console.log(`[${requestId}] No APIs available - returning empty results`);
    return [];
  }

  // Try APIs in priority order
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
        case 'usajobs':
          apiJobs = await scrapeUSAJobsAPI(keywords, location, requestId);
          break;
        case 'themusejobs':
          apiJobs = await scrapeTheMuseAPI(keywords, location, requestId);
          break;
        case 'remotive':
          apiJobs = await scrapeRemotiveAPI(keywords, requestId);
          break;
      }
      
      if (apiJobs.length > 0) {
        allJobs.push(...apiJobs);
        trackAPIUsage(api.name, 1);
        console.log(`[${requestId}] ${api.name}: ${apiJobs.length} real jobs (Total: ${allJobs.length})`);
      }
      
    } catch (error) {
      console.log(`[${requestId}] ${api.name} failed:`, error.message);
    }
  }

  console.log(`[${requestId}] Total real jobs from APIs: ${allJobs.length}`);
  return removeDuplicateJobs(allJobs);
}

// API Integration Functions
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

// Enhanced GPT Analysis with Free Tier Management
async function analyzeJobsWithIntelligentGPT(jobs, profile, skills, requestId) {
  if (!canUseAPI('openai')) {
    console.log(`[${requestId}] OpenAI: Daily/monthly limit reached, using basic scoring`);
    return jobs.map(job => ({
      ...job,
      gpt_match_score: calculateBasicMatchScore(job, profile, skills),
      gpt_analysis: 'Basic analysis - GPT quota conserved'
    }));
  }

  const analyzedJobs = [];
  const batchSize = 3;
  const maxJobs = Math.min(jobs.length, 15);
  
  for (let i = 0; i < maxJobs; i += batchSize) {
    if (!canUseAPI('openai')) break;
    
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
  
  const remainingJobs = jobs.slice(maxJobs).map(job => ({
    ...job,
    gpt_match_score: calculateBasicMatchScore(job, profile, skills),
    gpt_analysis: 'Basic analysis - GPT quota conserved'
  }));
  
  return [...analyzedJobs, ...remainingJobs];
}

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

// Utility functions
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

// Ghost job filtering
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