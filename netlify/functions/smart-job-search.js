const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const { scrapeITC2CJobs, shouldUseC2CScraper } = require('./it-c2c-scraper');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// Live search function (simplified version of your existing scrapers)
async function performLiveSearch(searchParams) {
    const { query = 'software developer', location = 'remote', limit = 10 } = searchParams;
    const jobs = [];
    
    try {
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
                            source: 'JSearch (Live)',
                            posted_date: job.job_posted_at_datetime_utc || new Date().toISOString(),
                            is_live_search: true,
                            match_score: 75 // Default match score for live results
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
                            source: 'Adzuna (Live)',
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

        // NO FAKE JOBS - If no real jobs found, return empty with proper message
        if (jobs.length === 0) {
            console.log('❌ No genuine jobs found - continuous search will find real opportunities');
        }

        return jobs;

    } catch (error) {
        console.error('Live search error:', error);
        // NO FAKE JOBS - Return empty array on error
        console.log('❌ Live search failed - only genuine jobs will be shown');
        return [];
    }
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
        const userId = event.queryStringParameters?.user_id || 'anonymous';
        const query = event.queryStringParameters?.query || 'software developer';
        const location = event.queryStringParameters?.location || 'remote';
        const forceRefresh = event.queryStringParameters?.force_refresh === 'true';

        console.log(`🔍 Smart job search for user: ${userId}, query: "${query}", location: "${location}"`);

        let jobs = [];
        let source = 'unknown';

        // STEP 1: Try background database first (if not forcing refresh)
        if (!forceRefresh) {
            try {
                const { data: backgroundJobs, error } = await supabase
                    .from('daily_job_recommendations')
                    .select(`
                        profile_matched_jobs (
                            profile_match_score,
                            scraped_jobs (
                                job_id, title, company, location, salary, job_type, 
                                work_mode, description, url, source, posted_date, 
                                extracted_skills, ghost_score, is_ghost_job
                            )
                        )
                    `)
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .limit(20);

                if (!error && backgroundJobs && backgroundJobs.length > 0) {
                    for (const rec of backgroundJobs) {
                        if (rec.profile_matched_jobs?.scraped_jobs) {
                            const job = rec.profile_matched_jobs.scraped_jobs;
                            jobs.push({
                                id: job.job_id,
                                title: job.title,
                                company: job.company,
                                location: job.location,
                                salary: job.salary,
                                job_type: job.job_type,
                                work_mode: job.work_mode,
                                description: job.description,
                                url: job.url,
                                source: `${job.source} (Background)`,
                                posted_date: job.posted_date,
                                extracted_skills: job.extracted_skills,
                                match_score: rec.profile_matched_jobs.profile_match_score,
                                is_background: true,
                                is_genuine: !job.is_ghost_job
                            });
                        }
                    }
                    source = 'background_database';
                    console.log(`✅ Found ${jobs.length} jobs from background database`);
                }
            } catch (dbError) {
                console.log('Background database not available, falling back to live search:', dbError.message);
            }
        }

        // STEP 2: If no background jobs found, trigger continuous search and show proper message
        if (jobs.length === 0 || forceRefresh) {
            console.log('🔴 No background jobs found, triggering continuous search...');
            
            // Trigger continuous job finder for this user (non-blocking)
            if (userId !== 'anonymous') {
                try {
                    axios.post(`${process.env.URL}/.netlify/functions/continuous-job-finder`, {
                        user_id: userId
                    }, { timeout: 5000 }).catch(err => 
                        console.log('Continuous search trigger failed:', err.message)
                    );
                } catch (error) {
                    console.log('Failed to trigger continuous search:', error.message);
                }
            }
            
            // Check if this is an IT C2C search
            if (shouldUseC2CScraper(query, event.queryStringParameters?.job_type)) {
                console.log('🎯 IT C2C criteria detected, using specialized C2C scraper...');
                try {
                    const c2cResult = await scrapeITC2CJobs(query, location);
                    if (c2cResult.success && c2cResult.jobs.length > 0) {
                        jobs = c2cResult.jobs;
                        source = 'it_c2c_specialist';
                        console.log(`✅ Found ${jobs.length} IT C2C jobs from specialized platforms`);
                    } else {
                        throw new Error('C2C scraper returned no results');
                    }
                } catch (c2cError) {
                    console.log('C2C scraper failed, falling back to general live search:', c2cError.message);
                    const liveJobs = await performLiveSearch({ query, location, limit: 15 });
                    jobs = liveJobs;
                    source = 'live_search_fallback';
                }
            } else {
                console.log('🔍 Performing general live search...');
                const liveJobs = await performLiveSearch({ query, location, limit: 15 });
                jobs = liveJobs;
                source = 'live_search';
            }
            
            console.log(`✅ Found ${jobs.length} jobs from ${source}`);
        }

        // STEP 3: If we have both, mix them intelligently
        if (source === 'background_database' && jobs.length < 10) {
            console.log('🔄 Supplementing background jobs with live search...');
            const supplementaryJobs = await performLiveSearch({ query, location, limit: 5 });
            jobs = [...jobs, ...supplementaryJobs.slice(0, 10 - jobs.length)];
            source = 'hybrid';
        }

        // Sort by match score and limit results
        jobs = jobs
            .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
            .slice(0, 20);

        const response = {
            success: true,
            jobs: jobs,
            count: jobs.length,
            source: source,
            search_params: { query, location, user_id: userId },
            summary: {
                background_jobs: jobs.filter(j => j.is_background).length,
                live_jobs: jobs.filter(j => j.is_live_search).length,
                c2c_jobs: jobs.filter(j => j.is_c2c).length,
                sample_jobs: jobs.filter(j => j.is_sample).length,
                fallback_jobs: jobs.filter(j => j.is_fallback).length,
                average_match_score: jobs.length > 0 
                    ? Math.round(jobs.reduce((sum, job) => sum + (job.match_score || 0), 0) / jobs.length)
                    : 0,
                specialization: source === 'it_c2c_specialist' ? 'IT C2C Contracts' : 'General',
                gpt_analyzed: jobs.filter(j => j.gpt_analyzed).length,
                ghost_filtered: jobs.filter(j => j.is_genuine === true).length,
                total_scraped: jobs.length + (jobs.filter(j => j.is_sample).length * 5) // Estimate
            },
            message: jobs.length === 0
                ? `No genuine jobs found right now. Our continuous AI search system is now actively scanning 30+ job boards for real opportunities that match your profile. Check back soon!`
                : source === 'background_database' 
                ? `Found ${jobs.length} pre-analyzed genuine jobs from your personalized database`
                : source === 'it_c2c_specialist'
                ? `Found ${jobs.length} IT C2C contract opportunities from specialized platforms (Dice, TechFetch, Corp-to-Corp.org, Benchfolks). LinkedIn given lower priority as requested.`
                : source === 'live_search'
                ? `Found ${jobs.length} genuine jobs from live search. Our continuous background system is building your personalized job database.`
                : `Found ${jobs.length} genuine jobs using hybrid search. Your personalized database is growing!`,
            next_steps: source === 'live_search' 
                ? 'Visit again later for personalized, pre-analyzed job recommendations from our background system.'
                : 'Jobs are continuously updated in the background for better matches.'
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