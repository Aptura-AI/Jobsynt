'use client';

import { useEffect, useState } from 'react';

export default function ProfileConfirm() {
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const confirmed = localStorage.getItem('confirmedProfile');
    if (confirmed) {
      setProfile(JSON.parse(confirmed));
    }
  }, []);

  if (!profile) return <div className="text-white p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto bg-card text-white">
      <h1 className="text-3xl font-bold mb-4">Review & Confirm Your Resume</h1>

      <div className="mb-6">
        <p><strong>{profile.first_name} {profile.last_name}</strong></p>
        <p>{profile.email} | {profile.phone}</p>
        <p>{profile.linkedin_profile}</p>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold">Location & Visa</h2>
        <p>{profile.location} | Visa: {profile.visa_status} {profile.other_visa && `(${profile.other_visa})`} | Valid till: {profile.visa_valid_till}</p>
        <p>Relocation: {profile.relocation_status} {profile.relocation_cities?.join(', ')} {profile.relocation_states?.join(', ')}</p>
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-semibold">Experience</h2>
        <p>{profile.experience_years} years</p>
        <p>Expected Salary: {profile.salary}</p>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Work History</h2>
        {profile.jobs?.map((job: any, idx: number) => (
          <div key={idx} className="mb-4">
            <p className="font-semibold">{job.title} — {job.company}</p>
            <p className="text-sm">{job.location} | {job.start_date} to {job.end_date || 'Present'}</p>
            <p className="text-sm whitespace-pre-wrap">{job.details}</p>
          </div>
        ))}
      </div>

      <button className="btn-primary mt-6">Confirm & Generate Resume</button>
    </div>
  );
}
