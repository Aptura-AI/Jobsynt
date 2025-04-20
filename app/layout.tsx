
import React from 'react';
import './globals.css';
import { getServerSession } from 'next-auth';
import SessionProviderClient from './providers/SessionProviderClient';
import externalAuthOptions from './api/auth/[...nextauth]/authOptions';
import NextAuth, { NextAuthOptions } from 'next-auth';

export const metadata = {
  title: 'Jobsynth',
  description: 'Your AI-powered job agent',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(externalAuthOptions);

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
