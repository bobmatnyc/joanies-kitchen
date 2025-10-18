'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getChefBySlug } from '@/app/actions/chefs';

interface BackToChefProps {
  chefSlug: string;
}

/**
 * BackToChef component - provides navigation back to a chef's page
 * Only displayed when the user navigated from a chef page
 */
export function BackToChef({ chefSlug }: BackToChefProps) {
  const [chefName, setChefName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChefName() {
      try {
        const result = await getChefBySlug(chefSlug);
        if (result.success && result.chef) {
          setChefName(result.chef.display_name || result.chef.name);
        }
      } catch (error) {
        console.error('Failed to fetch chef name:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchChefName();
  }, [chefSlug]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  if (!chefName) {
    return null; // Don't show if chef not found
  }

  const chefUrl = `/chef/${chefSlug}`;

  return (
    <Link
      href={chefUrl}
      className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-6 min-h-[44px] min-w-[44px] -ml-2 pl-2 pr-4 py-2 rounded-md hover:bg-accent transition-colors"
      aria-label={`Back to ${chefName}'s recipes`}
    >
      <ChevronLeft className="w-4 h-4 mr-1" />
      Back to {chefName}&apos;s Recipes
    </Link>
  );
}
