'use client';

import React, { useEffect, useState } from 'react';

interface Employment {
  designation: string;
  company: string;
  fromDate: string;
  toDate: string;
  isCurrent: boolean;
  description: string;
}

interface ParsedProfile {
  name: string;
  location: string;
  state: string;
  phone: string;
  email: string;
  visa: string;
  visaTypeOther: string;
  validTill: string;
  linkedIn: string;
  experience: string;
  salary: string;
  contractType: string;
  jobType: string;
  relocation: string;
  relocationOption: string;
  relocationCity: string;
  relocationState: string;
  jobs: Employment[];
}

const completePage = () => {
  const [profile, setProfile] = useState<ParsedProfile>({
    name: '',
    location: '',
    state: '',
    phone: '',
    email: '',
    visa: '',
    visaTypeOther: '',
    validTill: '',
    linkedIn: '',
    experience: '',
    salary: '',
    contractType: '',
    jobType: '',
    relocation: '',
    relocationOption: '',
    relocationCity: '',
    relocationState: '',
    jobs: [
      {
        designation: '',
        company: '',
        fromDate: '',
        toDate: '',
        isCurrent: false,
        description: '',
      },
      { designation: '', company: '', fromDate: '', toDate: '', isCurrent: false, description: '' },
      { designation: '', company: '', fromDate: '', toDate: '', isCurrent: false, description: '' },
    ],
  });

  useEffect(() => {
    const data = localStorage.getItem('complete');
    if (data) {
      setProfile(JSON.parse(data));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>, field: keyof ParsedProfile) => {
    setProfile((prev) => ({ ...prev, [field]: e.target.value }));
  };
  
  type JobDetails = {
      title: string;
      company: string;
      location: string;
      remote: boolean;
      // other fields of Employment object...
  };
  // Removed redundant Employment type definition to avoid conflicts.
  const handleJobChange = (index: number, key: keyof Employment, value: string | boolean) => {
      const updatedJobs = [...profile.jobs];
    
      // Ensure the key exists in the Employment object and assign the correct value
      (updatedJobs[index][key] as typeof value) = value;
    
      setProfile((prev) => ({ ...prev, jobs: updatedJobs }));
    };
  

  const handleSubmit = () => {
    alert('Profile finalized. Redirecting to dashboard...');
    // Redirect to next flow step like /dashboard or job search
  };

  return (
    <div className="p-6 max-w-4xl mx-auto text-white bg-zinc-900 min-h-screen">
      <h1 className="text-3xl font-bold text-violet-500 mb-6">Complete Your Profile</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: 'Full Name', field: 'name' },
          { label: 'Location (City)', field: 'location' },
          { label: 'State', field: 'state' },
          { label: 'Phone Number', field: 'phone' },
          { label: 'Email', field: 'email' },
          { label: 'LinkedIn Profile', field: 'linkedIn' },
          { label: 'Experience (years)', field: 'experience' },
          { label: 'Expected Salary (USD)', field: 'salary' },
        ].map(({ label, field }) => (
          <div key={field}>
            <label className="block text-sm mb-1">{label}</label>
            <input
              className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
              type="text"
              value={(profile as any)[field]}
              onChange={(e) => handleInputChange(e, field as keyof ParsedProfile)}
            />
          </div>
        ))}

        {/* Visa Section */}
        <div>
          <label className="block text-sm mb-1">Visa Status</label>
          <select
            className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
            value={profile.visa}
            onChange={(e) => handleInputChange(e, 'visa')}
          >
            <option value="">Select</option>
            {['US Citizen', 'Green Card', 'H1B', 'H4EAD', 'L2EAD', 'F1', 'STEM OPT', 'T1 Other'].map((visa) => (
              <option key={visa}>{visa}</option>
            ))}
          </select>
        </div>

        {profile.visa === 'T1 Other' && (
          <div>
            <label className="block text-sm mb-1">Other Visa Type</label>
            <input
              className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
              type="text"
              value={profile.visaTypeOther}
              onChange={(e) => handleInputChange(e, 'visaTypeOther')}
            />
          </div>
        )}

        {!['US Citizen', 'Green Card'].includes(profile.visa) && (
          <div>
            <label className="block text-sm mb-1">Visa Valid Till</label>
            <input
              type="date"
              value={profile.validTill}
              onChange={(e) => handleInputChange(e, 'validTill')}
              className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
            />
          </div>
        )}

        <div>
          <label className="block text-sm mb-1">Preferred Contract Type</label>
          <select
            value={profile.contractType}
            onChange={(e) => handleInputChange(e, 'contractType')}
            className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
          >
            <option value="">Select</option>
            <option value="W2">W2</option>
            <option value="Contract to hire">Contract to hire</option>
            <option value="1099">1099</option>
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">Job Type</label>
          <select
            value={profile.jobType}
            onChange={(e) => handleInputChange(e, 'jobType')}
            className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
          >
            <option value="">Select</option>
            <option value="Remote">Remote</option>
            <option value="Onsite">Onsite</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>

        {/* Relocation */}
        <div>
          <label className="block text-sm mb-1">Willing to Relocate?</label>
          <select
            value={profile.relocation}
            onChange={(e) => handleInputChange(e, 'relocation')}
            className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
          >
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        {profile.relocation === 'Yes' && (
          <>
            <div>
              <label className="block text-sm mb-1">Relocate To</label>
              <select
                value={profile.relocationOption}
                onChange={(e) => handleInputChange(e, 'relocationOption')}
                className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
              >
                <option value="">Select</option>
                <option value="Anywhere in USA">Anywhere in USA</option>
                <option value="To specific location">To specific location</option>
              </select>
            </div>

            {profile.relocationOption === 'To specific location' && (
              <>
                <div>
                  <label className="block text-sm mb-1">Relocation City</label>
                  <input
                    value={profile.relocationCity}
                    onChange={(e) => handleInputChange(e, 'relocationCity')}
                    className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Relocation State</label>
                  <input
                    value={profile.relocationState}
                    onChange={(e) => handleInputChange(e, 'relocationState')}
                    className="w-full bg-zinc-800 border border-gray-700 px-3 py-2 rounded"
                    placeholder="e.g. TX or Texas"
                  />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Employment History */}
      <div className="mt-10">
        <h2 className="text-2xl font-semibold text-violet-400 mb-4">Employment History</h2>
        {profile.jobs.map((job, index) => (
          <div key={index} className="bg-zinc-800 p-4 mb-4 rounded-lg border border-zinc-700 space-y-2">
            <h3 className="text-lg font-medium text-violet-300">Job {index + 1}</h3>
            <input
              className="w-full bg-zinc-900 border border-gray-600 px-3 py-2 rounded"
              placeholder="Designation"
              value={job.designation}
              onChange={(e) => handleJobChange(index, 'designation', e.target.value)}
            />
            <input
              className="w-full bg-zinc-900 border border-gray-600 px-3 py-2 rounded"
              placeholder="Company"
              value={job.company}
              onChange={(e) => handleJobChange(index, 'company', e.target.value)}
            />
            <div className="flex gap-2">
              <input
                className="w-1/2 bg-zinc-900 border border-gray-600 px-3 py-2 rounded"
                type="date"
                value={job.fromDate}
                onChange={(e) => handleJobChange(index, 'fromDate', e.target.value)}
              />
              <input
                className="w-1/2 bg-zinc-900 border border-gray-600 px-3 py-2 rounded"
                type={job.isCurrent ? 'text' : 'date'}
                value={job.isCurrent ? 'Till Date' : job.toDate}
                onChange={(e) => handleJobChange(index, 'toDate', e.target.value)}
                disabled={job.isCurrent}
              />
            </div>
            {index === 0 && (
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={job.isCurrent}
                  onChange={(e) => handleJobChange(index, 'isCurrent', e.target.checked)}
                />
                Current Job
              </label>
            )}
            <textarea
              className="w-full bg-zinc-900 border border-gray-600 px-3 py-2 rounded"
              placeholder="Job Description"
              value={job.description}
              onChange={(e) => handleJobChange(index, 'description', e.target.value)}
            />
          </div>
        ))}
      </div>

      <div className="mt-8 text-center">
        <button
          onClick={handleSubmit}
          className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-lg font-medium"
        >
          Start Job Search
        </button>
      </div>
    </div>
  );
};

export default completePage;
