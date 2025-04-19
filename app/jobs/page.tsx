'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

const JobSearchPage = () => {
  const router = useRouter();

  const [formData, setFormData] = useState({
    keyword: '',
    location: '',
    remote: true,
    visaSponsorship: false,
    salaryMin: '',
    contractType: '',
    workFormat: '', // remote, hybrid, onsite
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('jobSearchParams', JSON.stringify(formData));
    router.push('/jobs/results');
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center px-4 py-10">
      <h1 className="text-3xl font-bold text-violet-400 mb-6">Job Search</h1>
      <form
        onSubmit={handleSearch}
        className="bg-zinc-900 p-6 rounded-xl shadow-md w-full max-w-xl space-y-4"
      >
        <div>
          <label className="block text-sm mb-1">Job Title / Keywords</label>
          <input
            type="text"
            name="keyword"
            value={formData.keyword}
            onChange={handleChange}
            placeholder="e.g. React Developer"
            className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Preferred Location</label>
          <input
            type="text"
            name="location"
            value={formData.location}
            onChange={handleChange}
            placeholder="e.g. Austin, TX"
            className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="remote"
            checked={formData.remote}
            onChange={handleChange}
            id="remote"
          />
          <label htmlFor="remote" className="text-sm">Remote jobs only</label>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            name="visaSponsorship"
            checked={formData.visaSponsorship}
            onChange={handleChange}
            id="visa"
          />
          <label htmlFor="visa" className="text-sm">Require Visa Sponsorship</label>
        </div>

        <div>
          <label className="block text-sm mb-1">Minimum Salary (USD)</label>
          <input
            type="number"
            name="salaryMin"
            value={formData.salaryMin}
            onChange={handleChange}
            placeholder="e.g. 90000"
            className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Contract Type</label>
          <select
            name="contractType"
            value={formData.contractType}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700"
          >
            <option value="">Any</option>
            <option value="fulltime">Full-time</option>
            <option value="parttime">Part-time</option>
            <option value="contract">Contract</option>
            <option value="contractToHire">Contract to Hire</option>
            <option value="1099">1099</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Work Format</label>
          <select
            name="workFormat"
            value={formData.workFormat}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-md bg-zinc-800 text-white border border-zinc-700"
          >
            <option value="">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full mt-4 bg-violet-500 hover:bg-violet-600 text-white font-semibold py-2 px-4 rounded"
        >
          Find Jobs
        </button>
      </form>
    </div>
  );
};

export default JobSearchPage;
