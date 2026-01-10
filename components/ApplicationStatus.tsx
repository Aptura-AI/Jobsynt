'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import ApplyForMeIntervention from './ApplyForMeIntervention';

interface ApplicationRun {
  id: string;
  job_id: string;
  job_url: string;
  status: 'pending' | 'running' | 'submitted' | 'failed' | 'WAITING_FOR_CANDIDATE';
  error?: string | null;
  applied_at?: string | null;
  created_at: string;
  intervention_reason?: string | null;
  intervention_message?: string | null;
  job?: {
    title: string;
    company: string;
  };
}

export default function ApplicationStatus() {
  const [runs, setRuns] = useState<ApplicationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [intervention, setIntervention] = useState<ApplicationRun | null>(null);

  useEffect(() => {
    fetchApplicationRuns();
    // Refresh every 5 seconds if there are active jobs
    const interval = setInterval(() => {
      const hasActive = runs.some(r => 
        r.status === 'pending' || 
        r.status === 'running' || 
        r.status === 'WAITING_FOR_CANDIDATE'
      );
      if (hasActive) {
        fetchApplicationRuns();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [runs.length]);

  // Check for interventions on mount and when runs change
  useEffect(() => {
    const waitingRun = runs.find(r => r.status === 'WAITING_FOR_CANDIDATE');
    if (waitingRun) {
      setIntervention(waitingRun);
    } else {
      setIntervention(null);
    }
  }, [runs]);

  const fetchApplicationRuns = async () => {
    try {
      const res = await fetch('/api/apply-for-me/status');
      if (res.ok) {
        const data = await res.json();
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Error fetching application runs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResume = async (runId: string) => {
    try {
      const res = await fetch('/api/apply-for-me/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationRunId: runId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to resume application');
      }

      // Refresh runs
      await fetchApplicationRuns();
    } catch (error: any) {
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Application Status</h2>
        <p className="text-sm text-muted">Loading...</p>
      </div>
    );
  }

  if (runs.length === 0) {
    return null; // Don't show if no applications
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'WAITING_FOR_CANDIDATE':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'submitted':
        return 'Submitted';
      case 'failed':
        return 'Failed';
      case 'running':
        return 'In Progress';
      case 'pending':
        return 'Pending';
      case 'WAITING_FOR_CANDIDATE':
        return 'Action Required';
      default:
        return status;
    }
  };

  return (
    <>
      {intervention && intervention.intervention_reason && (
        <ApplyForMeIntervention
          intervention={{
            applicationRunId: intervention.id,
            reason: intervention.intervention_reason,
            message: intervention.intervention_message || 'Action required to continue',
            jobTitle: intervention.job?.title || 'Job Application',
            jobCompany: intervention.job?.company || 'Company',
            site: 'UNKNOWN', // TODO: Get from job metadata
            instructions: getInstructions(intervention.intervention_reason),
          }}
          onResume={handleResume}
        />
      )}
      <div className="card p-6">
        <h2 className="text-lg font-semibold text-ink mb-4">Application Status</h2>
        <div className="space-y-3">
        {runs.map((run) => (
          <div key={run.id} className="border border-slate-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-ink">
                  {run.job?.title || 'Job Application'}
                </h3>
                <p className="text-sm text-muted">
                  {run.job?.company || 'Company'}
                </p>
                {run.applied_at && (
                  <p className="text-xs text-muted mt-1">
                    Applied: {new Date(run.applied_at).toLocaleString()}
                  </p>
                )}
                {run.error && (
                  <p className="text-xs text-red-600 mt-1">
                    Error: {run.error}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(run.status)}`}>
                  {getStatusLabel(run.status)}
                </span>
                {run.job_url && (
                  <Link
                    href={run.job_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View Job →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      </div>
    </>
  );
}

function getInstructions(reason: string | null): string[] {
  switch (reason) {
    case 'CAPTCHA_REQUIRED':
      return [
        'A CAPTCHA verification is required to continue.',
        'Please complete the CAPTCHA in the open browser window.',
        'Once completed, click "I\'ve completed this step" in Jobsynt.',
      ];
    case 'LOGIN_REQUIRED':
      return [
        'You need to log in to this job site to continue.',
        'Please log in using your account credentials in the browser window.',
        'Once logged in, click "I\'ve completed this step" in Jobsynt.',
      ];
    case 'EMAIL_VERIFICATION_REQUIRED':
      return [
        'Please check your email and click the verification link.',
        'Once your account is verified, return to Jobsynt.',
        'Click "I\'ve completed this step" to continue.',
      ];
    default:
      return ['Please complete the required step in the browser window.'];
  }
}

