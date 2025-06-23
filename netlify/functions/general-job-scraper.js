const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase with cleaned environment variables
const cleanSupabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/[';]/g, '');
const cleanSupabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/[';]/g, '');

const supabase = cleanSupabaseUrl && cleanSupabaseKey ? 
    createClient(cleanSupabaseUrl, cleanSupabaseKey) : 
    null;

// Non-IT job categories and keywords
const BUSINESS_KEYWORDS = [
    'business development', 'bdm', 'business development manager', 'sales manager',
    'account manager', 'account executive', 'sales representative', 'sales director',
    'marketing manager', 'marketing director', 'digital marketing', 'content marketing',
    'social media manager', 'brand manager', 'product manager', 'project manager',
    'operations manager', 'business analyst', 'consultant', 'client success',
    'customer success', 'relationship manager', 'territory manager', 'regional manager',
    'finance manager', 'financial analyst', 'hr manager', 'recruiter', 'talent acquisition',
    'administrative', 'executive assistant', 'office manager', 'coordinator'
];

const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'temporary', 'internship'];

// Check if profile matches non-IT criteria
function isNonITProfile(profile) {
    const currentTitle = (profile.current_title || '').toLowerCase();
    const targetRole = (profile.target_role || '').toLowerCase();
    const skills = (profile.skills || '').toLowerCase();
    
    const searchText = `${currentTitle} ${targetRole} ${skills}`;
    
    return BUSINESS_KEYWORDS.some(keyword => 
        searchText.includes(keyword.toLowerCase())
    );
}

// Get all non-IT user profiles
async function getNonITProfiles() {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
            return [];
        }
        
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('*')
            .or('current_title.not.is.null,target_role.not.is.null,skills.not.is.null');
        
        if (error) {
            console.error('Error fetching profiles:', error);
            return [];
        }
        
        // Filter for non-IT profiles
        const nonITProfiles = (profiles || []).filter(profile => isNonITProfile(profile));
        
        console.log(`📊 Found ${nonITProfiles.length} non-IT profiles out of ${profiles?.length || 0} total`);
        return nonITProfiles;
    } catch (error) {
        console.error('Error in getNonITProfiles:', error);
        return [];
    }
}

