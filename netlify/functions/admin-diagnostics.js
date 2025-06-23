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

    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {
            hasSupabaseUrl: !!supabaseUrl,
            hasSupabaseKey: !!supabaseKey,
            supabaseUrlLength: supabaseUrl?.length || 0,
            supabaseKeyLength: supabaseKey?.length || 0,
            nodeVersion: process.version
        },
        supabaseConnection: null,
        tables: {}
    };

    try {
        if (!supabase) {
            diagnostics.supabaseConnection = 'Failed - Missing environment variables';
        } else {
            // Test basic connection
            const { data, error } = await supabase.auth.getUser();
            if (error && error.message !== 'No user found') {
                diagnostics.supabaseConnection = `Error: ${error.message}`;
            } else {
                diagnostics.supabaseConnection = 'Connected';
                
                // Test table access
                try {
                    const { count: profilesCount } = await supabase
                        .from('profiles')
                        .select('id', { count: 'exact', head: true });
                    diagnostics.tables.profiles = profilesCount || 0;
                } catch (e) {
                    diagnostics.tables.profiles = `Error: ${e.message}`;
                }

                try {
                    const { count: jobsCount } = await supabase
                        .from('scraped_jobs')
                        .select('id', { count: 'exact', head: true });
                    diagnostics.tables.scraped_jobs = jobsCount || 0;
                } catch (e) {
                    diagnostics.tables.scraped_jobs = `Error: ${e.message}`;
                }

                try {
                    const { count: favoritesCount } = await supabase
                        .from('favorite_companies')
                        .select('id', { count: 'exact', head: true });
                    diagnostics.tables.favorite_companies = favoritesCount || 0;
                } catch (e) {
                    diagnostics.tables.favorite_companies = `Error: ${e.message}`;
                }
            }
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(diagnostics, null, 2)
        };

    } catch (error) {
        diagnostics.error = error.message;
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(diagnostics, null, 2)
        };
    }
}; 