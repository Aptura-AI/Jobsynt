require('dotenv').config();

// ONLY Enhanced IT Contract Scraper is active.
const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { PassThrough } = require('stream');

// Enhanced configuration with memory and timeout management
const config = {
    maxITJobs: 50,
    requestDelay: 3000,
    maxRetries: 3,
    rateLimitDelay: 5000,
    apiTimeout: 15000,
    batchSize: 5,
    maxMemoryUsage: 512 // MB
};

// Constant search parameters - exactly what you requested
const CONSTANT_SEARCH_PARAMS = {
    query: '(PeopleSoft OR SAP) AND IT AND C2C AND Remote',
    location: 'remote',
    min_salary: 80,
    description: 'High-value PeopleSoft or SAP IT C2C opportunities paying $80+ per hour, remote'
};

// Site configurations for comprehensive coverage
const siteConfigs = {
    primaryAPIs: [
        {
            name: 'JSearch API',
            description: 'Aggregates Dice, Indeed, LinkedIn, Google Jobs',
            enabled: () => !!process.env.JSEARCH_API_KEY
        },
        {
            name: 'Adzuna API',
            description: 'Covers FlexJobs, Upwork, Robert Half',
            enabled: () => !!(process.env.ADZUNA_API_KEY && process.env.ADZUNA_APP_ID)
        }
    ],
    targetSites: [
        'Dice.com', 'Indeed.com', 'LinkedIn Jobs', 'Upwork', 'FlexJobs',
        'Robert Half Technology', 'CyberCoders', 'Aquent', 'Gun.io',
        'Hired', 'AngelList', 'Toptal'
    ]
};

// Enhanced logging with memory monitoring
function logInfo(message, data = null) {
    const memUsage = process.memoryUsage();
    console.log(`ℹ️ ${message}${data ? ': ' + JSON.stringify(data) : ''} | Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}

function logSuccess(message, data = null) {
    const memUsage = process.memoryUsage();
    console.log(`✅ ${message}${data ? ': ' + JSON.stringify(data) : ''} | Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}

function logWarning(message, data = null) {
    const memUsage = process.memoryUsage();
    console.log(`⚠️ ${message}${data ? ': ' + JSON.stringify(data) : ''} | Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}

function logError(message, error = null) {
    const memUsage = process.memoryUsage();
    console.error(`❌ ${message}${error ? ': ' + error.message : ''} | Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
}

// Memory monitoring
function checkMemoryUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > config.maxMemoryUsage) {
        logWarning(`High memory usage detected: ${Math.round(heapUsedMB)}MB`);
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
            logInfo('Garbage collection triggered');
        }
    }
    
    return {
        rss: Math.round(memUsage.rss / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(heapUsedMB)
    };
}

// Enhanced Supabase initialization
let supabase;
(async () => {
    try {
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Missing Supabase configuration');
        }
        supabase = createClient(
            process.env.SUPABASE_URL.replace(/[';]/g, ''),
            process.env.SUPABASE_SERVICE_ROLE_KEY.replace(/[';]/g, '')
        );
        // Verify connection
        await supabase.from('profiles').select('id').limit(1);
    } catch (initError) {
        console.error('❌ Supabase initialization failed:', initError);
        throw new Error('Database connection failed');
    }
})();

// Enhanced API call with timeout
async function safeApiCall(config) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
        const response = await axios({
            ...config,
            signal: controller.signal
        });
        clearTimeout(timeout);
        return response;
    } catch (error) {
        clearTimeout(timeout);
        if (error.code === 'ECONNABORTED') {
            throw new Error(`API timeout after 15s: ${config.url}`);
        }
        throw error;
    }
}

// Enhanced retry mechanism with exponential backoff
async function withRetry(operation, description, maxRetries = config.maxRetries) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            logInfo(`Attempt ${attempt}/${maxRetries}: ${description}`);
            const result = await operation();
            return result;
        } catch (error) {
            lastError = error;
            logWarning(`Attempt ${attempt} failed for ${description}`, { error: error.message });
            
            if (attempt < maxRetries) {
                const delay = config.requestDelay * Math.pow(2, attempt - 1); // Exponential backoff
                logInfo(`Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    logError(`All ${maxRetries} attempts failed for ${description}`, lastError);
    throw lastError;
}

// Smart delay with jitter and memory check
async function smartDelay(baseDelay = config.requestDelay) {
    const jitter = Math.random() * 1000;
    const delay = baseDelay + jitter;
    await new Promise(resolve => setTimeout(resolve, delay));
    checkMemoryUsage();
}

// Memory-safe job processing in batches
async function processJobsInBatches(jobs, saveFunction, batchSize = config.batchSize) {
    const results = [];
    let processedCount = 0;
    
    for (let i = 0; i < jobs.length; i += batchSize) {
        const batch = jobs.slice(i, i + batchSize);
        logInfo(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(jobs.length / batchSize)} (${batch.length} jobs)`);
        
        const batchResults = await Promise.allSettled(
            batch.map(job => saveFunction(job))
        );
        
        results.push(...batchResults);
        processedCount += batch.length;
        
        // Log batch results
        const successful = batchResults.filter(r => r.status === 'fulfilled' && r.value).length;
        const failed = batchResults.filter(r => r.status === 'rejected').length;
        logSuccess(`Batch completed: ${successful} saved, ${failed} failed`);
        
        // Rate limiting between batches
        if (i + batchSize < jobs.length) {
            await smartDelay(1000);
        }
        
        // Memory check after each batch
        checkMemoryUsage();
    }
    
    return {
        results,
        totalProcessed: processedCount,
        successful: results.filter(r => r.status === 'fulfilled' && r.value).length,
        failed: results.filter(r => r.status === 'rejected').length
    };
}

