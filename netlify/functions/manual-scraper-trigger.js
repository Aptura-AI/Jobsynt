const { runContinuousC2CScraping } = require('./it-c2c-scraper');
const { runGeneralJobScraping } = require('./general-job-scraper');

// Manual scraper trigger function - ACTUALLY RUNS SCRAPERS
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
        const { action } = JSON.parse(event.body || '{}');
        
        console.log(`🚀 Manual scraper trigger requested: ${action || 'all'}`);

        const results = {
            timestamp: new Date().toISOString(),
            triggers: {},
            overall_success: true,
            success_count: 0,
            total_triggers: 0
        };

        // Run IT C2C scraper
        if (!action || action === 'it-c2c' || action === 'all') {
            try {
                console.log('🔄 Running IT C2C scraper...');
                const itResult = await runContinuousC2CScraping();
                results.triggers.it_c2c_scraper = {
                    status: itResult.success ? 'completed' : 'failed',
                    message: itResult.message,
                    profiles_processed: itResult.profiles_processed || 0,
                    jobs_found: itResult.total_jobs_found || 0,
                    jobs_saved: itResult.total_jobs_saved || 0,
                    error: itResult.error || null
                };
                results.total_triggers++;
                if (itResult.success) results.success_count++;
            } catch (error) {
                console.error('IT C2C scraper error:', error);
                results.triggers.it_c2c_scraper = {
                    status: 'failed',
                    message: 'Failed to run IT C2C scraper',
                    error: error.message
                };
                results.total_triggers++;
            }
        }

        // Run General job scraper
        if (!action || action === 'general' || action === 'all') {
            try {
                console.log('🔄 Running General job scraper...');
                const generalResult = await runGeneralJobScraping();
                results.triggers.general_job_scraper = {
                    status: generalResult.success ? 'completed' : 'failed',
                    message: generalResult.message,
                    jobs_found: generalResult.jobsFound || 0,
                    jobs_saved: generalResult.jobsSaved || 0,
                    error: generalResult.error || null
                };
                results.total_triggers++;
                if (generalResult.success) results.success_count++;
            } catch (error) {
                console.error('General scraper error:', error);
                results.triggers.general_job_scraper = {
                    status: 'failed',
                    message: 'Failed to run General job scraper',
                    error: error.message
                };
                results.total_triggers++;
            }
        }

        results.overall_success = results.success_count > 0;

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: results.overall_success,
                message: `Manually triggered ${results.success_count}/${results.total_triggers} scrapers successfully`,
                results: results,
                next_steps: 'Check your dashboard for new job results in 1-2 minutes'
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