'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ParsedProfile {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  skills: string;
  experience: string;
  education: string;
}

const ParsedProfilePage = () => {
  const router = useRouter();
  const [parsedData, setParsedData] = useState<ParsedProfile>({
    name: '',
    email: '',
    phone: '',
    location: '',
    linkedin: '',
    skills: '',
    experience: '',
    education: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('parsedResumeData');
    if (saved) {
      setParsedData(JSON.parse(saved));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setParsedData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    localStorage.setItem('parsedResumeData', JSON.stringify(parsedData));
    router.push('/profile/complete');
  };

  return (
    <div className="min-h-screen bg-zinc-900 text-white px-6 py-10">
      <h1 className="text-3xl font-bold text-violet-500 mb-6">Review & Refine Resume Details</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Name */}
        <div>
          <label className="block mb-1">Full Name</label>
          <input
            name="name"
            value={parsedData.name}
            onChange={handleChange}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block mb-1">Email</label>
          <input
            name="email"
            value={parsedData.email}
            onChange={handleChange}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block mb-1">Phone</label>
          <input
            name="phone"
            value={parsedData.phone}
            onChange={handleChange}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>

        {/* Location */}
        <div>
          <label className="block mb-1">Location</label>
          <input
            name="location"
            value={parsedData.location}
            onChange={handleChange}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>

        {/* LinkedIn */}
        <div className="md:col-span-2">
          <label className="block mb-1">LinkedIn</label>
          <input
            name="linkedin"
            value={parsedData.linkedin}
            onChange={handleChange}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>

        {/* Skills */}
        <div className="md:col-span-2">
          <label className="block mb-1">Skills</label>
          <textarea
            name="skills"
            value={parsedData.skills}
            onChange={handleChange}
            rows={4}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>

        {/* Experience */}
        <div className="md:col-span-2">
          <label className="block mb-1">Experience Summary</label>
          <textarea
            name="experience"
            value={parsedData.experience}
            onChange={handleChange}
            rows={4}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>

        {/* Education */}
        <div className="md:col-span-2">
          <label className="block mb-1">Education Summary</label>
          <textarea
            name="education"
            value={parsedData.education}
            onChange={handleChange}
            rows={4}
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        className="mt-8 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2 rounded"
      >
        Save & Continue
      </button>
    </div>
  );
};

export default ParsedProfilePage;
