import { readJSON } from '@/utils/fs';
import TalentClient from './TalentClient';

type Candidate = {
  id: string;
  name: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  summary?: string;
};

async function getCandidates() {
  return readJSON<Candidate[]>('candidates.json');
}

export default async function TalentPoolPage() {
  const candidates = await getCandidates();
  return <TalentClient candidates={candidates} />;
}

