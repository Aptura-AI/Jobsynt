'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Helper to get 30 days ago date
function get30DaysAgoDate(): string {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  return thirtyDaysAgo.toISOString().split('T')[0];
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary: string;
  is_active: boolean;
  created_at: string;
};

export default function CompanyDashboardClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [showPostForm, setShowPostForm] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    if (!supabaseUrl || !supabaseAnonKey) {
      setLoading(false);
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    // TODO: Filter by company_id when we have company session
    // Filter out jobs older than 30 days
    const thirtyDaysAgo = get30DaysAgoDate();
    const { data, error } = await supabase
      .from('scraped_jobs')
      .select('*')
      .gte('posted_date', thirtyDaysAgo) // Only jobs from last 30 days
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching jobs:', error);
    } else {
      setJobs(data || []);
    }
    setLoading(false);
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { error } = await supabase
      .from('scraped_jobs')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (error) {
      alert('Error updating job: ' + error.message);
    } else {
      fetchJobs();
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
        <h1 className="text-3xl font-bold text-ink">Company Dashboard</h1>
        <p className="text-muted mt-2">Post jobs and manage your listings</p>
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => setShowPostForm(true)}
          className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
        >
          Post a Job
        </button>
        <div className="px-4 py-2 border rounded">
          <span className="text-sm text-muted">Applied/Shortlisted Candidates</span>
          <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Coming Soon</span>
        </div>
        <div className="px-4 py-2 border rounded">
          <span className="text-sm text-muted">Search Candidates</span>
          <span className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">Coming Soon</span>
        </div>
      </div>

      {showPostForm && (
        <PostJobForm
          onClose={() => setShowPostForm(false)}
          onSuccess={() => {
            setShowPostForm(false);
            fetchJobs();
          }}
        />
      )}

      <div className="card p-6">
        <h2 className="text-xl font-bold text-ink mb-4">Active Jobs ({jobs.filter(j => j.is_active).length})</h2>
        {jobs.length === 0 ? (
          <p className="text-muted text-center py-8">No jobs posted yet. Post your first job above.</p>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <div key={job.id} className="border rounded p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-ink">{job.title}</h3>
                    <p className="text-sm text-muted">{job.company} • {job.location}</p>
                    {job.salary && <p className="text-sm font-semibold text-ink mt-1">{job.salary}</p>}
                    {job.description && (
                      <p className="text-sm text-muted mt-2 line-clamp-2">{job.description}</p>
                    )}
                    {job.url && (
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline mt-2 inline-block"
                      >
                        View Job Link →
                      </a>
                    )}
                  </div>
                  <div className="ml-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={job.is_active}
                        onChange={() => handleToggleActive(job.id, job.is_active)}
                        className="rounded"
                      />
                      <span className="text-sm">{job.is_active ? 'Open' : 'Closed'}</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PostJobForm({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    location: '',
    work_mode: [] as string[],
    contract_type: [] as string[],
    pay_rate: '',
    description: '',
    job_link: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/company/post-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post job');
      }

      onSuccess();
    } catch (error: any) {
      alert('Error posting job: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h3 className="text-xl font-bold mb-4">Post a Job</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Job Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Location *</label>
            <input
              type="text"
              required
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
            <label className="block text-sm font-semibold mb-1">Pay Rate</label>
            <input
              type="text"
              value={formData.pay_rate}
              onChange={(e) => setFormData({ ...formData, pay_rate: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="$80/hr or $80k/year"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Job Description *</label>
            <textarea
              required
              rows={6}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Job Link</label>
            <input
              type="url"
              value={formData.job_link}
              onChange={(e) => setFormData({ ...formData, job_link: e.target.value })}
              className="w-full px-3 py-2 border rounded"
              placeholder="https://..."
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
              disabled={submitting}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Post Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

