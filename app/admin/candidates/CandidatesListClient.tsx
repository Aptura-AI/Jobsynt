'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

type Candidate = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  experience_years: number;
  title: string | null;
  primary_skills: string[] | null;
  secondary_skills: string[] | null;
  primary_platform: string | null;
  secondary_platforms: string[] | null; // PART 5: Add secondary_platforms
  resume_url: string | null;
  created_at: string;
  created_by_admin: boolean;
};

export default function CandidatesListClient() {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');

  useEffect(() => {
    fetchCandidates();
  }, [page, search, locationFilter, platformFilter]);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      if (search) params.append('search', search);
      if (locationFilter) params.append('location', locationFilter);
      if (platformFilter) params.append('platform', platformFilter);

      const res = await fetch(`/api/admin/candidates?${params}`);
      const data = await res.json();

      if (res.ok) {
        setCandidates(data.candidates || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error('Error fetching candidates:', data.error);
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
    fetchCandidates();
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
            className="px-4 py-2 text-muted hover:text-ink hover:border-b-2 hover:border-slate-300"
          >
            Jobs
          </a>
          <a
            href="/admin/candidates"
            className="px-4 py-2 border-b-2 border-blue-600 text-blue-600 font-semibold"
          >
            Candidates
          </a>
        </nav>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-ink">Candidate Management</h1>
          <p className="text-muted mt-2">View all candidates, profiles, and download resumes</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4 space-y-4">
        <form onSubmit={handleSearch} className="flex gap-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or title..."
            className="flex-1 px-4 py-2 border rounded"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Search
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Location</label>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => {
                setLocationFilter(e.target.value);
                setPage(1);
              }}
              placeholder="Filter by location..."
              className="w-full px-3 py-2 border rounded"
            />
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
        </div>
      </div>

      {/* Candidates Table */}
      {loading ? (
        <div className="card p-8 text-center">
          <div className="animate-pulse">Loading candidates...</div>
        </div>
      ) : candidates.length === 0 ? (
        <div className="card p-8 text-center text-muted">
          No candidates found. {search && 'Try adjusting your search filters.'}
        </div>
      ) : (
        <>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Email</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Location</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Experience</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Primary Platform</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Secondary Platforms</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Resume</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {candidates.map((candidate) => (
                    <tr key={candidate.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/admin/candidates/${candidate.id}`)}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {candidate.name || 'N/A'}
                        </button>
                        {candidate.title && (
                          <div className="text-xs text-muted">{candidate.title}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">{candidate.email}</td>
                      <td className="px-4 py-3">{candidate.location || 'N/A'}</td>
                      <td className="px-4 py-3">{candidate.experience_years} years</td>
                      <td className="px-4 py-3">
                        {candidate.primary_platform ? (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {candidate.primary_platform}
                          </span>
                        ) : (
                          <span className="text-muted text-xs">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.secondary_platforms && candidate.secondary_platforms.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {candidate.secondary_platforms.slice(0, 2).map((platform, idx) => (
                              <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                {platform}
                              </span>
                            ))}
                            {candidate.secondary_platforms.length > 2 && (
                              <span className="text-xs text-muted">+{candidate.secondary_platforms.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {candidate.resume_url ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                            Available
                          </span>
                        ) : (
                          <span className="text-muted text-xs">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => router.push(`/admin/candidates/${candidate.id}`)}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          View
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
                Showing {((page - 1) * 50) + 1} to {Math.min(page * 50, total)} of {total} candidates
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