async function getAllUserProfiles() {
    if (!supabase) {
        throw new Error('Supabase not initialized');
    }
    
    try {
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            throw error;
        }
        // Debug logging: print all profile IDs and key fields
        if (profiles && profiles.length > 0) {
            console.log('🔎 Supabase profiles fetched:', profiles.map(p => ({ id: p.id, user_id: p.user_id, current_title: p.current_title, skills: p.skills })));
        } else {
            console.log('🔎 Supabase profiles fetched: [] (empty)');
        }
        logSuccess(`Found ${profiles?.length || 0} user profiles`);
        return profiles || [];
    } catch (error) {
        logError('Error fetching profiles', error);
        throw error;
    }
}

async function getTotalJobCount(profile_id = null) {
    if (!supabase) return 0;
    
    try {
        let query = supabase
            .from('scraped_jobs')
            .select('id', { count: 'exact', head: true });
            
        if (profile_id) {
            query = query.eq('profile_id', profile_id);
        }
        
        const { count, error } = await query;
        
        if (error) throw error;
        return count || 0;
    } catch (error) {
        logError('Error counting jobs', error);
        return 0;
    }
}

// Enhanced duplicate detection
async function isDuplicateJob(job, profile_id = null) {
    if (!supabase) return false;
    
    try {
        let query = supabase
            .from('scraped_jobs')
            .select('id')
            .eq('title', job.title)
            .eq('company', job.company);
            
        if (profile_id) {
            query = query.eq('profile_id', profile_id);
        } else if (job.profile_id === null) {
            query = query.is('profile_id', null);
        }
        
        const { data: exact } = await query.single();
        return !!exact;
    } catch (error) {
        logWarning('Duplicate check failed, allowing job to be saved', error);
        return false;
    }
}

async function saveJobToSupabase(job) {
    if (!supabase) {
        throw new Error('Cannot save job - no Supabase connection');
    }
    
    try {
        const isDuplicate = await isDuplicateJob(job, job.profile_id);
        if (isDuplicate) {
            logWarning(`Duplicate job skipped: "${job.title}" at ${job.company}`);
            return false;
        }
        
        if (!job.title || !job.company) {
            logWarning('Job missing required fields', { title: job.title, company: job.company });
            return false;
        }
        
        const jobData = {
            ...job,
            scraped_at: new Date().toISOString(),
            is_real: true,
            source_confidence: 'high'
        };
        
        const { error } = await supabase.from('scraped_jobs').insert([jobData]);
        if (error) {
            throw error;
        }
        
        logSuccess(`Saved job: "${job.title}" at ${job.company}`);
        return true;
    } catch (error) {
        logError('Error saving job', error);
        throw error;
    }
}

