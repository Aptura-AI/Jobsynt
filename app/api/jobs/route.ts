// app/api/jobs/route.ts

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query') || 'developer';

  const [remotive, arbeitnow, jsearch] = await Promise.all([
    safeFetchRemotive(query),
    safeFetchArbeitnow(),
    safeFetchJSearch(query),
  ]);

  const combined = [...remotive, ...arbeitnow, ...jsearch];
  return NextResponse.json(combined);
}

// --- Safe API Wrappers ---

const safeFetchRemotive = async (query: string) => {
  try {
    const res = await fetch(`https://remotive.io/api/remote-jobs?search=${query}`);
    if (!res.ok) throw new Error(`Remotive response not ok: ${res.status}`);
    const data = await res.json();
    return data.jobs?.map((job: any) => ({
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location,
      url: job.url,
      source: 'Remotive'
    })) || [];
  } catch (error) {
    console.error('Remotive fetch error:', error);
    return [];
  }
};

const safeFetchArbeitnow = async () => {
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api');
    if (!res.ok) throw new Error(`Arbeitnow response not ok: ${res.status}`);
    const data = await res.json();
    return data.data?.map((job: any) => ({
      title: job.title,
      company: job.company_name,
      location: job.location,
      url: job.url,
      source: 'Arbeitnow'
    })) || [];
  } catch (error) {
    console.error('Arbeitnow fetch error:', error);
    return [];
  }
};

const safeFetchJSearch = async (query: string) => {
  try {
    const res = await fetch(`https://jsearch.p.rapidapi.com/search?query=${query}`, {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    });
    if (!res.ok) throw new Error(`JSearch response not ok: ${res.status}`);
    const data = await res.json();
    return data.data?.map((job: any) => ({
      title: job.job_title,
      company: job.employer_name,
      location: job.job_city || job.job_country,
      url: job.job_apply_link,
      source: 'JSearch'
    })) || [];
  } catch (error) {
    console.error('JSearch fetch error:', error);
    return [];
  }
};
