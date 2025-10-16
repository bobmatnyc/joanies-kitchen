import { cn } from '@/lib/utils';

interface MobileSpacerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

/**
 * Responsive spacer component for consistent vertical spacing
 * Automatically adjusts spacing based on viewport size
 *
 * Usage:
 * ```tsx
 * <MobileSpacer size="md" />
 * ```
 */
export function MobileSpacer({ size = 'md', className }: MobileSpacerProps) {
  const sizeClasses = {
    xs: 'h-2 md:h-3',
    sm: 'h-4 md:h-6',
    md: 'h-6 md:h-8',
    lg: 'h-8 md:h-12',
    xl: 'h-12 md:h-16',
    '2xl': 'h-16 md:h-24',
  };

  return <div className={cn(sizeClasses[size], className)} aria-hidden="true" />;
}
