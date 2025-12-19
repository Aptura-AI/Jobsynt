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
};

export default function CandidateProfileClient({ candidateId }: { candidateId: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingResume, setDownloadingResume] = useState(false);

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