// Save job to Supabase
async function saveJobToSupabase(job) {
    try {
        if (!supabase) {
            console.error('Supabase not initialized');
            return false;
        }
        
        const { data, error } = await supabase
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

// Scrape jobs using available APIs
async function scrapeGeneralJobs(query, location = 'remote', employmentType = 'full-time') {
    console.log(`🚀 Starting general job scraper for: "${query}" in ${location}`);
    
    const allJobs = [];
    
    try {
        // Try JSearch API (if available)
        if (process.env.JSEARCH_API_KEY) {
            try {
                console.log('🔍 Searching JSearch API...');
                const jsearchResponse = await axios.get('https://jsearch.p.rapidapi.com/search', {
                    params: {
                        query: query,
                        page: 1,
                        num_pages: 2,
                        date_posted: 'week',
                        employment_types: employmentType.toUpperCase().replace('-', ''),
                        remote_jobs_only: location.toLowerCase() === 'remote'
                    },
                    headers: {
                        'X-RapidAPI-Key': process.env.JSEARCH_API_KEY,
                        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                    },
                    timeout: 10000
                });

                if (jsearchResponse.data && jsearchResponse.data.data) {
                    const jobs = jsearchResponse.data.data
                        .filter(job => {
                            const title = job.job_title?.toLowerCase() || '';
                            const desc = job.job_description?.toLowerCase() || '';
                            const queryWords = query.toLowerCase().split(' ');
                            
                            // Check if job matches the search query
                            return queryWords.some(word => 
                                word.length > 2 && (title.includes(word) || desc.includes(word))
                            );
                        })
                        .slice(0, 15) // Limit to 15 jobs per API
                        .map(job => ({
                            id: `general_jsearch_${job.job_id}`,
                            title: job.job_title,
                            company: job.employer_name,
                            location: job.job_city && job.job_state ? 
                                `${job.job_city}, ${job.job_state}` : 
                                (job.job_country || location),
                            salary: job.job_salary || 'Competitive',
                            job_type: job.job_employment_type || employmentType,
                            work_mode: job.job_is_remote ? 'Remote' : 'On-site',
                            description: job.job_description?.substring(0, 1000) || 'No description available',
                            url: job.job_apply_link,
                            source: 'JSearch API',
                            posted_date: job.job_posted_at_datetime_utc || new Date().toISOString(),
                            is_c2c: false,
                            scraped_at: new Date().toISOString(),
                            is_real: true
                        }));
                    
                    allJobs.push(...jobs);
                    console.log(`✅ JSearch API: Found ${jobs.length} jobs`);
                }
            } catch (error) {
                console.error('JSearch API error:', error.message);
            }
        }

        // Try Adzuna API (if available)
        if (process.env.ADZUNA_API_KEY && process.env.ADZUNA_APP_ID) {
            try {
                console.log('🔍 Searching Adzuna API...');
                const adzunaResponse = await axios.get(`https://api.adzuna.com/v1/api/jobs/us/search/1`, {
                    params: {
                        app_id: process.env.ADZUNA_APP_ID,
                        app_key: process.env.ADZUNA_API_KEY,
                        what: query,
                        where: location,
                        results_per_page: 15,
                        max_days_old: 14,
                        sort_by: 'date'
                    },
                    timeout: 10000
                });

                if (adzunaResponse.data && adzunaResponse.data.results) {
                    const jobs = adzunaResponse.data.results
                        .slice(0, 15) // Limit to 15 jobs
                        .map(job => ({
                            id: `general_adzuna_${job.id}`,
                            title: job.title,
                            company: job.company.display_name,
                            location: job.location.display_name,
                            salary: job.salary_min && job.salary_max ? 
                                `$${job.salary_min.toLocaleString()}-${job.salary_max.toLocaleString()}` : 
                                'Competitive',
                            job_type: employmentType,
                            work_mode: job.location.display_name.toLowerCase().includes('remote') ? 'Remote' : 'On-site',
                            description: job.description?.substring(0, 1000) || 'No description available',
                            url: job.redirect_url,
                            source: 'Adzuna API',
                            posted_date: job.created,
                            is_c2c: false,
                            scraped_at: new Date().toISOString(),
                            is_real: true
                        }));
                    
                    allJobs.push(...jobs);
                    console.log(`✅ Adzuna API: Found ${jobs.length} jobs`);
                }
            } catch (error) {
                console.error('Adzuna API error:', error.message);
            }
        }

        console.log(`📊 Total jobs found: ${allJobs.length}`);
        return allJobs;

    } catch (error) {
        console.error('Error in scrapeGeneralJobs:', error);
        return [];
    }
}

// Main scraping function for all non-IT profiles
async function runGeneralJobScraping() {
    console.log('🔄 Starting general job scraping for non-IT profiles...');
    
    try {
        const profiles = await getNonITProfiles();
        
        if (profiles.length === 0) {
            console.log('ℹ️ No non-IT profiles found for scraping');
            return { 
                success: true, 
                message: 'No non-IT profiles found', 
                jobsFound: 0,
                jobsSaved: 0 
            };
        }

        let totalJobsFound = 0;
        let totalJobsSaved = 0;

        for (const profile of profiles) {
            const { current_title, target_role, skills, city, state, country, id: profile_id, email } = profile;
            
            // Create search query from profile data
            const searchTerms = [];
            if (target_role) searchTerms.push(target_role);
            if (current_title) searchTerms.push(current_title);
            
            const searchQuery = searchTerms.join(' ') || 'business development';
            const location = city && state ? `${city}, ${state}` : (country || 'remote');

            console.log(`🎯 Scraping for ${email}: "${searchQuery}" in ${location}`);

            try {
                const jobs = await scrapeGeneralJobs(searchQuery, location, 'full-time');
                totalJobsFound += jobs.length;

                // Save jobs to database
                for (const job of jobs) {
                    const success = await saveJobToSupabase(job);
                    if (success) {
                        totalJobsSaved++;
                    }
                }

                console.log(`✅ Profile ${email}: Found ${jobs.length} jobs, saved ${jobs.length} jobs`);
                
                // Small delay between profiles to be respectful to APIs
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                console.error(`❌ Error scraping for ${email}:`, error.message);
            }
        }

        const result = {
            success: true,
            message: `Scraping completed for ${profiles.length} non-IT profiles`,
            profilesProcessed: profiles.length,
            jobsFound: totalJobsFound,
            jobsSaved: totalJobsSaved,
            timestamp: new Date().toISOString()
        };

        console.log('📊 General scraping results:', result);
        return result;

    } catch (error) {
        console.error('❌ Error in runGeneralJobScraping:', error);
        return {
            success: false,
            error: error.message,
            jobsFound: 0,
            jobsSaved: 0
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
        console.log('🚀 General Job Scraper triggered');
        
        const result = await runGeneralJobScraping();
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result)
        };

    } catch (error) {
        console.error('❌ General job scraper error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

// Export functions for use in other modules
module.exports = {
    runGeneralJobScraping,
    scrapeGeneralJobs,
    isNonITProfile
}; 