// Enhanced Smart Job Scraper - 24/7 Operation
// Handles IT and CRM/BDM contract jobs intelligently

const axios = require('axios');

// Smart Job Scraper configuration
const SMART_SCRAPER = {
    name: 'Smart Job Scraper',
    endpoint: '/.netlify/functions/smart-job-scraper',
    enabled: true,
    description: 'AI-powered IT/Tech job scraper for Dice, Indeed, LinkedIn, Upwork, FlexJobs',
    interval: '60 minutes',
    focus: 'IT Contract & C2C Jobs',
    target_sites: ['Dice.com', 'Indeed.com', 'LinkedIn', 'Upwork', 'FlexJobs', 'USAJobs.gov']
};

// CRM Job Scraper configuration
const CRM_SCRAPER = {
    name: 'CRM Job Scraper',
    endpoint: '/.netlify/functions/dice-job-scraper',
    enabled: true,
    description: 'AI-powered CRM/general job scraper for sales, marketing, BDM, etc.',
    interval: '45 minutes',
    target_sites: ['Dice.com', 'Toptal', 'Upwork', 'FlexJobs', 'Robert Half', 'CyberCoders', 'Aquent', 'Gun.io', 'Hired', 'AngelList']
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

async function runCrmScraper() {
    try {
        console.log(`🚀 Triggering ${CRM_SCRAPER.name}...`);
        const response = await axios.get(`https://${process.env.URL || 'localhost'}${CRM_SCRAPER.endpoint}?continuous=true`, {
            timeout: 120000 // 2 minute timeout
        });
        if (response.status === 200 && response.data) {
            console.log('✅ CRM scraper completed successfully:', response.data);
            return response.data;
        } else {
            throw new Error(`CRM scraper returned status: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ CRM scraper error:', error.message);
        // Fallback: Try to import and run directly if HTTP call fails
        try {
            console.log('🔄 Attempting direct function call for CRM...');
            const { handler } = require('./dice-job-scraper');
            const result = await handler({ httpMethod: 'GET', queryStringParameters: { continuous: 'true' } }, {});
            if (result.statusCode === 200) {
                const data = JSON.parse(result.body);
                console.log('✅ Direct CRM call succeeded:', data);
                return data;
            } else {
                throw new Error(`Direct CRM call failed with status: ${result.statusCode}`);
            }
        } catch (directError) {
            console.error('❌ Direct CRM call also failed:', directError.message);
            throw new Error(`Both HTTP and direct CRM calls failed: ${error.message} | ${directError.message}`);
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
        // --- Smart Scraper ---
        console.log('⏰ CRON JOB: Starting 24/7 Enhanced Smart Job Scraping...');
        console.log(`🎯 Target: ${SMART_SCRAPER.target_sites.join(', ')}`);
        console.log(`🔄 Frequency: Every ${SMART_SCRAPER.interval}`);
        let smartResult = null;
        if (SMART_SCRAPER.enabled) {
            smartResult = await runSmartScraper();
        }

        // --- CRM Scraper ---
        console.log('⏰ CRON JOB: Starting 24/7 CRM General Job Scraping...');
        console.log(`🎯 Target: ${CRM_SCRAPER.target_sites.join(', ')}`);
        console.log(`🔄 Frequency: Every ${CRM_SCRAPER.interval}`);
        let crmResult = null;
        if (CRM_SCRAPER.enabled) {
            crmResult = await runCrmScraper();
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                cron_trigger: true,
                smart_scraper: {
                    name: SMART_SCRAPER.name,
                    interval: SMART_SCRAPER.interval,
                    result: smartResult
                },
                crm_scraper: {
                    name: CRM_SCRAPER.name,
                    interval: CRM_SCRAPER.interval,
                    result: crmResult
                },
                message: '24/7 Smart and CRM Job Scraping completed successfully',
                next_run: {
                    smart: `In ${SMART_SCRAPER.interval}`,
                    crm: `In ${CRM_SCRAPER.interval}`
                },
                timestamp: new Date().toISOString()
            })
        };
    } catch (error) {
        console.error('❌ CRON JOB ERROR:', error);
        return {
            statusCode: 200, // Return 200 to avoid cron failure alerts
            headers,
            body: JSON.stringify({
                success: false,
                error: error.message,
                message: '24/7 scraping encountered an error but will retry automatically',
                timestamp: new Date().toISOString()
            })
        };
    }
}; 