'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TouchTargetProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'ghost' | 'minimal';
  size?: 'default' | 'large';
}

/**
 * Touch-friendly button component
 * Ensures minimum touch target size for mobile accessibility
 *
 * Usage:
 * ```tsx
 * <TouchTarget onClick={handleClick}>
 *   <Icon />
 * </TouchTarget>
 * ```
 */
export function TouchTarget({
  children,
  className,
  variant = 'default',
  size = 'default',
  ...props
}: TouchTargetProps) {
  const variantClasses = {
    default: 'active:opacity-70 transition-opacity',
    ghost: 'hover:bg-gray-100 active:bg-gray-200 transition-colors',
    minimal: 'active:scale-95 transition-transform',
  };

  const sizeClasses = {
    default: 'min-h-[44px] min-w-[44px]',
    large: 'min-h-[48px] min-w-[48px]',
  };

  return (
    <button
      {...props}
      className={cn(
        'flex items-center justify-center',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'focus-visible:outline-none',
        'rounded-md',
        'no-select',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      type={props.type || 'button'}
    >
      {children}
    </button>
  );
}
