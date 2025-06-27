const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');
const FormData = require('form-data');
const formidable = require('formidable');
const { Readable } = require('stream');
const cheerio = require('cheerio');

const openaiApiKey = process.env.OPENAI_API_KEY;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const BUCKET_RESUMES = 'resumes';
const BUCKET_COVER_LETTERS = 'cover.letters';

async function fetchJobDescriptionFromLink(link) {
  try {
    const { data } = await axios.get(link, { timeout: 10000 });
    const $ = cheerio.load(data);
    // Try to extract main job description text
    let jd = $('body').text();
    if (jd.length > 2000) jd = jd.slice(0, 2000); // Limit for prompt
    return jd;
  } catch (e) {
    return '';
  }
}

async function generateAIContent({ resumeText, jobDescription, action }) {
  const prompt = `You are a professional AI Resume Assistant. Given the following resume and job description, do the following:

1. Write a fresh, tailored professional summary for the candidate, optimized for the job.
2. Suggest improvements for other resume sections (skills, experience, etc.) to better match the job.
3. If asked for a cover letter, write a personalized cover letter for the candidate for this job.

Resume:
${resumeText}

Job Description:
${jobDescription}

${action === 'cover' ? 'Write a new cover letter for this candidate.' : ''}`;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a professional AI Resume Assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.7,
    max_tokens: 800
  }, {
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.choices[0].message.content;
}

async function saveToBucket(bucket, fileName, fileBuffer, contentType) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.storage.from(bucket).upload(fileName, fileBuffer, {
    upsert: true,
    contentType
  });
  if (error) throw error;
  return data;
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const form = new formidable.IncomingForm({ multiples: false });
    const formData = await new Promise((resolve, reject) => {
      form.parse(event, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const { fields, files } = formData;
    const userId = fields.userId || 'anonymous';
    const action = fields.action || 'review'; // 'review' or 'cover'
    let jobDescription = fields.jobDescription || '';
    const jobLink = fields.jobLink || '';
    let resumeText = '';
    let resumeFileName = '';
    let resumeBuffer = null;
    let resumeContentType = '';

    // If job link is provided, try to fetch JD
    if (jobLink && !jobDescription) {
      jobDescription = await fetchJobDescriptionFromLink(jobLink);
    }

    // Read resume file
    if (files.resume) {
      const file = files.resume;
      resumeFileName = `${userId}_resume_${Date.now()}`;
      resumeBuffer = require('fs').readFileSync(file.filepath);
      resumeContentType = file.mimetype || 'application/pdf';
      // Try to extract text from PDF or DOCX (simple fallback: use file name)
      resumeText = file.originalFilename || 'Resume';
    } else {
      return { statusCode: 400, body: 'Resume file is required.' };
    }

    // Generate AI content
    const aiResult = await generateAIContent({ resumeText, jobDescription, action });

    // Save resume to Supabase bucket
    await saveToBucket(BUCKET_RESUMES, `${userId}.pdf`, resumeBuffer, resumeContentType);

    let coverLetter = '';
    if (action === 'cover') {
      coverLetter = aiResult;
      // Save cover letter to Supabase bucket
      await saveToBucket(BUCKET_COVER_LETTERS, `${userId}.txt`, Buffer.from(coverLetter, 'utf-8'), 'text/plain');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        summary: action === 'cover' ? '' : aiResult,
        suggestions: action === 'cover' ? '' : aiResult,
        coverLetter: coverLetter || '',
        message: 'AI Resume review completed.'
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
}; 