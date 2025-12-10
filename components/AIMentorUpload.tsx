'use client';

import { useState } from 'react';
import Button from './Button';
import Input from './Input';

export default function AIMentorUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userMessage, setUserMessage] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) setFile(e.target.files[0]);
  };

  const handleSubmit = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      // Simple text extraction (works for text-based PDFs and .txt files)
      const text = await file.text();

      const res = await fetch('/api/ai-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: text, userMessage: userMessage || undefined }),
      });

      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({ error: (error as Error).message || 'Failed to analyze resume' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
      <h2 className="mb-4 text-2xl font-bold text-ink">Upload Resume → Get AI Mentor</h2>
      <p className="mb-6 text-sm text-muted">Get personalized career advice, job matches, and identify ghost jobs</p>

      <div className="space-y-4">
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

        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Optional: Ask a specific question</label>
          <Input
            type="text"
            placeholder="e.g., What skills should I focus on?"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
          />
        </div>

        <Button onClick={handleSubmit} disabled={!file || loading} className="w-full">
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
              {/* Analysis Section */}
              {result.analysis && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Profile Analysis</h4>
                  <div className="mb-3">
                    <span className="text-sm text-muted">Profile Score: </span>
                    <span className="text-lg font-bold text-primary">{result.analysis.profileScore || 'N/A'}/10</span>
                  </div>
                  {result.analysis.strengths && result.analysis.strengths.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-ink">Strengths:</p>
                      <ul className="ml-4 list-disc text-sm text-muted">
                        {result.analysis.strengths.map((s: string, idx: number) => (
                          <li key={idx}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.analysis.skills && result.analysis.skills.length > 0 && (
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-ink">Skills Identified:</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {result.analysis.skills.map((skill: string, idx: number) => (
                          <span key={idx} className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.analysis.gaps && result.analysis.gaps.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-ink">Skill Gaps:</p>
                      <ul className="ml-4 list-disc text-sm text-muted">
                        {result.analysis.gaps.map((gap: string, idx: number) => (
                          <li key={idx}>{gap}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Matches Section */}
              {result.matches && result.matches.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Top Job Matches</h4>
                  <ul className="space-y-3">
                    {result.matches.map((m: any) => (
                      <li key={m.id} className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-ink">
                              {m.title} at {m.company}
                            </p>
                            <p className="text-xs text-muted">{m.fitScore}% fit</p>
                            {m.reasons && m.reasons.length > 0 && (
                              <ul className="mt-2 ml-4 list-disc text-xs text-muted">
                                {m.reasons.slice(0, 2).map((reason: string, idx: number) => (
                                  <li key={idx}>{reason}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                          {m.isGhost && (
                            <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">Ghost Job</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Fresh Jobs Section */}
              {result.freshJobs !== undefined && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                  <p className="font-semibold">✓ Scanned {result.freshJobs} new matching jobs from the web!</p>
                  {result.totalJobs && <p className="mt-1 text-xs">Total jobs in database: {result.totalJobs}</p>}
                </div>
              )}

              {result.scanning && !result.freshJobs && (
                <div className="rounded-md bg-blue-50 p-3 text-sm text-blue-700">
                  <p>🔄 Scanning web for fresh jobs based on your profile... This may take 30-60 seconds.</p>
                </div>
              )}

              {/* Keywords Section */}
              {result.keywords && result.keywords.length > 0 && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Search Keywords Used</h4>
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((keyword: string, idx: number) => (
                      <span key={idx} className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Guidance Section */}
              {result.guidance && (
                <div>
                  <h4 className="mb-2 font-semibold text-ink">Career Guidance</h4>
                  {result.guidance.advice && (
                    <p className="mb-3 italic text-muted">"{result.guidance.advice}"</p>
                  )}
                  {result.guidance.courses && result.guidance.courses.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-ink">Recommended Courses:</p>
                      <ul className="ml-4 list-disc text-sm text-muted">
                        {result.guidance.courses.map((course: string, idx: number) => (
                          <li key={idx}>{course}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.guidance.nextSteps && result.guidance.nextSteps.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-ink">Next Steps:</p>
                      <ul className="ml-4 list-disc text-sm text-muted">
                        {result.guidance.nextSteps.map((step: string, idx: number) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