async function saveConstantSearchJob(job) {
    if (!supabase) return false;
    
    try {
        const isDuplicate = await isDuplicateJob(job, null);
        if (isDuplicate) {
            logWarning(`Duplicate constant search job skipped: "${job.title}" at ${job.company}`);
            return false;
        }
        
        const jobData = {
            ...job,
            profile_id: null,
            is_constant_search: true,
            constant_search_type: 'peoplesoft_it_c2c',
            search_type: 'constant_peoplesoft',
            scraped_at: new Date().toISOString(),
            is_real: true,
            source_confidence: 'high'
        };
        
        const { error } = await supabase.from('scraped_jobs').insert([jobData]);
        if (error) {
            throw error;
        }
        
        logSuccess(`Saved constant search job: "${job.title}" at ${job.company}`);
        return true;
    } catch (error) {
        logError('Error saving constant search job', error);
        throw error;
    }
}

// Helper to intelligently build job search queries
function buildJobSearchQuery({ manualSearch, profile, site, automated = false }) {
    let query = '';
    let location = 'Remote';
    let rate = 80;
    let isFullTime = false;

    // If user has made a manual search, use those values
    if (manualSearch && manualSearch.position) {
        query = manualSearch.position;
        if (manualSearch.skills) {
            query += ' ' + manualSearch.skills;
        }
        if (manualSearch.rate) {
            rate = manualSearch.rate;
        }
        if (manualSearch.location) {
            location = manualSearch.location;
        }
        if (manualSearch.employment_type && manualSearch.employment_type.toLowerCase().includes('full')) {
            isFullTime = true;
        }
    } else if (profile) {
        // Fallback to profile data
        if (profile.current_title) {
            query = profile.current_title;
        }
        if (profile.skills) {
            const skillsList = profile.skills.split(',').map(s => s.trim()).filter(s => s.length > 2).slice(0, 4);
            if (skillsList.length > 0) {
                query += ' ' + skillsList.join(' ');
            }
        }
        if (profile.expected_salary) {
            rate = profile.expected_salary;
        }
        // Default location is Remote
    }

    // Automated scraping: only SAP or PeopleSoft, and contract type
    if (automated) {
        const tech = Math.random() > 0.5 ? 'SAP' : 'PeopleSoft';
        let contractType = 'contract';
        if (site && site.toLowerCase().includes('dice')) {
            contractType = 'c2c';
        } else if (site && site.toLowerCase().includes('indeed')) {
            contractType = 'Corp to Corp';
        }
        query = `${tech} ${contractType}`;
        location = 'Remote';
        rate = 80;
    }

    // Always append contract/C2C/freelance terms unless full-time is explicitly requested
    if (!isFullTime) {
        query = `${query} contract c2c freelance contractor`.trim();
    }

    return { query: query.trim(), location, rate, isFullTime };
}

