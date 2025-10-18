'use client';

import {
  Calendar,
  ChefHat,
  FolderHeart,
  Globe,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';

/**
 * Desktop Navigation Component
 *
 * Main navigation bar for desktop screens (>= 1280px / xl breakpoint)
 * Features active state indication and user authentication controls
 */
export function DesktopNav() {
  return (
    <div className="hidden xl:flex items-center gap-2">
      <NavLink href="/recipes/top-50" icon={Trophy} label="Top 50" />
      <NavLink href="/collections" icon={FolderHeart} label="Collections" />
      <NavLink href="/meals" icon={Calendar} label="Meals" />
      <NavLink href="/shared" icon={Globe} label="Shared" />
      <NavLink href="/discover" icon={Sparkles} label="Discover" />
      <NavLink href="/discover/chefs" icon={ChefHat} label="Chefs" />

      {/* Auth Controls */}
      <AuthButtons />
    </div>
  );
}
