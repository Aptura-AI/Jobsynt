import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.js`;

export type ParsedResumeData = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  education?: string[];
  experience?: string[];
  skills?: string[];
  summary?: string;
};

export async function parseResume(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf: PDFDocumentProxy = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let text = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => item.str).join(' ');
    text += pageText + '\n';
  }

  return text;
}

export function extractStructuredDataFromText(text: string): ParsedResumeData {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const phoneRegex = /(\+?\d{1,2})?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

  const email = text.match(emailRegex)?.[0];
  const phone = text.match(phoneRegex)?.[0];

  return {
    name: undefined, // Can add logic later
    email,
    phone,
    location: undefined, // Optional: extract using patterns
    education: [],
    experience: [],
    skills: [],
    summary: '',
  };
}
