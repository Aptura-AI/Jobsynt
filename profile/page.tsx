'use client';

import * as React from 'react';
import { useState } from 'react';
import { parseResumeWithPdfco } from '../lib/pdfcoClient';
import { OpenAI } from 'openai';


const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function ProfilePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);

    try {
      // Convert to base64
      const base64 = await convertToBase64(file);

      // Send to PDF.co
      const pdfcoResult = await parseResumeWithPdfco(base64);

      // Send to OpenAI for structured refinement
      const prompt = `Extract the following fields from this resume JSON: firstName, middleName, lastName, city, state, email, phone, linkedin, education (array with degree, field, from, to), workExperience (array with designation, company, from, to, details), languages (list), skills (list). JSON: ${JSON.stringify(pdfcoResult)}`;

      const gptRes = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
      });

      const aiJson = JSON.parse(gptRes.choices[0].message.content || '{}');
      setParsedData(aiJson);
    } catch (err) {
      console.error('Resume parsing failed', err);
      alert('Something went wrong while parsing the resume.');
    } finally {
      setLoading(false);
    }
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // remove data prefix
      };
      reader.onerror = (error) => reject(error);
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Upload Your Resume</h1>
      <input type="file" accept="application/pdf" onChange={handleFileChange} className="mb-4" />
      <button
        onClick={handleUpload}
        disabled={!file || loading}
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 disabled:opacity-50"
      >
        {loading ? 'Parsing…' : 'Upload & Parse'}
      </button>

      {parsedData && (
        <div className="mt-6 bg-gray-900 text-white p-4 rounded">
          <h2 className="text-xl font-semibold mb-2">Parsed Profile</h2>
          <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(parsedData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
