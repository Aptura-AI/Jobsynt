'use client';

import { useState } from 'react';
import Button from '@/components/Button';

export default function ApplyButton({ jobId, isLoggedIn }: { jobId: string; isLoggedIn: boolean }) {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleApply = async () => {
    if (!isLoggedIn) {
      window.location.href = `/login?next=/jobs/${jobId}`;
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });
      if (!res.ok) throw new Error('Unable to submit application');
      setMessage('Application submitted. A recruiter will reach out.');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-4">
      <Button onClick={handleApply} loading={loading}>
        Apply
      </Button>
      {message && <span className="text-sm text-muted">{message}</span>}
    </div>
  );
}


