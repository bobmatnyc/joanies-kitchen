'use client';

import {
  BookOpen,
  Calendar,
  ChefHat,
  FolderHeart,
  Globe,
  Heart,
  Plus,
  Sparkles,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';
import { Button } from '@/components/ui/button';

/**
 * Desktop Navigation Component
 *
 * Main navigation bar for desktop screens (>= 1280px / xl breakpoint)
 * Features active state indication and user authentication controls
 */
export function DesktopNav() {
  return (
    <div className="hidden xl:flex items-center gap-2">
      <NavLink href="/about" icon={Heart} label="About" />
      <NavLink href="/recipes" icon={BookOpen} label="My Recipes" />
      <NavLink href="/recipes/top-50" icon={Trophy} label="Top 50" />
      <NavLink href="/collections" icon={FolderHeart} label="Collections" />
      <NavLink href="/meals" icon={Calendar} label="Meals" />
      <NavLink href="/shared" icon={Globe} label="Shared" />
      <NavLink href="/discover" icon={Sparkles} label="Discover" />
      <NavLink href="/discover/chefs" icon={ChefHat} label="Chefs" />

      {/* Add Recipe CTA Button */}
      <Link href="/recipes/new">
        <Button
          size="sm"
          className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Recipe
        </Button>
      </Link>

      {/* Auth Controls */}
      <AuthButtons />
    </div>
  );
}
