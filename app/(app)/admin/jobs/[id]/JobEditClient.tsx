'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  work_location_type: string | null; // Remote, Hybrid, Onsite
  location_type: string | null; // Legacy - deprecated
  is_remote: boolean; // Legacy - deprecated
  url: string;
  description: string;
  job_type: string; // Employment type: full-time, w2-contract, etc.
  must_have_skills: string;
  good_to_have_skills: string;
  required_years_experience: number;
  salary: string | null;
  primary_platform: string | null;
  secondary_platforms: string[] | null;
  source: string;
  posted_date: string | null;
  is_active: boolean;
  target_candidate_ids: string | null;
};

export default function JobEditClient({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState<Partial<Job>>({});
  const [targetCandidateIds, setTargetCandidateIds] = useState('');

  useEffect(() => {
    fetchJob();
  }, [jobId]);

  const fetchJob = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/admin/jobs/${jobId}`);
      const data = await res.json();

      if (res.ok) {
        setJob(data);
        setFormData(data);
        setTargetCandidateIds(data.target_candidate_ids || '');
      } else {
        setError(data.error || 'Failed to load job');
      }
    } catch (err: any) {
      setError(err.message || 'Error loading job');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Validation: Hybrid/Onsite require location
      const workLocationType = formData.work_location_type || formData.location_type || (formData.is_remote !== undefined ? (formData.is_remote ? 'Remote' : 'Onsite') : 'Remote');
      if ((workLocationType === 'Hybrid' || workLocationType === 'Onsite') && !formData.location?.trim()) {
        setError(`${workLocationType} jobs require a location. Please provide a location.`);
        setSaving(false);
        return;
      }

      // Prepare update payload
      const updatePayload: any = { ...formData };
      
      // Set work_location_type (PART 1)
      if (formData.work_location_type) {
        updatePayload.work_location_type = formData.work_location_type;
      } else if (formData.location_type) {
        updatePayload.work_location_type = formData.location_type;
      } else if (formData.is_remote !== undefined) {
        updatePayload.work_location_type = formData.is_remote ? 'Remote' : 'Onsite';
      }
      
      // Handle target candidate IDs
      if (targetCandidateIds.trim()) {
        updatePayload.target_candidate_ids = targetCandidateIds.trim();
      } else {
        updatePayload.target_candidate_ids = null;
      }

      // Convert skills from string to format expected by API
      if (formData.must_have_skills !== undefined) {
        updatePayload.must_have_skills = String(formData.must_have_skills).trim();
      }
      if (formData.good_to_have_skills !== undefined) {
        updatePayload.good_to_have_skills = String(formData.good_to_have_skills).trim();
      }

      const res = await fetch(`/api/admin/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        // PART 2: Redirect to jobs list after successful save
        setTimeout(() => {
          router.push('/admin/jobs');
        }, 1000);
      } else {
        setError(data.error || 'Failed to save job');
      }
    } catch (err: any) {
      setError(err.message || 'Error saving job');
    } finally {
      setSaving(false);
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

  if (error && !job) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="card p-8 text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/admin/jobs" className="text-blue-600 hover:underline">
            ← Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-ink">Edit Job</h1>
          <p className="text-muted mt-2">{job.title} at {job.company}</p>
        </div>
        <Link
          href="/admin/jobs"
          className="px-4 py-2 bg-slate-200 text-ink rounded hover:bg-slate-300"
        >
          ← Back to Jobs
        </Link>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="card p-4 bg-green-50 border-green-200">
          <p className="text-green-800">✓ Job updated successfully!</p>
        </div>
      )}
      {error && (
        <div className="card p-4 bg-red-50 border-red-200">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Edit Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Basic Info */}
        <div className="space-y-6">
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Basic Information</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Job Title *</label>
                <input
                  type="text"
                  value={formData.title || ''}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Company *</label>
                <input
                  type="text"
                  value={formData.company || ''}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Job URL</label>
                <input
                  type="url"
                  value={formData.url || ''}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Location</label>
                <input
                  type="text"
                  value={formData.location || ''}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Work Location Type *</label>
                <select
                  value={formData.work_location_type || formData.location_type || (formData.is_remote ? 'Remote' : '') || 'Remote'}
                  onChange={(e) => {
                    const workLocationType = e.target.value;
                    setFormData({ ...formData, work_location_type: workLocationType });
                    
                    // Validation: Hybrid/Onsite require location
                    if ((workLocationType === 'Hybrid' || workLocationType === 'Onsite') && !formData.location?.trim()) {
                      setError(`${workLocationType} jobs require a location. Please provide a location.`);
                    } else {
                      setError(null);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded"
                  required
                >
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Onsite">Onsite</option>
                </select>
                <p className="text-xs text-muted mt-1">
                  {formData.work_location_type === 'Hybrid' || formData.work_location_type === 'Onsite' 
                    ? 'Location is required for Hybrid and Onsite jobs'
                    : 'Remote jobs do not require a location'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Job Type</label>
                <select
                  value={formData.job_type || ''}
                  onChange={(e) => setFormData({ ...formData, job_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="full-time">Full-time</option>
                  <option value="w2-contract">W2 Contract</option>
                  <option value="c2c">C2C</option>
                  <option value="1099">1099</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Required Experience (Years)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.required_years_experience || 0}
                  onChange={(e) => setFormData({ ...formData, required_years_experience: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Salary / Pay Rate</label>
                <input
                  type="text"
                  value={formData.salary || ''}
                  onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., $120k-$150k or $80/hr"
                />
              </div>
            </div>
          </div>

          {/* Platform */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Platform</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Primary Platform</label>
                <input
                  type="text"
                  value={formData.primary_platform || ''}
                  onChange={(e) => setFormData({ ...formData, primary_platform: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., Oracle Fusion, PeopleSoft, Workday"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Secondary Platforms (comma-separated)</label>
                <input
                  type="text"
                  value={formData.secondary_platforms?.join(', ') || ''}
                  onChange={(e) => {
                    const platforms = e.target.value.split(',').map(p => p.trim()).filter(p => p);
                    setFormData({ ...formData, secondary_platforms: platforms.length > 0 ? platforms : null });
                  }}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="e.g., Oracle HCM, Payroll"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Skills, Description, Targeting */}
        <div className="space-y-6">
          {/* Skills */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Skills</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Must Have Skills</label>
                <textarea
                  value={formData.must_have_skills || ''}
                  onChange={(e) => setFormData({ ...formData, must_have_skills: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={4}
                  placeholder="Enter skills separated by commas, semicolons, or new lines"
                />
                <p className="text-xs text-muted mt-1">Separate with commas, semicolons, or new lines</p>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Good To Have Skills</label>
                <textarea
                  value={formData.good_to_have_skills || ''}
                  onChange={(e) => setFormData({ ...formData, good_to_have_skills: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                  rows={4}
                  placeholder="Enter skills separated by commas, semicolons, or new lines"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Description</h2>
            
            <div>
              <textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border rounded"
                rows={8}
                placeholder="Job description..."
              />
            </div>
          </div>

          {/* Candidate Targeting */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Target Candidates</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Candidate UUIDs</label>
                <textarea
                  value={targetCandidateIds}
                  onChange={(e) => setTargetCandidateIds(e.target.value)}
                  className="w-full px-3 py-2 border rounded font-mono text-sm"
                  rows={3}
                  placeholder="Enter candidate UUIDs, one per line or comma-separated"
                />
                <p className="text-xs text-muted mt-1">
                  Enter candidate UUIDs to explicitly target this job to specific candidates.
                  Separate multiple UUIDs with commas or new lines.
                </p>
              </div>

              {job.target_candidate_ids && (
                <div className="p-3 bg-blue-50 rounded">
                  <p className="text-sm text-blue-800">
                    Currently targeting: {job.target_candidate_ids.split(',').length} candidate(s)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="card p-6">
            <h2 className="text-xl font-bold mb-4">Status</h2>
            
            <div className="space-y-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.is_active || false}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm">Active</span>
              </label>

              <div className="text-xs text-muted">
                <p>Source: {job.source}</p>
                <p>Created: {new Date(job.id).toLocaleDateString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-4">
        <Link
          href="/admin/jobs"
          className="px-6 py-2 border rounded hover:bg-slate-50"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

