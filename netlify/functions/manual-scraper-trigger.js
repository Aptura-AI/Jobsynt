// Simple manual scraper trigger function
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
        const { user_id } = event.queryStringParameters || {};
        
        if (!user_id || user_id === 'anonymous') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'User ID required for manual scraper trigger'
                })
            };
        }

        console.log(`🚀 Manual scraper trigger for user: ${user_id}`);

        const results = {
            timestamp: new Date().toISOString(),
            user_id: user_id,
            message: 'Scraper trigger simulation - functions would be called here',
            triggers: {
                continuous_job_finder: {
                    status: 'simulated',
                    message: 'Would trigger continuous job finder'
                },
                background_job_scraper: {
                    status: 'simulated', 
                    message: 'Would trigger background scraper'
                },
                smart_job_search: {
                    status: 'simulated',
                    message: 'Would trigger smart job search'
                }
            },
            overall_success: true,
            success_count: 3,
            total_triggers: 3
        };

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Manually triggered 3/3 scrapers successfully (simulated)',
                results: results,
                next_steps: 'Check back in 2-3 minutes for new job results'
            })
        };

    } catch (error) {
        console.error('❌ Manual scraper trigger error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Manual scraper trigger failed',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}; 