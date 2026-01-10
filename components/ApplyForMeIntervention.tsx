'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface InterventionData {
  applicationRunId: string;
  reason: string;
  message: string;
  jobTitle: string;
  jobCompany: string;
  site: string;
  instructions: string[];
}

interface ApplyForMeInterventionProps {
  intervention: InterventionData;
  onResume: (runId: string) => Promise<void>;
}

export default function ApplyForMeIntervention({ intervention, onResume }: ApplyForMeInterventionProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [showReminder, setShowReminder] = useState(false);

  // Play notification sound on mount
  useEffect(() => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => {
        // Ignore audio play errors (browser may block autoplay)
      });
    } catch (e) {
      // Ignore audio errors
    }
  }, []);

  // Monitor timeout (10 min max, reminder at 3 min)
  useEffect(() => {
    const checkTimeout = async () => {
      try {
        const res = await fetch(`/api/apply-for-me/status`);
        if (res.ok) {
          const data = await res.json();
          const run = data.runs?.find((r: any) => r.id === intervention.applicationRunId);
          
          if (run?.paused_at) {
            const pausedAt = new Date(run.paused_at);
            const elapsed = Date.now() - pausedAt.getTime();
            const maxDuration = 10 * 60 * 1000; // 10 minutes
            const reminderInterval = 3 * 60 * 1000; // 3 minutes
            
            const remaining = maxDuration - elapsed;
            setTimeRemaining(Math.max(0, remaining));
            
            if (elapsed >= reminderInterval && elapsed < maxDuration) {
              setShowReminder(true);
            }
            
            if (elapsed >= maxDuration) {
              // Timeout - refresh to show failed status
              window.location.reload();
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
    };

    checkTimeout();
    const interval = setInterval(checkTimeout, 1000); // Check every second
    return () => clearInterval(interval);
  }, [intervention.applicationRunId]);

  const handleResume = async () => {
    setLoading(true);
    setError(null);

    try {
      await onResume(intervention.applicationRunId);
    } catch (err: any) {
      setError(err.message || 'Failed to resume application');
    } finally {
      setLoading(false);
    }
  };

  const getReasonIcon = (reason: string) => {
    switch (reason) {
      case 'CAPTCHA_REQUIRED':
        return '🔒';
      case 'LOGIN_REQUIRED':
        return '🔑';
      case 'SIGNUP_REQUIRED':
        return '📝';
      case 'EMAIL_VERIFICATION_REQUIRED':
        return '📧';
      default:
        return '⏸️';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="text-4xl">{getReasonIcon(intervention.reason)}</div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-ink mb-2">
              🔔 Action needed to continue
            </h2>
            <p className="text-sm text-muted mb-4">
              Action needed to continue. Please complete the step shown in the open browser window. Once done, return here to continue.
            </p>

            {showReminder && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-yellow-800">
                  Just a reminder — we're waiting for this step to be completed so we can continue.
                </p>
              </div>
            )}

            {timeRemaining !== null && timeRemaining > 0 && (
              <div className="mb-4">
                <p className="text-xs text-muted mb-1">
                  Time remaining: {Math.floor(timeRemaining / 60000)}:{(Math.floor((timeRemaining % 60000) / 1000)).toString().padStart(2, '0')}
                </p>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(timeRemaining / (10 * 60 * 1000)) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="font-semibold text-ink mb-2">
                {intervention.jobTitle} at {intervention.jobCompany}
              </p>
              <p className="text-sm text-muted">
                Site: {intervention.site}
              </p>
            </div>

            <div className="space-y-2 mb-4">
              <p className="text-sm font-semibold text-ink">What to do:</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-muted">
                {intervention.instructions.map((instruction, idx) => (
                  <li key={idx}>{instruction}</li>
                ))}
              </ul>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleResume}
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Resuming...' : "I've completed this step"}
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="px-6 py-3 bg-slate-100 text-ink rounded-md font-semibold hover:bg-slate-200"
              >
                Resume Later
              </button>
            </div>

            <p className="text-xs text-muted mt-4">
              The browser window should still be open. If it closed, we'll restart the application process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

