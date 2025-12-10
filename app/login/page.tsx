'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Input from '@/components/Input';
import Button from '@/components/Button';

export default function LoginPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) throw new Error('Invalid credentials');
      
      // Safe redirect: validate route and prevent open redirect attacks
      const next = searchParams.get('next');
      const redirectTo = next?.startsWith('/') ? next : '/';
      router.push(redirectTo);
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-3xl font-bold text-ink">Login</h1>
      <p className="mt-2 text-muted">Access your Jobsynt account.</p>
      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" loading={loading}>
          Login
        </Button>
        {message && <p className="text-sm text-red-500">{message}</p>}
      </form>
    </div>
  );
}

