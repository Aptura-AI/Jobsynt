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

        // Get real subscriber data from profiles table
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name, created_at, current_title')
            .order('created_at', { ascending: false })
            .limit(10); // Latest 10 subscribers

        if (error) {
            throw error;
        }

        // Get job matches for each profile
        const subscribers = [];
        
        for (const profile of profiles || []) {
            // Count matched jobs for this profile
            const { count: jobCount } = await supabase
                .from('scraped_jobs')
                .select('id', { count: 'exact', head: true })
                .eq('profile_id', profile.id);

            subscribers.push({
                name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown User',
                email: profile.email || 'No email',
                plan: 'Free', // Default plan - update based on your billing system
                joined: profile.created_at,
                jobs: jobCount || 0,
                target_role: profile.current_title
            });
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                subscribers: subscribers,
                count: subscribers.length
            })
        };

    } catch (error) {
        console.error('Error fetching subscribers:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                subscribers: [],
                count: 0,
                error: 'Unable to fetch subscriber data'
            })
        };
    }
}; 