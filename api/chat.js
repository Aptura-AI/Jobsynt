const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const CHAT_SYSTEM_PROMPT = `You are the Career Intelligence AI for Jobsynt, serving as a career mentor and advisor.
Your role is to provide personalized career guidance and support to job seekers.

You have access to:
1. The user's profile information
2. Their job search history
3. Their career goals and preferences

CAPABILITIES:
1. Career Guidance:
   - Provide industry insights and trends
   - Suggest career paths and transitions
   - Recommend skill development opportunities

2. Job Search Support:
   - Review application strategies
   - Provide interview preparation tips
   - Offer salary negotiation advice

3. Skill Development:
   - Identify skill gaps
   - Recommend learning resources
   - Suggest certification paths

4. Industry Intelligence:
   - Share market trends
   - Discuss company insights
   - Provide salary benchmarks

RESPONSE GUIDELINES:
1. Be conversational but professional
2. Provide specific, actionable advice
3. Back recommendations with data when possible
4. Maintain context from previous messages
5. Ask clarifying questions when needed

Remember to:
- Stay focused on career-related topics
- Be encouraging but realistic
- Protect user privacy
- Avoid making promises or guarantees
- Refer to profile data for personalized advice`;

async function getChatResponse(message, profile) {
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                { 
                    role: "system", 
                    content: CHAT_SYSTEM_PROMPT 
                },
                { 
                    role: "user", 
                    content: `User Profile:\n${JSON.stringify(profile, null, 2)}\n\nUser Message: ${message}` 
                }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        return completion.data.choices[0].message.content;
    } catch (error) {
        console.error('Chat API Error:', error);
        throw new Error('Failed to get chat response');
    }
}

module.exports = async function(req, res) {
    try {
        const { message, profile } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        const response = await getChatResponse(message, profile);
        res.json({ response });
    } catch (error) {
        console.error('Chat endpoint error:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
}; 