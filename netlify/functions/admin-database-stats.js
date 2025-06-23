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

        // Get real table counts from Supabase
        const [
            scrapedJobsResult,
            profilesResult,
            profileMatchedJobsResult,
            dailyRecommendationsResult,
            favoriteCompaniesResult
        ] = await Promise.all([
            supabase.from('scraped_jobs').select('id', { count: 'exact', head: true }),
            supabase.from('profiles').select('id', { count: 'exact', head: true }),
            supabase.from('profile_matched_jobs').select('id', { count: 'exact', head: true }).catch(() => ({ count: 0 })),
            supabase.from('daily_job_recommendations').select('id', { count: 'exact', head: true }).catch(() => ({ count: 0 })),
            supabase.from('favorite_companies').select('id', { count: 'exact', head: true }).catch(() => ({ count: 0 }))
        ]);

        // Calculate approximate sizes (rough estimation)
        const estimateSize = (count, avgRecordSize) => {
            if (count === 0) return '0 KB';
            const totalBytes = count * avgRecordSize;
            if (totalBytes < 1024) return `${totalBytes} B`;
            if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
            if (totalBytes < 1024 * 1024 * 1024) return `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
            return `${(totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
        };

        const stats = [
            {
                table: 'scraped_jobs',
                count: scrapedJobsResult.count || 0,
                size: estimateSize(scrapedJobsResult.count || 0, 2000), // ~2KB per job record
                description: 'All scraped job data'
            },
            {
                table: 'profiles',
                count: profilesResult.count || 0,
                size: estimateSize(profilesResult.count || 0, 500), // ~500B per profile
                description: 'User profiles'
            },
            {
                table: 'profile_matched_jobs',
                count: profileMatchedJobsResult.count || 0,
                size: estimateSize(profileMatchedJobsResult.count || 0, 300), // ~300B per match
                description: 'Job matches per user'
            },
            {
                table: 'daily_job_recommendations',
                count: dailyRecommendationsResult.count || 0,
                size: estimateSize(dailyRecommendationsResult.count || 0, 400), // ~400B per recommendation
                description: 'Daily recommendations'
            },
            {
                table: 'favorite_companies',
                count: favoriteCompaniesResult.count || 0,
                size: estimateSize(favoriteCompaniesResult.count || 0, 200), // ~200B per company
                description: 'User favorite companies'
            }
        ];

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                stats: stats,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('Error fetching database stats:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                stats: [
                    { table: 'scraped_jobs', count: 0, size: '0 KB', description: 'All scraped job data' },
                    { table: 'profiles', count: 0, size: '0 KB', description: 'User profiles' },
                    { table: 'profile_matched_jobs', count: 0, size: '0 KB', description: 'Job matches per user' },
                    { table: 'daily_job_recommendations', count: 0, size: '0 KB', description: 'Daily recommendations' },
                    { table: 'favorite_companies', count: 0, size: '0 KB', description: 'User favorite companies' }
                ],
                error: 'Unable to fetch database statistics'
            })
        };
    }
}; 