const { createClient } = require('@supabase/supabase-js');

// Clean environment variables (remove quotes and semicolons)
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/[';]/g, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/[';]/g, '');

// Initialize Supabase with service role for admin-only access
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

exports.handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        if (!supabase) {
            throw new Error('Supabase not initialized for admin-users');
        }

        // Fetch all profiles (dev-only super admin view)
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, user_id, email, first_name, last_name, current_title, created_at')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        const users = (profiles || []).map(p => ({
            profile_id: p.id,
            user_id: p.user_id,
            email: p.email,
            name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email || 'Unknown User',
            current_title: p.current_title || '',
            created_at: p.created_at
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                users,
                count: users.length
            })
        };
    } catch (error) {
        console.error('Error in admin-users:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                users: [],
                count: 0,
                error: error.message
            })
        };
    }
};



