'use client';

import { useState } from 'react';
import Button from './Button';
import Input from './Input';
import Select from './Select';
import Textarea from './Textarea';
import TagInput from './TagInput';
import MultiSelect from './MultiSelect';

type ProfileSetupFormProps = {
  userEmail: string;
  userName: string;
  onComplete: () => void;
};

const contractTypeOptions = [
  { value: 'Full-time', label: 'Full-time' },
  { value: 'W2 Contract', label: 'W2 Contract' },
  { value: 'C2C', label: 'C2C' },
  { value: '1099', label: '1099' },
];

const workModeOptions = [
  { value: 'Remote', label: 'Remote' },
  { value: 'Hybrid', label: 'Hybrid' },
  { value: 'Onsite', label: 'Onsite' },
];

export default function ProfileSetupForm({ userEmail, userName, onComplete }: ProfileSetupFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const [formData, setFormData] = useState({
    name: userName || '',
    title: '',
    location: '',
    experience_years: '',
    skills: [] as string[],
    contract_type: [] as string[],
    work_mode: [] as string[],
    visa_status: '',
    rate_expectation: '',
    availability: 'immediate',
    summary: '',
  });

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setResumeFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create profile
      const profileRes = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          email: userEmail,
          experience_years: parseInt(formData.experience_years) || 0,
        }),
      });

      if (!profileRes.ok) {
        const data = await profileRes.json();
        throw new Error(data.error || data.message || 'Failed to create profile');
      }

      const profileData = await profileRes.json();

      // Upload resume if provided
      if (resumeFile) {
        try {
          const formDataUpload = new FormData();
          formDataUpload.append('file', resumeFile);

          const resumeRes = await fetch('/api/resume/upload', {
            method: 'POST',
            body: formDataUpload,
          });

          if (!resumeRes.ok) {
            const errorData = await resumeRes.json().catch(() => ({}));
            console.error('Resume upload failed:', errorData.error || 'Unknown error');
            // Don't throw - profile was created successfully
          }
        } catch (resumeError) {
          console.error('Resume upload error:', resumeError);
          // Continue - profile was created
        }
      }

      // Trigger AI matching for this profile
      if (profileData.profile?.id) {
        try {
          await fetch('/api/ai-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile_id: profileData.profile.id,
            }),
          });
        } catch (matchError) {
          console.error('AI matching trigger failed:', matchError);
          // Non-blocking - matching will happen on schedule
        }
      }

      onComplete();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-ink">Complete Your Profile</h1>
        <p className="mt-2 text-muted">
          Help us match you with the best opportunities by filling out your profile.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 card p-6">
        {/* Basic Info */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Full Name"
            required
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
          />
          <Input
            label="Professional Title"
            placeholder="e.g., Senior PeopleSoft Developer"
            required
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Location"
            placeholder="e.g., New York, NY or Remote"
            required
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
          />
          <Input
            label="Years of Experience"
            type="number"
            min="0"
            max="50"
            required
            value={formData.experience_years}
            onChange={(e) => handleChange('experience_years', e.target.value)}
          />
        </div>

        {/* Skills */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink">Skills</label>
          <TagInput
            values={formData.skills}
            onChange={(values) => handleChange('skills', values)}
            placeholder="Add skills (press Enter)"
          />
          <p className="mt-1 text-xs text-muted">Add your key skills separated by Enter</p>
        </div>

        {/* Job Preferences - Multi-select */}
        <div className="grid gap-4 md:grid-cols-2">
          <MultiSelect
            label="Contract Type"
            options={contractTypeOptions}
            values={formData.contract_type}
            onChange={(values) => handleChange('contract_type', values)}
            placeholder="Select contract types"
          />
          <MultiSelect
            label="Work Mode"
            options={workModeOptions}
            values={formData.work_mode}
            onChange={(values) => handleChange('work_mode', values)}
            placeholder="Select work modes"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Select
            label="Availability"
            value={formData.availability}
            onChange={(e) => handleChange('availability', e.target.value)}
          >
            <option value="immediate">Immediate</option>
            <option value="2weeks">2 Weeks Notice</option>
            <option value="1month">1 Month Notice</option>
            <option value="flexible">Flexible</option>
          </Select>
          <Input
            label="Rate Expectation (optional)"
            placeholder="e.g., $80/hr or $150k/year"
            value={formData.rate_expectation}
            onChange={(e) => handleChange('rate_expectation', e.target.value)}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="Visa Status (optional)"
            placeholder="e.g., US Citizen, H1B, etc."
            value={formData.visa_status}
            onChange={(e) => handleChange('visa_status', e.target.value)}
          />
        </div>

        {/* Summary */}
        <Textarea
          label="Professional Summary"
          placeholder="Brief summary of your experience and what you're looking for..."
          rows={4}
          value={formData.summary}
          onChange={(e) => handleChange('summary', e.target.value)}
        />

        {/* Resume Upload */}
        <div>
          <label className="mb-1 block text-sm font-semibold text-ink">Resume (PDF)</label>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeChange}
              className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-blue-700"
            />
          </div>
          {resumeFile && (
            <p className="mt-2 text-sm text-green-600">Selected: {resumeFile.name}</p>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Submit Button */}
        <Button type="submit" loading={loading} className="w-full">
          Complete Profile
        </Button>
      </form>
    </div>
  );
}
