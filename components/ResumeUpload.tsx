'use client';

import React from 'react';
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
  const handleFile = async (file?: File) => {
    if (!file) return;
    const text = await file.text(); // best-effort; works for text/PDFs with embedded text
    const email = text.match(emailRegex)?.[0];
    const firstLine = text.split('\n').map((l) => l.trim()).find((l) => l.length > 3);
    const skills = extractSkills(text);
    onParsed({ text, name: firstLine, email, skills });
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-ink">Resume upload (PDF/text)</label>
      <input
        type="file"
        accept=".pdf,.txt"
        onChange={(e) => handleFile(e.target.files?.[0])}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
      />
      <Button type="button" variant="ghost" onClick={() => handleFile(undefined)}>
        Clear
      </Button>
      <p className="text-xs text-muted">We extract text only (no storage) to prefill your profile.</p>
    </div>
  );
}

