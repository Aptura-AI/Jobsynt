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
  location_type: string | null; // Legacy
  is_remote: boolean; // Legacy
  primary_platform: string | null;
  source: string;
  job_type: string; // Employment type
  is_active: boolean;
  created_at: string;
  target_candidate_ids: string | null;
};

export default function JobsListClient() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  useEffect(() => {
    fetchJobs();
  }, [page, search, sourceFilter, platformFilter, activeFilter]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (search) params.append('search', search);
      if (sourceFilter) params.append('source', sourceFilter);
      if (platformFilter) params.append('platform', platformFilter);
      if (activeFilter !== '') params.append('is_active', activeFilter);

      const res = await fetch(`/api/admin/jobs?${params}`);
      const data = await res.json();

      if (res.ok) {
        setJobs(data.jobs || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error('Error fetching jobs:', data.error);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchJobs();
  };

  const getTargetedCount = (targetIds: string | null): number => {
    if (!targetIds) return 0;
    return targetIds.split(',').filter(id => id.trim().length > 0).length;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-6">
      {/* Navigation Tabs */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-4">
          <a
            href="/admin"
            className="px-4 py-2 text-muted hover:text-ink hover:border-b-2 hover:border-slate-300"
          >
            Dashboard
          </a>
          <a
            href="/admin/jobs"
            className="px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-semibold"
          >
            Jobs
          </a>
          <a
            href="/admin/candidates"
            className="px-4 py-2 text-muted hover:text-ink hover:border-b-2 hover:border-slate-300"
          >
            Candidates
          </a>
        </nav>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-ink">Job Management</h1>
          <p className="text-muted mt-2">Edit jobs, align information, and target candidates</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search jobs by title, company, or description..."
            className="flex-1 px-4 py-2 border rounded"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Source</label>
            <select
              value={sourceFilter}
              onChange={(e) => {
                setSourceFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">All Sources</option>
              <option value="Dice">Dice</option>
              <option value="manual">Manual</option>
              <option value="indeed">Indeed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Platform</label>
            <select
              value={platformFilter}
              onChange={(e) => {
                setPlatformFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">All Platforms</option>
              <option value="Oracle Fusion">Oracle Fusion</option>
              <option value="PeopleSoft">PeopleSoft</option>
              <option value="Workday">Workday</option>
              <option value="SAP">SAP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Status</label>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs Table */}
      {loading ? (
        <div className="card p-8 text-center">
          <div className="animate-pulse">Loading jobs...</div>
        </div>
      ) : jobs.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          No jobs found. {search && 'Try adjusting your search filters.'}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Company</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Job Type</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Platform</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Source</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Targeted</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {jobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{job.title}</div>
                        <div className="text-xs text-muted">{job.job_type}</div>
                      </td>
                      <td className="px-4 py-3">{job.company}</td>
                      <td className="px-4 py-3">
                        {job.location || (job.work_location_type === 'Remote' ? 'Remote' : 'N/A')}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const workLocationType = job.work_location_type || job.location_type || (job.is_remote !== undefined ? (job.is_remote ? 'Remote' : 'Onsite') : null);
                          if (!workLocationType) {
                            return <span className="text-muted text-xs">Not set</span>;
                          }
                          return (
                            <span className={`px-2 py-1 rounded text-xs ${
                              workLocationType === 'Remote' 
                                ? 'bg-green-100 text-green-800' 
                                : workLocationType === 'Hybrid'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {workLocationType}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {job.primary_platform || (
                          <span className="text-muted">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {job.source}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getTargetedCount(job.target_candidate_ids) > 0 ? (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                            {getTargetedCount(job.target_candidate_ids)} candidate(s)
                          </span>
                        ) : (
                          <span className="text-muted text-xs">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {job.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/admin/jobs/${job.id}`)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-muted">
                Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, total)} of {total} jobs
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-4 py-2 border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

