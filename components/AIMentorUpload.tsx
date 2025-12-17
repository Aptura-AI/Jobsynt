'use client';

import { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export default function AIMentorUpload() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [userMessage, setUserMessage] = useState('');
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [checkingResume, setCheckingResume] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Check if resume exists in Supabase
  useEffect(() => {
    const checkResume = async () => {
      try {
        const res = await fetch('/api/resume/upload');
        if (res.ok) {
          const data = await res.json();
          if (data.resumes && data.resumes.length > 0) {
            setResumeAvailable(true);
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

  const handleSubmit = async () => {
    if (!userMessage && !resumeAvailable) {
      setResult({ error: 'Please upload a resume in your profile first or ask a question.' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: 'user', content: userMessage || 'Analyze my profile and resume and suggest next steps.' });

      const res = await fetch('/api/ai-mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, userMessage }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const data = await res.json();

      if (!data || Object.keys(data).length === 0) {
        setMessages((prev) => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: 'I apologize, but I received an empty response. Please try asking your question again.' }]);
        setResult({ error: 'AI returned an empty response. Please try again.' });
        return;
      }

      // Format AI response as readable text
      let aiResponse = '';
      if (data.summary) aiResponse += `Summary: ${data.summary}\n\n`;
      if (data.strengths && data.strengths.length > 0) {
        aiResponse += `Strengths:\n${data.strengths.map((s: string) => `• ${s}`).join('\n')}\n\n`;
      }
      if (data.careerTips && data.careerTips.length > 0) {
        aiResponse += `Career Tips:\n${data.careerTips.map((t: string) => `• ${t}`).join('\n')}\n\n`;
      }
      if (data.nextSteps && data.nextSteps.length > 0) {
        aiResponse += `Next Steps:\n${data.nextSteps.map((s: string) => `• ${s}`).join('\n')}\n\n`;
      }
      if (data.matchedJobs && data.matchedJobs.length > 0) {
        aiResponse += `Top Job Matches:\n${data.matchedJobs.slice(0, 3).map((j: any) => `• ${j.title} at ${j.company} (${j.fitScore || 'N/A'}% match)`).join('\n')}`;
      }
      if (!aiResponse) {
        aiResponse = JSON.stringify(data, null, 2);
      }

      setMessages((prev) => [...prev, { role: 'user', content: userMessage }, { role: 'assistant', content: aiResponse }]);
      setResult(data);
      setUserMessage('');
    } catch (error) {
      console.error('AI Mentor error:', error);
      setResult({ error: (error as Error).message || 'Failed to analyze profile' });
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
    <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-lg">
      <h2 className="mb-4 text-xl sm:text-2xl font-bold text-ink">AI Career Mentor</h2>

      {/* Chat Messages */}
      {messages.length > 0 && (
        <div className="mb-4 max-h-64 sm:max-h-96 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-lg px-3 sm:px-4 py-2 ${
                  msg.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-white text-ink border border-slate-200'
                }`}
              >
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-ink">Ask a career question</label>
          <Input
            type="text"
            placeholder="e.g., What roles are the best match for me this week?"
            value={userMessage}
            onChange={(e) => setUserMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>

        <Button 
          onClick={handleSubmit} 
          disabled={loading || !userMessage.trim()} 
          className="w-full"
        >
          {loading ? 'Thinking...' : 'Send Message'}
        </Button>
      </div>

      {/* Old result format - hidden, messages are now in chat */}
      {false && result && !result.error && (
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
