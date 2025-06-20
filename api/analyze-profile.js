import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

class ProfileAnalyzer {
    constructor() {
        this.model = 'gpt-4';
    }

    async analyzeProfile(profile) {
        try {
            const prompt = this._createAnalysisPrompt(profile);
            const completion = await openai.chat.completions.create({
                model: this.model,
            messages: [
                    { role: "system", content: "You are an expert career advisor and profile analyzer." },
                    { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1000
        });
            return this._parseAnalysis(completion.choices[0].message.content);
    } catch (error) {
        console.error('Profile analysis error:', error);
            throw new Error('Failed to analyze profile');
    }
}

    _createAnalysisPrompt(profile) {
        return `Analyze this professional profile:
            Skills: ${profile.skills.join(', ')}
            Experience: ${profile.experience}
            Education: ${profile.education}
            Visa Status: ${profile.visaStatus}
            Career Goals: ${profile.careerGoals}`;
    }

    _parseAnalysis(analysis) {
        return {
            skillGaps: this._extractSection(analysis, 'Skill gap analysis'),
            careerPath: this._extractSection(analysis, 'Career path recommendations'),
            industryFit: this._extractSection(analysis, 'Industry fit assessment'),
            visaOpportunities: this._extractSection(analysis, 'Visa-friendly opportunities'),
            salaryExpectations: this._extractSection(analysis, 'Salary expectations'),
            developmentSuggestions: this._extractSection(analysis, 'Professional development suggestions')
        };
    }

    _extractSection(text, section) {
        const regex = new RegExp(`${section}:\\s*([^\\n]+)`);
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    }
}

export default new ProfileAnalyzer(); 