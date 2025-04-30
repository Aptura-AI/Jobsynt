'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { extractResumeText, parseResumeText } from '@/lib/resume-parser';

interface JobExperience {
  title: string;
  company: string;
  location: string;
  start_date: string;
  end_date: string;
  details: string[];
}

interface ProfileData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  visa_status: string;
  other_visa: string;
  visa_valid_till: string;
  location_city: string;
  location_state: string;
  relocation_status: string;
  relocation_cities: string[];
  relocation_states: string[];
  linkedin_profile: string;
  salary: string;
  experience_years: string;
  jobs: JobExperience[];
}

interface ParsedResumeData {
  name?: string;
  email?: string;
  phone?: string;
  skills?: string[];
  experience?: string[];
  education?: string[];
  rawText?: string;
}

const visaOptions = ['US Citizen', 'Green Card', 'H1B', 'F1', 'STEM OPT', 'L1', 'Other'];
const relocationOptions = ['No', 'Relocate anywhere in the USA', 'Relocate to selected cities'];

const normalizeArrayInput = (input: string | string[]): string[] => {
  if (Array.isArray(input)) return input.filter(item => item.trim() !== '');
  if (typeof input === 'string') {
    return input.split(/[,;]|\s+/).filter(item => item.trim() !== '');
  }
  return [];
};

