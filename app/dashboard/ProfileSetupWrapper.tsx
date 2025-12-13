'use client';

import { useRouter } from 'next/navigation';
import ProfileSetupForm from '@/components/ProfileSetupForm';

type ProfileSetupWrapperProps = {
  userEmail: string;
  userName: string;
};

export default function ProfileSetupWrapper({ userEmail, userName }: ProfileSetupWrapperProps) {
  const router = useRouter();

  const handleComplete = () => {
    // Refresh the page to load the dashboard
    router.refresh();
  };

  return (
    <ProfileSetupForm
      userEmail={userEmail}
      userName={userName}
      onComplete={handleComplete}
    />
  );
}

