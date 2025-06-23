const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');

// Clean environment variables (remove quotes and semicolons)
const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/[';]/g, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[';]/g, '');
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Initialize OpenAI
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
}) : null;

exports.handler = async (event, context) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        console.log('Career chatbot function called');
        
        // Check if Supabase is available
        if (!supabase) {
            console.error('Supabase not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ 
                    error: 'Database not configured. Please check environment variables.',
                    debug: { supabaseUrl: !!supabaseUrl, supabaseKey: !!supabaseKey }
                })
            };
        }

        const { message, userId } = JSON.parse(event.body);
        console.log('Processing message for user:', userId);

        if (!message || !userId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Message and userId are required' })
            };
        }

        // Fetch user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (profileError && profileError.code !== 'PGRST116') {
            console.error('Error fetching profile:', profileError);
        }

        // Fetch user resume
        const { data: resume, error: resumeError } = await supabase
            .from('resumes')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (resumeError && resumeError.code !== 'PGRST116') {
            console.error('Error fetching resume:', resumeError);
        }

        // Fetch favorite companies
        const { data: favoriteCompanies, error: companiesError } = await supabase
            .from('favorite_companies')
            .select('*')
            .eq('user_id', userId);

        if (companiesError) {
            console.error('Error fetching favorite companies:', companiesError);
        }

        console.log('User data fetched:', {
            hasProfile: !!profile,
            hasResume: !!resume,
            favoriteCompaniesCount: favoriteCompanies ? favoriteCompanies.length : 0
        });

        // Generate AI response using real GPT
        const response = await generateGPTResponse(message, profile, resume, favoriteCompanies || []);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                response,
                userContext: {
                    hasProfile: !!profile,
                    hasResume: !!resume,
                    favoriteCompaniesCount: favoriteCompanies ? favoriteCompanies.length : 0
                }
            })
        };

    } catch (error) {
        console.error('Error in career chatbot:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message,
                debug: {
                    supabaseConfigured: !!supabase,
                    openaiConfigured: !!openai
                }
            })
        };
    }
};

async function generateGPTResponse(message, profile, resume, favoriteCompanies) {
    // Check if OpenAI is available
    if (!openai) {
        console.log('OpenAI not available, using fallback response');
        return "I'm currently unable to access my AI capabilities. Please try again later or contact support if the issue persists.";
    }

    try {
        // Build comprehensive user context for GPT
        const userContext = {
            hasProfile: !!profile,
            hasResume: !!resume,
            currentTitle: profile?.current_title || 'Not specified',
            targetRole: profile?.target_role || 'Not specified',
            skills: profile?.skills || 'Not specified',
            experience: profile?.years_of_experience || 'Not specified',
            location: profile?.location || 'Not specified',
            resumeFileName: resume?.file_name || 'No resume uploaded',
            favoriteCompanies: favoriteCompanies ? favoriteCompanies.map(c => c.name) : [],
            favoriteCompaniesCount: favoriteCompanies ? favoriteCompanies.length : 0
        };

        console.log('Generating GPT response for user context:', userContext);

        // Create detailed system prompt with user's actual data
        const systemPrompt = `You are an expert AI Career Assistant for Jobsynt, a professional job search platform. You have access to the user's complete profile and resume data.

USER PROFILE INFORMATION:
- Current Title: ${userContext.currentTitle}
- Target Role: ${userContext.targetRole}
- Skills: ${userContext.skills}
- Years of Experience: ${userContext.experience}
- Location: ${userContext.location}
- Resume File: ${userContext.resumeFileName}
- Favorite Companies: ${userContext.favoriteCompanies.length > 0 ? userContext.favoriteCompanies.join(', ') : 'None added yet'}

INSTRUCTIONS:
- Provide personalized career advice based on their actual profile data
- Reference their specific information (current title, skills, resume file name, etc.) when relevant
- Be professional, supportive, and actionable in your responses
- Help with job search strategies, resume optimization, interview preparation, networking, and career planning
- If they ask about their profile/resume access, confirm you can see their data and reference specific details
- Keep responses concise but comprehensive (aim for 2-4 paragraphs)
- Use their actual job title and experience level to provide relevant advice
- If they have favorite companies, reference them when giving networking or application advice

RESPONSE STYLE:
- Professional but friendly tone
- Use bullet points for actionable advice when appropriate
- Reference their specific career situation
- Provide concrete, practical recommendations
- Ask follow-up questions to continue the conversation`;

        // Generate response using GPT
        const completion = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const response = completion.choices[0].message.content;
        console.log('GPT response generated successfully');
        return response;

    } catch (error) {
        console.error('Error generating GPT response:', error);
        
        // Provide a helpful fallback response with user's actual data
        const userContext = {
            currentTitle: profile?.current_title,
            resumeFileName: resume?.file_name,
            favoriteCompanies: favoriteCompanies ? favoriteCompanies.map(c => c.name) : []
        };

        if (message.toLowerCase().includes('resume') && userContext.resumeFileName) {
            return `I can see your resume "${userContext.resumeFileName}" and your profile as a ${userContext.currentTitle}. While I'm experiencing some technical difficulties with my AI processing, I can confirm I have access to your data. Please try your question again, or visit the AI Resume Assistant section for detailed resume analysis.`;
        } else if (message.toLowerCase().includes('profile') && userContext.currentTitle) {
            return `Yes, I can see your profile! You're working as a ${userContext.currentTitle}. I'm currently experiencing some technical difficulties with my AI processing, but I have access to your complete profile data. Please try your question again in a moment.`;
        } else {
            return `I'm currently experiencing some technical difficulties with my AI processing, but I can see your profile data. Please try your question again, or feel free to explore the other sections of the platform while I get back online.`;
        }
    }
} 