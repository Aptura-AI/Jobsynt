const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// API Configuration for job scraping
const API_CONFIG = {
    serpapi: {
        key: process.env.SERPAPI_KEY,
        daily_limit: 100,
        endpoint: 'https://serpapi.com/search'
    },
    adzuna: {
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        daily_limit: 500,
        endpoint: 'https://api.adzuna.com/v1/api/jobs/us/search/1'
    },
    jsearch: {
        key: process.env.JSEARCH_API_KEY,
        daily_limit: 250,
        endpoint: 'https://jsearch.p.rapidapi.com/search'
    },
    openai: {
        key: process.env.OPENAI_API_KEY,
        daily_limit: 50 // Conservative limit for GPT analysis
    }
};

// Main handler - can be triggered by cron or manually
exports.handler = async (event, context) => {
    console.log('🤖 Background Job Scraper Started');
    
    try {
        // Step 1: Scrape jobs from all sources
        const scrapedJobs = await scrapeJobsFromAllSources();
        console.log(`📊 Scraped ${scrapedJobs.length} jobs from all sources`);
        
        // Step 2: Filter through ghost job detection
        const realJobs = await filterGhostJobs(scrapedJobs);
        console.log(`✅ ${realJobs.length} real jobs after ghost filtering`);
        
        // Step 3: Store in database
        const storedJobs = await storeScrapedJobs(realJobs);
        console.log(`💾 Stored ${storedJobs.length} jobs in database`);
        
        // Step 4: Match jobs to user profiles
        const matchingResults = await matchJobsToProfiles(storedJobs);
        console.log(`🎯 Matched jobs to ${matchingResults.usersProcessed} user profiles`);
        
        // Step 5: Generate daily recommendations
        const recommendationResults = await generateDailyRecommendations();
        console.log(`📈 Generated recommendations for ${recommendationResults.usersWithRecommendations} users`);
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                success: true,
                summary: {
                    jobs_scraped: scrapedJobs.length,
                    real_jobs: realJobs.length,
                    jobs_stored: storedJobs.length,
                    users_processed: matchingResults.usersProcessed,
                    recommendations_generated: recommendationResults.usersWithRecommendations
                },
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('❌ Background scraper error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};

// Step 1: Scrape jobs from all available sources
async function scrapeJobsFromAllSources() {
    const allJobs = [];
    const sources = ['serpapi', 'adzuna', 'jsearch'];
    
    // Common job search terms to ensure variety
    const searchTerms = [
        'software engineer', 'sales representative', 'marketing manager',
        'data analyst', 'project manager', 'customer service',
        'accountant', 'nurse', 'teacher', 'designer'
    ];
    
    for (const source of sources) {
        try {
            console.log(`🔍 Scraping from ${source}...`);
            const sourceJobs = await scrapeFromSource(source, searchTerms);
            allJobs.push(...sourceJobs);
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.error(`❌ Error scraping ${source}:`, error.message);
        }
    }
    
    return removeDuplicateJobs(allJobs);
}

// Scrape from a specific source
async function scrapeFromSource(source, searchTerms) {
    const jobs = [];
    
    for (const term of searchTerms.slice(0, 3)) { // Limit to 3 terms per source
        try {
            let sourceJobs = [];
            
            switch (source) {
                case 'serpapi':
                    sourceJobs = await scrapeSerpAPI(term);
                    break;
                case 'adzuna':
                    sourceJobs = await scrapeAdzunaAPI(term);
                    break;
                case 'jsearch':
                    sourceJobs = await scrapeJSearchAPI(term);
                    break;
            }
            
            jobs.push(...sourceJobs);
            
            // Rate limiting between searches
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`❌ Error scraping ${term} from ${source}:`, error.message);
        }
    }
    
    return jobs;
}

// Individual API scrapers
async function scrapeSerpAPI(searchTerm) {
    if (!API_CONFIG.serpapi.key) return [];
    
    try {
        const response = await axios.get(API_CONFIG.serpapi.endpoint, {
            params: {
                engine: 'google_jobs',
                q: searchTerm,
                location: 'United States',
                api_key: API_CONFIG.serpapi.key,
                num: 20
            },
            timeout: 10000
        });

        return (response.data.jobs_results || []).map(job => ({
            job_id: `serp_${job.job_id}`,
            title: job.title,
            company: job.company_name,
            location: job.location,
            salary: job.detected_extensions?.salary,
            job_type: job.detected_extensions?.schedule_type || 'Full-time',
            work_mode: job.location?.toLowerCase().includes('remote') ? 'remote' : 'onsite',
            description: job.description,
            url: job.share_link,
            source: 'Google Jobs',
            posted_date: job.detected_extensions?.posted_at,
            extracted_skills: extractSkillsFromDescription(job.description)
        }));
    } catch (error) {
        console.error('SerpAPI error:', error.message);
        return [];
    }
}

async function scrapeAdzunaAPI(searchTerm) {
    if (!API_CONFIG.adzuna.app_id || !API_CONFIG.adzuna.app_key) return [];
    
    try {
        const response = await axios.get(API_CONFIG.adzuna.endpoint, {
            params: {
                app_id: API_CONFIG.adzuna.app_id,
                app_key: API_CONFIG.adzuna.app_key,
                what: searchTerm,
                where: 'United States',
                results_per_page: 20
            },
            timeout: 10000
        });

        return (response.data.results || []).map(job => ({
            job_id: `adzuna_${job.id}`,
            title: job.title,
            company: job.company?.display_name,
            location: job.location?.display_name,
            salary: job.salary_min && job.salary_max ? `$${job.salary_min} - $${job.salary_max}` : null,
            job_type: job.contract_type || 'Full-time',
            work_mode: job.location?.display_name?.toLowerCase().includes('remote') ? 'remote' : 'onsite',
            description: job.description,
            url: job.redirect_url,
            source: 'Adzuna',
            posted_date: job.created,
            extracted_skills: extractSkillsFromDescription(job.description)
        }));
    } catch (error) {
        console.error('Adzuna API error:', error.message);
        return [];
    }
}

async function scrapeJSearchAPI(searchTerm) {
    if (!API_CONFIG.jsearch.key) return [];
    
    try {
        const response = await axios.get(API_CONFIG.jsearch.endpoint, {
            params: {
                query: `${searchTerm} United States`,
                page: '1',
                num_pages: '1'
            },
            headers: {
                'X-RapidAPI-Key': API_CONFIG.jsearch.key,
                'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
            },
            timeout: 10000
        });

        return (response.data.data || []).map(job => ({
            job_id: `jsearch_${job.job_id}`,
            title: job.job_title,
            company: job.employer_name,
            location: `${job.job_city}, ${job.job_state}`,
            salary: job.job_min_salary && job.job_max_salary ? `$${job.job_min_salary} - $${job.job_max_salary}` : null,
            job_type: job.job_employment_type || 'Full-time',
            work_mode: job.job_is_remote ? 'remote' : 'onsite',
            description: job.job_description,
            url: job.job_apply_link,
            source: 'JSearch',
            posted_date: job.job_posted_at_datetime_utc,
            extracted_skills: extractSkillsFromDescription(job.job_description)
        }));
    } catch (error) {
        console.error('JSearch API error:', error.message);
        return [];
    }
}

// Step 2: Filter ghost jobs using AI detection
async function filterGhostJobs(jobs) {
    const realJobs = [];
    
    for (const job of jobs) {
        try {
            const ghostAnalysis = await analyzeJobForGhost(job);
            
            job.ghost_score = ghostAnalysis.score;
            job.is_ghost_job = ghostAnalysis.isGhost;
            job.ghost_flags = ghostAnalysis.flags;
            
            // Only keep jobs with low ghost scores
            if (ghostAnalysis.score < 70) {
                realJobs.push(job);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Ghost analysis error:', error.message);
            // If analysis fails, assume it's real but low quality
            job.ghost_score = 50;
            job.is_ghost_job = false;
            realJobs.push(job);
        }
    }
    
    return realJobs;
}

// Analyze individual job for ghost indicators
async function analyzeJobForGhost(job) {
    const flags = [];
    let score = 0;
    
    // Basic ghost job indicators
    if (!job.description || job.description.length < 100) {
        flags.push('Very short description');
        score += 20;
    }
    
    if (!job.company || job.company === 'Unknown') {
        flags.push('Unknown company');
        score += 25;
    }
    
    if (!job.salary) {
        flags.push('No salary information');
        score += 10;
    }
    
    if (job.description) {
        const desc = job.description.toLowerCase();
        
        // Generic buzzwords
        const buzzwords = ['rockstar', 'ninja', 'guru', 'unicorn'];
        const foundBuzzwords = buzzwords.filter(word => desc.includes(word));
        if (foundBuzzwords.length > 0) {
            flags.push(`Generic buzzwords: ${foundBuzzwords.join(', ')}`);
            score += 15;
        }
        
        // Unrealistic requirements
        if (desc.includes('10+ years') && desc.includes('entry level')) {
            flags.push('Contradictory experience requirements');
            score += 30;
        }
    }
    
    return {
        score: Math.min(100, score),
        isGhost: score >= 70,
        flags
    };
}

// Step 3: Store scraped jobs in database
async function storeScrapedJobs(jobs) {
    const storedJobs = [];
    
    for (const job of jobs) {
        try {
            const { data, error } = await supabase
                .from('scraped_jobs')
                .upsert({
                    job_id: job.job_id,
                    title: job.title,
                    company: job.company,
                    location: job.location,
                    salary: job.salary,
                    job_type: job.job_type,
                    work_mode: job.work_mode,
                    description: job.description,
                    url: job.url,
                    source: job.source,
                    posted_date: job.posted_date,
                    ghost_score: job.ghost_score,
                    is_ghost_job: job.is_ghost_job,
                    ghost_flags: job.ghost_flags,
                    extracted_skills: job.extracted_skills
                }, {
                    onConflict: 'job_id'
                });
            
            if (error) {
                console.error('Database error storing job:', error);
            } else {
                storedJobs.push(data);
            }
        } catch (error) {
            console.error('Error storing job:', error.message);
        }
    }
    
    return storedJobs;
}

// Step 4: Match jobs to user profiles
async function matchJobsToProfiles(jobs) {
    // Get all active user profiles
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, skills, experience_level, current_title, city, state, salary_range_from, salary_range_to')
        .not('skills', 'is', null);
    
    if (error) {
        console.error('Error fetching profiles:', error);
        return { usersProcessed: 0 };
    }
    
    let usersProcessed = 0;
    
    for (const profile of profiles) {
        try {
            const matchedJobs = await matchJobsToProfile(profile, jobs);
            usersProcessed++;
            
            console.log(`✅ Matched ${matchedJobs.length} jobs for user ${profile.user_id}`);
        } catch (error) {
            console.error(`Error matching jobs for user ${profile.user_id}:`, error.message);
        }
    }
    
    return { usersProcessed };
}

// Match jobs to a specific profile
async function matchJobsToProfile(profile, jobs) {
    const matchedJobs = [];
    const userSkills = profile.skills ? profile.skills.split(',').map(s => s.trim().toLowerCase()) : [];
    
    for (const job of jobs) {
        const matchScore = calculateProfileMatchScore(job, profile, userSkills);
        
        if (matchScore >= 60) { // Minimum match threshold
            try {
                const { data, error } = await supabase
                    .from('profile_matched_jobs')
                    .upsert({
                        user_id: profile.user_id,
                        scraped_job_id: job.id,
                        profile_match_score: matchScore,
                        skill_match_score: calculateSkillMatch(job.extracted_skills || [], userSkills),
                        location_match_score: calculateLocationMatch(job.location, profile.city, profile.state),
                        salary_match_score: calculateSalaryMatch(job.salary, profile.salary_range_from, profile.salary_range_to)
                    }, {
                        onConflict: 'user_id,scraped_job_id'
                    });
                
                if (!error) {
                    matchedJobs.push(data);
                }
            } catch (error) {
                console.error('Error storing matched job:', error.message);
            }
        }
    }
    
    return matchedJobs;
}

// Step 5: Generate daily recommendations (top 20% or max 50)
async function generateDailyRecommendations() {
    const today = new Date().toISOString().split('T')[0];
    
    // Get all users with matched jobs
    const { data: users, error } = await supabase
        .from('profile_matched_jobs')
        .select('user_id')
        .eq('is_recommended', false)
        .group('user_id');
    
    if (error) {
        console.error('Error fetching users for recommendations:', error);
        return { usersWithRecommendations: 0 };
    }
    
    let usersWithRecommendations = 0;
    
    for (const user of users) {
        try {
            await generateUserDailyRecommendations(user.user_id, today);
            usersWithRecommendations++;
        } catch (error) {
            console.error(`Error generating recommendations for user ${user.user_id}:`, error.message);
        }
    }
    
    return { usersWithRecommendations };
}

// Generate recommendations for a specific user
async function generateUserDailyRecommendations(userId, date) {
    // Get user's matched jobs ordered by score
    const { data: matchedJobs, error } = await supabase
        .from('profile_matched_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_recommended', false)
        .order('profile_match_score', { ascending: false })
        .limit(100); // Get top 100 to select from
    
    if (error || !matchedJobs.length) return;
    
    // Select top 20% or max 50 jobs
    const recommendationCount = Math.min(50, Math.ceil(matchedJobs.length * 0.2));
    const topJobs = matchedJobs.slice(0, recommendationCount);
    
    // Store recommendations
    for (let i = 0; i < topJobs.length; i++) {
        try {
            await supabase
                .from('daily_job_recommendations')
                .upsert({
                    user_id: userId,
                    profile_matched_job_id: topJobs[i].id,
                    recommendation_date: date,
                    rank_position: i + 1
                }, {
                    onConflict: 'user_id,recommendation_date,rank_position'
                });
            
            // Mark as recommended
            await supabase
                .from('profile_matched_jobs')
                .update({ is_recommended: true })
                .eq('id', topJobs[i].id);
                
        } catch (error) {
            console.error('Error storing recommendation:', error.message);
        }
    }
}

// Utility functions
function calculateProfileMatchScore(job, profile, userSkills) {
    let score = 50; // Base score
    
    // Skill matching
    const jobSkills = job.extracted_skills || [];
    const skillMatches = userSkills.filter(userSkill => 
        jobSkills.some(jobSkill => jobSkill.toLowerCase().includes(userSkill))
    );
    score += (skillMatches.length / Math.max(userSkills.length, 1)) * 30;
    
    // Title matching
    if (profile.current_title && job.title) {
        const titleWords = profile.current_title.toLowerCase().split(' ');
        const jobTitleWords = job.title.toLowerCase().split(' ');
        const titleMatches = titleWords.filter(word => 
            jobTitleWords.some(jobWord => jobWord.includes(word))
        );
        score += (titleMatches.length / titleWords.length) * 20;
    }
    
    return Math.min(100, Math.max(0, Math.round(score)));
}

function calculateSkillMatch(jobSkills, userSkills) {
    if (!jobSkills.length || !userSkills.length) return 0;
    
    const matches = userSkills.filter(userSkill =>
        jobSkills.some(jobSkill => jobSkill.toLowerCase().includes(userSkill))
    );
    
    return Math.round((matches.length / userSkills.length) * 100);
}

function calculateLocationMatch(jobLocation, userCity, userState) {
    if (!jobLocation) return 50;
    if (!userCity && !userState) return 50;
    
    const jobLoc = jobLocation.toLowerCase();
    const userLoc = `${userCity || ''} ${userState || ''}`.toLowerCase().trim();
    
    if (jobLoc.includes('remote')) return 100;
    if (jobLoc.includes(userLoc) || userLoc.includes(jobLoc)) return 100;
    if (userState && jobLoc.includes(userState.toLowerCase())) return 75;
    
    return 25;
}

function calculateSalaryMatch(jobSalary, userMin, userMax) {
    if (!jobSalary || !userMin) return 50;
    
    const salaryNumbers = jobSalary.match(/\d+/g);
    if (!salaryNumbers) return 50;
    
    const jobSalaryNum = parseInt(salaryNumbers[0]) * 1000; // Assuming K format
    
    if (jobSalaryNum >= userMin && (!userMax || jobSalaryNum <= userMax)) {
        return 100;
    } else if (jobSalaryNum >= userMin * 0.8) {
        return 75;
    } else if (jobSalaryNum >= userMin * 0.6) {
        return 50;
    }
    
    return 25;
}

function extractSkillsFromDescription(description) {
    if (!description) return [];
    
    const skills = [
        'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL', 'AWS', 'Docker',
        'Sales', 'Marketing', 'CRM', 'Salesforce', 'HubSpot', 'Excel', 'PowerPoint',
        'Project Management', 'Agile', 'Scrum', 'Customer Service', 'Communication'
    ];
    
    return skills.filter(skill => 
        description.toLowerCase().includes(skill.toLowerCase())
    );
}

function removeDuplicateJobs(jobs) {
    const seen = new Set();
    return jobs.filter(job => {
        const key = `${job.title}-${job.company}`.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
} 