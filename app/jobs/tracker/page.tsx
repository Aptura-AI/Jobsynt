'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type JobApplication = {
  id: string;
  job_title: string;
  company: string;
  job_link: string;
  status: 'Applied' | 'Interview' | 'Offer' | 'Rejected';
  applied_date: string;
  job_ranking_score: number;
};

export default function JobTrackerPage() {
  const [applications, setApplications] = useState<JobApplication[]>([]);

  useEffect(() => {
    const fetchApplications = async () => {
      const { data, error } = await supabase.from('applications').select('*');
      if (error) console.error(error);
      else setApplications(data);
    };
    fetchApplications();
  }, []);

  const updateStatus = async (id: string, newStatus: JobApplication['status']) => {
    const { error } = await supabase.from('applications').update({ status: newStatus }).eq('id', id);
    if (error) console.error(error);
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: newStatus } : app))
    );
  };

  return (
    <div className="p-6 text-white bg-black min-h-screen">
      <h1 className="text-3xl font-bold mb-6 text-purple-400">Job Tracker</h1>
      <div className="overflow-x-auto">
        <table className="table-auto w-full border-collapse border border-gray-700">
          <thead>
            <tr className="bg-purple-900 text-left">
              <th className="px-4 py-2">Job Title</th>
              <th className="px-4 py-2">Company</th>
              <th className="px-4 py-2">Link</th>
              <th className="px-4 py-2">Date Applied</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Ranking</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => (
              <tr key={app.id} className="border-t border-gray-700">
                <td className="px-4 py-2">{app.job_title}</td>
                <td className="px-4 py-2">{app.company}</td>
                <td className="px-4 py-2 text-blue-400 underline">
                  <a href={app.job_link} target="_blank" rel="noopener noreferrer">
                    View
                  </a>
                </td>
                <td className="px-4 py-2">{new Date(app.applied_date).toLocaleDateString()}</td>
                <td className="px-4 py-2">
                  <select
                    value={app.status}
                    onChange={(e) => updateStatus(app.id, e.target.value as JobApplication['status'])}
                    className="bg-black text-white border border-gray-600 px-2 py-1 rounded"
                  >
                    <option value="Applied">Applied</option>
                    <option value="Interview">Interview</option>
                    <option value="Offer">Offer</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </td>
                <td className="px-4 py-2">{app.job_ranking_score ?? '-'}</td>
                <a href={app.job_link} target="_blank" rel="noopener noreferrer">
                    View Job Description
                    </a>

                </tr>
            ))}
          </tbody>
        </table>
        {applications.length === 0 && <p className="mt-4 text-gray-400">No applications found.</p>}
      </div>
    </div>
  );
}
