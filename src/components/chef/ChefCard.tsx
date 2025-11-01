'use client';

import { ChefHat } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { ChefAvatar } from './ChefAvatar';

interface Chef {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  bio: string | null;
  profileImageUrl: string | null;
  specialties: string[] | null;
  isVerified: boolean | null;
  latitude?: string | null;
  longitude?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
}

interface ChefCardProps {
  chef: Chef & { recipeCount: number | null };
}

export function ChefCard({ chef }: ChefCardProps) {
  return (
    <Link href={`/chef/${chef.slug}`}>
      <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-jk-olive/20">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Profile Image */}
            <ChefAvatar
              size="md"
              imageUrl={chef.profileImageUrl}
              name={chef.name}
              verified={chef.isVerified}
              specialties={chef.specialties}
              className="flex-shrink-0"
            />

            {/* Chef Info */}
            <div className="flex-1 min-w-0">
              <div className="mb-1">
                <h3 className="font-heading text-lg text-jk-olive truncate">
                  {chef.displayName || chef.name}
                </h3>
              </div>

              {chef.bio && <p className="text-sm text-jk-olive/60 line-clamp-2 mb-3">{chef.bio}</p>}

              {/* Specialties */}
              {chef.specialties && chef.specialties.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap max-w-full overflow-hidden">
                  {chef.specialties.slice(0, 3).map((specialty) => (
                    <Badge
                      key={specialty}
                      variant="secondary"
                      className="text-xs bg-jk-sage/30 text-jk-olive border-jk-olive/20 truncate"
                    >
                      {specialty}
                    </Badge>
                  ))}
                  {chef.specialties.length > 3 && (
                    <Badge
                      variant="secondary"
                      className="text-xs bg-jk-sage/30 text-jk-olive border-jk-olive/20"
                    >
                      +{chef.specialties.length - 3} more
                    </Badge>
                  )}
                </div>
              )}

              {/* Recipe Count */}
              <div className="flex items-center gap-1 text-sm text-jk-olive/60">
                <ChefHat className="w-4 h-4" />
                <span>
                  {chef.recipeCount || 0} {chef.recipeCount === 1 ? 'recipe' : 'recipes'}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
