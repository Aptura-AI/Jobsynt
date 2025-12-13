'use client';

import { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';

export default function AIMentorUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userMessage, setUserMessage] = useState('');
  const [resumeFromDB, setResumeFromDB] = useState<string | null>(null);
  const [checkingResume, setCheckingResume] = useState(true);

  // Check if resume exists in Supabase
  useEffect(() => {
    const checkResume = async () => {
      try {
        const res = await fetch('/api/resume/upload');
        if (res.ok) {
          const data = await res.json();
          if (data.resumes && data.resumes.length > 0) {
            // Get the extracted text from the most recent resume
            const latestResume = data.resumes[0];
            if (latestResume.extracted_text) {
              setResumeFromDB(latestResume.extracted_text);
            } else if (latestResume.public_url) {
              // If no extracted text, try to fetch from URL
              try {
                const textRes = await fetch(latestResume.public_url);
                const text = await textRes.text();
                setResumeFromDB(text);
              } catch {
                // If can't fetch, user will need to upload
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking resume:', error);
      } finally {
        setCheckingResume(false);
      }
    };
    checkResume();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setResult(null);

    try {
      let resumeText = '';

      // Use uploaded file if provided, otherwise use from DB
      if (file) {
        resumeText = await file.text();
      } else if (resumeFromDB) {
        resumeText = resumeFromDB;
      } else {
        setResult({ error: 'Please upload a resume or ask a question' });
        setLoading(false);
        return;
      }

      const res = await fetch('/api/ai-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          resumeText: resumeText || undefined, 
          userMessage: userMessage || undefined 
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();
      
      if (!data || Object.keys(data).length === 0) {
        setResult({ error: 'AI returned an empty response. Please try again.' });
        return;
      }

      setResult(data);
    } catch (error) {
      console.error('AI Mentor error:', error);
      setResult({ error: (error as Error).message || 'Failed to analyze resume' });
    } finally {
      setLoading(false);
    }
  };

  if (checkingResume) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-muted">Checking for existing resume...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-2xl font-bold text-ink">AI Career Mentor</h2>
      <p className="mb-6 text-sm text-muted">Get personalized career advice, job matches, and identify ghost jobs</p>

      {resumeFromDB && (
        <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
          ✓ Using your uploaded resume from profile
        </div>
      )}

      <div className="space-y-4">
        {!resumeFromDB && (
          <div>
            <label className="mb-2 block text-sm font-medium text-ink">Resume (PDF or TXT)</label>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none"
            />
            {file && <p className="mt-2 text-xs text-muted">Selected: {file.name}</p>}
          </div>
        )}

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Ask a question (optional)</label>
          <Input
            type="text"
            placeholder="e.g., What skills should I focus on? What jobs match my profile?"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={(!file && !resumeFromDB && !userMessage) || loading} 
          className="w-full"
        >
          {loading ? 'Analyzing with AI...' : 'Get My AI Career Plan'}
        </Button>
      </div>

      {result && (
        <div className="mt-8 rounded-lg border border-slate-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6">
          <h3 className="mb-4 text-xl font-bold text-ink">AI Mentor Report</h3>
          {result.error ? (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{result.error}</div>
          ) : (
            <div className="space-y-6">
              {result.summary && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Summary</h4>
                  <p className="text-sm text-muted">{result.summary}</p>
                </div>
              )}

              {result.strengths && result.strengths.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Strengths</h4>
                  <ul className="ml-4 list-disc text-sm text-muted">
                    {result.strengths.map((s: string, idx: number) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.matchedJobs && result.matchedJobs.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Top Job Matches</h4>
                  <ul className="space-y-3">
                    {result.matchedJobs.map((m: any, idx: number) => (
                      <li key={idx} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-ink">
                              {m.title} at {m.company}
                            </p>
                            <p className="text-xs text-muted">Fit Score: {m.fitScore || 'N/A'}%</p>
                            {m.reasons && m.reasons.length > 0 && (
                              <ul className="mt-2 ml-4 list-disc text-xs text-muted">
                                {m.reasons.slice(0, 2).map((reason: string, rIdx: number) => (
                                  <li key={rIdx}>{reason}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {m.is_ghost && (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Ghost Job</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.keywords && result.keywords.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Search Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((keyword: string, idx: number) => (
                      <span key={idx} className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.careerTips && result.careerTips.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Career Tips</h4>
                  <ul className="ml-4 list-disc text-sm text-muted">
                    {result.careerTips.map((tip: string, idx: number) => (
                      <li key={idx}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.nextSteps && result.nextSteps.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Next Steps</h4>
                  <ul className="ml-4 list-disc text-sm text-muted">
                    {result.nextSteps.map((step: string, idx: number) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.scanning && (
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                  <p>🔄 Scanning web for fresh jobs based on your profile...</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
