'use client';

import { useState } from 'react';
import Button from './Button';
import Input from './Input';
import Textarea from './Textarea';
import TagInput from './TagInput';
import ResumeUpload from './ResumeUpload';

type FormState = {
  name: string;
  email: string;
  title: string;
  location: string;
  experience: number;
  skills: string[];
  visa: string;
  rate: string;
  availability: string;
  summary: string;
  projects: string[];
};

const initialState: FormState = {
  name: '',
  email: '',
  title: '',
  location: '',
  experience: 0,
  skills: [],
  visa: '',
  rate: '',
  availability: '',
  summary: '',
  projects: ['', '', ''],
};

export default function ProfileForm() {
  const [state, setState] = useState<FormState>(initialState);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    try {
      const res = await fetch('/api/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error('Unable to save profile');
      setMessage('Profile saved successfully!');
      setState(initialState);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card p-6" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Name" required value={state.name} onChange={(e) => setState({ ...state, name: e.target.value })} />
        <Input label="Email" type="email" required value={state.email} onChange={(e) => setState({ ...state, email: e.target.value })} />
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
        <Input label="Visa status" value={state.visa} onChange={(e) => setState({ ...state, visa: e.target.value })} />
        <Input label="Rate expectation" value={state.rate} onChange={(e) => setState({ ...state, rate: e.target.value })} />
        <Input label="Availability" value={state.availability} onChange={(e) => setState({ ...state, availability: e.target.value })} />
      </div>

      <div className="mt-4">
        <TagInput label="Skills" values={state.skills} onChange={(skills) => setState({ ...state, skills })} />
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

      <div className="mt-6 flex items-center justify-between gap-3">
        <Button type="submit" loading={loading}>
          Save Profile
        </Button>
        {message && <span className="text-sm text-muted">{message}</span>}
      </div>
    </form>
  );
}