// Enhanced job search with comprehensive API coverage and timeout handling
async function searchJobs(query, location, isFullTime = false) {
    logInfo(`Searching for: "${query}" in ${location}`);
    const allJobs = [];
    let totalApiCalls = 0;
    
    // JSearch API - Comprehensive job aggregation
    if (process.env.JSEARCH_API_KEY) {
        try {
            totalApiCalls++;
            logInfo('Calling JSearch API (Dice, Indeed, LinkedIn, Google Jobs)...');
            const searchResult = await withRetry(async () => {
                return await safeApiCall({
                    method: 'GET',
                    url: 'https://jsearch.p.rapidapi.com/search',
                    headers: {
                        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
                        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                    },
                    params: {
                        query: query,
                        page: 1,
                        num_pages: 2,
                        date_posted: 'week',
                        employment_types: isFullTime ? 'FULLTIME' : 'CONTRACTOR'
                    },
                    timeout: config.apiTimeout
                });
            }, 'JSearch API call');

            if (searchResult.data?.data?.length > 0) {
                let jobs = searchResult.data.data
                    .filter(job => job?.job_title && job?.employer_name)
                    .slice(0, 12)
                    .map(job => ({
                        id: `jsearch_${job.job_id}_${Date.now()}`,
                        title: job.job_title.trim(),
                        company: job.employer_name.trim(),
                        location: job.job_city && job.job_state ? 
                            `${job.job_city}, ${job.job_state}` : 
                            location || 'Remote',
                        salary: job.job_min_salary && job.job_max_salary ? 
                            `$${job.job_min_salary.toLocaleString()}-${job.job_max_salary.toLocaleString()}` : 
                            'Competitive',
                        job_type: job.job_employment_type || (isFullTime ? 'Full-Time' : 'Contract'),
                        work_mode: job.job_is_remote ? 'Remote' : 'On-site',
                        description: job.job_description?.substring(0, 500) || 'No description available',
                        url: job.job_apply_link || job.job_google_link || '',
                        source: 'JSearch API (Dice, Indeed, LinkedIn)',
                        posted_date: job.job_posted_at_datetime_utc
                    }));
                
                // Filter out full-time/permanent jobs unless explicitly requested
                if (!isFullTime) {
                    jobs = jobs.filter(j => !j.job_type.toLowerCase().includes('full'));
                }
                allJobs.push(...jobs);
                logSuccess(`JSearch: Found ${jobs.length} jobs`);
            } else {
                logWarning('JSearch returned no results');
            }
            
            await smartDelay();
        } catch (error) {
            logError('JSearch API error', error);
        }
    } else {
        logWarning('JSearch API key not configured');
    }

    // Adzuna API - Additional coverage
    if (process.env.ADZUNA_API_KEY && process.env.ADZUNA_APP_ID) {
        try {
            totalApiCalls++;
            logInfo('Calling Adzuna API (FlexJobs, Upwork, Robert Half)...');
            
            const searchResult = await withRetry(async () => {
                return await safeApiCall({
                    method: 'GET',
                    url: `https://api.adzuna.com/v1/api/jobs/us/search/1`,
                    params: {
                        app_id: process.env.ADZUNA_APP_ID,
                        app_key: process.env.ADZUNA_API_KEY,
                        what: query,
                        where: location,
                        results_per_page: 10,
                        max_days_old: 14,
                        sort_by: 'date'
                    },
                    timeout: config.apiTimeout
                });
            }, 'Adzuna API call');

            if (searchResult.data?.results?.length > 0) {
                let jobs = searchResult.data.results
                    .filter(job => job?.title && job?.company?.display_name)
                    .slice(0, 8)
                    .map(job => ({
                        id: `adzuna_${job.id}_${Date.now()}`,
                        title: job.title.trim(),
                        company: job.company.display_name.trim(),
                        location: job.location.display_name || location,
                        salary: job.salary_min && job.salary_max ? 
                            `$${Math.round(job.salary_min).toLocaleString()}-${Math.round(job.salary_max).toLocaleString()}` : 
                            'Competitive',
                        job_type: job.contract_time || (isFullTime ? 'Full-Time' : 'Contract'),
                        work_mode: job.location.display_name?.toLowerCase().includes('remote') ? 'Remote' : 'On-site',
                        description: job.description?.substring(0, 500) || 'No description available',
                        url: job.redirect_url || '',
                        source: 'Adzuna API (FlexJobs, Upwork)',
                        posted_date: job.created
                    }));
                
                // Filter out full-time/permanent jobs unless explicitly requested
                if (!isFullTime) {
                    jobs = jobs.filter(j => !j.job_type.toLowerCase().includes('full'));
                }
                allJobs.push(...jobs);
                logSuccess(`Adzuna: Found ${jobs.length} jobs`);
            } else {
                logWarning('Adzuna returned no results');
            }
            
            await smartDelay();
        } catch (error) {
            logError('Adzuna API error', error);
        }
    } else {
        logWarning('Adzuna API credentials not configured');
    }

    // USA Jobs API
    if (process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL) {
        try {
            totalApiCalls++;
            logInfo('Calling USA Jobs API...');
            const searchResult = await withRetry(async () => {
                return await safeApiCall({
                    method: 'GET',
                    url: 'https://data.usajobs.gov/api/search',
                    headers: {
                        'Authorization-Key': process.env.USAJOBS_API_KEY,
                        'User-Agent': process.env.USAJOBS_EMAIL
                    },
                    params: {
                        Keyword: query,
                        LocationName: location,
                        RemoteIndicator: 'Yes',
                        ResultsPerPage: 10
                    },
                    timeout: config.apiTimeout
                });
            }, 'USA Jobs API call');

            if (searchResult.data?.SearchResult?.SearchResultItems?.length > 0) {
                let jobs = searchResult.data.SearchResult.SearchResultItems
                    .map(item => item.MatchedObjectDescriptor)
                    .filter(job => job.PositionTitle && job.OrganizationName)
                    .map(job => ({
                        id: `usajobs_${job.PositionID}_${Date.now()}`,
                        title: job.PositionTitle.trim(),
                        company: job.OrganizationName.trim(),
                        location: job.PositionLocationDisplay || location,
                        salary: job.PositionRemuneration && job.PositionRemuneration.length > 0 ?
                            `$${job.PositionRemuneration[0].MinimumRange}-${job.PositionRemuneration[0].MaximumRange}` :
                            'Competitive',
                        job_type: job.PositionOfferingType || (isFullTime ? 'Full-Time' : 'Contract'),
                        work_mode: job.PositionLocationDisplay?.toLowerCase().includes('remote') ? 'Remote' : 'On-site',
                        description: job.UserArea?.Details?.JobSummary?.substring(0, 500) || 'No description available',
                        url: job.PositionURI || '',
                        source: 'USA Jobs API',
                        posted_date: job.PublicationStartDate
                    }))
                    .filter(job => job.work_mode === 'Remote');
                
                // Filter out full-time/permanent jobs unless explicitly requested
                if (!isFullTime) {
                    jobs = jobs.filter(j => !j.job_type.toLowerCase().includes('full'));
                }
                allJobs.push(...jobs);
                logSuccess(`USA Jobs: Found ${jobs.length} jobs`);
            } else {
                logWarning('USA Jobs returned no results');
            }
            await smartDelay();
        } catch (error) {
            logError('USA Jobs API error', error);
        }
    } else {
        logWarning('USA Jobs API credentials not configured');
    }

    logSuccess(`Total jobs found: ${allJobs.length} from ${totalApiCalls} API calls`);
    return allJobs;
}

