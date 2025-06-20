import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// AI-powered job matching
router.post('/match', async (req, res) => {
  try {
    const { skills, experience, preferences } = req.body;
    const prompt = `Find the best job matches for a candidate with these skills: ${skills}. Experience: ${experience}. Preferences: ${preferences}. Return a JSON array of job matches with title, company, matchScore, visaFriendly, and a short reason.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 800
    });
    const jobs = JSON.parse(completion.choices[0].message.content);
    res.json({ jobs });
  } catch (error) {
    res.status(500).json({ error: 'Job matching failed', details: error.message });
  }
});

// Ghost job detector
router.post('/ghost-check', async (req, res) => {
  try {
    const { url, jobDescription } = req.body;
    const prompt = `Analyze this job posting for signs of being a ghost job (fake, expired, or non-responsive): ${url} \nDescription: ${jobDescription}. Return JSON with isGhost, confidence, and explanation.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400
    });
    const result = JSON.parse(completion.choices[0].message.content);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Ghost job check failed', details: error.message });
  }
});

// Visa/sponsorship support
router.post('/visa-support', async (req, res) => {
  try {
    const { skills, visaType } = req.body;
    const prompt = `List companies and jobs in the US that are friendly to ${visaType} visa holders for someone with these skills: ${skills}. Return a JSON array with company, jobTitle, and visaSupportLevel.`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600
    });
    const results = JSON.parse(completion.choices[0].message.content);
    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: 'Visa support check failed', details: error.message });
  }
});

export default router; 