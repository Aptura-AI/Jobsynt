// Test script to demonstrate intelligent API usage management
const { handler } = require('./netlify/functions/enhanced-multi-source-scraper');

async function testAPIUsage() {
    console.log('🧪 Testing Enhanced Multi-Source Scraper API Usage Management\n');
    
    // Simulate a job search request
    const testEvent = {
        httpMethod: 'POST',
        body: JSON.stringify({
            keywords: 'software engineer',
            location: 'New York, NY',
            search_type: 'jobs',
            profile: {
                industry: 'technology',
                experience_level: 'mid',
                skills: ['JavaScript', 'React', 'Node.js'],
                salary_min: 80000,
                salary_max: 120000
            }
        })
    };
    
    try {
        console.log('📊 Making test job search request...');
        const result = await handler(testEvent, {});
        const response = JSON.parse(result.body);
        
        if (response.success) {
            console.log('✅ Job search successful!');
            console.log(`📈 Results: ${response.count} jobs found`);
            console.log(`🔍 Total scraped: ${response.total_scraped}`);
            console.log(`👻 Ghost jobs filtered: ${response.ghost_filtered}`);
            console.log(`📡 Sources used: ${response.sources_used?.join(', ')}`);
            
            // Show API usage tracking
            if (response.api_usage) {
                console.log('\n🎯 API Usage Tracking:');
                console.log('Daily usage:', response.api_usage.daily_usage);
                console.log('Monthly usage:', response.api_usage.monthly_usage);
                console.log('Available APIs:', response.api_usage.available_apis);
            }
            
            // Show sample jobs (first 3)
            console.log('\n💼 Sample Jobs:');
            const sampleJobs = response.jobs?.slice(0, 3) || [];
            sampleJobs.forEach((job, index) => {
                console.log(`\n${index + 1}. ${job.title} at ${job.company}`);
                console.log(`   📍 Location: ${job.location}`);
                console.log(`   💰 Salary: ${job.salary || 'Not specified'}`);
                console.log(`   🎯 Match Score: ${job.gpt_match_score || 'N/A'}%`);
                console.log(`   👻 Ghost Score: ${job.ghost_score || 'N/A'}`);
                console.log(`   📡 Source: ${job.source}`);
            });
            
        } else {
            console.log('❌ Job search failed:', response.error);
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error.message);
    }
}

// Run the test
if (require.main === module) {
    testAPIUsage();
}

module.exports = { testAPIUsage }; 