const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Send email notification when job search is complete
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
        const { user_id, user_email, job_count, subscription_plan, search_query } = JSON.parse(event.body || '{}');

        if (!user_email || !user_id) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'User email and ID required'
                })
            };
        }

        // Get plan limits
        const planLimits = getJobLimits(subscription_plan);
        
        // Create email content
        const emailContent = createJobNotificationEmail({
            user_email,
            job_count,
            search_query,
            plan_name: planLimits.plan_name,
            job_limit: planLimits.daily_limit
        });

        // Store notification in queue (for future email service integration)
        const { data: notification, error: notificationError } = await supabase
            .from('notification_queue')
            .insert({
                user_id: user_id,
                user_email: user_email,
                notification_type: 'job_search_complete',
                subject: emailContent.subject,
                content: emailContent.content,
                status: 'pending',
                created_at: new Date().toISOString(),
                metadata: {
                    job_count,
                    search_query,
                    subscription_plan,
                    job_limit: planLimits.daily_limit
                }
            });

        if (notificationError) {
            console.error('Failed to store notification:', notificationError);
        }

        // For now, return success (email service integration pending)
        console.log(`📧 Job notification queued for ${user_email}: ${job_count} jobs found`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Job search notification prepared for ${user_email}`,
                notification_id: notification?.[0]?.id,
                email_content: emailContent
            })
        };

    } catch (error) {
        console.error('❌ Email notification error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Failed to send notification',
                message: error.message
            })
        };
    }
};

// Create email content for job search completion
function createJobNotificationEmail({ user_email, job_count, search_query, plan_name, job_limit }) {
    const subject = `🎯 Your Jobsynt AI Job Search is Complete - ${job_count} Matched Jobs Found!`;
    
    const content = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 15px;">
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
            <h1 style="color: #4a5568; text-align: center; margin-bottom: 20px;">
                🚀 Your AI Job Search Results Are Ready!
            </h1>
            
            <div style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 25px;">
                <h2 style="margin: 0; font-size: 24px;">✨ ${job_count} High-Quality Jobs Found!</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9;">Search: "${search_query}"</p>
            </div>

            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                <h3 style="color: #2d3748; margin-top: 0;">🎯 Your Search Results:</h3>
                <ul style="color: #4a5568; line-height: 1.6;">
                    <li><strong>Jobs Found:</strong> ${job_count} out of ${job_limit} (${plan_name})</li>
                    <li><strong>Match Quality:</strong> Minimum 90% match score</li>
                    <li><strong>Required Skills:</strong> 100% match for must-have skills</li>
                    <li><strong>Ghost Jobs:</strong> All filtered out with AI detection</li>
                    <li><strong>GPT Analysis:</strong> Each job analyzed for authenticity</li>
                </ul>
            </div>

            <div style="text-align: center; margin: 30px 0;">
                <a href="https://jobsyntai.netlify.app/dashboard.html" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                          color: white; 
                          text-decoration: none; 
                          padding: 15px 30px; 
                          border-radius: 50px; 
                          font-weight: bold; 
                          font-size: 16px;
                          display: inline-block;
                          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                          transition: all 0.3s ease;">
                    🔍 View & Apply to Jobs →
                </a>
            </div>

            <div style="background: #edf2f7; padding: 15px; border-radius: 8px; margin-top: 25px;">
                <h4 style="color: #2d3748; margin-top: 0;">🔧 What You Can Do Next:</h4>
                <ul style="color: #4a5568; margin-bottom: 0;">
                    <li>📋 Analyze each job with our AI matching system</li>
                    <li>📝 Generate tailored cover letters for applications</li>
                    <li>🔗 Copy job links to analyze against your resume</li>
                    <li>👻 Trust our ghost job detection - all jobs are verified</li>
                    <li>⏰ Jobs refresh every 24 hours with new opportunities</li>
                </ul>
            </div>

            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 2px solid #e2e8f0;">
                <p style="color: #718096; margin: 0;">
                    Happy job hunting! 🎯<br>
                    <strong>The Jobsynt AI Team</strong>
                </p>
            </div>
        </div>
    </div>
    `;

    return { subject, content };
}

// Get job limits based on subscription plan
function getJobLimits(plan) {
    switch (plan?.toLowerCase()) {
        case 'professional':
        case 'pro':
            return {
                daily_limit: 20,
                plan_name: 'Professional ($29)'
            };
        case 'executive':
        case 'premium':
            return {
                daily_limit: 30,
                plan_name: 'Executive ($79)'
            };
        default:
            return {
                daily_limit: 10,
                plan_name: 'Free Plan'
            };
    }
} 