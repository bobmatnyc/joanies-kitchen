/**
 * Version Display Component
 *
 * Shows application version and build information.
 * Useful for footer, about page, or debug panels.
 */

'use client';

import { getVersionInfo, getVersionString } from '@/lib/version';

interface VersionDisplayProps {
  variant?: 'full' | 'short' | 'minimal';
  className?: string;
}

export function VersionDisplay({ variant = 'short', className = '' }: VersionDisplayProps) {
  const info = getVersionInfo();

  if (variant === 'minimal') {
    return <span className={className}>v{info.version}</span>;
  }

  if (variant === 'short') {
    return <span className={className}>{getVersionString()}</span>;
  }

  // Full variant
  return (
    <div className={`text-sm text-muted-foreground ${className}`}>
      <div>Version: {info.version}</div>
      <div>Build: {info.build}</div>
      <div>Built: {new Date(info.buildDate).toLocaleDateString()}</div>
    </div>
  );
}

/**
 * Usage examples:
 *
 * // In footer
 * <footer>
 *   <VersionDisplay variant="short" />
 * </footer>
 *
 * // In about page
 * <div>
 *   <h2>About Joanie's Kitchen</h2>
 *   <VersionDisplay variant="full" />
 * </div>
 *
 * // In debug panel
 * <div className="debug-info">
 *   <VersionDisplay variant="full" className="font-mono" />
 * </div>
 */
