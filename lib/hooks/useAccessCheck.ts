'use client';

import { useState, useEffect } from 'react';
import { hasCandidateAccess } from '@/lib/utils/accessCheck';

type Profile = {
  is_paid?: boolean | null;
  trial_ends_at?: string | null;
};

/**
 * Hook to check candidate access
 * Fetches profile and checks access status
 */
export function useAccessCheck(): { hasAccess: boolean; loading: boolean } {
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch('/api/profile');
        if (res.ok) {
          const data = await res.json();
          const profile: Profile = data.profile || {};
          setHasAccess(hasCandidateAccess(profile));
        } else {
          // If profile fetch fails, assume no access
          setHasAccess(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setHasAccess(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccess();
  }, []);

  return { hasAccess, loading };
}

