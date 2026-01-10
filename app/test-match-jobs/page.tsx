'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';

export default function TestMatchJobsPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const testGET = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/match-jobs');
      const data = await res.json();
      
      if (res.ok) {
        setResult({
          method: 'GET',
          status: res.status,
          data,
        });
      } else {
        setError(`Error ${res.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const testPOST = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/match-jobs', {
        method: 'POST',
      });
      const data = await res.json();
      
      if (res.ok) {
        setResult({
          method: 'POST',
          status: res.status,
          data,
        });
      } else {
        setError(`Error ${res.status}: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Test Match Jobs API</h1>
      
      <div className="space-y-4 mb-6">
        <div className="card p-4">
          <h2 className="font-semibold mb-2">GET /api/match-jobs</h2>
          <p className="text-sm text-muted mb-3">
            Fetches active jobs from candidate_job_matches ledger (no matching, no AI)
          </p>
          <button
            onClick={testGET}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Test GET'}
          </button>
        </div>

        <div className="card p-4">
          <h2 className="font-semibold mb-2">POST /api/match-jobs</h2>
          <p className="text-sm text-muted mb-3">
            Qualifies NEW jobs and triggers AI ranking (only new jobs are inserted)
          </p>
          <button
            onClick={testPOST}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Test POST'}
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border border-red-200 mb-4">
          <h3 className="font-semibold text-red-800 mb-2">Error</h3>
          <pre className="text-sm text-red-700 whitespace-pre-wrap">{error}</pre>
        </div>
      )}

      {result && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">
            Response ({result.method} - Status {result.status})
          </h3>
          <pre className="text-xs bg-slate-50 p-4 rounded overflow-auto max-h-96">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        </div>
      )}

      <div className="mt-6 text-sm text-muted">
        <p className="mb-2"><strong>Note:</strong> You must be logged in to test these endpoints.</p>
        <p>GET returns jobs from your ledger. POST qualifies new jobs and triggers AI ranking.</p>
      </div>
    </div>
  );
}