// Enhanced PeopleSoft constant search
async function searchPeopleSoftJobs() {
    logInfo(`CONSTANT SEARCH: "${CONSTANT_SEARCH_PARAMS.query}" - Remote, $${CONSTANT_SEARCH_PARAMS.min_salary}+`);
    const allJobs = [];
    
    if (process.env.JSEARCH_API_KEY) {
        try {
            const searchResult = await withRetry(async () => {
                return await safeApiCall({
                    method: 'GET',
                    url: 'https://jsearch.p.rapidapi.com/search',
                    headers: {
                        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
                        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                    },
                    params: {
                        query: CONSTANT_SEARCH_PARAMS.query,
                        page: 1,
                        num_pages: 1,
                        date_posted: 'week',
                        employment_types: 'CONTRACTOR',
                        remote_jobs_only: 'true'
                    },
                    timeout: config.apiTimeout
                });
            }, 'PeopleSoft constant search');

            if (searchResult.data?.data?.length > 0) {
                const jobs = searchResult.data.data
                    .filter(job => job?.job_title && job?.employer_name)
                    .filter(job => job.job_is_remote)
                    .filter(job => {
                        const title = job.job_title.toLowerCase();
                        const desc = (job.job_description || '').toLowerCase();
                        
                        if (!title.includes('peoplesoft') && !desc.includes('peoplesoft')) {
                            return false;
                        }
                        
                        if (job.job_min_salary && job.job_min_salary >= (CONSTANT_SEARCH_PARAMS.min_salary * 2000)) {
                            return true;
                        }
                        
                        return desc.includes('$80') || desc.includes('$90') || desc.includes('$100') || 
                               desc.includes('80+') || desc.includes('senior') || desc.includes('lead') ||
                               title.includes('senior') || title.includes('lead');
                    })
                    .slice(0, 8)
                    .map(job => ({
                        id: `constant_jsearch_${job.job_id}_${Date.now()}`,
                        title: job.job_title.trim(),
                        company: job.employer_name.trim(),
                        location: 'Remote',
                        salary: job.job_min_salary && job.job_max_salary ? 
                            `$${job.job_min_salary.toLocaleString()}-${job.job_max_salary.toLocaleString()}` : 
                            '$80+ per hour (Premium PeopleSoft)',
                        job_type: 'Contract (C2C)',
                        work_mode: 'Remote',
                        description: job.job_description?.substring(0, 500) || '',
                        url: job.job_apply_link || job.job_google_link || '',
                        source: 'JSearch API (PeopleSoft Constant Search)',
                        posted_date: job.job_posted_at_datetime_utc,
                        search_type: 'constant_peoplesoft',
                        priority: 'high'
                    }));
                
                allJobs.push(...jobs);
                logSuccess(`Found ${jobs.length} premium PeopleSoft IT C2C jobs`);
            } else {
                logWarning('No PeopleSoft jobs found in constant search');
            }
        } catch (error) {
            logError('PeopleSoft constant search error', error);
        }
    }
    return allJobs;
}

