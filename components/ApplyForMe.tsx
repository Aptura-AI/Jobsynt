'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type Job = {
  id: string;
  title: string;
  company: string;
  url?: string | null;
};

interface ApplyForMeProps {
  jobs: Job[];
  selectedJobs: Set<string>;
  onClearSelection?: () => void;
}

export default function ApplyForMe({ jobs, selectedJobs, onClearSelection }: ApplyForMeProps) {
  const router = useRouter();
  const [hasResumeJson, setHasResumeJson] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [checkingResume, setCheckingResume] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check if user has resume_json
  useEffect(() => {
    async function checkResume() {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          setHasResumeJson(!!data.profile?.resume_json);
        }
      } catch (err) {
        console.error('Error checking resume:', err);
      } finally {
        setCheckingResume(false);
      }
    }
    checkResume();
  }, []);

  const handleApplyForMe = async () => {
    if (selectedJobs.size === 0) {
      setError('Please select at least one job to apply for');
      return;
    }

    if (!hasResumeJson) {
      setError('Please upload a resume in your profile first');
      router.push('/candidates');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Get candidate ID
      const profileRes = await fetch('/api/profile');
      if (!profileRes.ok) {
        throw new Error('Failed to fetch profile');
      }
      const profileData = await profileRes.json();
      const candidateId = profileData.profile?.id;

      if (!candidateId) {
        throw new Error('Candidate ID not found');
      }

      // Call apply-for-me API
      const res = await fetch('/api/apply-for-me', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidateId,
          jobIds: Array.from(selectedJobs),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start applications');
      }

      setSuccess(`Started applying to ${selectedJobs.size} job${selectedJobs.size > 1 ? 's' : ''}. Check your dashboard for status.`);
      if (onClearSelection) {
        onClearSelection();
      }
      
      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      console.error('Apply for Me error:', err);
      setError(err.message || 'An error occurred while starting applications');
    } finally {
      setLoading(false);
    }
  };

  if (checkingResume) {
    return null; // Don't show until we know resume status
  }

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink mb-2">Apply for Me</h2>
        <p className="text-sm text-muted mb-4">
          Select jobs below and we'll automatically apply on your behalf using your resume and profile information.
        </p>
        {!hasResumeJson && (
          <div className="mb-4 rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <p className="text-sm text-yellow-800">
              ⚠️ Please upload a resume in your profile to use this feature.
            </p>
          </div>
        )}
        <p className="text-xs text-muted italic">
          By clicking "Apply for Me", you authorize automated submission on your behalf.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 p-3">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={handleApplyForMe}
          disabled={loading || selectedJobs.size === 0 || !hasResumeJson}
          className="px-4 py-2 bg-primary text-white rounded-md font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Starting Applications...' : `Apply for Me (${selectedJobs.size} selected)`}
        </button>
        {selectedJobs.size > 0 && onClearSelection && (
          <button
            onClick={onClearSelection}
            className="px-4 py-2 bg-slate-100 text-ink rounded-md font-semibold hover:bg-slate-200"
          >
            Clear Selection
          </button>
        )}
      </div>
    </div>
  );
}

// Job selection checkbox component
export function JobCheckbox({ 
  jobId, 
  isSelected, 
  onToggle 
}: { 
  jobId: string; 
  isSelected: boolean; 
  onToggle: (jobId: string) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={isSelected}
      onChange={() => onToggle(jobId)}
      className="h-4 w-4 text-primary focus:ring-primary border-slate-300 rounded"
    />
  );
}

