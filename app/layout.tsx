import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'JobSynth | AI-Powered Talent Marketplace',
  description: 'Your AI-Powered Talent Marketplace for Oracle, Cloud & IT Professionals.',
  openGraph: {
    title: 'JobSynth | AI-Powered Talent Marketplace',
    description: 'Find Oracle, Cloud, and IT experts faster with JobSynth.',
    url: 'https://jobsynth.com',
    siteName: 'JobSynth',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