// Enhanced match scoring algorithm
function calculateMatchScore(job, profile) {
    let score = 40;
    const jobText = `${job.title} ${job.description}`.toLowerCase();
    const jobTitle = job.title.toLowerCase();
    
    if (profile.current_title) {
        const profileTitle = profile.current_title.toLowerCase();
        if (jobTitle.includes(profileTitle) || profileTitle.includes(jobTitle)) {
            score += 30;
        } else {
            const titleWords = profileTitle.split(' ').filter(word => word.length > 2);
            const matchingTitleWords = titleWords.filter(word => jobTitle.includes(word));
            score += matchingTitleWords.length * 8;
        }
    }
    
    if (profile.skills) {
        const profileSkills = profile.skills.split(',').map(s => s.trim().toLowerCase());
        const matchingSkills = profileSkills.filter(skill => 
            skill.length > 2 && jobText.includes(skill)
        );
        score += matchingSkills.length * 6;
    }
    
    if (profile.city && job.location) {
        const profileLocation = profile.city.toLowerCase();
        const jobLocation = job.location.toLowerCase();
        
        if (jobLocation.includes('remote')) {
            score += 15;
        } else if (jobLocation.includes(profileLocation)) {
            score += 12;
        } else if (profile.state && jobLocation.includes(profile.state.toLowerCase())) {
            score += 6;
        }
    }
    
    if (jobText.includes('contract') || jobText.includes('c2c') || jobText.includes('freelance')) {
        score += 8;
    }
    
    return Math.min(score, 100);
}

async function getLatestUserJobSearch(user_id) {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase
            .from('user_job_searches')
            .select('*')
            .eq('user_id', user_id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching user job search:', error);
        return null;
    }
}

