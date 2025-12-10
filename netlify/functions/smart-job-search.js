const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Clean environment variables (remove quotes and semicolons)
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/[';]/g, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/[';]/g, '');
const PERPLEXITY_API_KEY = (process.env.PERPLEXITY_API_KEY || '').replace(/[';]/g, '');

// Initialize Supabase
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const PRIMARY_JOB_BOARDS = ['Dice', 'LinkedIn', 'Indeed'];
const SECONDARY_JOB_BOARDS = ['Monster', 'ZipRecruiter', 'CareerBuilder', 'SimplyHired', 'Glassdoor'];
const MAX_JOBS_PER_DAY = 10;
const INITIAL_LOOKBACK_DAYS = 14;
const DAILY_LOOKBACK_HOURS = 24;

const PST_TIMEZONE = 'America/Los_Angeles';

/**
 * Parse JSON that may be wrapped in markdown/code fences.
 */
function extractJsonPayload(rawText) {
    if (!rawText) return null;
    try {
        const trimmed = rawText.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            return JSON.parse(trimmed);
        }
        const fenceMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i);
        if (fenceMatch) {
            return JSON.parse(fenceMatch[1].trim());
        }
        const bracesMatch = trimmed.match(/(\{[\s\S]+\})/);
        if (bracesMatch) {
            return JSON.parse(bracesMatch[1]);
        }
        const arrayMatch = trimmed.match(/(\[[\s\S]+\])/);
        if (arrayMatch) {
            return JSON.parse(arrayMatch[1]);
        }
    } catch (err) {
        console.error('Failed to parse Perplexity response as JSON:', err.message);
    }
    return null;
}

/**
 * Normalize raw Perplexity job data into internal format.
 */
