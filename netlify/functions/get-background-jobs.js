const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  );

exports.handler = async (event, context) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // Get user ID from the request
        const userId = event.queryStringParameters?.user_id;
        
        if (!userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'User ID is required'
                })
            };
        }

        console.log(`🔍 Fetching background jobs for user: ${userId}`);

        // Get today's date
        const today = new Date().toISOString().split('T')[0];

        // Fetch user's daily recommendations with job details
        const { data: recommendations, error: recommendationsError } = await supabase
            .from('daily_job_recommendations')
            .select(`
                id,
                rank_position,
                recommendation_date,
                profile_matched_jobs (
                    id,
                    profile_match_score,
                    skill_match_score,
                    location_match_score,
                    salary_match_score,
                    gpt_match_analysis,
                    shown_to_user,
                    user_interested,
                    applied,
                    scraped_jobs (
                        id,
                        job_id,
                        title,
                        company,
                        location,
                        salary,
                        job_type,
                        work_mode,
                        description,
                        url,
                        source,
                        posted_date,
                        ghost_score,
                        is_ghost_job,
                        extracted_skills,
                        scraped_at
                    )
                )
            `)
            .eq('user_id', userId)
            .eq('is_active', true)
            .order('recommendation_date', { ascending: false })
            .order('rank_position', { ascending: true })
            .limit(50);

        if (recommendationsError) {
            console.error('Error fetching recommendations:', recommendationsError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Failed to fetch job recommendations'
                })
            };
        }

        // Also get any additional high-scoring matched jobs not yet recommended
        const { data: additionalJobs, error: additionalError } = await supabase
            .from('profile_matched_jobs')
            .select(`
                id,
                profile_match_score,
                skill_match_score,
                location_match_score,
                salary_match_score,
                scraped_jobs (
                    id,
                    job_id,
                    title,
                    company,
                    location,
                    salary,
                    job_type,
                    work_mode,
                    description,
                    url,
                    source,
                    posted_date,
                    ghost_score,
                    extracted_skills,
                    scraped_at
                )
            `)
            .eq('user_id', userId)
            .eq('is_recommended', false)
            .eq('shown_to_user', false)
            .gte('profile_match_score', 75)
            .order('profile_match_score', { ascending: false })
            .limit(10);

        if (additionalError) {
            console.error('Error fetching additional jobs:', additionalError);
        }

        // Process and format the results
        const processedJobs = [];
        
        // Add recommended jobs
        if (recommendations && recommendations.length > 0) {
            for (const rec of recommendations) {
                if (rec.profile_matched_jobs && rec.profile_matched_jobs.scraped_jobs) {
                    const job = rec.profile_matched_jobs.scraped_jobs;
                    const matchData = rec.profile_matched_jobs;
                    
                    processedJobs.push({
                        id: job.id,
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
                        extracted_skills: job.extracted_skills,
                        
                        // Match scores
                        match_score: matchData.profile_match_score,
                        skill_match: matchData.skill_match_score,
                        location_match: matchData.location_match_score,
                        salary_match: matchData.salary_match_score,
                        
                        // AI analysis
                        gpt_analysis: matchData.gpt_match_analysis,
                        
                        // Status
                        is_recommended: true,
                        rank_position: rec.rank_position,
                        recommendation_date: rec.recommendation_date,
                        shown_to_user: matchData.shown_to_user,
                        user_interested: matchData.user_interested,
                        applied: matchData.applied,
                        
                        // Quality indicators
                        ghost_score: job.ghost_score,
                        is_genuine: !job.is_ghost_job,
                        scraped_at: job.scraped_at
                    });
                }
            }
        }
        
        // Add additional high-scoring jobs
        if (additionalJobs && additionalJobs.length > 0) {
            for (const additional of additionalJobs) {
                if (additional.scraped_jobs) {
                    const job = additional.scraped_jobs;
                    
                    processedJobs.push({
                        id: job.id,
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
                        extracted_skills: job.extracted_skills,
                        
                        // Match scores
                        match_score: additional.profile_match_score,
                        skill_match: additional.skill_match_score,
                        location_match: additional.location_match_score,
                        salary_match: additional.salary_match_score,
                        
                        // Status
                        is_recommended: false,
                        is_additional: true,
                        ghost_score: job.ghost_score,
                        is_genuine: !job.is_ghost_job,
                        scraped_at: job.scraped_at
                    });
                }
            }
        }

        // Get scraping status for transparency
        const { data: scrapingStatus } = await supabase
            .from('scraping_status')
            .select('source, last_success, jobs_scraped_count, is_active')
            .eq('is_active', true);

        // Mark shown jobs as viewed
        if (processedJobs.length > 0) {
            const jobIds = processedJobs.map(job => job.id);
            await supabase
                .from('profile_matched_jobs')
                .update({ shown_to_user: true })
                .in('scraped_job_id', jobIds)
                .eq('user_id', userId);
        }

        const response = {
            success: true,
            jobs: processedJobs,
            count: processedJobs.length,
            summary: {
                recommended_jobs: processedJobs.filter(j => j.is_recommended).length,
                additional_jobs: processedJobs.filter(j => j.is_additional).length,
                total_jobs: processedJobs.length,
                average_match_score: processedJobs.length > 0 
                    ? Math.round(processedJobs.reduce((sum, job) => sum + job.match_score, 0) / processedJobs.length)
                    : 0,
                last_updated: new Date().toISOString()
            },
            scraping_info: {
                active_sources: scrapingStatus ? scrapingStatus.length : 0,
                last_scrape_times: scrapingStatus ? scrapingStatus.map(s => ({
                    source: s.source,
                    last_success: s.last_success,
                    jobs_count: s.jobs_scraped_count
                })) : [],
                next_refresh: 'Jobs are refreshed every hour and recommendations daily'
            },
            message: processedJobs.length > 0 
                ? `Found ${processedJobs.length} genuine jobs matched to your profile through our AI system`
                : 'No jobs found matching your profile yet. Our system is continuously searching - check back soon!'
        };

        console.log(`✅ Returned ${processedJobs.length} background jobs for user ${userId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('❌ Error in get-background-jobs:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Internal server error while fetching jobs',
                message: 'Our system is working to find jobs for you. Please try again in a few minutes.'
            })
        };
    }
}; 