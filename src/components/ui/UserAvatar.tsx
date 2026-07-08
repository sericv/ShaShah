'use client';

import { useRouter } from 'next/navigation';

interface UserAvatarProps {
  userId: string;
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showStatus?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-14 h-14 text-lg',
  xl: 'w-20 h-20 text-3xl',
};

const statusSizeMap = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
};

export default function UserAvatar({ userId, name, avatarUrl, size = 'md', isOnline, showStatus, className = '' }: UserAvatarProps) {
  const router = useRouter();

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <div
        onClick={() => router.push(`/profile?userId=${userId}`)}
        className={`${sizeMap[size]} rounded-full bg-shasha-accent/25 border border-shasha-accent/30 flex items-center justify-center font-bold text-shasha-accent overflow-hidden cursor-pointer hover:ring-2 hover:ring-shasha-accent/50 transition-all`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          name.charAt(0)
        )}
      </div>
      {showStatus && (
        <span
          className={`${statusSizeMap[size]} rounded-full absolute -bottom-0.5 -right-0.5 ring-2 ring-[#0c0c0f] ${
            isOnline ? 'bg-shasha-success' : 'bg-zinc-500'
          }`}
        />
      )}
    </div>
  );
}