function normalizePerplexityJobs(rawJobs = [], defaults = {}) {
    if (!Array.isArray(rawJobs)) {
        rawJobs = rawJobs.jobs || rawJobs.results || [];
    }
    if (!Array.isArray(rawJobs)) return [];

    return rawJobs
        .filter(job => job && job.title && job.company && job.url && /^https?:\/\//.test(job.url))
        .map((job, idx) => ({
            id: job.id || `perplexity_${Date.now()}_${idx}`,
            title: job.title.trim(),
            company: job.company.trim(),
            location: job.location || defaults.location || 'Remote',
            salary: job.salary || 'Not specified',
            job_type: job.job_type || job.type || 'Contract',
            work_mode: job.work_mode || (job.remote ? 'Remote' : 'On-site'),
            description: job.description || '',
            url: job.url,
            source: job.source || 'Perplexity (Live Search)',
            posted_date: job.posted_date || job.date || new Date().toISOString(),
            is_live_search: true,
            match_score: job.match_score || 82,
            is_genuine: true,
            remote: job.remote ?? /remote/i.test(job.location || '')
        }));
}

/**
 * Use Perplexity API to fetch latest job postings.
 */
async function fetchJobsFromPerplexity({ query, location, limit = 10, aiContext = {}, preferGoogle = false }) {
    if (!PERPLEXITY_API_KEY) {
        console.log('⚠️ PERPLEXITY_API_KEY not configured. Skipping Perplexity search.');
        return [];
    }

    try {
        console.log(`🤝 Fetching jobs from Perplexity for "${query}" in "${location}"`);
        const salaryHint = aiContext?.salaryRange
            ? `Prioritize roles paying between ${aiContext.salaryRange.min || '$70/hr'} and ${aiContext.salaryRange.max || 'upper range requested by user'}.`
            : 'Prioritize roles paying at least $70/hr or $140k annually.';

        const preferenceHint = [
            aiContext?.preferredLocations?.length ? `User prefers locations: ${aiContext.preferredLocations.join(', ')}.` : 'User is open to remote roles across the US.',
            aiContext?.workMode ? `Work mode preference: ${aiContext.workMode}.` : 'Remote or hybrid acceptable.',
            aiContext?.jobType ? `Job type preference: ${aiContext.jobType}.` : 'Contract/C2C preferred.'
        ].join(' ');

        const skillsHint = aiContext?.skills?.length
            ? `Top resume skills: ${aiContext.skills.slice(0, 8).join(', ')}.`
            : 'Skill focus: PeopleSoft, SAP, ERP, Azure, AI/ML, Python.';

        const systemPrompt = [
            'You are an enterprise sourcing analyst returning ONLY verified job listings.',
            'Every job must include a working link, company name, title, description snippet, compensation/rate info if available, job type, work mode, posted date (ISO or relative), and explicit source.',
            'Never fabricate or hallucinate information. If unsure, omit the job.',
            'Prefer Dice, LinkedIn, and Indeed first; if fewer than required jobs exist there, expand to other reputable job boards. Use company career pages via Google only when primary boards have <10 results.'
        ].join(' ');

        const sourcingChannel = preferGoogle
            ? 'Primary boards were exhausted. Use Google with queries like "site:careers.company.com {query}" to source fresh postings directly from company career pages. Only include results from official career portals.'
            : 'Stay within Dice, LinkedIn, and Indeed first. Only add other well-known boards if fewer than 10 qualifying jobs exist.';

        const userPrompt = [
            `Find currently open "${query}" roles located in "${location || 'United States'}" posted within the last ${preferGoogle ? '14' : '7'} days.`,
            preferenceHint,
            salaryHint,
            skillsHint,
            aiContext?.resumeSummary ? `Resume summary: ${aiContext.resumeSummary.substring(0, 800)}` : '',
            sourcingChannel,
            `Return JSON only with key "jobs": [{"title","company","location","salary","job_type","work_mode","description","url","source","posted_date","remote","key_requirements"}].`,
            `Deliver up to ${limit} best matches with no duplicates and ensure each link is unique.`
        ].filter(Boolean).join(' ');

        const response = await axios.post('https://api.perplexity.ai/chat/completions', {
            model: 'sonar-pro',
            temperature: 0.2,
            max_tokens: 800,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 25000
        });

        const rawContent = response.data?.choices?.[0]?.message?.content;
        const parsed = extractJsonPayload(rawContent);
        const normalized = normalizePerplexityJobs(parsed, { location });
        const limited = normalized.slice(0, limit);

        console.log(`✅ Perplexity returned ${limited.length} verified jobs`);
        return limited;
    } catch (error) {
        console.error('❌ Perplexity API error:', error.response?.data || error.message);
        return [];
    }
}

function dedupeJobs(jobs = []) {
    const seen = new Set();
    const deduped = [];
    for (const job of jobs) {
        const key = (job.url || job.job_apply_link || job.job_google_link || job.id || `${job.title}-${job.company}-${job.location}`).toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(job);
    }
    return deduped;
}

function formatJobBoardName(source = '') {
    if (!source) return 'Unknown';
    const normalized = source.toLowerCase();
    if (normalized.includes('dice')) return 'Dice';
    if (normalized.includes('linkedin')) return 'LinkedIn';
    if (normalized.includes('indeed')) return 'Indeed';
    if (normalized.includes('perplexity')) return 'Perplexity Research';
    if (normalized.includes('google')) return 'Google Careers';
    if (normalized.includes('jsearch')) return 'JSearch Aggregator';
    return source;
}

function deriveKeyRequirements(job = {}, fallbackSkills = []) {
    const text = `${job.description || ''} ${job.job_highlights?.Qualifications?.join(' ') || ''}`.toLowerCase();
    const skills = new Set();
    const keywords = fallbackSkills.length ? fallbackSkills : ['peoplesoft','sap','oracle','azure','python','ai','ml','erp','hcm','financials'];
    keywords.forEach(skill => {
        if (!skill) return;
        if (text.includes(skill.toLowerCase())) skills.add(skill);
    });
    return Array.from(skills).slice(0, 4);
}

function formatPostedLabel(dateInput) {
    if (!dateInput) return 'Recently posted';
    const parsed = new Date(dateInput);
    if (Number.isNaN(parsed.getTime())) {
        const text = (dateInput || '').toString().toLowerCase();
        if (text.includes('7') || text.includes('week')) return 'Last 7 days';
        if (text.includes('14')) return 'Last 2 weeks';
        return dateInput;
    }
    const diffDays = (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays <= 1) return 'Last 24 hours';
    if (diffDays <= 7) return 'Last 7 days';
    if (diffDays <= 14) return 'Last 2 weeks';
    return parsed.toISOString().split('T')[0];
}

function mapJobToOutput(job, options = {}) {
    const keyRequirements = job.key_requirements || deriveKeyRequirements(job, options?.skills || []);
    return {
        job_id: job.id || job.job_id || `${job.company}-${job.title}`.replace(/\s+/g, '-'),
        job_title: job.job_title || job.title || 'Opportunity',
        company: job.company || job.employer_name || 'Company Confidential',
        location: job.location || job.job_location || job.job_city || 'Remote',
        rate_salary: job.rate_salary || job.salary || job.job_salary || job.compensation || 'Market Rate',
        contract_type: job.contract_type || job.job_type || job.employment_type || 'Contract',
        posted: formatPostedLabel(job.posted_date || job.created_at),
        key_requirements: keyRequirements,
        job_board: formatJobBoardName(job.source),
        source_link: job.url || job.apply_url || job.job_apply_link || job.job_google_link || '#',
        is_remote: job.remote ?? /remote/i.test(`${job.location || ''} ${job.description || ''}`),
        original: job
    };
}

function enforceJobQuota(jobs = [], { limit = MAX_JOBS_PER_DAY, appliedLinks = new Set() } = {}) {
    const filtered = jobs.filter(job => {
        const url = job.url || job.apply_url || job.job_apply_link;
        if (!url) return true;
        return !appliedLinks.has(url);
    });
    const deduped = dedupeJobs(filtered);
    return deduped.slice(0, limit);
}

function getPSTHour() {
    try {
        return parseInt(new Intl.DateTimeFormat('en-US', {
            timeZone: PST_TIMEZONE,
            hour: '2-digit',
            hour12: false
        }).format(new Date()), 10);
    } catch {
        return null;
    }
}

async function fetchUserProfile(userId) {
    if (!supabase || !userId) return null;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id,user_id,created_at,current_title,skills,resume_summary,resume_headline,preferred_locations,salary_expectation,work_preferences,experience,job_type_preference')
            .eq('user_id', userId)
            .maybeSingle();
        if (error) throw error;
        return data;
    } catch (err) {
        console.log('⚠️ Unable to fetch user profile:', err.message);
        return null;
    }
}

