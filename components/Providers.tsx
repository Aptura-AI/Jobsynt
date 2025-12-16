'use client';

import { SessionProvider } from 'next-auth/react';

// Providers component - NextAuth SessionProvider for OAuth
// Main auth uses custom JWT tokens, but OAuth (Google/LinkedIn) still uses NextAuth
export default function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}


