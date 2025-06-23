const { createClient } = require('@supabase/supabase-js');

// Clean environment variables (remove quotes and semicolons)
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/[';]/g, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/[';]/g, '');

// Initialize Supabase
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
        if (!supabase) {
            console.error('Supabase not initialized - missing environment variables');
            console.error('SUPABASE_URL:', supabaseUrl ? 'Present' : 'Missing');
            console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'Present' : 'Missing');
            throw new Error('Database connection not available');
        }

        // Get real statistics from Supabase
        const [profilesResult, jobsResult] = await Promise.all([
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('scraped_jobs').select('id', { count: 'exact', head: true })
        ]);

        // Get jobs scraped in last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const { count: jobs24h } = await supabase
            .from('scraped_jobs')
            .select('id', { count: 'exact', head: true })
            .gte('scraped_at', yesterday.toISOString());

        const stats = {
            totalUsers: profilesResult.count || 0,
            activeScrapers: 1, // Only IT C2C scraper is active
            jobsScraped24h: jobs24h || 0,
            systemStatus: jobs24h > 0 ? 'Healthy - IT C2C Active' : 'IT C2C Active - No Recent Jobs'
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(stats)
        };

    } catch (error) {
        console.error('Error fetching admin stats:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                totalUsers: 0,
                activeScrapers: 1,
                jobsScraped24h: 0,
                systemStatus: 'IT C2C Active - Database Connection Error'
            })
        };
    }
}; 