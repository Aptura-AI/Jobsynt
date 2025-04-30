// app/layout.tsx
import { Providers } from './providers';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Jobsynt',
  description: 'AI-Powered Job Search Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-gradient-to-br from-[#1a063a] via-[#2e0b6e] to-[#0a0515] text-white">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}