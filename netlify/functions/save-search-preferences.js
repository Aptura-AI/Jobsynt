const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Save user search preferences for scraper use and persistence
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
        const requestBody = JSON.parse(event.body || '{}');
        const {
            user_id,
            job_title,
            keywords,
            location,
            salary_min,
            salary_max,
            salary_type,
            job_type,
            work_mode,
            visa_status,
            experience_level,
            subscription_plan
        } = requestBody;

        if (!user_id || user_id === 'anonymous') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'User ID required'
                })
            };
        }

        // Parse and normalize keywords (comma, slash, or space separated)
        const normalizedKeywords = parseKeywords(keywords || job_title || '');
        
        // Determine job limits based on subscription plan
        const jobLimits = getJobLimits(subscription_plan);

        // Save search preferences
        const { data, error } = await supabase
            .from('user_job_preferences')
            .upsert({
                user_id: user_id,
                last_search_job_title: job_title,
                last_search_keywords: normalizedKeywords,
                last_search_location: location,
                last_search_salary_min: salary_min,
                last_search_salary_max: salary_max,
                last_search_salary_type: salary_type,
                last_search_job_type: job_type,
                last_search_work_mode: work_mode,
                last_search_visa_status: visa_status,
                last_search_experience_level: experience_level,
                subscription_plan: subscription_plan,
                job_limit: jobLimits.daily_limit,
                refresh_frequency_hours: jobLimits.refresh_hours,
                minimum_match_score: 90,
                required_skills_match: 100,
                last_search_date: new Date().toISOString(),
                search_preferences_updated: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        if (error) {
            throw new Error(`Failed to save preferences: ${error.message}`);
        }

        // Create search history entry
        await supabase
            .from('search_history')
            .insert({
                user_id: user_id,
                search_query: job_title,
                keywords: normalizedKeywords,
                location: location,
                filters: {
                    salary_min,
                    salary_max,
                    salary_type,
                    job_type,
                    work_mode,
                    visa_status,
                    experience_level
                },
                subscription_plan: subscription_plan,
                expected_job_count: jobLimits.daily_limit,
                search_timestamp: new Date().toISOString()
            });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Search preferences saved successfully',
                preferences: {
                    keywords: normalizedKeywords,
                    job_limits: jobLimits,
                    match_requirements: {
                        minimum_score: 90,
                        required_skills_match: 100
                    }
                }
            })
        };

    } catch (error) {
        console.error('❌ Save preferences error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to save search preferences',
                message: error.message
            })
        };
    }
};

// Parse keywords from various formats (comma, slash, space separated)
function parseKeywords(input) {
    if (!input) return [];
    
    const keywords = input
        .split(/[,/\s]+/)
        .map(keyword => keyword.trim().toLowerCase())
        .filter(keyword => keyword.length > 1)
        .filter(keyword => !['and', 'or', 'the', 'a', 'an'].includes(keyword));
    
    return [...new Set(keywords)];
}

// Get job limits based on subscription plan
function getJobLimits(plan) {
    switch (plan?.toLowerCase()) {
        case 'professional':
        case 'pro':
            return {
                daily_limit: 20,
                refresh_hours: 24,
                plan_name: 'Professional ($29)'
            };
        case 'executive':
        case 'premium':
            return {
                daily_limit: 30,
                refresh_hours: 24,
                plan_name: 'Executive ($79)'
            };
        default:
            return {
                daily_limit: 10,
                refresh_hours: 24,
                plan_name: 'Free Plan'
            };
    }
} 