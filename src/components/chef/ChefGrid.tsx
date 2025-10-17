'use client';

import { ChefHat } from 'lucide-react';
import { ChefCard } from './ChefCard';

interface Chef {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  specialties: string[] | null;
  isVerified: boolean | null;
}

interface ChefGridProps {
  chefs: (Chef & { recipeCount: number | null })[];
  emptyMessage?: string;
  emptyDescription?: string;
}

export function ChefGrid({
  chefs,
  emptyMessage = 'No chefs found',
  emptyDescription = 'Check back soon for featured chefs and their recipes!',
}: ChefGridProps) {
  if (chefs.length === 0) {
    return (
      <div className="text-center py-12">
        <ChefHat className="w-16 h-16 mx-auto text-jk-olive/20 mb-4" />
        <h3 className="text-2xl font-heading text-jk-olive mb-2">{emptyMessage}</h3>
        <p className="text-jk-olive/60">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {chefs.map((chef) => (
        <ChefCard key={chef.id} chef={chef} />
      ))}
    </div>
  );
}
