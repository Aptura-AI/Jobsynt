'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useEffect } from 'react';

const HomePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    // Session state sync
  }, [status]);

  const handleAuthAction = () => {
    if (status === 'loading') return;
    
    if (!session) {
      toast.error('Please sign in to continue');
      router.push('/auth/signin');
    } else {
      router.push('/profile');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-white bg-gradient-to-br from-[#1a063a] via-[#2e0b6e] to-[#0a0515]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col text-white bg-gradient-to-br from-[#1a063a] via-[#2e0b6e] to-[#0a0515]">
      {/* Hero Section */}
      <section className="relative text-center py-20 px-6 md:px-20 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-purple-600 filter blur-[100px]"></div>
          <div className="absolute bottom-1/3 right-1/4 w-80 h-80 rounded-full bg-indigo-800 filter blur-[120px]"></div>
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-purple-400">
            Jobsynt — Your AI-Powered Job Agent, Career Guide, and Opportunity Engine.
          </h1>
          <p className="max-w-3xl mx-auto mb-8 text-lg text-purple-100/80">
            Say goodbye to chaotic job hunts. Let AI search, analyze, and apply for jobs — personalized for you.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap justify-center gap-4 mb-16">
            <Link href="/auth/signin">
              <button className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg text-white font-medium transition-all">
                Sign In
              </button>
            </Link>
            <Link href="/auth/signup">
              <button className="bg-transparent border border-purple-400 hover:bg-purple-600 px-6 py-3 rounded-lg text-white font-medium transition-all">
                Sign Up
              </button>
            </Link>
            <button 
              onClick={handleAuthAction}
              className="bg-transparent border border-purple-400 hover:bg-purple-600 px-6 py-3 rounded-lg text-white font-medium transition-all"
            >
              Profile
            </button>
          </div>

          {/* Hero Image */}
          <div className="relative w-full max-w-5xl mx-auto aspect-video rounded-xl overflow-hidden border border-purple-500/20 shadow-xl">
            <Image
              src="/images/homepage-image.png"  // Updated path
              alt="Jobsynt Platform Preview"
              fill
              priority
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 80vw"
              quality={100}
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="px-6 md:px-20 py-12 flex flex-col md:flex-row gap-8 items-center bg-gradient-to-r from-[#1a063a]/50 to-[#2e0b6e]/50">
        <div className="md:w-2/3">
          <h2 className="text-3xl font-bold mb-4 text-purple-300">About Jobsynt</h2>
          <p className="text-purple-100/80 text-lg leading-relaxed">
            Jobsynt is a next-generation, AI-driven job search and career intelligence platform designed for modern job seekers navigating a complex global market.
          </p>
          <p className="mt-4 text-purple-100/80 text-lg leading-relaxed">
            At its core, Jobsynt blends AI intuition with human-centric design to simplify and supercharge the job-seeking process.
          </p>
        </div>
        
        {/* Logo Display */}
        <div className="relative w-64 h-64 mx-auto">
          <div className="relative h-full rounded-2xl overflow-hidden border border-purple-500/20 bg-[#1a063a] p-4">
            <Image
              src="/images/logo.png"  // Updated path
              alt="Jobsynt Logo"
              fill
              className="object-contain"
              quality={100}
            />
          </div>
        </div>
      </section>

      {/* Mission & Vision */}
      <section className="px-6 md:px-20 py-12 bg-[#1a063a]/70">
        <h2 className="text-3xl font-bold mb-4 text-purple-300">Mission & Vision</h2>
        <p className="text-purple-100/80 text-lg leading-relaxed mb-4">
          <strong>Vision:</strong> To redefine job search and hiring by making it intelligent, efficient, and personalized.
        </p>
        <p className="text-purple-100/80 text-lg leading-relaxed">
          <strong>Mission:</strong> To build the world's most powerful AI-powered job agent.
        </p>
      </section>

      {/* How It Works */}
      <section className="px-6 md:px-20 py-12 bg-gradient-to-b from-[#12052a] to-[#0a0515]">
        <h2 className="text-3xl font-bold mb-6 text-purple-300">How Jobsynt Works</h2>
        <ul className="text-lg text-purple-100/80 space-y-4">
          <li>✅ Upload your resume and LinkedIn profile</li>
          <li>✅ Jobsynt finds matching jobs using AI</li>
          <li>✅ Generate tailored resumes for each job</li>
        </ul>
      </section>

      {/* Meet the Founder */}
      <section className="px-6 md:px-20 py-12 bg-[#1a063a]/70">
        <h2 className="text-3xl font-bold mb-6 text-purple-300">Meet the Founder</h2>
        <p className="text-purple-100/80 text-lg leading-relaxed">
          Roy is an experienced professional with more than 15 years of international experience.
        </p>
      </section>

      {/* Footer */}
      <footer className="bg-black/80 backdrop-blur-sm py-12 px-6 md:px-20 border-t border-purple-500/10">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-xl font-bold text-purple-300 mb-4">Jobsynt</h3>
              <p className="text-purple-100/60">
                The intelligent job search platform powered by AI.
              </p>
            </div>
            <div>
              <h4 className="text-purple-200 font-semibold mb-4">Navigation</h4>
              <ul className="space-y-2 text-purple-100/60">
                {['Home', 'About', 'Job Search', 'Resume Builder'].map((item) => (
                  <li key={item}>
                    <Link href={`/${item.toLowerCase().replace(' ', '-')}`} className="hover:text-purple-300 transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-purple-200 font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-purple-100/60">
                {['Blog', 'Career Guide', 'Help Center'].map((item) => (
                  <li key={item}>
                    <Link href={`/${item.toLowerCase().replace(' ', '-')}`} className="hover:text-purple-300 transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="text-purple-200 font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-purple-100/60">
                {['Privacy Policy', 'Terms of Service'].map((item) => (
                  <li key={item}>
                    <Link href={`/${item.toLowerCase().replace(' ', '-')}`} className="hover:text-purple-300 transition-colors">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-purple-500/10 text-center text-purple-100/50 text-sm">
            &copy; {new Date().getFullYear()} Jobsynt. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;