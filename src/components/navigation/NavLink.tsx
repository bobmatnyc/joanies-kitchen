'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavLinkProps {
  href: string;
  icon: LucideIcon;
  label: string;
  variant?: 'desktop' | 'mobile';
  onClick?: () => void;
}

/**
 * Navigation Link Component with Active State
 *
 * Automatically highlights the current page based on URL pathname.
 * Supports both desktop and mobile variants.
 */
export function NavLink({ href, icon: Icon, label, variant = 'desktop', onClick }: NavLinkProps) {
  const pathname = usePathname();

  // Check if this link is active
  // For exact match on home, otherwise check if pathname starts with href
  const isActive = href === '/' ? pathname === '/' : pathname?.startsWith(href);

  if (variant === 'mobile') {
    return (
      <Button
        variant="ghost"
        className={cn(
          'w-full justify-start text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui',
          isActive && 'bg-jk-olive/60 text-jk-sage font-semibold'
        )}
        asChild
      >
        <Link href={href} onClick={onClick}>
          <Icon className="h-5 w-5 mr-3" />
          {label}
        </Link>
      </Button>
    );
  }

  // Desktop variant
  return (
    <Link href={href}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'text-jk-linen hover:text-jk-sage hover:bg-jk-olive/80 font-ui',
          isActive && 'bg-jk-olive/60 text-jk-sage font-semibold'
        )}
      >
        <Icon className="h-4 w-4 mr-2" />
        {label}
      </Button>
    </Link>
  );
}
