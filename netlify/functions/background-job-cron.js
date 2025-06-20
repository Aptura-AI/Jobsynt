const axios = require('axios');

// This function is triggered by Netlify's scheduled functions
// To enable, add this to netlify.toml:
// [[functions]]
// schedule = "0 */2 * * *"  # Every 2 hours
// name = "background-job-cron"

exports.handler = async (event, context) => {
    console.log('🕐 Scheduled background job scraper triggered');
    
    try {
        // Call the main background scraper
        const scraperUrl = process.env.URL || 'https://your-site.netlify.app';
        const response = await axios.post(`${scraperUrl}/.netlify/functions/background-job-scraper`, {
            source: 'cron',
            timestamp: new Date().toISOString()
        }, {
            timeout: 300000 // 5 minutes timeout
        });

        console.log('✅ Background scraper completed successfully');
        console.log('Results:', response.data);

        return {
            statusCode: 200,
            body: JSON.stringify({
                success: true,
                message: 'Background job scraper executed successfully',
                results: response.data,
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        console.error('❌ Cron job error:', error.message);
        
        // Send notification about the failure (optional)
        // You could integrate with email service here
        
        return {
            statusCode: 500,
            body: JSON.stringify({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
}; 