// Enhanced main scraper function with memory management
async function runSmartJobScraper(manualTrigger = false) {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    logInfo(`🚀 ENHANCED SMART JOB SCRAPER ${manualTrigger ? '(MANUAL)' : '(AUTO)'} - ID: ${executionId}`);
    logInfo(`🎯 Target Sites: ${siteConfigs.targetSites.join(', ')}`);
    logInfo(`💼 Constant Search: ${CONSTANT_SEARCH_PARAMS.description}`);
    
    // Initial memory check
    const initialMemory = checkMemoryUsage();
    logInfo(`Initial memory usage: ${initialMemory.heapUsed}MB`);
    
    try {
        // Initialize Supabase with validation
        if (!supabase) {
            throw new Error('Supabase not initialized');
        }
        
        const profiles = await withRetry(
            () => getAllUserProfiles(),
            'fetching user profiles'
        );
        
        const totalJobCount = await getTotalJobCount();
        logInfo(`Current total jobs in database: ${totalJobCount}`);
        
        if (profiles.length === 0) {
            const message = 'No user profiles found - system may need profile setup';
            logWarning(message);
            // Always run constant search if no profiles, not just on manualTrigger
            logInfo('No profiles found - attempting constant search for PeopleSoft jobs');
            const constantSearchJobs = await searchPeopleSoftJobs();
            let constantSearchJobsAdded = 0;
            if (constantSearchJobs.length > 0) {
                const batchResult = await processJobsInBatches(
                    constantSearchJobs, 
                    saveConstantSearchJob
                );
                constantSearchJobsAdded = batchResult.successful;
            }
            return {
                success: true,
                message: 'No profiles found, but attempted constant search jobs',
                profiles_processed: 0,
                total_jobs_found: constantSearchJobs.length,
                total_jobs_saved: 0,
                constant_search_jobs_added: constantSearchJobsAdded,
                execution_time_ms: Date.now() - startTime,
                execution_id: executionId,
                memory_usage: checkMemoryUsage()
            };
        }

        let totalJobsFound = 0;
        let totalJobsSaved = 0;
        let profilesProcessed = 0;
        let constantSearchJobsAdded = 0;
        const processingResults = [];

        // Process each user profile
        for (const profile of profiles) {
            try {
                const { current_title, skills, city, state, id: profile_id, email, first_name, last_name } = profile;
                
                const manualSearch = await getLatestUserJobSearch(profile.user_id);
                const { query, location, rate, isFullTime } = buildJobSearchQuery({ manualSearch, profile, site: 'Dice', automated: false });
                
                profilesProcessed++;
                const userName = `${first_name || ''} ${last_name || ''}`.trim() || email;
                const profileJobCount = await getTotalJobCount(profile_id);
                
                logInfo(`Processing Profile ${profilesProcessed}/${profiles.length}: ${userName}`);
                logInfo(`Role: ${current_title || 'Not specified'}`);
                logInfo(`Search Query: "${query}" | Location: "${location}"`);
                logInfo(`Current jobs for profile: ${profileJobCount}`);
                
                if (profileJobCount >= config.maxITJobs && !manualTrigger) {
                    logInfo(`Profile ${userName} already has ${config.maxITJobs}+ jobs, skipping`);
                    continue;
                }
                
                const jobs = await withRetry(
                    () => searchJobs(query, location, isFullTime),
                    `searching jobs for ${userName}`
                );
                
                logInfo(`API returned ${jobs.length} jobs for query: "${query}"`);
                if (jobs.length > 0) {
                    logInfo(`First 5 job titles: ${jobs.slice(0,5).map(j => j.title).join('; ')}`);
                } else {
                    logWarning(`No jobs found for query: "${query}" using APIs: ${siteConfigs.primaryAPIs.filter(api => api.enabled()).map(api => api.name).join(', ')}`);
                }
                
                totalJobsFound += jobs.length;

                if (jobs.length > 0) {
                    const jobsWithProfile = jobs.map(job => ({
                        ...job,
                        profile_id,
                        target_role: current_title,
                        matched_at: new Date().toISOString(),
                        match_score: calculateMatchScore(job, profile),
                        search_query: query,
                        execution_id: executionId
                    }));
                    const jobsToSave = jobsWithProfile.filter(j => j.match_score >= 40 || manualTrigger);
                    if (jobsToSave.length === 0) {
                        logWarning(`${userName}: No jobs met the match score threshold (40)`);
                    }
                    const batchResult = await processJobsInBatches(jobsToSave, saveJobToSupabase, config.batchSize);
                    const successful = batchResult.results.filter(r => r.status === 'fulfilled' && r.value === true).length;
                    const failed = batchResult.results.filter(r => r.status === 'rejected' || r.value === false).length;
                    logSuccess(`${userName}: Found ${jobs.length} jobs, saved ${successful} new jobs (batch), ${failed} skipped/failed`);
                    if (failed > 0) {
                        batchResult.results.forEach((r, idx) => {
                            if (r.status === 'rejected') {
                                logWarning(`Job save failed: ${jobsToSave[idx]?.title} at ${jobsToSave[idx]?.company} - ${r.reason}`);
                            } else if (r.value === false) {
                                logWarning(`Job skipped (duplicate or missing fields): ${jobsToSave[idx]?.title} at ${jobsToSave[idx]?.company}`);
                            }
                        });
                    }
                    totalJobsSaved += successful;
                    processingResults.push({
                        profile: userName,
                        found: jobs.length,
                        saved: successful,
                        match_rate: jobs.length > 0 ? `${((successful / jobs.length) * 100).toFixed(1)}%` : '0%'
                    });
                } else {
                    logWarning(`${userName}: No jobs found`);
                    processingResults.push({
                        profile: userName,
                        found: 0,
                        saved: 0,
                        match_rate: '0%'
                    });
                }
                
                if (profilesProcessed < profiles.length) {
                    await smartDelay(config.rateLimitDelay);
                }
                
                // Memory check after each profile
                checkMemoryUsage();
                
            } catch (profileError) {
                logError(`Error processing profile ${profile.email}`, profileError);
                continue;
            }
        }

        // CONSTANT SEARCH for PeopleSoft jobs
        const shouldTriggerConstantSearch = 
            totalJobCount + totalJobsSaved >= 45 || 
            manualTrigger || 
            profiles.length === 0;
            
        if (shouldTriggerConstantSearch) {
            logInfo(`TRIGGERING CONSTANT SEARCH...`);
            logInfo(`Current total job count: ${totalJobCount + totalJobsSaved}/50`);
            
            try {
                const peopleSoftJobs = await withRetry(
                    () => searchPeopleSoftJobs(),
                    'PeopleSoft constant search'
                );
                
                if (peopleSoftJobs.length > 0) {
                    logInfo(`Processing ${peopleSoftJobs.length} PeopleSoft jobs for global access...`);
                    
                    const batchResult = await processJobsInBatches(
                        peopleSoftJobs, 
                        saveConstantSearchJob
                    );
                    
                    constantSearchJobsAdded = batchResult.successful;
                    logSuccess(`Added ${constantSearchJobsAdded}/${peopleSoftJobs.length} constant search jobs`);
                } else {
                    logWarning('No PeopleSoft jobs found in constant search');
                }
            } catch (constantSearchError) {
                logError('Constant search failed', constantSearchError);
            }
        }

        const executionTime = Date.now() - startTime;
        const finalMemory = checkMemoryUsage();
        
        const summary = {
            success: true,
            execution_id: executionId,
            profiles_processed: profilesProcessed,
            total_jobs_found: totalJobsFound,
            total_jobs_saved: totalJobsSaved,
            constant_search_jobs_added: constantSearchJobsAdded,
            execution_time_ms: executionTime,
            execution_time_readable: `${(executionTime / 1000).toFixed(2)} seconds`,
            save_rate: totalJobsFound > 0 ? `${((totalJobsSaved / totalJobsFound) * 100).toFixed(1)}%` : '0%',
            processing_results: processingResults,
            target_coverage: siteConfigs.targetSites,
            memory_usage: {
                initial: initialMemory,
                final: finalMemory,
                peak: Math.max(initialMemory.heapUsed, finalMemory.heapUsed)
            },
            message: `Processed ${profilesProcessed} profiles, found ${totalJobsFound} jobs, saved ${totalJobsSaved} new jobs, added ${constantSearchJobsAdded} premium jobs`
        };

        logSuccess('ENHANCED SCRAPING SUMMARY:');
        logSuccess(`Execution ID: ${executionId}`);
        logSuccess(`Execution Time: ${summary.execution_time_readable}`);
        logSuccess(`Profiles Processed: ${profilesProcessed}`);
        logSuccess(`Jobs Found: ${totalJobsFound}`);
        logSuccess(`Jobs Saved: ${totalJobsSaved} (${summary.save_rate})`);
        logSuccess(`Premium Jobs Added: ${constantSearchJobsAdded}`);
        logSuccess(`Target Sites: ${siteConfigs.targetSites.length} sites covered`);
        logSuccess(`Memory Usage: ${finalMemory.heapUsed}MB (peak: ${summary.memory_usage.peak}MB)`);
        
        logInfo(`Total jobs saved to Supabase this run: ${totalJobsSaved}`);
        
        return summary;
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        const finalMemory = checkMemoryUsage();
        
        logError('Critical scraper error', error);
        
        return {
            success: false,
            execution_id: executionId,
            error: error.message,
            error_stack: error.stack,
            profiles_processed: 0,
            total_jobs_found: 0,
            total_jobs_saved: 0,
            constant_search_jobs_added: 0,
            execution_time_ms: executionTime,
            execution_time_readable: `${(executionTime / 1000).toFixed(2)} seconds`,
            memory_usage: {
                initial: initialMemory,
                final: finalMemory
            }
        };
    }
}

