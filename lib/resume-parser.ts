'use client';

export interface ParsedResumeData {
  rawText: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string[];
  education: string[];
}

export async function extractResumeText(file: File): Promise<string> {
  // Import PDF.js dynamically
  const pdfjsLib = await import('pdfjs-dist/build/pdf.min.js');
  
  // Use CDN worker instead of local file
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({
      data: arrayBuffer,
      disableFontFace: true,
      useSystemFonts: true
    }).promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      text += content.items
        .map((item: any) => item.str || ' ')
        .join('') + '\n';
    }
    return text;
  } catch (error) {
    console.error('PDF error:', error);
    throw new Error('Failed to parse PDF');
  }
}
export function parseResumeText(text: string): ParsedResumeData {
  return {
    rawText: text,
    first_name: extractFirstName(text),
    last_name: extractLastName(text),
    email: extractEmail(text),
    phone: extractPhone(text),
    skills: extractSkills(text),
    experience: extractDates(text),
    education: extractEducation(text)
  };
}

// Helper functions with explicit return types
function extractFirstName(text: string): string {
  const match = text.match(/^([A-Z][a-z]+)/);
  return match?.[0] || '';
}

function extractLastName(text: string): string {
  const match = text.match(/^[A-Z][a-z]+\s+([A-Z][a-z]+)/);
  return match?.[1] || '';
}

function extractEmail(text: string): string {
  const match = text.match(/\S+@\S+\.\S+/);
  return match?.[0] || '';
}

function extractPhone(text: string): string {
  const match = text.match(/(\+\d{1,3}\s?)?(\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/);
  return match?.[0] || '';
}

function extractSkills(text: string): string[] {
  const skills = ['JavaScript', 'React', 'Node', 'Python', 'SQL'];
  return skills.filter(skill => text.includes(skill));
}

function extractDates(text: string): string[] {
  const matches = text.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{4}/gi);
  return matches || [];
}

function extractEducation(text: string): string[] {
  const matches = text.match(/\b(University|College|Institute|Bachelor|Master|PhD)\b/gi);
  return matches || [];
}