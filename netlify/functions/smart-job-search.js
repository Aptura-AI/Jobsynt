const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

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

        // If still no jobs, provide some default examples
        if (jobs.length === 0) {
            jobs.push(
                {
                    id: `default_${Date.now()}_1`,
                    title: 'Software Developer',
                    company: 'Tech Company',
                    location: location || 'Remote',
                    salary: '$70k - $120k',
                    job_type: 'Full-time',
                    work_mode: 'Remote',
                    description: 'We are looking for a talented software developer to join our growing team. You will work on exciting projects using modern technologies.',
                    url: '#',
                    source: 'Live Search (Sample)',
                    posted_date: new Date().toISOString(),
                    is_live_search: true,
                    is_sample: true,
                    match_score: 65
                },
                {
                    id: `default_${Date.now()}_2`,
                    title: 'Frontend Developer',
                    company: 'Startup Inc',
                    location: location || 'Remote',
                    salary: '$60k - $100k',
                    job_type: 'Full-time',
                    work_mode: 'Hybrid',
                    description: 'Join our dynamic team as a frontend developer. Work with React, TypeScript, and modern web technologies.',
                    url: '#',
                    source: 'Live Search (Sample)',
                    posted_date: new Date().toISOString(),
                    is_live_search: true,
                    is_sample: true,
                    match_score: 70
                }
            );
        }

        return jobs;

    } catch (error) {
        console.error('Live search error:', error);
        // Return sample jobs on error
        return [
            {
                id: `fallback_${Date.now()}`,
                title: 'Software Developer',
                company: 'Growing Company',
                location: location || 'Remote',
                salary: 'Competitive',
                job_type: 'Full-time',
                work_mode: 'Remote',
                description: 'Exciting opportunity for a software developer. Our background system is continuously finding more opportunities for you.',
                url: '#',
                source: 'Fallback Search',
                posted_date: new Date().toISOString(),
                is_live_search: true,
                is_fallback: true,
                match_score: 60
            }
        ];
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

        // STEP 2: If no background jobs found, perform live search
        if (jobs.length === 0 || forceRefresh) {
            console.log('🔴 No background jobs found, performing live search...');
            const liveJobs = await performLiveSearch({ query, location, limit: 15 });
            jobs = liveJobs;
            source = 'live_search';
            console.log(`✅ Found ${jobs.length} jobs from live search`);
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
                sample_jobs: jobs.filter(j => j.is_sample).length,
                average_match_score: jobs.length > 0 
                    ? Math.round(jobs.reduce((sum, job) => sum + (job.match_score || 0), 0) / jobs.length)
                    : 0
            },
            message: source === 'background_database' 
                ? `Found ${jobs.length} pre-analyzed genuine jobs from your personalized database`
                : source === 'live_search'
                ? `Performed live search and found ${jobs.length} jobs. Our background system is continuously building your personalized job database.`
                : `Found ${jobs.length} jobs using hybrid search (background + live). Your personalized database is growing!`,
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
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Search temporarily unavailable',
                message: 'Our job search system is working to find opportunities for you. Please try again in a moment.'
            })
        };
    }
}; 