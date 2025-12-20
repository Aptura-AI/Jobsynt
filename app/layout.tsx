import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Providers from '@/components/Providers';
import { Analytics } from '@vercel/analytics/next';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Jobsynt | AI-Powered Talent Marketplace',
  description: 'Your AI-Powered Talent Marketplace for ERP, Cloud & IT Professionals.',
  openGraph: {
    title: 'Jobsynt | AI-Powered Talent Marketplace',
    description: 'Find ERP, Cloud, and IT experts faster with Jobsynt.',
    url: 'https://jobsynt.com',
    siteName: 'Jobsynt',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}

