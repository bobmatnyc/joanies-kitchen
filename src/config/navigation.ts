// Centralized nav item list — single source of truth for DesktopNav and MobileNav.
// Update here and both nav variants pick up the change automatically.

import {
  Bookmark,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Leaf,
  Package,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Primary nav links — shown in both desktop bar and mobile drawer. */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { href: '/learn', label: 'Learn', icon: GraduationCap },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/collections', label: 'Collections', icon: Bookmark },
  { href: '/meal-plans', label: 'Meals', icon: CalendarDays },
  { href: '/ingredients', label: 'Ingredients', icon: Package },
  { href: '/discover/chefs', label: 'No-Waste Chefs', icon: Leaf },
];

/** Secondary nav links — shown only in the mobile drawer below the divider. */
export const SECONDARY_NAV_ITEMS: NavItem[] = [
  { href: '/recipes/zero-waste', label: 'Zero-Waste Collection', icon: Leaf },
  { href: '/discover', label: 'Discover', icon: Sparkles },
];
