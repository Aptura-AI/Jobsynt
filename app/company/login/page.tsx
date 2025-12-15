'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';
import Link from 'next/link';

export default function CompanyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<'error' | 'success'>('error');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/company/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessageType('error');
        setMessage(data.error || 'Login failed');
      } else {
        setMessageType('success');
        setMessage('Login successful! Redirecting...');
        setTimeout(() => {
          router.push('/company');
        }, 1000);
      }
    } catch (err) {
      setMessageType('error');
      setMessage((err as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-ink">Company Login</h1>
      <p className="mt-2 text-muted">Access your company dashboard</p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          label="Password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" loading={loading} className="w-full">
          Sign In
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
        Don't have an account?{' '}
        <Link href="/company/register" className="font-semibold text-primary hover:underline">
          Register your company
        </Link>
      </div>
    </div>
  );
}

