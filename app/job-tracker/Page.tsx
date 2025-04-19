
'use client';
import React, { useState } from 'react';

const JobTrackerPage = () => {
  const [applications, setApplications] = useState([
    { jobTitle: 'Software Engineer', company: 'ABC Corp', status: 'Applied' },
    { jobTitle: 'Data Scientist', company: 'XYZ Ltd', status: 'Interviewing' },
  ]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-semibold mb-4">Job Application Tracker</h1>
      <ul>
        {applications.map((app, index) => (
          <li key={index} className="mb-4">
            <div className="job-card">
              <h3>{app.jobTitle}</h3>
              <p>{app.company}</p>
              <p>Status: {app.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default JobTrackerPage;
