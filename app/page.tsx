'use client'; // Add this line at the very top
// app/profile/page.tsx
import React from 'react';
import { useState } from 'react';

export default function ProfilePage() {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [visaStatus, setVisaStatus] = useState('');
  const [otherVisa, setOtherVisa] = useState('');
  const [validTill, setValidTill] = useState('');
  const [email, setEmail] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [jobType, setJobType] = useState<string[]>([]);
  const [preferredContract, setPreferredContract] = useState<string[]>([]);
  const [relocation, setRelocation] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [linkedinProfile, setLinkedinProfile] = useState('');
  const [experienceLevel, setExperienceLevel] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const profileData = {
      name,
      location,
      visaStatus,
      otherVisa,
      validTill,
      email,
      salaryRange,
      jobType,
      preferredContract,
      relocation,
      cities,
      states,
      linkedinProfile,
      experienceLevel,
    };

    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Profile saved:', data);
      } else {
        console.error('Failed to save profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Your form fields here */}
      <button type="submit">Save Profile</button>
    </form>
  );
}
