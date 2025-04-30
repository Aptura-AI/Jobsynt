'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function UploadJobPage() {
  const [form, setForm] = useState({
    title: '',
    company: '',
    location: '',
    type: 'Remote',
    salary: '',
    description: '',
    apply_url: '',
  });

  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from('jobs').insert([{
      title: form.title,
      company: form.company,
      location: form.location,
      type: form.type,
      salary: form.salary ? Number(form.salary) : null,
      description: form.description,
      apply_url: form.apply_url,
    }]);

    setLoading(false);

    if (error) {
      alert('Error uploading job: ' + error.message);
    } else {
      alert('Job uploaded!');
      router.push('/jobs'); // or wherever your jobs list is
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10 p-6 bg-black text-white rounded-2xl shadow-lg border border-purple-700">
      <h1 className="text-2xl font-bold mb-4">Upload a Job</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Job Title"
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
          required
        />
        <input
          name="company"
          value={form.company}
          onChange={handleChange}
          placeholder="Company"
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
          required
        />
        <input
          name="location"
          value={form.location}
          onChange={handleChange}
          placeholder="Location"
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
        />
        <select
          name="type"
          value={form.type}
          onChange={handleChange}
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
        >
          <option value="Remote">Remote</option>
          <option value="Onsite">Onsite</option>
          <option value="Hybrid">Hybrid</option>
        </select>
        <input
          name="salary"
          value={form.salary}
          onChange={handleChange}
          placeholder="Salary (optional)"
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
          type="number"
        />
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          placeholder="Job Description"
          rows={4}
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
          required
        />
        <input
          name="apply_url"
          value={form.apply_url}
          onChange={handleChange}
          placeholder="Application URL (optional)"
          className="w-full p-2 rounded bg-gray-800 text-white border border-gray-600"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white py-2 px-4 rounded"
        >
          {loading ? 'Uploading...' : 'Upload Job'}
        </button>
      </form>
    </div>
  );
}
