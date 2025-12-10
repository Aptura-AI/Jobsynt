// netlify/functions/paste-job-urls.js
// Accepts POST with array of job URLs, fetches/extracts job info, saves to Supabase, returns summary

const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function extractJobFromURL(url) {
  try {
    const res = await fetch(url, { timeout: 15000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const $ = cheerio.load(html);
    // Try to extract title, description, company
    let title = $('title').first().text().trim();
    let description = $('meta[name="description"]').attr('content') || '';
    if (!description) description = $('p').first().text().trim();
    let company = '';
    // Try to extract company from meta or domain
    company = $('meta[property="og:site_name"]').attr('content') || '';
    if (!company && url) {
      try { company = new URL(url).hostname.replace('www.', ''); } catch {}
    }
    return { url, title, description, company, scraped_at: new Date().toISOString().split('T')[0], source: company };
  } catch (e) {
    return { url, error: e.message };
  }
}

async function saveJobToSupabase(job) {
  if (!job.url || job.error) return { ...job, saved: false };
  try {
    const { error } = await supabase
      .from('scraped_jobs')
      .upsert([job], { onConflict: 'url' });
    if (error) return { ...job, saved: false, error: error.message };
    return { ...job, saved: true };
  } catch (e) {
    return { ...job, saved: false, error: e.message };
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: 'Method Not Allowed' };
  }
  let urls = [];
  try {
    const body = JSON.parse(event.body);
    urls = Array.isArray(body.urls) ? body.urls : [];
  } catch {
    return { statusCode: 400, headers, body: 'Invalid request body' };
  }
  if (!urls.length) {
    return { statusCode: 400, headers, body: 'No URLs provided' };
  }
  const results = [];
  for (const url of urls) {
    const job = await extractJobFromURL(url);
    const saved = await saveJobToSupabase(job);
    results.push(saved);
  }
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ success: true, count: results.length, results })
  };
}; 