'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  experience_years: number;
  skills: string[];
  location: string;
  work_mode: string[];
  contract_type: string[];
  visa_status: string;
  rate_expectation: string;
  resume_url: string | null;
  created_at: string;
  created_by_admin: boolean;
};

export default function AdminDashboardClient() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
  const [uploadStatus, setUploadStatus] = useState<{ success: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetchCandidates();
  }, []);

  const fetchCandidates = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('created_by_admin', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching candidates:', error);
    } else {
      setCandidates(data || []);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) {
      alert('Error deleting candidate: ' + error.message);
    } else {
      fetchCandidates();
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/admin/upload-jobs', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadStatus({ success: data.success || 0, errors: data.errors || [] });
        setTimeout(() => setUploadStatus(null), 5000);
      } else {
        alert('Upload failed: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Upload error: ' + (error as Error).message);
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-ink">Admin Dashboard</h1>
        <p className="text-muted mt-2">Manage candidates and upload jobs</p>
      </div>

      {/* Excel Upload Section */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-ink mb-4">Upload Jobs (Excel)</h2>
        <div className="space-y-4">
          <input
            type="file"
            accept=".xlsx,.csv"
            onChange={handleExcelUpload}
            className="block w-full text-sm text-muted file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
          />
          <p className="text-xs text-muted">
            Expected columns (case-insensitive, variations accepted):<br/>
            <strong>Required:</strong> Job Title, Company, Job Link (URL)<br/>
            <strong>Optional:</strong> Location, Job Type, Pay Rate, Posted Date, Source, Key Requirements/Description<br/>
            <em>Note: Use the upload button above, not Supabase's direct CSV import</em>
          </p>
          {uploadStatus && (
            <div className={`p-3 rounded ${uploadStatus.errors.length > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              <p className="text-sm font-semibold">
                {uploadStatus.success} jobs uploaded successfully
                {uploadStatus.errors.length > 0 && `, ${uploadStatus.errors.length} errors`}
              </p>
              {uploadStatus.errors.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 list-disc list-inside">
                  {uploadStatus.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Candidates Section */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-ink">Candidates ({candidates.length})</h2>
          <button
            onClick={() => {
              setEditingCandidate(null);
              setShowCreateForm(true);
            }}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Create New Candidate
          </button>
        </div>

        {showCreateForm && (
          <CandidateForm
            candidate={editingCandidate}
            onClose={() => {
              setShowCreateForm(false);
              setEditingCandidate(null);
            }}
            onSuccess={() => {
              setShowCreateForm(false);
              setEditingCandidate(null);
              fetchCandidates();
            }}
          />
        )}

        {candidates.length === 0 ? (
          <p className="text-muted text-center py-8">No candidates yet. Create your first candidate above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Name</th>
                  <th className="text-left p-2">Email</th>
                  <th className="text-left p-2">Exp</th>
                  <th className="text-left p-2">Skills</th>
                  <th className="text-left p-2">Location</th>
                  <th className="text-left p-2">Work Mode</th>
                  <th className="text-left p-2">Contract</th>
                  <th className="text-left p-2">Citizenship</th>
                  <th className="text-left p-2">Rate</th>
                  <th className="text-left p-2">Resume</th>
                  <th className="text-left p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-b">
                    <td className="p-2">{candidate.name || 'N/A'}</td>
                    <td className="p-2">{candidate.email}</td>
                    <td className="p-2">{candidate.experience_years || 0} yrs</td>
                    <td className="p-2">
                      <div className="max-w-xs truncate">
                        {(candidate.skills || []).slice(0, 3).join(', ')}
                        {(candidate.skills || []).length > 3 && '...'}
                      </div>
                    </td>
                    <td className="p-2">{candidate.location || 'N/A'}</td>
                    <td className="p-2">{(candidate.work_mode || []).join(', ') || 'N/A'}</td>
                    <td className="p-2">{(candidate.contract_type || []).join(', ') || 'N/A'}</td>
                    <td className="p-2">{candidate.visa_status || 'N/A'}</td>
                    <td className="p-2">{candidate.rate_expectation || 'N/A'}</td>
                    <td className="p-2">
                      {candidate.resume_url ? (
                        <a
                          href={candidate.resume_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Download
                        </a>
                      ) : (
                        'No resume'
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCandidate(candidate);
                            setShowCreateForm(true);
                          }}
                          className="text-primary hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(candidate.id)}
                          className="text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function CandidateForm({
  candidate,
  onClose,
  onSuccess,
}: {
  candidate: Candidate | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    name: candidate?.name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    experience_years: candidate?.experience_years || 0,
    skills: (candidate?.skills || []).join(', '),
    location: candidate?.location || '',
    work_mode: candidate?.work_mode || [],
    contract_type: candidate?.contract_type || [],
    visa_status: candidate?.visa_status || '',
    rate_expectation: candidate?.rate_expectation || '',
    resume: null as File | null,
  });

  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploading(true);

    try {
      // Parse skills
      const skills = formData.skills.split(',').map(s => s.trim()).filter(Boolean);

      // Use the API route which uses service role key to bypass RLS
      // This ensures admin has full access without RLS restrictions
      const candidateData = {
        name: formData.name,
        email: formData.email.toLowerCase(),
        phone: formData.phone?.trim() || null,
        title: '', // Title can be added later by candidate or admin
        location: formData.location || '',
        experience: formData.experience_years,
        skills,
        visa: formData.visa_status || null,
        rate: formData.rate_expectation || null,
        availability: 'immediate',
        summary: null,
        projects: [],
        resumeUrl: candidate?.resume_url || null,
        preferred_job_types: [], // Can be added later if needed
      };

      const response = await fetch('/api/candidates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(candidateData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to save candidate');
      }

      // If resume was uploaded, handle it separately (can be enhanced later)
      if (formData.resume) {
        // TODO: Handle resume upload via separate API if needed
        console.log('Resume upload not yet integrated with API route');
      }

      onSuccess();
    } catch (error: any) {
      alert('Error saving candidate: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-xl font-bold mb-4">
          {candidate ? 'Edit Candidate' : 'Create New Candidate'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Email *</label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="+1 (555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Years Experience</label>
            <input
              type="number"
              min="0"
              value={formData.experience_years}
              onChange={(e) => setFormData({ ...formData, experience_years: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Skills (comma-separated)</label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="TypeScript, React, Node.js"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Work Mode (multi-select)</label>
            <div className="flex gap-4">
              {['Remote', 'Onsite', 'Hybrid'].map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.work_mode.includes(mode)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, work_mode: [...formData.work_mode, mode] });
                      } else {
                        setFormData({ ...formData, work_mode: formData.work_mode.filter(m => m !== mode) });
                      }
                    }}
                  />
                  {mode}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Contract Type (multi-select)</label>
            <div className="flex gap-4">
              {['Full-time', 'W2', 'C2C', '1099'].map((type) => (
                <label key={type} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.contract_type.includes(type)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, contract_type: [...formData.contract_type, type] });
                      } else {
                        setFormData({ ...formData, contract_type: formData.contract_type.filter(t => t !== type) });
                      }
                    }}
                  />
                  {type}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Citizenship/Visa Status</label>
            <input
              type="text"
              value={formData.visa_status}
              onChange={(e) => setFormData({ ...formData, visa_status: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="US Citizen, H1B, etc."
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Rate Expectation</label>
            <input
              type="text"
              value={formData.rate_expectation}
              onChange={(e) => setFormData({ ...formData, rate_expectation: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="$80/hr or $80k/year"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Resume (PDF/DOC)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={(e) => setFormData({ ...formData, resume: e.target.files?.[0] || null })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {uploading ? 'Saving...' : candidate ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

