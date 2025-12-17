type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience?: string;
  skills?: string[];
  workMode?: string;
  summary?: string;
};

type Candidate = {
  id: string;
  name: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  status?: string;
};

export type JobFilterParams = {
  search?: string;
  location?: string;
  experience?: string;
  workMode?: string;
  skills?: string[];
};

export type CandidateFilterParams = {
  search?: string;
  location?: string;
  minExperience?: number;
  skills?: string[];
};

const matchesText = (value: string, search?: string) =>
  !search || value.toLowerCase().includes(search.toLowerCase());

const matchesSkills = (itemSkills: string[], skills?: string[]) =>
  !skills || skills.length === 0 || skills.every((skill) => itemSkills.map((s) => s.toLowerCase()).includes(skill.toLowerCase()));

export function filterJobs(jobs: Job[], params: JobFilterParams) {
  return jobs.filter((job) => {
    const searchMatch =
      matchesText(job.title, params.search) ||
      matchesText(job.company, params.search) ||
      matchesText(job.summary || '', params.search);
    const locationMatch = !params.location || job.location.toLowerCase().includes(params.location.toLowerCase());
    const experienceMatch = !params.experience || (job.experience && job.experience === params.experience);
    const workModeMatch = !params.workMode || (job.workMode && job.workMode === params.workMode);
    const skillsMatch = matchesSkills(job.skills || [], params.skills);
    return searchMatch && locationMatch && experienceMatch && workModeMatch && skillsMatch;
  });
}

export function filterCandidates(candidates: Candidate[], params: CandidateFilterParams) {
  return candidates.filter((cand) => {
    const searchMatch =
      matchesText(cand.name, params.search) ||
      matchesText(cand.title, params.search);
    const locationMatch = !params.location || cand.location.toLowerCase().includes(params.location.toLowerCase());
    const experienceMatch = params.minExperience === undefined || cand.experience >= params.minExperience;
    const skillsMatch = matchesSkills(cand.skills, params.skills);
    return searchMatch && locationMatch && experienceMatch && skillsMatch;
  });
}

