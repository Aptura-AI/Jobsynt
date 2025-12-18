'use client';

import { useState, useEffect } from 'react';
import Button from './Button';
import Input from './Input';
import Textarea from './Textarea';
import TagInput from './TagInput';
import ResumeUpload from './ResumeUpload';
import { ALLOWED_JOB_TYPES, JOB_TYPE_LABELS, type JobType } from '@/lib/job-types';
import { VISA_STATUS_VALUES, VISA_STATUS_LABELS, normalizeVisaStatus, type VisaStatus } from '@/lib/visa-types';

type FormState = {
  name: string;
  email: string;
  phone: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  preferred_job_types: JobType[];
  visa: VisaStatus;
  rate: string;
  availability: string;
  summary: string;
  projects: string[];
};

const initialState: FormState = {
  name: '',
  email: '',
  phone: '',
  title: '',
  location: '',
  experience: 0,
  skills: [],
  preferred_job_types: [],
  visa: 'UNSPECIFIED',
  rate: '',
  availability: '',
  summary: '',
  projects: ['', '', ''],
};

export default function ProfileForm() {
  const [state, setState] = useState<FormState>(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Load existing profile data on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        // Check URL params for email (from password reset flow)
        const urlParams = new URLSearchParams(window.location.search);
        const verified = urlParams.get('verified') === 'true';

        // Try to load from profile API first
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          if (data.profile) {
            setState({
              name: data.profile.name || '',
              email: data.profile.email || '',
              phone: data.profile.phone || '',
              title: data.profile.title || '',
              location: data.profile.location || '',
              experience: data.profile.experience_years || 0,
              skills: Array.isArray(data.profile.skills) ? data.profile.skills : [],
              preferred_job_types: Array.isArray(data.profile.preferred_job_types) 
                ? data.profile.preferred_job_types 
                : [],
              // Normalize visa status from database to enum value
              visa: normalizeVisaStatus(data.profile.visa_status),
              rate: data.profile.rate_expectation || '',
              availability: data.profile.availability || 'immediate',
              summary: data.profile.summary || '',
              projects: [], // Projects not stored in profile currently
            });
          }
        }

        // If verified=true in URL, show success message
        if (verified) {
          setMessage('Email verified! Please review and confirm your profile information.');
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoadingProfile(false);
      }
    };
    loadProfile();
  }, []);

  const updateProject = (idx: number, value: string) => {
    setState((prev) => {
      const projects = [...prev.projects];
      projects[idx] = value;
      return { ...prev, projects };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    // Validate visa selection
    if (!state.visa) {
      setMessage('Please select your visa status');
      setLoading(false);
      return;
    }

    try {
      // Use PUT to update existing profile, POST for new
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...state,
          experience_years: state.experience,
          visa_status: state.visa, // Send enum value
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Unable to save profile');
      }
      setMessage(data.message || 'Profile saved successfully! Redirecting to dashboard...');
      
      // Redirect to dashboard after successful save
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1500);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-1/3 rounded bg-slate-200"></div>
          <div className="h-10 rounded bg-slate-200"></div>
        </div>
      </div>
    );
  }

  return (
    <form className="card p-4 sm:p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        <Input label="Name" required value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
        <Input label="Email" type="email" required value={state.email} disabled className="bg-gray-50" />
        <Input label="Phone Number" type="tel" value={state.phone} onChange={(e) => setState({ ...state, phone: e.target.value })} placeholder="+1 (555) 123-4567" />
        <Input label="Title" required value={state.title} onChange={(e) => setState({ ...state, title: e.target.value })} />
        <Input label="Location" required value={state.location} onChange={(e) => setState({ ...state, location: e.target.value })} />
        <Input
          label="Experience (years)"
          type="number"
          min={0}
          required
          value={state.experience}
          onChange={(e) => setState({ ...state, experience: Number(e.target.value) })}
        />
        
        {/* Visa Status Dropdown - REQUIRED */}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">
            Visa Status <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={state.visa}
            onChange={(e) => setState({ ...state, visa: e.target.value as VisaStatus })}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="" disabled>Select visa status</option>
            {VISA_STATUS_VALUES.map((visa) => (
              <option key={visa} value={visa}>
                {VISA_STATUS_LABELS[visa]}
              </option>
            ))}
          </select>
        </div>

        <Input label="Rate expectation" value={state.rate} onChange={(e) => setState({ ...state, rate: e.target.value })} placeholder="e.g., $80/hr" />
        <Input label="Availability" value={state.availability} onChange={(e) => setState({ ...state, availability: e.target.value })} placeholder="e.g., immediate, 2 weeks" />
      </div>

      <div className="mt-4">
        <TagInput label="Skills" values={state.skills} onChange={(skills) => setState({ ...state, skills })} />
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-ink">
          Preferred Job Types <span className="text-muted text-xs">(Select one or more, leave empty to see all jobs)</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ALLOWED_JOB_TYPES.map((jobType) => (
            <label key={jobType} className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={state.preferred_job_types.includes(jobType)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setState({
                      ...state,
                      preferred_job_types: [...state.preferred_job_types, jobType],
                    });
                  } else {
                    setState({
                      ...state,
                      preferred_job_types: state.preferred_job_types.filter((t) => t !== jobType),
                    });
                  }
                }}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm text-ink">{JOB_TYPE_LABELS[jobType]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <Textarea label="Summary" rows={4} value={state.summary} onChange={(e) => setState({ ...state, summary: e.target.value })} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {state.projects.map((proj, idx) => (
          <Input key={idx} label={`Project ${idx + 1}`} value={proj} onChange={(e) => updateProject(idx, e.target.value)} />
        ))}
      </div>

      <div className="mt-4">
        <ResumeUpload
          onParsed={({ name, email, skills }) => {
            setState((prev) => ({
              ...prev,
              name: name || prev.name,
              email: email || prev.email,
              skills: skills && skills.length ? Array.from(new Set([...(prev.skills || []), ...skills])).slice(0, 20) : prev.skills,
            }));
          }}
        />
      </div>

      <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Button type="submit" loading={loading} className="w-full sm:w-auto">
          Save Profile
        </Button>
        {message && <span className="text-sm text-muted text-center sm:text-left">{message}</span>}
      </div>
    </form>
  );
}
