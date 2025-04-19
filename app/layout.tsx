
import React from 'react';
import './globals.css';
import { getServerSession } from 'next-auth';
import SessionProviderClient from './providers/SessionProviderClient';
import { authOptions } from './api/auth/[...nextauth]/route';

export const metadata = {
  title: 'Jobsynth',
  description: 'Your AI-powered job agent',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en">
      <body>
        <SessionProviderClient session={session}>
          {children}
        </SessionProviderClient>
      </body>
    </html>
  );
}
