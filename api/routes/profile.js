import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI-powered profile analysis
router.post('/analyze', async (req, res) => {
  try {
    const { skills, experience, education, visaStatus, careerGoals } = req.body;
    const prompt = `Analyze this professional profile and provide detailed insights, skill gap analysis, career path recommendations, industry fit, visa-friendly opportunities, salary expectations, and professional development suggestions.\nSkills: ${skills}\nExperience: ${experience}\nEducation: ${education}\nVisa Status: ${visaStatus}\nCareer Goals: ${careerGoals}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1200
    });
    const analysis = completion.choices[0].message.content;
    res.json({ analysis });
  } catch (error) {
    res.status(500).json({ error: 'Profile analysis failed', details: error.message });
  }
});

export default router; 