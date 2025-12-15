'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Link from 'next/link';

export default function CompanyRegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    designation: '',
    email: '',
    phone: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/company/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessageType('error');
        setMessage(data.error || 'Registration failed');
      } else {
        setMessageType('success');
        setMessage('Company registered successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/company/login');
        }, 2000);
      }
    } catch (err) {
      setMessageType('error');
      setMessage((err as Error).message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-ink">Company Registration</h1>
      <p className="mt-2 text-muted">Post C2C & 1099 contract jobs for free</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Company Name *"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <Input
          label="Contact Name *"
          type="text"
          required
          value={formData.contact_name}
          onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
        />
        <Input
          label="Designation"
          type="text"
          value={formData.designation}
          onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
        />
        <Input
          label="Email *"
          type="email"
          required
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <Input
          label="Phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <Input
          label="Password *"
          type="password"
          required
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
        />
        <Button type="submit" loading={loading} className="w-full">
          Register Company
        </Button>
      </form>

      {message && (
        <div
          className={`mt-4 rounded-md p-3 text-sm ${
            messageType === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {message}
        </div>
      )}

      <div className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/company/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}

