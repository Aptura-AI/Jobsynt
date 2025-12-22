'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type CandidateProfile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  experience_years: number;
  title: string | null;
  summary: string | null;
  primary_skills: string[] | null;
  secondary_skills: string[] | null;
  adjacent_skills: string[] | null;
  generic_skills: string[] | null;
  primary_platform: string | null;
  secondary_platforms: string[] | null;
  preferred_job_types: string[] | null;
  expected_pay_min: number | null;
  visa_status: string | null;
  resume_url: string | null;
  created_at: string;
  created_by_admin: boolean;
  trial_ends_at: string | null;
  is_paid: boolean | null;
};

export default function CandidateProfileClient({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingResume, setDownloadingResume] = useState(false);
  const [extendDays, setExtendDays] = useState<number>(7);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [extendingTrial, setExtendingTrial] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, [candidateId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/candidates/${candidateId}`);
      const data = await res.json();

      if (res.ok) {
        setProfile(data);
      } else {
        setError(data.error || 'Failed to load candidate profile');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResume = async () => {
    if (!profile?.resume_url) return;

    try {
      setDownloadingResume(true);
      const res = await fetch(`/api/admin/candidates/${candidateId}/resume`);

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${profile.name?.replace(/\s+/g, '_') || 'Candidate'}_Resume.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to download resume');
      }
    } catch (err: any) {
      alert(err.message || 'Error downloading resume');
    } finally {
      setDownloadingResume(false);
    }
  };

  const handleExtendTrial = async () => {
    if (!profile || extendDays <= 0) return;

    try {
      setExtendingTrial(true);
      const res = await fetch(`/api/admin/candidates/${candidateId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: extendDays }),
      });

      const data = await res.json();

      if (res.ok) {
        setToastMessage(`Trial extended by ${extendDays} days successfully!`);
        setShowConfirmModal(false);
        // Refetch profile data
        await fetchProfile();
        // Clear toast after 3 seconds
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        alert(data.error || 'Failed to extend trial');
      }
    } catch (err: any) {
      alert(err.message || 'Error extending trial');
    } finally {
      setExtendingTrial(false);
    }
  };

  // Calculate trial status and days remaining
  const getTrialStatus = () => {
    if (!profile) return { status: 'Unknown', daysRemaining: null };
    
    if (profile.is_paid === true) {
      return { status: 'Paid', daysRemaining: null };
    }

    if (!profile.trial_ends_at) {
      return { status: 'No Trial', daysRemaining: null };
    }

    const trialEnd = new Date(profile.trial_ends_at);
    const now = new Date();
    const diffTime = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { status: 'Expired', daysRemaining: 0 };
    }

    return { status: 'Active', daysRemaining: diffDays };
  };

  const trialInfo = getTrialStatus();
  const canExtendTrial = profile && profile.is_paid !== true && profile.trial_ends_at !== null;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-slate-200"></div>
          <div className="h-96 rounded bg-slate-200"></div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="card p-8 text-center">
          <p className="text-red-600 mb-4">{error || 'Candidate not found'}</p>
          <Link href="/admin/candidates" className="text-blue-600 hover:underline">
            ← Back to Candidates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          {toastMessage}
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Extend Trial</h3>
            <p className="mb-6">
              Extend trial by {extendDays} days?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-slate-200 text-ink rounded hover:bg-slate-300"
                disabled={extendingTrial}
              >
                Cancel
              </button>
              <button
                onClick={handleExtendTrial}
                disabled={extendingTrial}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {extendingTrial ? 'Extending...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-ink">{profile.name || 'Candidate Profile'}</h1>
          <p className="text-muted mt-2">{profile.email}</p>
        </div>
        <div className="flex gap-2">
          {profile.resume_url && (
            <button
              onClick={handleDownloadResume}
              disabled={downloadingResume}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {downloadingResume ? 'Downloading...' : '📥 Download Resume'}
            </button>
          )}
          <Link
            href="/admin/candidates"
            className="px-4 py-2 bg-slate-200 text-ink rounded hover:bg-slate-300"
          >
            ← Back to Candidates
          </Link>
        </div>
      </div>

      {/* Profile Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Personal Info */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Personal Information</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-semibold text-muted">Name:</span>
                <p className="text-ink">{profile.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-sm font-semibold text-muted">Email:</span>
                <p className="text-ink">{profile.email}</p>
              </div>
              {profile.phone && (
                <div>
                  <span className="text-sm font-semibold text-muted">Phone:</span>
                  <p className="text-ink">{profile.phone}</p>
                </div>
              )}
              {profile.location && (
                <div>
                  <span className="text-sm font-semibold text-muted">Location:</span>
                  <p className="text-ink">{profile.location}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-semibold text-muted">Experience:</span>
                <p className="text-ink">{profile.experience_years} years</p>
              </div>
              {profile.title && (
                <div>
                  <span className="text-sm font-semibold text-muted">Title:</span>
                  <p className="text-ink">{profile.title}</p>
                </div>
              )}
              {profile.visa_status && (
                <div>
                  <span className="text-sm font-semibold text-muted">Visa Status:</span>
                  <p className="text-ink">{profile.visa_status}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Platform & Skills</h2>
            <div className="space-y-4">
              {profile.primary_platform && (
                <div>
                  <span className="text-sm font-semibold text-muted">Primary Platform:</span>
                  <p className="text-ink">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      {profile.primary_platform}
                    </span>
                  </p>
                </div>
              )}
              {profile.secondary_platforms && profile.secondary_platforms.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted">Secondary Platforms:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile.secondary_platforms.map((platform, idx) => (
                      <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-sm">
                        {platform}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.primary_skills && profile.primary_skills.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted">Primary Skills:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile.primary_skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.secondary_skills && profile.secondary_skills.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted">Secondary Skills:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile.secondary_skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.adjacent_skills && profile.adjacent_skills.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted">Adjacent Skills:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile.adjacent_skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 bg-orange-100 text-orange-800 rounded text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.generic_skills && profile.generic_skills.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted">Generic Skills:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile.generic_skills.map((skill, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Preferences & Summary */}
        <div className="space-y-6">
          {/* Trial Status Section */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Trial Status</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-semibold text-muted">Status:</span>
                <p className="text-ink">
                  <span className={`px-2 py-1 rounded text-sm font-semibold ${
                    trialInfo.status === 'Paid' ? 'bg-green-100 text-green-800' :
                    trialInfo.status === 'Active' ? 'bg-blue-100 text-blue-800' :
                    trialInfo.status === 'Expired' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {trialInfo.status}
                  </span>
                </p>
              </div>
              {profile.trial_ends_at && (
                <div>
                  <span className="text-sm font-semibold text-muted">Trial Ends At:</span>
                  <p className="text-ink">{new Date(profile.trial_ends_at).toLocaleString()}</p>
                </div>
              )}
              {trialInfo.daysRemaining !== null && trialInfo.status === 'Active' && (
                <div>
                  <span className="text-sm font-semibold text-muted">Days Remaining:</span>
                  <p className="text-ink font-semibold">{trialInfo.daysRemaining} days</p>
                </div>
              )}
            </div>

            {/* Extend Trial Control */}
            {canExtendTrial && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <h3 className="text-lg font-semibold mb-4">Extend Trial</h3>
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-muted mb-2">
                      Days to Extend
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={extendDays}
                      onChange={(e) => setExtendDays(Math.max(1, parseInt(e.target.value) || 7))}
                      className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setShowConfirmModal(true)}
                    disabled={extendDays <= 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Extend Trial
                  </button>
                </div>
              </div>
            )}
          </div>

          {profile.summary && (
            <div className="card p-6">
              <h2 className="text-xl font-bold mb-4">Summary</h2>
              <p className="text-ink whitespace-pre-wrap">{profile.summary}</p>
            </div>
          )}

          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Job Preferences</h2>
            <div className="space-y-3">
              {profile.preferred_job_types && profile.preferred_job_types.length > 0 && (
                <div>
                  <span className="text-sm font-semibold text-muted">Preferred Job Types:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {profile.preferred_job_types.map((type, idx) => (
                      <span key={idx} className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                        {type}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {profile.expected_pay_min && (
                <div>
                  <span className="text-sm font-semibold text-muted">Expected Pay (Min):</span>
                  <p className="text-ink">${profile.expected_pay_min}/hr</p>
                </div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Metadata</h2>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-muted">Candidate ID:</span>
                <p className="font-mono text-xs">{profile.id}</p>
              </div>
              <div>
                <span className="text-muted">Created:</span>
                <p>{new Date(profile.created_at).toLocaleString()}</p>
              </div>
              <div>
                <span className="text-muted">Created by Admin:</span>
                <p>{profile.created_by_admin ? 'Yes' : 'No'}</p>
              </div>
              {profile.resume_url && (
                <div>
                  <span className="text-muted">Resume:</span>
                  <p className="text-green-600">Available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

