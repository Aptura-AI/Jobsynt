import type { Metadata } from 'next';
import Link from 'next/link';
import Button from '@/components/Button';

export const metadata: Metadata = {
  title: 'Privacy Policy - Jobsynt',
  description: 'Privacy Policy for Jobsynt - Learn how we collect, use, and protect your personal information.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">Last updated: December 13, 2025</p>
      </div>

      <div className="prose prose-slate max-w-none space-y-8">
        {/* Introduction */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">1. Introduction</h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>
              Welcome to Jobsynt. We are a career platform that helps candidates find jobs and receive AI-powered career guidance. 
              We respect your privacy and are committed to protecting your personal information.
            </p>
            <p>
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service. 
              By using Jobsynt, you agree to the collection and use of information in accordance with this policy.
            </p>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* Information We Collect */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">2. Information We Collect</h2>
          <div className="mt-4 space-y-4 text-muted">
            <div>
              <h3 className="text-lg font-semibold text-ink">Account Data</h3>
              <p>
                When you create an account or sign in, we collect:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Name and email address</li>
                <li>Profile information (title, location, experience, skills, visa status, rate expectations, availability)</li>
                <li>When you sign in with Google or LinkedIn OAuth, we receive your name, email address, and profile picture (as permitted by the provider)</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">Resume Data</h3>
              <p>
                When you upload a resume (PDF or text format), we extract text content for AI-powered analysis and job matching. 
                Resumes are processed temporarily and are not stored permanently in our AI training data.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">Usage Data</h3>
              <p>
                We collect information about how you interact with our service, including:
              </p>
              <ul className="ml-6 list-disc space-y-2">
                <li>Interactions with our AI Career Mentor</li>
                <li>Job matches and recommendations</li>
                <li>Application submissions</li>
              </ul>
            </div>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* How We Use Your Information */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">3. How We Use Your Information</h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>We use the information we collect to:</p>
            <ul className="ml-6 list-disc space-y-2">
              <li>Create and manage your account</li>
              <li>Provide AI-powered resume analysis and career guidance</li>
              <li>Match you with relevant job opportunities</li>
              <li>Send personalized job recommendations and career insights</li>
              <li>Improve our service and develop new features</li>
              <li>Respond to your inquiries and provide customer support</li>
            </ul>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* Data Sharing */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">4. Data Sharing</h2>
          <div className="mt-4 space-y-4 text-muted">
            <p>
              <strong className="text-ink">We do NOT sell your data.</strong> We do NOT share your resumes with third parties.
            </p>
            <div>
              <h3 className="text-lg font-semibold text-ink">OAuth Data</h3>
              <p>
                When you sign in with Google or LinkedIn, the authentication data (name, email, profile picture) is used solely 
                for account creation and authentication purposes. We do not share this information with third parties.
              </p>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-ink">Service Providers</h3>
              <p>We work with trusted service providers to operate our platform:</p>
              <ul className="ml-6 list-disc space-y-2">
                <li>
                  <strong className="text-ink">Vercel:</strong> Hosting and infrastructure services
                </li>
                <li>
                  <strong className="text-ink">Supabase:</strong> Database and authentication services
                </li>
                <li>
                  <strong className="text-ink">OpenAI:</strong> AI processing for resume analysis and job matching. 
                  Resumes are processed temporarily for analysis but are not stored or used to train AI models.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* Data Storage and Security */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">5. Data Storage and Security</h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>
              Your data is stored securely on Vercel and Supabase infrastructure, which use industry-standard encryption 
              and security measures to protect your information.
            </p>
            <p>
              Resumes uploaded for AI analysis are processed temporarily and are not permanently stored in our AI training datasets. 
              We implement appropriate technical and organizational measures to protect your personal information against unauthorized 
              access, alteration, disclosure, or destruction.
            </p>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* Your Rights */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">6. Your Rights</h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>You have the right to:</p>
            <ul className="ml-6 list-disc space-y-2">
              <li>Access your personal data</li>
              <li>Update or correct your information</li>
              <li>Request deletion of your account and data</li>
              <li>Export your data in a portable format</li>
              <li>Opt out of certain data processing activities</li>
            </ul>
            <p>
              To exercise these rights, please contact us at{' '}
              <a href="mailto:info@jobsynt.com" className="font-semibold text-primary hover:underline">
                info@jobsynt.com
              </a>
            </p>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* Cookies and Tracking */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">7. Cookies and Tracking</h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>
              We use essential cookies for authentication and session management. These cookies are necessary for the 
              functioning of our service and cannot be disabled.
            </p>
            <p>
              We do not use tracking cookies or advertising cookies. We do not track your activity across other websites 
              or services.
            </p>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* Changes to Policy */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">8. Changes to This Policy</h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new 
              Privacy Policy on this page and updating the "Last updated" date.
            </p>
            <p>
              Your continued use of Jobsynt after any changes to this Privacy Policy constitutes your acceptance of the 
              updated policy.
            </p>
          </div>
        </section>

        <div className="border-t border-slate-200"></div>

        {/* Contact Us */}
        <section>
          <h2 className="text-2xl font-semibold text-ink">9. Contact Us</h2>
          <div className="mt-4 space-y-3 text-muted">
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="rounded-lg bg-slate-50 p-4">
              <p className="font-semibold text-ink">Email:</p>
              <a href="mailto:info@jobsynt.com" className="text-primary hover:underline">
                info@jobsynt.com
              </a>
              <p className="mt-2 font-semibold text-ink">Website:</p>
              <a href="https://jobsynt.com/privacy" className="text-primary hover:underline">
                https://jobsynt.com/privacy
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* Back to Home Button */}
      <div className="mt-12 flex justify-center">
        <Link href="/">
          <Button variant="ghost">Back to Home</Button>
        </Link>
      </div>
    </div>
  );
}

