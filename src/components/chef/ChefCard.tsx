'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChefHat, Check } from 'lucide-react';
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
}

interface ChefCardProps {
  chef: Chef & { recipeCount: number | null };
}

export function ChefCard({ chef }: ChefCardProps) {
  return (
    <Link href={`/chef/${chef.slug}`}>
      <Card className="hover:shadow-lg transition-all duration-200 hover:scale-[1.02] cursor-pointer border-jk-olive/20 overflow-hidden">
        <CardContent className="p-0">
          {/* Large Image Header */}
          <div className="relative w-full aspect-[4/3] bg-jk-olive/5 overflow-hidden">
            {chef.profileImageUrl ? (
              <>
                <Image
                  src={chef.profileImageUrl}
                  alt={chef.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
                {/* Verified Badge */}
                {chef.isVerified && (
                  <div className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-white shadow-lg">
                    <Check className="w-5 h-5 text-white" strokeWidth={3} />
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-jk-olive/20 to-jk-sage/20">
                <div className="w-32 h-32 rounded-full bg-jk-olive flex items-center justify-center mb-4 border-4 border-jk-sage shadow-lg">
                  <span className="text-6xl font-heading text-white font-bold">
                    {chef.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <ChefHat className="w-12 h-12 text-jk-olive/30" />
              </div>
            )}
          </div>

          {/* Chef Info */}
          <div className="p-6">
            <div className="mb-2">
              <h3 className="font-heading text-xl text-jk-olive">
                {chef.displayName || chef.name}
              </h3>
            </div>

            {chef.bio && (
              <p className="text-sm text-jk-olive/60 line-clamp-2 mb-4">
                {chef.bio}
              </p>
            )}

            {/* Specialties */}
            {chef.specialties && chef.specialties.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                {chef.specialties.slice(0, 3).map((specialty) => (
                  <Badge
                    key={specialty}
                    variant="secondary"
                    className="text-xs bg-jk-sage/30 text-jk-olive border-jk-olive/20"
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
        </CardContent>
      </Card>
    </Link>
  );
}
