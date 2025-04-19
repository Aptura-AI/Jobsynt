// app/utils/jobsFetcher.ts

type Job = {
  title: string;
  company: string;
  location: string;
  description: string;
  applyLink: string;
  source: 'remotive' | 'jsearch';
};

// ✅ JSearch API (RapidAPI)
export const fetchFromJSearch = async (keyword: string): Promise<Job[]> => {
  try {
    const res = await fetch(`https://jsearch.p.rapidapi.com/search?query=${keyword}`, {
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY!,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
      },
    });

    if (!res.ok) {
      throw new Error(`JSearch fetch failed: ${res.status}`);
    }

    const data = await res.json();

    if (!data.data || !Array.isArray(data.data)) return [];

    return data.data.map((job: any) => ({
      title: job.job_title,
      company: job.employer_name,
      location: [job.job_city, job.job_state].filter(Boolean).join(', '),
      description: job.job_description,
      applyLink: job.job_apply_link,
      source: 'jsearch',
    }));
  } catch (error) {
    console.error('JSearch fetch error:', error);
    return [];
  }
};

// ✅ Remotive API
export const fetchFromRemotive = async (keyword: string): Promise<Job[]> => {
  try {
    const res = await fetch(`https://remotive.io/api/remote-jobs?search=${keyword}`);
    if (!res.ok) throw new Error(`Remotive fetch failed: ${res.status}`);

    const data = await res.json();
    if (!data.jobs || !Array.isArray(data.jobs)) return [];

    return data.jobs.map((job: any) => ({
      title: job.title,
      company: job.company_name,
      location: job.candidate_required_location,
      description: job.description,
      applyLink: job.url,
      source: 'remotive',
    }));
  } catch (error) {
    console.error('Remotive fetch error:', error);
    return [];
  }
};

// ✅ Combined fetch
export const fetchAllJobs = async (keyword: string): Promise<Job[]> => {
  const [remotiveJobs, jsearchJobs] = await Promise.all([
    fetchFromRemotive(keyword),
    fetchFromJSearch(keyword),
  ]);

  return [...remotiveJobs, ...jsearchJobs];
};
