/**
 * Shared Type Definitions
 */

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  experience?: string;
  skills?: string[];
  workMode?: string;
  summary?: string;
  rate?: string;
  url: string;
  posted_date?: string;
};
