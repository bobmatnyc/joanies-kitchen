'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface MobileContainerProps {
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
}

/**
 * Mobile-first container component
 * Provides responsive padding and max-width constraints
 *
 * Usage:
 * ```tsx
 * <MobileContainer>
 *   <YourContent />
 * </MobileContainer>
 * ```
 */
export function MobileContainer({
  children,
  className,
  noPadding = false,
  maxWidth = '2xl',
}: MobileContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-screen-sm',
    md: 'max-w-screen-md',
    lg: 'max-w-screen-lg',
    xl: 'max-w-screen-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-full',
  };

  return (
    <div
      className={cn(
        'w-full mx-auto',
        maxWidthClasses[maxWidth],
        !noPadding && 'px-4 sm:px-6 md:px-8',
        className
      )}
    >
      {children}
    </div>
  );
}
