const { Configuration, OpenAIApi } = require('openai');

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// GPT-4 prompts
const PROMPTS = {
    resume_optimization: `You are a Resume Optimization AI for Jobsynt. Your goal is to enhance resumes for specific job applications without exaggerating or falsifying experience.

    INPUT ANALYSIS:
    - Candidate's original resume
    - Industry standards and keywords

    OPTIMIZATION PROCESS:
    1. KEYWORD INTEGRATION:
       - Extract relevant keywords
       - Naturally integrate into existing experience descriptions
       - Maintain authenticity

    2. FORMATTING ENHANCEMENT:
       - Improve grammar, punctuation, and readability
       - Optimize bullet points for ATS scanning
       - Ensure consistent formatting

    3. IMPACT AMPLIFICATION:
       - Transform passive descriptions into active, results-oriented statements
       - Add quantifiable achievements where possible
       - Emphasize transferable skills

    4. SKILL MATRIX CREATION:
       - Create a skills matrix showing proficiency levels
       - Suggest skill development areas

    Analyze the following resume:`,

    job_matching: `You are an AI Job Agent for Jobsynt, acting as an intelligent recruiter. Your role is to analyze candidate profiles and match them with job opportunities.

    CANDIDATE PROFILE ANALYSIS:
    - Extract and categorize: skills, experience level, industry, location preferences
    - Identify career trajectory and growth potential

    JOB MATCHING CRITERIA:
    1. Skills alignment (70% weight)
    2. Location compatibility (20% weight)
    3. Compensation alignment (10% weight)

    Analyze the following profile and job:`,

    ghost_detection: `You are the Ghost Job Detection AI for Jobsynt. Your mission is to identify fake, expired, or "ghost" job postings.

    GHOST JOB INDICATORS:
    1. Posting age and patterns
    2. Company behavior and history
    3. Content analysis
    4. Response patterns

    Analyze the following job posting:`,

    career_guidance: `You are the Career Intelligence AI for Jobsynt, serving as a career mentor and advisor.

    PROVIDE:
    1. Industry insights and trends
    2. Personalized recommendations
    3. Skill development suggestions
    4. Career path guidance

    Based on the following profile:`
};

async function getGPTResponse(prompt, content) {
    try {
        const completion = await openai.createChatCompletion({
            model: "gpt-4",
            messages: [
                { role: "system", content: prompt },
                { role: "user", content }
            ],
            temperature: 0.7,
            max_tokens: 2000
        });

        return completion.data.choices[0].message.content;
    } catch (error) {
        console.error('GPT API Error:', error);
        throw new Error('Failed to get AI response');
    }
}

// API Endpoints
module.exports = {
    async analyzeResume(req, res) {
        try {
            const { resume_text } = req.body;
            const response = await getGPTResponse(PROMPTS.resume_optimization, resume_text);
            
            // Parse GPT response into structured format
            const analysis = JSON.parse(response);
            res.json(analysis);
        } catch (error) {
            res.status(500).json({ error: 'Resume analysis failed' });
        }
    },

    async matchJobs(req, res) {
        try {
            const { profile, jobs } = req.body;
            const response = await getGPTResponse(
                PROMPTS.job_matching,
                JSON.stringify({ profile, jobs })
            );
            
            const matches = JSON.parse(response);
            res.json(matches);
        } catch (error) {
            res.status(500).json({ error: 'Job matching failed' });
        }
    },

    async detectGhostJob(req, res) {
        try {
            const { job_posting } = req.body;
            const response = await getGPTResponse(
                PROMPTS.ghost_detection,
                JSON.stringify(job_posting)
            );
            
            const analysis = JSON.parse(response);
            res.json(analysis);
        } catch (error) {
            res.status(500).json({ error: 'Ghost job detection failed' });
        }
    },

    async getCareerGuidance(req, res) {
        try {
            const { profile, query } = req.body;
            const response = await getGPTResponse(
                PROMPTS.career_guidance,
                JSON.stringify({ profile, query })
            );
            
            const guidance = JSON.parse(response);
            res.json(guidance);
        } catch (error) {
            res.status(500).json({ error: 'Career guidance failed' });
        }
    }
}; 