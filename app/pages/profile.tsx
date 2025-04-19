// pages/profile.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Redirect to sign-in if the user is not authenticated
  if (status === 'loading') return <div>Loading...</div>;
  if (status === 'unauthenticated') {
    router.push('/signin');
    return null;  // Prevent rendering while redirecting
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-black text-white p-6">
      <h1 className="text-5xl font-bold text-center text-purple-600 mb-6">Welcome to Your Profile, {session?.user?.name}</h1>

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg w-full max-w-lg text-lg">
        <div className="mb-4">
          <strong className="text-gray-400">Name:</strong> {session?.user?.name}
        </div>
        <div className="mb-4">
          <strong className="text-gray-400">Email:</strong> {session?.user?.email}
        </div>
        <div className="mb-4">
          <strong className="text-gray-400">Provider:</strong> {session?.user?.provider || 'Google/LinkedIn'}
        </div>

        {/* Add more profile details as needed */}

        <button
          onClick={() => router.push('/')}
          className="mt-6 bg-purple-600 text-white px-8 py-4 rounded-full w-full text-xl"
        >
          Go back to Home
        </button>
      </div>
    </div>
  );
};

export default ProfilePage;
