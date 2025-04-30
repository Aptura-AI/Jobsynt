// app/success/page.tsx
'use client';

import Link from 'next/link';

export default function SuccessPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6">
      <h1 className="text-4xl font-bold mb-4">Profile Saved Successfully!</h1>
      <p className="text-lg mb-6">
        Your profile and generated resume have been saved. You can now proceed to build your resume or explore job listings.
      </p>
      <div className="flex gap-4">
        <Link href="/">
          <a className="bg-purple-600 hover:bg-purple-700 text-white py-2 px-4 rounded">
            Home
          </a>
        </Link>
        <Link href="/resume-builder">
          <a className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded">
            Go to Resume Builder
          </a>
        </Link>
      </div>
    </div>
  );
}
