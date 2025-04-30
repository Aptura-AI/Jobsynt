import axios from 'axios';
// Ensure Jest types are available
jest.mock('axios');                                  // 1. Tell Jest to mock axios :contentReference[oaicite:5]{index=5}
const mockedAxios = axios as jest.Mocked<typeof axios>; // 2. Cast to the mocked type :contentReference[oaicite:6]{index=6}

import { fetchJobs } from './fetchJobs';

describe('fetchJobs', () => {
  it('returns job data on success', async () => {
    // 3. Provide a fake response payload
    const fakeJobs = [
      { job_id: '1', job_title: 'Dev A', job_description: 'Desc A' },
      { job_id: '2', job_title: 'Dev B', job_description: 'Desc B' },
    ];
    mockedAxios.get.mockResolvedValue({ status: 200, data: { data: fakeJobs } });

    const jobs = await fetchJobs({ query: 'engineer', pages: 1 });
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs).toHaveLength(2);
    expect(jobs[0]).toMatchObject({ job_title: 'Dev A' });
  });

  it('handles API errors gracefully', async () => {
    // 4. Simulate a non-200 response
    mockedAxios.get.mockResolvedValue({ status: 500, data: {} });
    const jobs = await fetchJobs({ query: 'engineer', pages: 1 });
    expect(jobs).toEqual([]);  // empty array on bad status :contentReference[oaicite:7]{index=7}
  });

  it('catches network failures', async () => {
    // 5. Simulate network error
    mockedAxios.get.mockRejectedValue(new Error('Network Error'));
    const jobs = await fetchJobs({ query: 'engineer', pages: 1 });
    expect(jobs).toEqual([]);  // empty array on exception :contentReference[oaicite:8]{index=8}
  });
});
