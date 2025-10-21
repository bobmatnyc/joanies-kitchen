'use client';

import {
  Refrigerator,
  Recycle,
  GraduationCap,
  Leaf,
  Heart,
  BookOpen,
  Package,
} from 'lucide-react';
import { AuthButtons } from '@/components/auth/AuthButtons';
import { NavLink } from '@/components/navigation/NavLink';

/**
 * Desktop Navigation Component - Week 4 Task 5.1
 *
 * Main navigation bar for desktop screens (>= 1280px / xl breakpoint)
 * Reorganized around zero-waste mission per ROADMAP.md
 *
 * Primary Navigation:
 * 1. What's in Your Fridge - Core entry point for waste reduction
 * 2. Rescue Ingredients - Browse by ingredient type (wilting greens, aging veggies, etc.)
 * 3. Learn Techniques - Educational content on zero-waste cooking
 * 4. Sustainability Chefs - Featured chefs with zero-waste focus
 * 5. Philosophy - Joanie's approach to cooking and waste reduction
 * 6. All Recipes - Complete searchable collection (secondary)
 */
export function DesktopNav() {
  return (
    <div className="hidden xl:flex items-center gap-2">
      {/* Primary: Zero-Waste Entry Point */}
      <NavLink href="/fridge" icon={Refrigerator} label="What's in Your Fridge" />

      {/* Rescue Ingredients - NEW */}
      <NavLink href="/rescue" icon={Recycle} label="Rescue Ingredients" />

      {/* Ingredients Directory */}
      <NavLink href="/ingredients" icon={Package} label="Ingredients" />

      {/* Learn Techniques - NEW */}
      <NavLink href="/learn" icon={GraduationCap} label="Learn" />

      {/* Sustainability Chefs */}
      <NavLink href="/discover/chefs" icon={Leaf} label="Chefs" />

      {/* Philosophy - NEW */}
      <NavLink href="/philosophy" icon={Heart} label="Philosophy" />

      {/* Secondary: All Recipes */}
      <NavLink href="/recipes" icon={BookOpen} label="Recipes" />

      {/* Auth Controls */}
      <AuthButtons />
    </div>
  );
}