async function fetchAppliedJobLinks(userId) {
    if (!supabase || !userId) return new Set();
    try {
        const { data, error } = await supabase
            .from('job_applications')
            .select('job_url, job_id')
            .eq('user_id', userId);
        if (error) throw error;
        const links = new Set();
        (data || []).forEach(row => {
            if (row.job_url) links.add(row.job_url);
            if (row.job_id) links.add(row.job_id);
        });
        return links;
    } catch (err) {
        console.log('⚠️ Unable to fetch applied jobs:', err.message);
        return new Set();
    }
}

function isInitialWindow(profile) {
    if (!profile?.created_at) return false;
    const created = new Date(profile.created_at);
    if (Number.isNaN(created.getTime())) return false;
    const hoursOld = (Date.now() - created.getTime()) / (1000 * 60 * 60);
    return hoursOld <= 24;
}

function buildAIContext(profile, searchParams) {
    const skills = Array.isArray(profile?.skills)
        ? profile.skills
        : typeof profile?.skills === 'string'
            ? profile.skills.split(',').map(s => s.trim()).filter(Boolean)
            : [];
    return {
        resumeSummary: profile?.resume_summary || profile?.resume_headline || '',
        skills,
        preferredLocations: profile?.preferred_locations || (searchParams.location ? [searchParams.location] : []),
        salaryRange: {
            min: searchParams.salary_min || profile?.salary_expectation,
            max: searchParams.salary_max || profile?.salary_expectation
        },
        workMode: searchParams.work_mode || profile?.work_preferences,
        jobType: searchParams.job_type || profile?.job_type_preference
    };
}

