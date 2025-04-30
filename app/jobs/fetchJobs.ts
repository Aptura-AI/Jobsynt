import axios from 'axios';

interface FetchJobsParams {
  query: string;
  location?: string;
  employment_type?: string;
  date_posted?: string;
  pages?: number;
}

export const fetchJobs = async ({
  query,
  location,
  employment_type,
  date_posted,
  pages = 1,
}: FetchJobsParams) => {
  const allJobs: any[] = [];
  
  try {
    for (let page = 1; page <= pages; page++) {
      const response = await axios.get('https://jsearch.p.rapidapi.com/search', {
        params: {
          query,
          page: page.toString(),
          num_pages: '1',
          ...(location && { location }),
          ...(employment_type && { employment_type }),
          ...(date_posted && { date_posted }),
        },
        headers: {
          'X-RapidAPI-Key': process.env.NEXT_PUBLIC_RAPIDAPI_KEY || 'YOUR_RAPIDAPI_KEY',
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        },
      });

      if (response.status === 200 && Array.isArray(response.data.data)) {
        allJobs.push(...response.data.data);
      } else {
        console.warn(`Unexpected response structure on page ${page}:`, response.data);
      }
    }

    return allJobs;
  } catch (error: any) {
    if (axios.isAxiosError(error)) {
      console.error(`Axios error fetching jobs: ${error.response?.status} - ${error.response?.data?.message || error.message}`);
    } else {
      console.error('Unexpected error fetching jobs:', error);
    }
    return [];
  }
};