// Netlify-specific cold start handler
let isColdStart = true;

// Enhanced Netlify function handler with streaming and cold start optimization
exports.handler = async (event, context) => {
    // Memory usage logging
    console.log('Memory usage:', {
        rss: process.memoryUsage().rss / 1024 / 1024 + 'MB',
        heapTotal: process.memoryUsage().heapTotal / 1024 / 1024 + 'MB',
        heapUsed: process.memoryUsage().heapUsed / 1024 / 1024 + 'MB'
    });

    // Cold start optimization
    if (isColdStart) {
        console.log('Cold start detected - initializing...');
        await new Promise(resolve => setTimeout(resolve, 500));
        isColdStart = false;
    }

    // Streamed response for Netlify
    const streamResponse = () => {
        const stream = new PassThrough();
        setTimeout(() => {
            stream.write(JSON.stringify({ status: 'processing' }));
        }, 0);
        return stream;
    };

    try {
        // Immediate response to prevent timeout
        const responseStream = streamResponse();

        // Process in background
        setImmediate(async () => {
            try {
                const result = await runSmartJobScraper();
                responseStream.write(JSON.stringify(result));
            } catch (error) {
                responseStream.write(JSON.stringify({ 
                    error: error.message,
                    stack: error.stack 
                }));
            } finally {
                responseStream.end();
            }
        });

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: responseStream
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: 'Initialization failed',
                details: error.message 
            })
        };
    }
};

if (require.main === module) {
  runSmartJobScraper(true).then(result => {
    if (result && result.total_jobs_found > 0) {
      console.log('SCRAPER RESULT:', JSON.stringify(result, null, 2));
    } else {
      console.log('No real jobs found. The scraper ran successfully, but no jobs were returned from the APIs.');
    }
  }).catch(err => {
    console.error('SCRAPER ERROR:', err);
  });
} 