async function fetchDatabaseJobs({ keywords, lookbackDays, location, limit, appliedLinks, preferredBoards, skills }) {
    if (!supabase) return [];
    try {
        const lookbackDate = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
        let query = supabase
            .from('scraped_jobs')
            .select('*')
            .gte('posted_date', lookbackDate)
            .order('posted_date', { ascending: false });

        if (preferredBoards?.length) {
            query = query.in('source', preferredBoards);
        }

        const { data, error } = await query;
        if (error) throw error;

        if (!data?.length) {
            return [];
        }

        const keywordList = (keywords || '')
            .toLowerCase()
            .split(/\s+|,|\/|\band\b|\bor\b/gi)
            .map(k => k.trim())
            .filter(Boolean);

        const scored = data.map(job => {
            const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
            let matchCount = 0;
            keywordList.forEach(kw => {
                if (!kw) return;
                if (jobText.includes(kw)) matchCount += 1;
            });
            return { ...job, matchCount };
        }).filter(job => job.matchCount > 0);

        const filtered = scored.filter(job => {
            if (!location || location.toLowerCase() === 'remote') return true;
            return (job.location || '').toLowerCase().includes(location.toLowerCase());
        });

        return enforceJobQuota(
            filtered.sort((a, b) => b.matchCount - a.matchCount),
            { limit, appliedLinks }
        ).map(job => ({
            ...job,
            key_requirements: deriveKeyRequirements(job, skills)
        }));
    } catch (err) {
        console.log('⚠️ Database job fetch failed:', err.message);
        return [];
    }
}

