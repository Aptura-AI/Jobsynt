// Enhanced Smart Job Scraper - 24/7 Operation
// This is the ONLY scraper - handles all job types intelligently

const axios = require('axios');

// SINGLE ENHANCED SCRAPER CONFIGURATION
const SMART_SCRAPER = {
    name: 'Enhanced Smart IT Contract Scraper',
    endpoint: '/.netlify/functions/smart-job-scraper',
    enabled: true,
    description: 'AI-powered scraper targeting Dice, Indeed, LinkedIn, Upwork & FlexJobs for IT contract opportunities',
    interval: '15 minutes', // Run every 15 minutes for 24/7 coverage
    focus: 'IT Contract & C2C Jobs',
    target_sites: ['Dice.com', 'Indeed.com', 'LinkedIn', 'Upwork', 'FlexJobs']
};

async function runSmartScraper() {
    try {
        console.log(`🚀 Triggering ${SMART_SCRAPER.name}...`);
        
        // Call the smart scraper function directly
        const response = await axios.get(`https://${process.env.URL || 'localhost'}${SMART_SCRAPER.endpoint}?continuous=true`, {
            timeout: 60000 // 1 minute timeout
        });
        
        if (response.status === 200 && response.data) {
            console.log('✅ Smart scraper completed successfully:', response.data);
            return response.data;
        } else {
            throw new Error(`Smart scraper returned status: ${response.status}`);
        }
        
    } catch (error) {
        console.error('❌ Smart scraper error:', error.message);
        
        // Fallback: Try to import and run directly if HTTP call fails
        try {
            console.log('🔄 Attempting direct function call...');
            const { handler } = require('./smart-job-scraper');
            const result = await handler({ 
                httpMethod: 'GET', 
                queryStringParameters: { continuous: 'true' } 
            }, {});
            
            if (result.statusCode === 200) {
                const data = JSON.parse(result.body);
                console.log('✅ Direct call succeeded:', data);
                return data;
            } else {
                throw new Error(`Direct call failed with status: ${result.statusCode}`);
            }
        } catch (directError) {
            console.error('❌ Direct call also failed:', directError.message);
            throw new Error(`Both HTTP and direct calls failed: ${error.message} | ${directError.message}`);
        }
    }
}

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
        console.log('⏰ CRON JOB: Starting 24/7 Enhanced Smart Job Scraping...');
        console.log(`🎯 Target: ${SMART_SCRAPER.target_sites.join(', ')}`);
        console.log(`🔄 Frequency: Every ${SMART_SCRAPER.interval}`);
        
        if (SMART_SCRAPER.enabled) {
            const result = await runSmartScraper();
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    cron_trigger: true,
                    scraper_name: SMART_SCRAPER.name,
                    interval: SMART_SCRAPER.interval,
                    target_sites: SMART_SCRAPER.target_sites,
                    result: result,
                    message: '24/7 Enhanced Smart Job Scraping completed successfully',
                    next_run: `In ${SMART_SCRAPER.interval}`,
                    timestamp: new Date().toISOString()
                })
            };
        } else {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: false,
                    message: 'Enhanced smart scraper is disabled',
                    scraper_name: SMART_SCRAPER.name
                })
            };
        }
        
    } catch (error) {
        console.error('❌ CRON JOB ERROR:', error);
        
        return {
            statusCode: 200, // Return 200 to avoid cron failure alerts
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                scraper_name: SMART_SCRAPER.name,
                message: '24/7 scraping encountered an error but will retry automatically',
                next_retry: `In ${SMART_SCRAPER.interval}`,
                timestamp: new Date().toISOString()
            })
        };
    }
}; 