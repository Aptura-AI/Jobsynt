'use client';

import React, { useEffect, useState, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import usStates from '../utils/usStates.json';
import { useSession } from 'next-auth/react';

interface ProfileState {
  name: string;
  location: string;
  email: string;
  phone: string;
  visa: string;
  visaTypeOther: string;
  validTill: string;
  resume: File | null;
  linkedin: string;
  experienceYears: string;
  salary: string;
  contractType: string;
  jobType: string;
  willingToRelocate: string;
  relocationScope: string;
  relocationCity: string;
  relocationState: string;
  otherVisa: string;
  openToRelocate: string;
  workPreference: string;
}

const visaOptions = [
  'US Citizen',
  'Green Card',
  'H1B',
  'H4EAD',
  'L2EAD',
  'F1',
  'STEM OPT',
  'T1 Other',
];

const contractTypes = [
  'Full-time',
  'Part-time',
  'Contract',
  'Contract to hire',
  '1099',
];

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const jobTypes = ['Onsite', 'Remote', 'Hybrid'];
  const relocationScopes = ['Anywhere in USA', 'To Specific Location'];
  const [formData, setFormData] = useState<ProfileState>({
    name: '',
    location: '',
    email: '',
    phone: '',
    visa: '',
    visaTypeOther: '',
    validTill: '',
    resume: null,
    linkedin: '',
    experienceYears: '',
    salary: '',
    contractType: '',
    jobType: '',
    willingToRelocate: '',
    relocationScope: '',
    relocationCity: '',
    relocationState: '',
    otherVisa: '',
    openToRelocate: '',
    workPreference: '',
  });

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/signin');
    }
  }, [status, session, router]);

  const parseResume = (text: string) => {
    const nameMatch = text.match(/Name:\s*(.*)/i);
    const locationMatch = text.match(/Location:\s*(.*)/i);
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/);
    const educationMatch = text.match(/Education[\s\S]*?(?=Experience|$)/i);
    const experienceMatch = text.match(/Experience[\s\S]*?(?=Skills|$)/i);
    const skillsMatch = text.match(/Skills[\s\S]*?(?=Projects|$)/i);

    const parsedProfile = {
      parsedName: nameMatch?.[1] || '',
      parsedLocation: locationMatch?.[1] || '',
      parsedEmail: emailMatch?.[0] || '',
      parsedEducation: educationMatch?.[0] || '',
      parsedExperience: experienceMatch?.[0] || '',
      parsedSkills: skillsMatch?.[0] || '',
    };

    localStorage.setItem('parsedProfile', JSON.stringify(parsedProfile));
    router.push('/profile/parsed');
  };

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleResumeUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData((prev) => ({ ...prev, resume: file }));

      const reader = new FileReader();
      reader.onload = () => {
        const text = reader.result as string;
        parseResume(text);
      };
      reader.readAsText(file);
    }
  };

  useEffect(() => {
    const savedData = localStorage.getItem('profileData');
    if (savedData) {
      setFormData(JSON.parse(savedData));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('profileData', JSON.stringify(formData));
  }, [formData]);

  const handleSubmit = () => {
    localStorage.setItem('profileData', JSON.stringify(formData));
    router.push('/profile/confirm');
  };

  if (status === 'loading') return <div className="text-white p-4">Loading...</div>;
  if (!session) return null;

  return (
    <div className="flex flex-col md:flex-row min-h-screen text-white">
      <div className="w-full md:w-1/2 bg-zinc-900 p-8 space-y-6">
        <h1 className="text-3xl font-bold text-violet-600">Candidate Profile</h1>

        <div>
          <label className="block mb-1">Full Name</label>
          <input
            type="text"
            name="name"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.name}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <label className="block mb-1">Location (City, State)</label>
          <input
            type="text"
            name="location"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.location}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <label className="block mb-1">Phone Number</label>
          <input
            type="tel"
            name="phone"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.phone}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <label className="block mb-1">Email</label>
          <input
            type="email"
            name="email"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.email}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <label className="block mb-1">LinkedIn Profile</label>
          <input
            type="url"
            name="linkedin"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.linkedin}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <label className="block mb-1">Years of Experience</label>
          <input
            type="number"
            name="experienceYears"
            min="0"
            step="0.1"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.experienceYears}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <label className="block mb-1">Expected Salary (USD)</label>
          <input
            type="text"
            name="salary"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.salary}
            onChange={handleInputChange}
          />
        </div>

        <div>
          <label className="block mb-1">Preferred Contract Type</label>
          <select
            name="contractType"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.contractType}
            onChange={handleInputChange}
          >
            <option value="">Select</option>
            {contractTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Preferred Job Type</label>
          <select
            name="jobType"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.jobType}
            onChange={handleInputChange}
          >
            <option value="">Select</option>
            {jobTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block mb-1">Visa Status</label>
          <select
            name="visa"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.visa}
            onChange={handleInputChange}
          >
            <option value="">Select</option>
            {visaOptions.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        {formData.visa === 'T1 Other' && (
          <div>
            <label className="block mb-1">Specify Visa Type</label>
            <input
              type="text"
              name="visaTypeOther"
              className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
              value={formData.visaTypeOther}
              onChange={handleInputChange}
            />
          </div>
        )}

        {!['US Citizen', 'Green Card'].includes(formData.visa) && formData.visa && (
          <div>
            <label className="block mb-1">Visa Valid Till</label>
            <input
              type="date"
              name="validTill"
              className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
              value={formData.validTill}
              onChange={handleInputChange}
            />
          </div>
        )}

        <div>
          <label className="block mb-1">Willing to Relocate?</label>
          <select
            name="willingToRelocate"
            className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
            value={formData.willingToRelocate}
            onChange={handleInputChange}
          >
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>

        {formData.willingToRelocate === 'Yes' && (
          <div>
            <label className="block mb-1">Relocation Preference</label>
            <select
              name="relocationScope"
              className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
              value={formData.relocationScope}
              onChange={handleInputChange}
            >
              <option value="">Select</option>
              {relocationScopes.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}

        {formData.relocationScope === 'To Specific Location' && (
          <>
            <div>
              <label className="block mb-1">Relocation State</label>
              <input
                type="text"
                name="relocationState"
                list="us-states"
                className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
                value={formData.relocationState}
                onChange={handleInputChange}
              />
              <datalist id="us-states">
                {usStates.map((state: { name: string }) => (
                  <option key={state.name} value={state.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block mb-1">Relocation City</label>
              <input
                type="text"
                name="relocationCity"
                className="w-full bg-zinc-800 border border-gray-700 px-4 py-2 rounded"
                value={formData.relocationCity}
                onChange={handleInputChange}
              />
            </div>
          </>
        )}

        <button
          className="mt-4 bg-violet-600 hover:bg-violet-700 text-white font-semibold px-6 py-2 rounded"
          onClick={handleSubmit}
        >
          Upload Resume & Continue
        </button>
      </div>

      <div className="w-full md:w-1/2 bg-gray-800 p-8 flex flex-col justify-center items-center">
        <h2 className="text-2xl font-semibold text-violet-500 mb-4">
          Upload Resume
        </h2>
        <input
          type="file"
          accept=".pdf"
          className="text-white"
          onChange={handleResumeUpload}
        />
      </div>
    </div>
  );
}
