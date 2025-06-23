const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase with cleaned environment variables
const cleanSupabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[';]/g, '');
const cleanSupabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/[';]/g, '');

const supabase = cleanSupabaseUrl && cleanSupabaseKey ? 
    createClient(cleanSupabaseUrl, cleanSupabaseKey) : 
    null;

// IT and C2C related keywords for auto-detection
const IT_KEYWORDS = [
    'software developer', 'java', 'python', 'javascript', 'react', 'angular', 'vue',
    'node.js', 'php', 'c#', '.net', 'sql', 'database', 'aws', 'azure', 'cloud',
    'devops', 'kubernetes', 'docker', 'microservices', 'api', 'backend', 'frontend',
    'full stack', 'data engineer', 'data scientist', 'machine learning', 'ai',
    'cybersecurity', 'network', 'system admin', 'sap', 'salesforce', 'servicenow',
    'tableau', 'power bi', 'scrum master', 'product owner', 'qa', 'testing',
    'automation', 'ci/cd', 'jenkins', 'git', 'agile', 'mobile developer',
    'ios', 'android', 'flutter', 'react native', 'blockchain', 'ethereum'
];

const C2C_KEYWORDS = [
    'c2c', 'corp to corp', 'corp-to-corp', 'contract', 'contractor', 'consulting',
    'vendor', 'w2', '1099', 'freelance', 'independent contractor'
];

// Check if search query matches IT C2C criteria
function shouldUseC2CScraper(query, jobType) {
    const queryLower = query.toLowerCase();
    const hasITKeyword = IT_KEYWORDS.some(keyword => queryLower.includes(keyword));
    const hasC2CKeyword = C2C_KEYWORDS.some(keyword => queryLower.includes(keyword));
    const isContractType = jobType && (jobType.toLowerCase().includes('contract') || jobType.toLowerCase().includes('c2c'));
    
    return hasITKeyword && (hasC2CKeyword || isContractType);
}

// Get all user profiles from Supabase
async function getAllUserProfiles() {
    try {
        // Clean environment variables (remove quotes and semicolons)
        const supabaseUrl = process.env.SUPABASE_URL?.replace(/[';]/g, '');
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/[';]/g, '');
        
        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing Supabase credentials');
            return [];
        }
        
        const cleanSupabase = createClient(supabaseUrl, supabaseKey);
        
        const { data: profiles, error } = await cleanSupabase
            .from('profiles')
            .select('*')
            .or('current_title.not.is.null,skills.not.is.null');
        
        if (error) {
            console.error('Error fetching profiles:', error);
            return [];
        }
        
        console.log(`📊 Found ${profiles?.length || 0} profiles with job info`);
        return profiles || [];
    } catch (error) {
        console.error('Error in getAllUserProfiles:', error);
        return [];
    }
}

// Save job to Supabase
async function saveJobToSupabase(job) {
    try {
        // Clean environment variables (remove quotes and semicolons)
        const supabaseUrl = process.env.SUPABASE_URL?.replace(/[';]/g, '');
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.replace(/[';]/g, '');
        
        if (!supabaseUrl || !supabaseKey) {
            console.error('Missing Supabase credentials for saving job');
            return false;
        }
        
        const cleanSupabase = createClient(supabaseUrl, supabaseKey);
        
        const { data, error } = await cleanSupabase
            .from('scraped_jobs')
            .upsert([job], { onConflict: 'id' });
        
        if (error) {
            console.error('Error saving job:', error);
            return false;
        }
        
        return true;
    } catch (error) {
        console.error('Error in saveJobToSupabase:', error);
        return false;
    }
}

// Real API job scraper for IT C2C roles
async function scrapeRealITC2CJobs(query, location = 'remote') {
    console.log(`🚀 Starting REAL IT C2C scraper for: "${query}" in ${location}`);
    
    const allJobs = [];
    
    try {
        // Try JSearch API first (if available)
        if (process.env.JSEARCH_API_KEY) {
            try {
                const jsearchResponse = await axios.get('https://jsearch.p.rapidapi.com/search', {
                    params: {
                        query: `${query} software developer engineer`,
                        page: 1,
                        num_pages: 3,
                        date_posted: 'week',
                        employment_types: 'FULLTIME,CONTRACTOR,PARTTIME',
                        remote_jobs_only: location.toLowerCase() === 'remote'
                    },
                    headers: {
                        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
                        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                    }
                });

                if (jsearchResponse.data && jsearchResponse.data.data) {
                    const jobs = jsearchResponse.data.data
                        .filter(job => {
                            const title = job.job_title?.toLowerCase() || '';
                            const desc = job.job_description?.toLowerCase() || '';
                            const hasC2CKeyword = C2C_KEYWORDS.some(keyword => 
                                title.includes(keyword) || desc.includes(keyword)
                            );
                            // Find contract jobs for ALL profiles (no IT keyword restriction)
                            return hasC2CKeyword || job.job_employment_type === 'CONTRACTOR';
                        })
                        .map(job => ({
                            id: `real_jsearch_${job.job_id}`,
                            title: job.job_title,
                            company: job.employer_name,
                            location: job.job_city && job.job_state ? 
                                `${job.job_city}, ${job.job_state}` : 
                                (job.job_country || location),
                            salary: job.job_salary || 'Competitive',
                            job_type: job.job_employment_type || 'Full-time',
                            work_mode: job.job_is_remote ? 'Remote' : 'On-site',
                            description: job.job_description,
                            url: job.job_apply_link,
                            source: 'JSearch API (Real Jobs)',
                            posted_date: job.job_posted_at_datetime_utc || new Date().toISOString(),
                            is_c2c: job.job_employment_type === 'CONTRACTOR',
                            scraped_at: new Date().toISOString(),
                            is_real: true
                        }));
                    
                    allJobs.push(...jobs);
                    console.log(`✅ JSearch API: Found ${jobs.length} real IT jobs`);
                }
            } catch (error) {
                console.error('JSearch API error:', error.message);
            }
        }

        // Try Adzuna API (if available)
        if (process.env.ADZUNA_API_KEY && process.env.ADZUNA_APP_ID) {
            try {
                const adzunaResponse = await axios.get(`https://api.adzuna.com/v1/api/jobs/us/search/1`, {
                    params: {
                        app_id: process.env.ADZUNA_APP_ID,
                        app_key: process.env.ADZUNA_API_KEY,
                        what: `${query} contract C2C`,
                        where: location,
                        results_per_page: 20,
                        max_days_old: 7,
                        sort_by: 'date'
                    }
                });

                if (adzunaResponse.data && adzunaResponse.data.results) {
                    const jobs = adzunaResponse.data.results
                        .filter(job => {
                            const title = job.title?.toLowerCase() || '';
                            const desc = job.description?.toLowerCase() || '';
                            const hasC2CKeyword = C2C_KEYWORDS.some(keyword => 
                                title.includes(keyword) || desc.includes(keyword)
                            );
                            // Find contract jobs for ALL profiles (no IT keyword restriction)
                            return hasC2CKeyword;
                        })
                        .map(job => ({
                            id: `real_adzuna_${job.id}`,
                            title: job.title,
                            company: job.company.display_name,
                            location: job.location.display_name,
                            salary: job.salary_min && job.salary_max ? 
                                `$${job.salary_min.toLocaleString()}-${job.salary_max.toLocaleString()}` : 
                                'Competitive',
                            job_type: 'Contract (C2C)',
                            work_mode: job.location.display_name.toLowerCase().includes('remote') ? 'Remote' : 'On-site',
                            description: job.description,
                            url: job.redirect_url,
                            source: 'Adzuna API (Real Jobs)',
                            posted_date: job.created,
                            is_c2c: true,
                            scraped_at: new Date().toISOString(),
                            is_real: true
                        }));
                    
                    allJobs.push(...jobs);
                    console.log(`✅ Adzuna API: Found ${jobs.length} real IT C2C jobs`);
                }
            } catch (error) {
                console.error('Adzuna API error:', error.message);
            }
        }

        // If no API keys available, try simple job search fallback
        if (allJobs.length === 0) {
            console.log('⚠️ No API keys configured, trying simple job search...');
            
            try {
                // Use simple job search as fallback
                const fallbackResponse = await fetch('/.netlify/functions/simple-job-search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `${query} contract C2C`,
                        location: location,
                        job_type: 'contract'
                    })
                });
                
                if (fallbackResponse.ok) {
                    const fallbackData = await fallbackResponse.json();
                    if (fallbackData.jobs && fallbackData.jobs.length > 0) {
                        // Filter for IT C2C jobs
                        const filteredJobs = fallbackData.jobs
                            .filter(job => {
                                const title = job.title?.toLowerCase() || '';
                                const desc = job.description?.toLowerCase() || '';
                                const hasITKeyword = IT_KEYWORDS.some(keyword => title.includes(keyword) || desc.includes(keyword));
                                const hasC2CKeyword = C2C_KEYWORDS.some(keyword => title.includes(keyword) || desc.includes(keyword));
                                return hasITKeyword && hasC2CKeyword;
                            })
                            .map(job => ({
                                ...job,
                                id: `fallback_${job.id}`,
                                job_type: 'Contract (C2C)',
                                is_c2c: true,
                                source: 'Simple Job Search (Fallback)',
                                scraped_at: new Date().toISOString(),
                                is_real: true
                            }));
                        
                        allJobs.push(...filteredJobs);
                        console.log(`✅ Fallback search: Found ${filteredJobs.length} IT C2C jobs`);
                    }
                }
            } catch (error) {
                console.error('Fallback search error:', error.message);
            }
        }
        
        // If still no jobs, return empty with message
        if (allJobs.length === 0) {
            console.log('⚠️ No jobs found from any source');
            return {
                success: true,
                jobs: [],
                count: 0,
                message: 'No IT C2C jobs found at this time. Add JSEARCH_API_KEY or ADZUNA_API_KEY for better results.',
                note: 'Scraper is running every 30 minutes - jobs will appear when found'
            };
        }

        // Remove duplicates based on similar titles and companies
        const uniqueJobs = [];
        for (const job of allJobs) {
            const isDuplicate = uniqueJobs.some(existing => 
                existing.title.toLowerCase() === job.title.toLowerCase() && 
                existing.company.toLowerCase() === job.company.toLowerCase()
            );
            if (!isDuplicate) {
                uniqueJobs.push(job);
            }
        }

        console.log(`✅ IT C2C Real Scraper completed: ${uniqueJobs.length} unique jobs found`);
        
        return {
            success: true,
            jobs: uniqueJobs,
            count: uniqueJobs.length,
            sources: ['JSearch API', 'Adzuna API'],
            message: `Found ${uniqueJobs.length} real IT C2C contract opportunities`,
            is_real: true
        };
        
    } catch (error) {
        console.error('Real IT C2C scraper error:', error);
        return {
            success: false,
            error: error.message,
            jobs: [],
            message: 'Unable to fetch real jobs at this time. Please try again later.'
        };
    }
}

// Continuous scraping function for all profiles - finds contract jobs for EVERYONE
async function runContinuousC2CScraping() {
    console.log('🔄 Starting continuous contract job scraping for ALL profiles...');
    
    try {
        const profiles = await getAllUserProfiles();
        
        if (profiles.length === 0) {
            console.log('No user profiles found for scraping');
            return { success: true, message: 'No profiles to scrape' };
        }

        let totalJobsFound = 0;
        let totalJobsSaved = 0;

        for (const profile of profiles) {
            const { current_title, skills, city, state, country, contract_types, id: profile_id, email } = profile;
            
            // Create search query from current_title and skills
            const searchTerms = [];
            if (current_title) searchTerms.push(current_title);
            if (skills) searchTerms.push(skills);
            
            const searchQuery = searchTerms.join(' ').toLowerCase();
            if (!searchQuery) {
                console.log(`⏭️ Skipping ${email}: No search terms (missing current_title and skills)`);
                continue;
            }

            // REMOVED IT ROLE CHECK - NOW SCRAPES ALL PROFILES
            // REMOVED C2C CHECK - NOW FINDS ALL JOB TYPES
            
            console.log(`🎯 Scraping for ${email}: "${current_title}" + "${skills}"`);
            
            // Create location string
            const location = city && state ? `${city}, ${state}` : 
                           state ? state : 
                           country || 'remote';
            
            const result = await scrapeRealITC2CJobs(
                searchQuery, 
                location
            );

            if (result.success && result.jobs.length > 0) {
                totalJobsFound += result.jobs.length;

                // Save each job to Supabase
                for (const job of result.jobs) {
                    const jobWithProfile = {
                        ...job,
                        profile_id,
                        target_role: current_title,
                        matched_at: new Date().toISOString()
                    };

                    const saved = await saveJobToSupabase(jobWithProfile);
                    if (saved) {
                        totalJobsSaved++;
                    }
                }
            }

            // Add delay between profiles to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(`✅ Continuous scraping completed: ${totalJobsFound} jobs found, ${totalJobsSaved} saved`);
        
        return {
            success: true,
            profiles_processed: profiles.length,
            total_jobs_found: totalJobsFound,
            total_jobs_saved: totalJobsSaved,
            message: `Processed ${profiles.length} profiles, found ${totalJobsFound} IT C2C jobs`
        };

    } catch (error) {
        console.error('Continuous scraping error:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Netlify function handler
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
        const query = event.queryStringParameters?.query || 'software developer';
        const location = event.queryStringParameters?.location || 'remote';
        const jobType = event.queryStringParameters?.job_type || '';
        const continuous = event.queryStringParameters?.continuous === 'true';
        const forceRun = event.queryStringParameters?.force === 'true';
        
        // If continuous scraping is requested
        if (continuous) {
            console.log('🔄 Continuous IT C2C scraping requested');
            const result = await runContinuousC2CScraping();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify(result)
            };
        }
        
        // Check if this should trigger C2C scraping
        if (!forceRun && !shouldUseC2CScraper(query, jobType)) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Query does not match IT C2C criteria',
                    criteria_met: false,
                    suggestion: 'Use keywords like: C2C, contract, corp-to-corp + IT skills (Java, Python, AWS, etc.)',
                    it_keywords: IT_KEYWORDS.slice(0, 10),
                    c2c_keywords: C2C_KEYWORDS.slice(0, 5)
                })
            };
        }
        
        console.log(`🎯 IT C2C Scraper activated for: "${query}"`);
        
        const result = await scrapeRealITC2CJobs(query, location);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };
        
    } catch (error) {
        console.error('IT C2C scraper handler error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'IT C2C scraper temporarily unavailable',
                message: 'Please try again in a moment'
            })
        };
    }
};

// Export functions for use in other modules
module.exports = {
    scrapeRealITC2CJobs,
    shouldUseC2CScraper,
    runContinuousC2CScraping
};
