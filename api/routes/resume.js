import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI-powered resume optimization
router.post('/optimize', async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;
    const prompt = `Optimize this resume for the following job description. Highlight improvements and return the optimized resume as plain text.\nResume: ${resume}\nJob Description: ${jobDescription}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1200
    });
    const optimizedResume = completion.choices[0].message.content;
    res.json({ optimizedResume });
  } catch (error) {
    res.status(500).json({ error: 'Resume optimization failed', details: error.message });
  }
});

// Keyword analysis
router.post('/keywords', async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;
    const prompt = `Analyze the following resume and job description. List the top 10 keywords missing from the resume that are important for the job.\nResume: ${resume}\nJob Description: ${jobDescription}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400
    });
    const keywords = completion.choices[0].message.content;
    res.json({ keywords });
  } catch (error) {
    res.status(500).json({ error: 'Keyword analysis failed', details: error.message });
  }
});

export default router; 