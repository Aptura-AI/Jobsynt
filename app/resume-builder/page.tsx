import * as pdfjsLib from 'pdfjs-dist';
import 'pdfjs-dist/build/pdf.worker.entry'; // Prevents worker error

export interface ResumeData {
  rawText: string;
  email: string;
  phone: string;
  name?: string;
  skills?: string[];
  experience?: string[];
  education?: string[];
}

export async function extractResumeText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let textContent = '';

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const text = await page.getTextContent();
    const pageText = text.items.map((item: any) => item.str).join(' ');
    textContent += pageText + '\n';
  }

  return textContent;
}

export function extractName(rawText: string): string {
  const lines = rawText.split('\n');
  return lines[0]?.trim() || '';
}

export function extractSkills(rawText: string): string[] {
  const skills: string[] = [];
  const skillSectionRegex = /(skills|technical skills)[:\s]*/i;
  const lines = rawText.split('\n');

  let capture = false;
  for (const line of lines) {
    if (skillSectionRegex.test(line)) {
      capture = true;
      continue;
    }
    if (capture) {
      if (line.trim() === '' || line.length > 100) break;
      skills.push(...line.split(/[,•]/).map(s => s.trim()));
    }
  }
  return skills.filter(skill => skill.length > 1);
}

export function extractExperience(rawText: string): string[] {
  const experience: string[] = [];
  const lines = rawText.split('\n');

  for (const line of lines) {
    if (/(\d{4})\s*[-–]\s*(\d{4}|present)/i.test(line)) {
      experience.push(line.trim());
    }
  }
  return experience;
}

export function extractEducation(rawText: string): string[] {
  const education: string[] = [];
  const educationRegex = /(Bachelor|Master|B\.Sc|M\.Sc|Ph\.D|B\.Tech|M\.Tech|BA|MA|BS|MS)/i;
  const lines = rawText.split('\n');

  for (const line of lines) {
    if (educationRegex.test(line)) {
      education.push(line.trim());
    }
  }
  return education;
}
