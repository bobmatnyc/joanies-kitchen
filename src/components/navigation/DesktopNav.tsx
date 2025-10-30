'use client';

import { Bookmark, BookOpen, CalendarDays, GraduationCap, Leaf, Package } from 'lucide-react';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';

/**
 * Desktop Navigation Component - Week 4 Task 5.1 (Updated Oct 21)
 *
 * Main navigation bar for desktop screens (>= 1280px / xl breakpoint)
 * Reorganized around zero-waste mission per ROADMAP.md
 *
 * Primary Navigation:
 * 1. Ingredients - Searchable ingredient directory
 * 2. Learn - Educational content (includes Philosophy and Rescue Ingredients links)
 * 3. Sustainability Chefs - Featured chefs with zero-waste focus
 * 4. All Recipes - Complete searchable collection
 *
 * Note: "What's in Your Fridge" is linked from homepage hero
 * Note: "Philosophy" and "Rescue Ingredients" are linked from /learn page
 */
export function DesktopNav() {
  return (
    <div className="hidden xl:flex items-center gap-2">
      {/* Learn Techniques */}
      <NavLink href="/learn" icon={GraduationCap} label="Learn" />

      {/* All Recipes */}
      <NavLink href="/recipes" icon={BookOpen} label="Recipes" />

      {/* Collections */}
      <NavLink href="/collections" icon={Bookmark} label="Collections" />

      {/* Meal Plans */}
      <NavLink href="/meal-plans" icon={CalendarDays} label="Meals" />

      {/* Ingredients Directory */}
      <NavLink href="/ingredients" icon={Package} label="Ingredients" />

      {/* Sustainability Chefs */}
      <NavLink href="/discover/chefs" icon={Leaf} label="Chefs" />

      {/* Auth Controls */}
      <AuthButtons />
    </div>
  );
}
