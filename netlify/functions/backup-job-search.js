// Backup job search for when APIs are not working
// This provides sample jobs for testing the interface only

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
        // Parse request body for POST requests
        let requestData = {};
        if (event.httpMethod === 'POST' && event.body) {
            try {
                requestData = JSON.parse(event.body);
            } catch (parseError) {
                requestData = {};
            }
        }

        // Extract search parameters
        const position = requestData.position || requestData.keywords || 'software developer';
        const location = requestData.location || 'United States';

        console.log(`🔄 Backup job search for: ${position} in ${location}`);

        // Sample jobs for interface testing - clearly marked as samples
        const sampleJobs = [
            {
                id: 'sample_1',
                job_title: `${position} - Sample Job`,
                employer_name: 'Tech Company (Sample)',
                job_city: location,
                job_description: '⚠️ This is a SAMPLE job for testing the interface. Real jobs will appear when API keys are configured.',
                job_apply_link: '#',
                job_salary: 'Competitive (Sample)',
                job_employment_type: 'Full-time',
                is_sample: true
            },
            {
                id: 'sample_2',
                job_title: `Senior ${position} - Sample Job`,
                employer_name: 'Startup Inc (Sample)',
                job_city: location,
                job_description: '⚠️ This is a SAMPLE job for testing the interface. Real jobs will appear when API keys are configured.',
                job_apply_link: '#',
                job_salary: '$80,000 - $120,000 (Sample)',
                job_employment_type: 'Full-time',
                is_sample: true
            }
        ];

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                jobs: sampleJobs,
                count: sampleJobs.length,
                source: 'backup_samples',
                message: '⚠️ Showing SAMPLE jobs for interface testing. Configure API keys to see real job opportunities.',
                is_sample_data: true,
                api_status: {
                    jsearch: 'API key quota exceeded or invalid',
                    adzuna: 'Not configured',
                    background_scraper: 'Running every 30 minutes for IT C2C jobs only'
                },
                next_steps: [
                    '1. Get new JSearch API key from RapidAPI',
                    '2. Configure other job APIs (Adzuna, etc.)',
                    '3. Wait for background scraper to find real jobs'
                ]
            })
        };

    } catch (error) {
        console.error('Backup job search error:', error);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: false,
                jobs: [],
                count: 0,
                message: 'Job search temporarily unavailable. Please try again later.',
                error: error.message
            })
        };
    }
}; 