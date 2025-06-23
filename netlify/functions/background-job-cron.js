const { runContinuousC2CScraping } = require('./it-c2c-scraper');

// ACTIVE SCRAPER: Contract Jobs for ALL Profiles
const ACTIVE_SCRAPER = {
    name: 'Universal Contract Job Scraper',
    function: runContinuousC2CScraping,
    enabled: true,
    description: 'Scrapes real contract jobs (C2C) for ALL user profiles - no IT keyword restriction',
    interval: '30 minutes'
};

// ALL OTHER SCRAPERS DELETED TO AVOID COSTS
// Only IT C2C scraper remains active

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
        console.log('🔄 Starting scheduled IT C2C job scraping...');
        
        // Only run the active IT C2C scraper
        if (ACTIVE_SCRAPER.enabled) {
            const result = await ACTIVE_SCRAPER.function();
            
            console.log(`✅ ${ACTIVE_SCRAPER.name} completed:`, result);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    active_scraper: ACTIVE_SCRAPER.name,
                    result: result,
                    dormant_scrapers: 0,
                    message: 'IT C2C scraping completed successfully',
                    next_run: 'In 30 minutes'
                })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'No active scrapers enabled',
                    active_scraper: null,
                    dormant_scrapers: 0
                })
            };
        }
        
    } catch (error) {
        console.error('Background cron error:', error);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                active_scraper: ACTIVE_SCRAPER.name,
                message: 'Background scraping failed'
            })
        };
    }
}; 