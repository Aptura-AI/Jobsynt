'use client';

import React, { useState } from 'react';
import Button from './Button';

type Props = {
  onParsed: (data: { text: string; name?: string; email?: string; skills?: string[] }) => void;
};

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function extractSkills(text: string) {
  const skillWords = Array.from(
    new Set(
      text
        .split(/[\n,;]+/)
        .map((w) => w.trim())
        .filter((w) => w.length > 2 && w.length < 40),
    ),
  );
  const filtered = skillWords.filter((w) => /[A-Za-z]/.test(w) && w.length < 25);
  return filtered.slice(0, 15);
}

export default function ResumeUpload({ onParsed }: Props) {
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file?: File) => {
    setError(null);
    
    if (!file) {
      onParsed({ text: '' });
      return;
    }

    // Client-side validation: PDF only
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes are supported. Please upload a PDF file.');
      return;
    }

    const text = await file.text(); // best-effort; works for PDFs with embedded text
    const email = text.match(emailRegex)?.[0];
    const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 3);
    const skills = extractSkills(text);
    onParsed({ text, name: firstLine, email, skills });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    
    // Client-side validation before processing
    if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes are supported. Please upload a PDF file.');
      e.target.value = ''; // Reset file input
      return;
    }
    
    handleFile(file);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">
        Resume (<span className="font-bold">PDF ONLY</span>)
      </label>
      <input
        type="file"
        accept="application/pdf"
        onChange={handleChange}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
      />
      {error && (
        <p className="text-xs text-red-600 font-medium">{error}</p>
      )}
      <Button type="button" variant="ghost" onClick={() => handleFile(undefined)}>
        Clear
      </Button>
      <p className="text-xs text-muted">Only PDF resumes are supported.</p>
    </div>
  );
}