// Use the Enhanced Smart Scraper for live searches
async function callEnhancedSmartScraper(query, location) {
    try {
        console.log(`🚀 Calling Enhanced Smart Scraper for: "${query}" in ${location}`);
        
        // Call the smart scraper with search mode
        const response = await axios.post('/.netlify/functions/smart-job-scraper?search=true', {
            query: query,
            location: location,
            jobType: 'all'
        }, {
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status === 200 && response.data?.success) {
            console.log(`✅ Enhanced Smart Scraper found ${response.data.jobs?.length || 0} jobs`);
            return response.data.jobs || [];
        } else {
            console.log('⚠️ Enhanced Smart Scraper returned no results');
            return [];
        }
        
    } catch (error) {
        console.error('❌ Enhanced Smart Scraper error:', error.message);
        return [];
    }
}

// Live search function using Enhanced Smart Scraper
async function performLiveSearch(searchParams, aiContext = {}) {
    const { query = 'software developer', location = 'remote', limit = 10 } = searchParams;
    let jobs = [];
    
    try {
        // First try Perplexity for live verified jobs
        const perplexityJobs = await fetchJobsFromPerplexity({ query, location, limit, aiContext });
        if (perplexityJobs.length > 0) {
            jobs = perplexityJobs;
            console.log(`✅ Using ${jobs.length} jobs from Perplexity live search`);
            return jobs;
        }

        // First try the Enhanced Smart Scraper
        const smartJobs = await callEnhancedSmartScraper(query, location);
        if (smartJobs.length > 0) {
            jobs = smartJobs.slice(0, limit).map(job => ({
                ...job,
                is_live_search: true,
                match_score: 85 // High score for smart scraper results
            }));
            
            console.log(`✅ Enhanced Smart Scraper provided ${jobs.length} jobs`);
            return jobs;
        }
        
        // Fallback to direct API calls if smart scraper is unavailable
        console.log('🔄 Falling back to direct API calls...');
        
        // JSearch API (if available)
        if (process.env.JSEARCH_API_KEY) {
            try {
                const jsearchResponse = await axios.get('https://jsearch.p.rapidapi.com/search', {
                    params: {
                        query: `${query} ${location}`,
                        page: '1',
                        num_pages: '1'
                    },
                    headers: {
                        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
                        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                    },
                    timeout: 8000
                });

                if (jsearchResponse.data?.data) {
                    for (const job of jsearchResponse.data.data.slice(0, limit)) {
                        jobs.push({
                            id: `jsearch_${Date.now()}_${Math.random()}`,
                            title: job.job_title || 'Software Developer',
                            company: job.employer_name || 'Company',
                            location: job.job_city ? `${job.job_city}, ${job.job_state || job.job_country}` : location,
                            salary: job.job_salary || 'Competitive',
                            job_type: job.job_employment_type || 'Full-time',
                            work_mode: job.job_is_remote ? 'Remote' : 'On-site',
                            description: job.job_description || job.job_highlights?.Qualifications?.join('; ') || 'Great opportunity',
                            url: job.job_apply_link || job.job_google_link || '#',
                            source: 'JSearch (Live Fallback)',
                            posted_date: job.job_posted_at_datetime_utc || new Date().toISOString(),
                            is_live_search: true,
                            match_score: 75
                        });
                    }
                }
            } catch (jsearchError) {
                console.log('JSearch API not available:', jsearchError.message);
            }
        }

        // Adzuna API fallback (if available and not enough jobs)
        if (jobs.length < limit && process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
            try {
                const adzunaResponse = await axios.get(`https://api.adzuna.com/v1/api/jobs/us/search/1`, {
                    params: {
                        app_id: process.env.ADZUNA_APP_ID,
                        app_key: process.env.ADZUNA_APP_KEY,
                        what: query,
                        where: location === 'remote' ? '' : location,
                        results_per_page: limit - jobs.length,
                        sort_by: 'date'
                    },
                    timeout: 8000
                });

                if (adzunaResponse.data?.results) {
                    for (const job of adzunaResponse.data.results) {
                        jobs.push({
                            id: `adzuna_${Date.now()}_${Math.random()}`,
                            title: job.title || 'Software Developer',
                            company: job.company?.display_name || 'Company',
                            location: `${job.location.area[3] || job.location.area[2] || job.location.area[1] || location}`,
                            salary: job.salary_min && job.salary_max ? 
                                `$${Math.round(job.salary_min/1000)}k - $${Math.round(job.salary_max/1000)}k` : 
                                'Competitive',
                            job_type: job.contract_type || 'Full-time',
                            work_mode: 'On-site',
                            description: job.description || 'Great opportunity in a growing company',
                            url: job.redirect_url || '#',
                            source: 'Adzuna (Live Fallback)',
                            posted_date: job.created || new Date().toISOString(),
                            is_live_search: true,
                            match_score: 70
                        });
                    }
                }
            } catch (adzunaError) {
                console.log('Adzuna API not available:', adzunaError.message);
            }
        }

        // If still empty, ask Perplexity to switch to Google/company career pages
        if (jobs.length === 0) {
            console.log('⚠️ Primary job boards empty. Switching Perplexity to Google/company career pages...');
            const googleJobs = await fetchJobsFromPerplexity({
                query,
                location,
                limit,
                aiContext,
                preferGoogle: true
            });
            if (googleJobs.length > 0) {
                jobs = googleJobs.map(job => ({
                    ...job,
                    source: job.source || 'Perplexity (Google Careers)'
                }));
            } else {
                console.log('❌ No genuine jobs found even after Google fallback.');
            }
        }

        return jobs;

    } catch (error) {
        console.error('Live search error:', error);
        // NO FAKE JOBS - Return empty array on error
        console.log('❌ Live search failed - only genuine jobs will be shown');
        return [];
    }
}

// Helper to determine if user wants C2C/contract jobs
function wantsC2C(jobTypes, keywords) {
    const c2cTerms = ['c2c', 'corp to corp', 'contract'];
    if (!jobTypes && !keywords) return false;
    const jt = (jobTypes || '').toLowerCase();
    const kw = (keywords || '').toLowerCase();
    return c2cTerms.some(term => jt.includes(term) || kw.includes(term));
}

// Enhanced robust job search
async function performRobustSearch(searchParams, aiContext = {}) {
    let { query = 'software developer', location = 'remote', limit = 10, job_types = '', keywords = '' } = searchParams;
    let jobs = [];
    let attempts = [];
    // If user wants C2C, always append contract terms
    if (wantsC2C(job_types, query)) {
        query += ' c2c "Corp to Corp" contract';
    }
    // Try full query first
    attempts.push(query);
    // If query has commas, try each keyword separately
    if (query.includes(',')) {
        const keywordsArr = query.split(',').map(s => s.trim()).filter(Boolean);
        attempts.push(...keywordsArr.map(k => wantsC2C(job_types, k) ? k + ' c2c "Corp to Corp" contract' : k));
    }
    // Always try a very broad fallback
    attempts.push('SAP c2c contract');
    attempts.push('IT c2c contract');
    for (const attempt of attempts) {
        const found = await performLiveSearch({ query: attempt, location, limit, job_types }, aiContext);
        // Filter out full-time/permanent jobs if user wants C2C
        let filtered = found;
        if (wantsC2C(job_types, attempt)) {
            filtered = found.filter(job => {
                const jt = (job.job_type || job.type || '').toLowerCase();
                const desc = (job.description || '').toLowerCase();
                return jt.includes('contract') || jt.includes('c2c') || jt.includes('corp') || desc.includes('contract') || desc.includes('c2c') || desc.includes('corp to corp');
            });
        }
        if (filtered && filtered.length > 0) {
            console.log(`✅ Found jobs for query: ${attempt}`);
            return filtered;
        } else {
            console.log(`❌ No jobs found for query: ${attempt}`);
        }
    }
    // If still no jobs, return empty
    return [];
}

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Parse request body for POST requests
        let requestData = {};
        if (event.httpMethod === 'POST' && event.body) {
            try {
                requestData = JSON.parse(event.body);
            } catch (parseError) {
                console.error('Failed to parse request body:', parseError);
                throw new Error('Invalid request format');
            }
        }
        
        // Extract all search parameters with form-over-profile priority
        const userId = requestData.user_id || event.queryStringParameters?.user_id || 'anonymous';
        const keywords = requestData.position || requestData.keywords || requestData.query || 
                         event.queryStringParameters?.keywords || event.queryStringParameters?.query || 'software developer';
        const location = requestData.location || event.queryStringParameters?.location || 'remote';
        const visaStatus = requestData.visa_status || event.queryStringParameters?.visa_status || 'all';
        const salaryType = requestData.salary_type || event.queryStringParameters?.salary_type || 'yearly';
        const salaryMin = parseInt(requestData.salary_min || event.queryStringParameters?.salary_min || '0');
        const salaryMax = parseInt(requestData.salary_max || event.queryStringParameters?.salary_max || '200000');
        const experienceLevel = requestData.experience_level || event.queryStringParameters?.experience_level || 'all';
        const jobTypes = requestData.job_type || requestData.job_types || event.queryStringParameters?.job_types || 'all';
        const workModes = requestData.work_mode || requestData.work_modes || event.queryStringParameters?.work_modes || 'all';
        const skills = requestData.skills || event.queryStringParameters?.skills || '';
        const searchPriority = requestData.search_priority || event.queryStringParameters?.search_priority || 'form_over_profile';
        const forceRefresh = (requestData.force_refresh || event.queryStringParameters?.force_refresh) === 'true';

        console.log(`🔍 Smart job search with FORM PRIORITY for user: ${userId}`);
        console.log(`📝 Search Parameters:`, {
            keywords,
            location,
            visa_status: visaStatus,
            salary_range: `${salaryMin}-${salaryMax} (${salaryType})`,
            experience_level: experienceLevel,
            job_types: jobTypes,
            work_modes: workModes,
            skills: skills ? skills.substring(0, 50) + '...' : 'none',
            search_priority: searchPriority
        });

        // Profile + context
        const profile = await fetchUserProfile(userId);
        const aiContext = buildAIContext(profile, {
            location,
            salary_min: salaryMin,
            salary_max: salaryMax,
            work_mode: workModes,
            job_type: jobTypes
        });
        const appliedLinks = await fetchAppliedJobLinks(userId);
        const initialWindow = isInitialWindow(profile);
        const pstHour = getPSTHour();
        if (pstHour !== null) {
            console.log(`🕔 Current PST hour: ${pstHour}. Daily automation targets 17:00 PST.`);
        }

        let jobs = [];
        let source = initialWindow ? 'initial_two_week_sweep' : 'daily_refresh';

        // STEP 1: pull from internal database with appropriate lookback
        const dbJobs = await fetchDatabaseJobs({
            keywords,
            lookbackDays: initialWindow ? INITIAL_LOOKBACK_DAYS : DAILY_LOOKBACK_HOURS / 24,
            location,
            limit: MAX_JOBS_PER_DAY,
            appliedLinks,
            preferredBoards: PRIMARY_JOB_BOARDS,
            skills: aiContext.skills
        });
        jobs.push(...dbJobs);

        // STEP 2: If fewer than quota, expand to other boards + live sourcing
        if (jobs.length < MAX_JOBS_PER_DAY || forceRefresh) {
            console.log('🔄 Expanding search to live job boards via scrapers/Perplexity');
            const liveJobs = await performRobustSearch({ 
                query: keywords, 
                location, 
                limit: MAX_JOBS_PER_DAY,
                visa_status: visaStatus,
                salary_min: salaryMin,
                salary_max: salaryMax,
                experience_level: experienceLevel,
                job_types: jobTypes,
                work_modes: workModes
            }, aiContext);
            jobs.push(...liveJobs);
            source = liveJobs.length > 0 ? 'live_search' : source;
        }

        // STEP 3: If still under quota, use secondary boards from DB
        if (jobs.length < MAX_JOBS_PER_DAY) {
            const secondaryDbJobs = await fetchDatabaseJobs({
                keywords,
                lookbackDays: initialWindow ? INITIAL_LOOKBACK_DAYS : DAILY_LOOKBACK_HOURS / 24,
                location,
                limit: MAX_JOBS_PER_DAY,
                appliedLinks,
                preferredBoards: SECONDARY_JOB_BOARDS,
                skills: aiContext.skills
            });
            jobs.push(...secondaryDbJobs);
        }

        // STEP 4: Enforce quota/dedup and map to desired format
        jobs = enforceJobQuota(jobs, { limit: MAX_JOBS_PER_DAY, appliedLinks });
        const formattedJobs = jobs.map(job => mapJobToOutput(job, { skills: aiContext.skills }));

        const response = {
            success: true,
            jobs: formattedJobs,
            count: formattedJobs.length,
            source: source,
            search_params: { 
                keywords, 
                location, 
                user_id: userId,
                visa_status: visaStatus,
                salary_range: `${salaryMin}-${salaryMax} (${salaryType})`,
                experience_level: experienceLevel,
                job_types: jobTypes,
                work_modes: workModes,
                search_priority: searchPriority
            },
            summary: {
                daily_quota: MAX_JOBS_PER_DAY,
                delivered: formattedJobs.length,
                initial_window: initialWindow,
                job_boards_used: Array.from(new Set(formattedJobs.map(job => job.job_board))),
                remote_jobs: formattedJobs.filter(j => j.is_remote).length,
                pst_hour_executed: pstHour
            },
            message: formattedJobs.length === 0
                ? `No genuine jobs found right now. Automated sourcing will continue hourly and perform the prioritized 5 PM PST sweep.`
                : initialWindow
                ? `Found ${formattedJobs.length} best matches from the past 14 days across Dice, LinkedIn, and Indeed.`
                : `Delivered ${formattedJobs.length} fresh daily postings prioritized for the current profile.`,
            next_steps: formattedJobs.length < MAX_JOBS_PER_DAY
                ? 'Monitoring additional boards and company career pages to fill the remaining quota.'
                : 'Quota reached. Next daily sweep scheduled for 5 PM PST.'
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('❌ Error in smart job search:', error);
        
        // NO FAKE JOBS - Return proper no results message
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                jobs: [],
                count: 0,
                source: 'error_recovery',
                no_results: true,
                message: 'We could not find any genuine jobs right now. Our AI system is continuously searching for real opportunities and will notify you when perfect matches are found.',
                summary: {
                    background_jobs: 0,
                    live_jobs: 0,
                    c2c_jobs: 0,
                    sample_jobs: 0,
                    fallback_jobs: 0,
                    average_match_score: 0,
                    specialization: 'Continuous Search Active'
                },
                next_steps: 'Our continuous search system is now active. Check back later for genuine job opportunities.'
            })
        };
    }
}; 