'use client';

import React from 'react';
import { useState } from 'react';

const JobSearchPage = () => {
  const [location, setLocation] = useState('');
  const [visa, setVisa] = useState('');
  const [results, setResults] = useState<{ title: string; company: string; location: string }[]>([]);

  const handleSearch = async () => {
    // Mock API call, replace with real job search logic
    const response = await fetch('/api/job-search', {
      method: 'POST',
      body: JSON.stringify({ location, visa }),
    });
    const data = await response.json();
    setResults(data);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Job Search</h1>
      <div className="mb-4">
        <label className="block">Location</label>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="input"
          placeholder="Enter job location"
        />
      </div>

      <div className="mb-4">
        <label className="block">Visa Type</label>
        <select
          value={visa}
          onChange={(e) => setVisa(e.target.value)}
          className="select"
        >
          <option value="All">All</option>
          <option value="H1B">H1B</option>
          <option value="F1">F1</option>
          <option value="Green Card">Green Card</option>
        </select>
      </div>

      <button onClick={handleSearch} className="btn-primary">Search Jobs</button>

      <div className="mt-4">
        <h2 className="text-xl font-semibold mb-2">Job Results</h2>
        {results.map((job, index) => (
          <div key={index} className="job-card">
            <h3 className="font-semibold">{job.title}</h3>
            <p>{job.company}</p>
            <p>{job.location}</p>
            <button className="btn-secondary">Apply</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default JobSearchPage;
