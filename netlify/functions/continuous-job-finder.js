const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Continuous job finder - runs until 20+ genuine jobs found per user
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
        const userId = event.queryStringParameters?.user_id || (event.body ? JSON.parse(event.body).user_id : null);
        const forceStart = event.queryStringParameters?.force_start === 'true';
        
        console.log(`🔄 Continuous job finder triggered for user: ${userId}`);

        if (!userId || userId === 'anonymous') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'User ID required for continuous job finding'
                })
            };
        }

        // Check current genuine job count for this user
        const { data: currentJobs, error: jobError } = await supabase
            .from('daily_job_recommendations')
            .select(`
                profile_matched_jobs (
                    scraped_jobs (
                        job_id, is_ghost_job, gpt_analyzed, gpt_analysis_score
                    )
                )
            `)
            .eq('user_id', userId)
            .eq('is_active', true);

        let genuineJobCount = 0;
        if (!jobError && currentJobs) {
            genuineJobCount = currentJobs.filter(rec => 
                rec.profile_matched_jobs?.scraped_jobs &&
                !rec.profile_matched_jobs.scraped_jobs.is_ghost_job &&
                rec.profile_matched_jobs.scraped_jobs.gpt_analyzed &&
                (rec.profile_matched_jobs.scraped_jobs.gpt_analysis_score || 0) >= 70
            ).length;
        }

        console.log(`📊 Current genuine job count for user ${userId}: ${genuineJobCount}`);

        // If user already has 20+ genuine jobs and not forced, return success
        if (genuineJobCount >= 20 && !forceStart) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: `User already has ${genuineJobCount} genuine jobs - continuous search not needed`,
                    genuine_job_count: genuineJobCount,
                    status: 'sufficient_jobs'
                })
            };
        }

        // Get user profile for targeted searching
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (!profile) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'User profile not found'
                })
            };
        }

        // Set continuous search status
        await supabase
            .from('user_job_preferences')
            .upsert({
                user_id: userId,
                continuous_search_active: true,
                search_started_at: new Date().toISOString(),
                target_job_count: 20,
                current_job_count: genuineJobCount,
                last_search_trigger: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        // Start immediate background search
        const searchResult = await triggerImmediateSearch(userId, profile);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Continuous job search ${searchResult.new_genuine_jobs >= 20 ? 'completed' : 'in progress'}`,
                user_id: userId,
                genuine_jobs_found: searchResult.new_genuine_jobs,
                search_cycles_remaining: searchResult.new_genuine_jobs >= 20 ? 0 : 'continuous',
                next_search_in: searchResult.new_genuine_jobs >= 20 ? 'none' : '5 minutes',
                status: searchResult.new_genuine_jobs >= 20 ? 'target_reached' : 'searching_continuous'
            })
        };

    } catch (error) {
        console.error('❌ Continuous job finder error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Continuous job search failed',
                message: error.message
            })
        };
    }
};

// Trigger immediate search for genuine jobs
async function triggerImmediateSearch(userId, profile) {
    console.log(`🚀 Starting immediate job search for user: ${userId}`);
    
    try {
        // Call the background job scraper
        const scraperUrl = `${process.env.URL}/.netlify/functions/background-job-scraper`;
        const response = await axios.post(scraperUrl, {
            user_id: userId,
            profile: profile,
            continuous_mode: true,
            target_count: 20,
            quality_threshold: 70, // Only jobs with 70+ GPT score
            no_samples: true, // Absolutely no fake/sample jobs
            sources: [
                'indeed', 'linkedin', 'glassdoor', 'dice', 'monster', 
                'careerbuilder', 'ziprecruiter', 'simplyhired'
            ]
        }, {
            timeout: 300000 // 5 minutes timeout
        });

        const result = response.data;
        console.log('✅ Immediate search completed:', result);

        return {
            success: true,
            new_genuine_jobs: result.genuine_jobs_added || 0,
            total_processed: result.total_jobs_processed || 0,
            ghost_filtered: result.ghost_jobs_filtered || 0,
            gpt_analyzed: result.gpt_analyzed_count || 0
        };

    } catch (error) {
        console.error('❌ Immediate search failed:', error.message);
        return {
            success: false,
            new_genuine_jobs: 0,
            error: error.message
        };
    }
} 