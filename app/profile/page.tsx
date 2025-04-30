// app/profile/page.tsx
'use client';

import { useState, ChangeEvent } from 'react';
import { extractResumeText, parseResumeText } from '@/lib/resume-parser';

interface ParsedResumeData {
  rawText: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string[];
  education: string[];
  links: string[];
}

export default function ProfilePage() {
  const [parsedData, setParsedData] = useState<ParsedResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const text = await extractResumeText(e.target.files[0]);
      const data = parseResumeText(text);
      setParsedData(data);
    } catch (err) {
      setError('Failed to parse resume. Please try another PDF file.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Upload Resume</h1>
      
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        disabled={isLoading}
        className="mb-4"
      />
      
      {isLoading && <p>Processing resume...</p>}
      {error && <p className="text-red-500">{error}</p>}
      
      {parsedData && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Parsed Data</h2>
          <pre className="bg-gray-100 p-4 rounded">
            {JSON.stringify(parsedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ParsedResumeData {
  rawText: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string[];
  education: string[];
  links: string[];
}