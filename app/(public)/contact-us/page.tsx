import type { Metadata } from 'next';
import Link from 'next/link';
import Button from '@/components/Button';

export const metadata: Metadata = {
  title: 'Contact Us - Jobsynt',
  description: 'Get in touch with Jobsynt - AI-powered job agent for C2C & 1099 contractors. Contact us for support, questions, or partnership opportunities.',
};

export const dynamic = 'force-dynamic';

export default function ContactUsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-ink">Contact Us</h1>
        <p className="mt-2 text-lg text-muted">
          We'd love to hear from you. Get in touch with our team.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Contact Information */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-ink mb-4">Get in Touch</h2>
            <p className="text-muted">
              Have questions about Jobsynt? Want to learn more about our AI-powered job matching? 
              Reach out to us through any of the channels below.
            </p>
          </div>

          <div className="space-y-4">
            {/* Email */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📧</div>
                <div>
                  <h3 className="font-semibold text-ink mb-1">Email</h3>
                  <a 
                    href="mailto:info@jobsynt.com" 
                    className="text-primary hover:underline break-all"
                  >
                    info@jobsynt.com
                  </a>
                  <p className="text-sm text-muted mt-1">We typically respond within 24 hours</p>
                </div>
              </div>
            </div>

            {/* Phone */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📞</div>
                <div>
                  <h3 className="font-semibold text-ink mb-1">Phone</h3>
                  <a 
                    href="tel:+13467700780" 
                    className="text-primary hover:underline"
                  >
                    +1 (346) 770-0780
                  </a>
                  <p className="text-sm text-muted mt-1">Monday - Friday, 9 AM - 5 PM CST</p>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">📍</div>
                <div>
                  <h3 className="font-semibold text-ink mb-1">Office</h3>
                  <p className="text-ink">
                    Houston, TX 77079<br />
                    United States
                  </p>
                </div>
              </div>
            </div>

            {/* Social Media */}
            <div className="card p-4">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔗</div>
                <div>
                  <h3 className="font-semibold text-ink mb-3">Follow Us</h3>
                  <div className="space-y-2">
                    <a 
                      href="https://www.linkedin.com/company/jobsynt" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      <span>LinkedIn</span>
                    </a>
                    <a 
                      href="https://x.com/jobsynt" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      <span>X (Twitter)</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold text-ink mb-4">About Jobsynt</h2>
            <p className="text-muted mb-4">
              Jobsynt is a recruiter-led, AI-assisted job search and career intelligence platform 
              built for professionals who want better outcomes — not just more job listings.
            </p>
            <p className="text-muted">
              We combine human expertise with intelligent automation to help C2C & 1099 contractors 
              find roles that actually fit their skills, experience, and career goals.
            </p>
          </div>

          <div className="card p-6 bg-primary/5">
            <h3 className="font-semibold text-ink mb-3">What We Offer</h3>
            <ul className="space-y-2 text-muted">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>AI-powered job matching for C2C & 1099 contracts</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Personal AI Career Mentor for guidance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Resume optimization and ATS compliance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>No ghost jobs — only verified opportunities</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-1">✓</span>
                <span>Human-guided matching with AI acceleration</span>
              </li>
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="font-semibold text-ink mb-3">Quick Links</h3>
            <div className="space-y-2">
              <Link href="/" className="block text-primary hover:underline">
                → Home
              </Link>
              <Link href="/jobs" className="block text-primary hover:underline">
                → Browse Jobs
              </Link>
              <Link href="/signup" className="block text-primary hover:underline">
                → Sign Up
              </Link>
              <Link href="/privacy" className="block text-primary hover:underline">
                → Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Form Section (Optional - can be added later) */}
      <div className="mt-12 card p-8 text-center">
        <h2 className="text-2xl font-semibold text-ink mb-2">Ready to Get Started?</h2>
        <p className="text-muted mb-6">
          Join Jobsynt today and let our AI-powered job agent find the perfect C2C & 1099 opportunities for you.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/signup">
            <Button className="px-8 py-3">Create Your Profile</Button>
          </Link>
          <Link href="/jobs">
            <Button variant="ghost" className="px-8 py-3">Browse Jobs</Button>
          </Link>
        </div>
      </div>

      {/* Back to Home */}
      <div className="mt-8 flex justify-center">
        <Link href="/">
          <Button variant="ghost">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}