export default function ProfileCompletePage() {
  const supabase = createClientComponentClient();
  const router = useRouter();

  const [profileData, setProfileData] = useState<ProfileData>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    visa_status: '',
    other_visa: '',
    visa_valid_till: '',
    location_city: '',
    location_state: '',
    relocation_status: '',
    relocation_cities: [],
    relocation_states: [],
    linkedin_profile: '',
    salary: '',
    experience_years: '',
    jobs: [
      { 
        title: '', 
        company: '', 
        location: '', 
        start_date: '', 
        end_date: '', 
        details: [''] 
      },
    ],
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleRelocationCityChange = (index: number, value: string) => {
    const updatedCities = [...profileData.relocation_cities];
    updatedCities[index] = value;
    setProfileData(prev => ({ ...prev, relocation_cities: updatedCities }));
  };

  const addRelocationCity = () => {
    setProfileData(prev => ({
      ...prev,
      relocation_cities: [...prev.relocation_cities, '']
    }));
  };

  const handleJobChange = (index: number, field: keyof JobExperience, value: string) => {
    const updatedJobs = [...profileData.jobs];
    if (field === 'details') {
      updatedJobs[index] = {
        ...updatedJobs[index],
        details: normalizeArrayInput(value)
      };
    } else {
      updatedJobs[index] = {
        ...updatedJobs[index],
        [field]: value
      };
    }
    setProfileData(prev => ({ ...prev, jobs: updatedJobs }));
  };

  const addJob = () => {
    setProfileData(prev => ({
      ...prev,
      jobs: [
        ...prev.jobs,
        { 
          title: '', 
          company: '', 
          location: '', 
          start_date: '', 
          end_date: '', 
          details: [''] 
        },
      ],
    }));
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const rawText = await extractResumeText(file);
      const parsedData: ParsedResumeData = parseResumeText(rawText);
      
      // Safely merge parsed data with existing profile data
      setProfileData(prev => ({
        ...prev,
        first_name: parsedData.name?.split(' ')[0] || prev.first_name,
        last_name: parsedData.name?.split(' ').slice(1).join(' ') || prev.last_name,
        email: parsedData.email || prev.email,
        phone: parsedData.phone || prev.phone,
        // Handle skills if needed
        // Handle experience if needed
        // Handle education if needed
      }));
    } catch (error) {
      console.error('Error parsing resume:', error);
    }
  };

  const saveProfile = async () => {
    try {
      // Normalize all array inputs before saving
      const formattedData = {
        ...profileData,
        relocation_cities: normalizeArrayInput(profileData.relocation_cities),
        relocation_states: normalizeArrayInput(profileData.relocation_states),
        jobs: profileData.jobs.map(job => ({
          ...job,
          details: normalizeArrayInput(job.details)
        }))
      };

      const { error } = await supabase.from('profiles').upsert(formattedData);
      
      if (error) {
        console.error('Error saving profile:', error);
        return;
      }
      
      router.push('/profile/confirm');
    } catch (error) {
      console.error('Error in saveProfile:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-semibold mb-6">Complete Your Profile</h1>

      {/* Resume Upload */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Upload Resume (PDF)</label>
        <input 
          type="file" 
          accept="application/pdf" 
          onChange={handleResumeUpload} 
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      {/* Basic Info */}
      {['first_name', 'last_name', 'email', 'phone'].map((field) => (
        <div key={field} className="mb-4">
          <label className="block font-medium mb-1 capitalize">{field.replace('_', ' ')}</label>
          <input
            type={field === 'email' ? 'email' : 'text'}
            name={field}
            value={profileData[field as keyof ProfileData] as string}
            onChange={handleInputChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
      ))}

      {/* Visa Status */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Visa Status</label>
        <select
          name="visa_status"
          value={profileData.visa_status}
          onChange={handleInputChange}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">Select</option>
          {visaOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {profileData.visa_status === 'Other' && (
        <div className="mb-4">
          <label className="block font-medium mb-1">Specify Other Visa</label>
          <input
            type="text"
            name="other_visa"
            value={profileData.other_visa}
            onChange={handleInputChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
      )}

      {!(profileData.visa_status === 'US Citizen' || profileData.visa_status === 'Green Card') && profileData.visa_status && (
        <div className="mb-4">
          <label className="block font-medium mb-1">Visa Valid Till</label>
          <input
            type="date"
            name="visa_valid_till"
            value={profileData.visa_valid_till}
            onChange={handleInputChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
      )}

      {/* Location */}
      <div className="mb-4">
        <label className="block font-medium mb-1">City</label>
        <input
          type="text"
          name="location_city"
          value={profileData.location_city}
          onChange={handleInputChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>
      <div className="mb-4">
        <label className="block font-medium mb-1">State</label>
        <input
          type="text"
          name="location_state"
          value={profileData.location_state}
          onChange={handleInputChange}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      {/* Relocation */}
      <div className="mb-4">
        <label className="block font-medium mb-1">Relocation Preference</label>
        <select
          name="relocation_status"
          value={profileData.relocation_status}
          onChange={handleInputChange}
          className="w-full border px-3 py-2 rounded"
        >
          <option value="">Select</option>
          {relocationOptions.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      {profileData.relocation_status === 'Relocate to selected cities' && (
        <>
          {profileData.relocation_cities.map((city, index) => (
            <div key={index} className="mb-4">
              <label className="block font-medium mb-1">Relocation City {index + 1}</label>
              <input
                type="text"
                value={city}
                onChange={(e) => handleRelocationCityChange(index, e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          ))}
          <button 
            type="button" 
            onClick={addRelocationCity} 
            className="text-blue-500 underline mb-4"
          >
            + Add More Cities
          </button>
        </>
      )}

      <div className="mb-4">
        <label className="block font-medium mb-1">
          Relocation States (comma or space separated)
        </label>
        <input
          type="text"
          name="relocation_states"
          value={profileData.relocation_states.join(', ')}
          onChange={(e) => {
            setProfileData(prev => ({
              ...prev,
              relocation_states: normalizeArrayInput(e.target.value)
            }));
          }}
          className="w-full border px-3 py-2 rounded"
        />
      </div>

      {/* LinkedIn, Salary, Experience */}
      {['linkedin_profile', 'salary', 'experience_years'].map((field) => (
        <div key={field} className="mb-4">
          <label className="block font-medium mb-1 capitalize">
            {field.replace('_', ' ')}
            {field === 'salary' && ' ($)'}
            {field === 'experience_years' && ' (years)'}
          </label>
          <input
            type={field === 'salary' || field === 'experience_years' ? 'number' : 'text'}
            name={field}
            value={profileData[field as keyof ProfileData] as string}
            onChange={handleInputChange}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
      ))}

      {/* Work Experience */}
      <h2 className="text-xl font-semibold mt-6 mb-2">Work Experience</h2>
      {profileData.jobs.map((job, index) => (
        <div key={index} className="border p-4 mb-4 rounded-lg">
          {['title', 'company', 'location', 'start_date', 'end_date'].map((field) => (
            <div key={field} className="mb-3">
              <label className="block font-medium mb-1 capitalize">{field.replace('_', ' ')}</label>
              <input
                type={field.includes('date') ? 'date' : 'text'}
                value={job[field as keyof JobExperience] as string}
                onChange={(e) => handleJobChange(index, field as keyof JobExperience, e.target.value)}
                className="w-full border px-3 py-2 rounded"
              />
            </div>
          ))}
          <div className="mb-3">
            <label className="block font-medium mb-1">Details (one per line)</label>
            <textarea
              value={job.details.join('\n')}
              onChange={(e) => handleJobChange(index, 'details', e.target.value)}
              className="w-full border px-3 py-2 rounded"
              rows={4}
            />
          </div>
        </div>
      ))}
      <button 
        type="button" 
        onClick={addJob} 
        className="text-blue-500 underline mb-6"
      >
        + Add Another Job
      </button>

      {/* Submit */}
      <button
        onClick={saveProfile}
        className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 transition-colors"
      >
        Save and Continue
      </button>
    </div>
  );
}