import { cookies } from 'next/headers';
import { readJSON } from '@/utils/fs';
import JobsClient from './JobsClient';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience: string;
  skills: string[];
  workMode: string;
  summary?: string;
  rate?: string;
};

async function getJobs() {
  return readJSON<Job[]>('jobs.json');
}

export default async function JobsPage() {
  const jobs = await getJobs();
  cookies(); // keep dynamic to allow future auth usage
  return <JobsClient jobs={jobs} />;
}

