'use client';

import { ChefHat, Clock, Leaf, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getPlaceholderImage } from '@/lib/utils/recipe-placeholders';
import type { RecipeOfTheDayResponse } from '@/app/api/recipes/recipe-of-day/route';

function parseTags(tagsJson: string | null): string[] {
  if (!tagsJson) return [];
  try {
    const parsed = JSON.parse(tagsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getHeroImage(data: RecipeOfTheDayResponse): string {
  if (data.images) {
    try {
      const parsed = JSON.parse(data.images);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch {
      // fall through
    }
  }
  if (data.image_url) return data.image_url;
  return getPlaceholderImage(parseTags(data.tags));
}

export function RecipeOfTheDay() {
  const [data, setData] = useState<RecipeOfTheDayResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/recipes/recipe-of-day')
      .then(async (res) => {
        if (!res.ok) return null;
        const json = await res.json();
        // Guard: if the response has an error field, treat as no data
        if (json && typeof json === 'object' && 'error' in json) return null;
        return json as RecipeOfTheDayResponse;
      })
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden bg-jk-linen border border-jk-sage/30 animate-pulse">
        <div className="aspect-[16/7] bg-jk-sage/20" />
        <div className="p-6 space-y-3">
          <div className="h-4 bg-jk-sage/20 rounded w-24" />
          <div className="h-7 bg-jk-sage/20 rounded w-3/4" />
          <div className="h-4 bg-jk-sage/20 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl overflow-hidden bg-jk-linen border border-jk-sage/30 p-8 text-center">
        <p className="text-jk-charcoal/60 font-body text-sm">
          No featured recipe today — check back tomorrow!
        </p>
      </div>
    );
  }

  const recipeHref = data.slug ? `/recipes/${data.slug}` : `/recipes/${data.recipe_id}`;
  const heroImage = getHeroImage(data);
  const tags = parseTags(data.tags);

  return (
    <div className="rounded-2xl overflow-hidden shadow-lg bg-jk-linen border border-jk-sage/40 group">
      {/* Hero Image */}
      <div className="relative aspect-[16/7] overflow-hidden">
        <Image
          src={heroImage}
          alt={data.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
          className="object-cover group-hover:scale-105 transition-transform duration-700"
          priority
          quality={85}
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-jk-charcoal/70 via-jk-charcoal/20 to-transparent" />

        {/* Badge top-left */}
        <div className="absolute top-4 left-4">
          <Badge className="bg-jk-tomato text-white border-0 shadow-md text-sm px-3 py-1 flex items-center gap-1.5">
            <Leaf className="w-3.5 h-3.5" />
            Recipe of the Day
          </Badge>
        </div>

        {/* Theme badge top-right */}
        {data.theme && (
          <div className="absolute top-4 right-4">
            <Badge variant="secondary" className="bg-jk-sage/90 text-white border-0 capitalize">
              {data.theme}
            </Badge>
          </div>
        )}

        {/* Bottom overlay: title + chef */}
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6">
          <h3 className="font-heading text-xl md:text-3xl font-bold text-jk-linen leading-tight mb-2 line-clamp-2">
            {data.title}
          </h3>

          {/* Chef attribution */}
          {data.chef_name && (
            <div className="flex items-center gap-2">
              {data.chef_image_url ? (
                <Image
                  src={data.chef_image_url}
                  alt={data.chef_name}
                  width={28}
                  height={28}
                  className="rounded-full object-cover border border-jk-linen/60"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-jk-sage/60 flex items-center justify-center">
                  <ChefHat className="w-4 h-4 text-jk-linen" />
                </div>
              )}
              <span className="text-jk-linen/90 text-sm font-ui">
                {data.chef_slug ? (
                  <Link
                    href={`/chef/${data.chef_slug}`}
                    className="hover:underline hover:text-jk-linen"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {data.chef_name}
                  </Link>
                ) : (
                  data.chef_name
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="p-4 md:p-6">
        {data.description && (
          <p className="text-jk-charcoal/80 font-body text-sm md:text-base line-clamp-2 mb-4">
            {data.description}
          </p>
        )}

        {/* Stats row */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-jk-charcoal/70 mb-4">
          {data.total_time > 0 && (
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-jk-tomato" />
              <span>{data.total_time} min</span>
            </div>
          )}
          {data.ingredients_count > 0 && (
            <div className="flex items-center gap-1.5">
              <Leaf className="w-4 h-4 text-jk-sage" />
              <span>{data.ingredients_count} ingredients</span>
            </div>
          )}
          {data.servings && (
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-jk-olive" />
              <span>{data.servings} servings</span>
            </div>
          )}
          {data.difficulty && (
            <Badge
              variant="outline"
              className={
                data.difficulty === 'easy'
                  ? 'text-green-600 border-green-300'
                  : data.difficulty === 'medium'
                    ? 'text-yellow-600 border-yellow-300'
                    : 'text-red-600 border-red-300'
              }
            >
              {data.difficulty}
            </Badge>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs capitalize">
                {tag}
              </Badge>
            ))}
            {tags.length > 4 && (
              <Badge variant="secondary" className="text-xs">
                +{tags.length - 4}
              </Badge>
            )}
          </div>
        )}

        <Button
          asChild
          size="lg"
          className="w-full sm:w-auto bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui font-medium rounded-jk"
        >
          <Link href={recipeHref}>View Recipe</Link>
        </Button>
      </div>
    </div>
  );
}
