'use client';

import { Check } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface ChefAvatarProps {
  size?: AvatarSize;
  imageUrl?: string | null;
  name: string;
  verified?: boolean | null;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { container: string; text: string; badge: string }> = {
  sm: {
    container: 'w-8 h-8',
    text: 'text-sm',
    badge: 'w-3 h-3 -top-0.5 -right-0.5',
  },
  md: {
    container: 'w-44 h-44',
    text: 'text-4xl',
    badge: 'w-6 h-6 -top-1 -right-1',
  },
  lg: {
    container: 'w-24 h-24',
    text: 'text-4xl',
    badge: 'w-5 h-5 -top-1 -right-1',
  },
  xl: {
    container: 'w-32 h-32 md:w-40 md:h-40',
    text: 'text-5xl md:text-6xl',
    badge: 'w-6 h-6 -top-2 -right-2',
  },
};

const sizeBorders: Record<AvatarSize, string> = {
  sm: 'border',
  md: 'border-2',
  lg: 'border-3',
  xl: 'border-4',
};

export function ChefAvatar({
  size = 'md',
  imageUrl,
  name,
  verified = false,
  className,
}: ChefAvatarProps) {
  const sizes = sizeClasses[size];
  const border = sizeBorders[size];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          sizes.container,
          border,
          'relative rounded-full overflow-hidden bg-jk-olive border-jk-sage shadow-md',
          'transition-transform hover:scale-105'
        )}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            className="object-cover"
            sizes={
              size === 'xl' ? '160px' : size === 'lg' ? '96px' : size === 'md' ? '176px' : '32px'
            }
            priority={size === 'xl'}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-jk-olive">
            <span className={cn(sizes.text, 'font-heading text-white font-bold')}>{initial}</span>
          </div>
        )}
      </div>

      {/* Verified Badge */}
      {verified && (
        <div
          className={cn(
            sizes.badge,
            'absolute rounded-full bg-blue-500 flex items-center justify-center',
            'ring-2 ring-white shadow-sm'
          )}
        >
          <Check className="w-full h-full p-0.5 text-white" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}
