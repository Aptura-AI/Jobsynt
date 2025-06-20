import express from 'express';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Career chatbot
router.post('/', async (req, res) => {
  try {
    const { message, context } = req.body;
    const prompt = `You are a career advisor AI. Answer the following question with actionable advice.\n${context ? 'Context: ' + context + '\n' : ''}Question: ${message}`;
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 600
    });
    const reply = completion.choices[0].message.content;
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: 'Chatbot failed', details: error.message });
  }
});

export default router; 