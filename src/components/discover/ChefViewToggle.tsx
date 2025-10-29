'use client';

import { Grid, Map } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ChefGrid } from '@/components/chef/ChefGrid';
import { Button } from '@/components/ui/button';

// Dynamically import the map component to avoid SSR issues
const ChefLocationMap = dynamic(
  () => import('./ChefLocationMap').then((mod) => mod.ChefLocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[600px] bg-jk-linen rounded-lg flex items-center justify-center">
        <p className="text-jk-olive/60">Loading map...</p>
      </div>
    ),
  }
);

interface Chef {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  specialties: string[] | null;
  isVerified: boolean | null;
  recipeCount: number | null;
  latitude?: string | null;
  longitude?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
}

interface ChefViewToggleProps {
  chefs: Chef[];
}

export function ChefViewToggle({ chefs }: ChefViewToggleProps) {
  const [view, setView] = useState<'grid' | 'map'>('grid');

  return (
    <div>
      {/* View Toggle */}
      <div className="mb-6 flex gap-3">
        <Button
          variant={view === 'grid' ? 'default' : 'outline'}
          onClick={() => setView('grid')}
          className="flex items-center gap-2"
        >
          <Grid className="w-4 h-4" />
          Grid View
        </Button>
        <Button
          variant={view === 'map' ? 'default' : 'outline'}
          onClick={() => setView('map')}
          className="flex items-center gap-2"
        >
          <Map className="w-4 h-4" />
          Map View
        </Button>
      </div>

      {/* Content */}
      {view === 'grid' ? (
        <ChefGrid
          chefs={chefs}
          emptyMessage="No chefs yet"
          emptyDescription="Check back soon for featured chefs and their amazing recipes!"
        />
      ) : (
        <ChefLocationMap chefs={chefs} />
      )}
    </div>
  );
}
