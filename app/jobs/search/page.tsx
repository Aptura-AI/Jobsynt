'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const JobSearchPage = () => {
  const [jobInput, setJobInput] = useState('');
  const [salary, setSalary] = useState('');
  const [salaryType, setSalaryType] = useState('monthly');

  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const query = new URLSearchParams({
      jobInput,
      salary,
      salaryType,
    }).toString();

    router.push(`/jobs/results?${query}`);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="w-full max-w-4xl px-6 py-10 bg-gradient-to-b from-gray-900 to-gray-800 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold text-center text-purple-500 mb-8">Search for Your Ideal Job</h1>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="flex flex-col">
            <label htmlFor="jobInput" className="text-lg font-semibold text-gray-300 mb-2">
              Paste a Job Description or Job Link
            </label>
            <textarea
              id="jobInput"
              value={jobInput}
              onChange={(e) => setJobInput(e.target.value)}
              rows={4}
              placeholder="Paste job description or URL here..."
              className="p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div className="flex flex-col">
            <label htmlFor="salary" className="text-lg font-semibold text-gray-300 mb-2">
              Target Salary
            </label>
            <div className="flex space-x-4">
              <input
                type="number"
                id="salary"
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="e.g. 80000"
                className="w-2/3 p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              />
              <select
                id="salaryType"
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value)}
                className="w-1/3 p-4 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-600"
              >
                <option value="hourly">Hourly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              type="submit"
              className="w-full py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-600"
            >
              Find Matching Jobs
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobSearchPage;
