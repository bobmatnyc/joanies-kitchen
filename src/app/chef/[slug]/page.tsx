import { ChefHat, Globe, Instagram, MapPin, Youtube } from 'lucide-react';
import { notFound } from 'next/navigation';
import { FaXTwitter } from 'react-icons/fa6';
import { getChefBySlug } from '@/app/actions/chefs';
import { ChefAvatar } from '@/components/chef/ChefAvatar';
import { RecipeList } from '@/components/recipe/RecipeList';
import { Badge } from '@/components/ui/badge';
import { ChefDisclaimer } from '@/components/chef/ChefDisclaimer';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chefResult = await getChefBySlug(slug);

  if (!chefResult.success || !chefResult.chef) {
    return {
      title: 'Chef Not Found',
    };
  }

  const chef = chefResult.chef;

  return {
    title: `${chef.display_name || chef.name} | Joanie's Kitchen`,
    description: chef.bio || `Browse recipes from ${chef.display_name || chef.name}`,
  };
}

export default async function ChefProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const chefResult = await getChefBySlug(slug);

  if (!chefResult.success || !chefResult.chef) {
    notFound();
  }

  const chef = chefResult.chef;
  const recipes = chef.recipes || [];

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Chef Header */}
      <div className="bg-jk-linen rounded-lg p-6 md:p-8 mb-8 border-2 border-jk-olive/20 shadow-lg">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Profile Image */}
          <ChefAvatar
            size="xl"
            imageUrl={chef.profile_image_url}
            name={chef.name}
            verified={chef.is_verified}
            specialties={chef.specialties}
            className="flex-shrink-0"
          />

          {/* Chef Info */}
          <div className="flex-1 text-center md:text-left">
            <div className="mb-2">
              <h1 className="text-3xl md:text-4xl font-heading text-jk-olive">
                {chef.display_name || chef.name}
              </h1>
            </div>

            {chef.bio && <p className="text-jk-olive/80 mb-4 text-lg">{chef.bio}</p>}

            {/* Specialties */}
            {chef.specialties && chef.specialties.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {chef.specialties.map((specialty) => (
                  <Badge
                    key={specialty}
                    variant="secondary"
                    className="bg-jk-sage/30 text-jk-olive border-jk-olive/20"
                  >
                    {specialty}
                  </Badge>
                ))}
              </div>
            )}

            {/* Location */}
            {(chef.location_city || chef.location_country) && (
              <div className="flex items-center gap-2 text-jk-olive/70 mb-4">
                <MapPin className="w-4 h-4" />
                <span>
                  {chef.location_city}
                  {chef.location_state && `, ${chef.location_state}`}
                  {chef.location_country && ` • ${chef.location_country}`}
                </span>
              </div>
            )}

            {/* Social Links */}
            {(chef.website || chef.social_links) && (
              <div className="flex gap-4 items-center">
                {chef.website && (
                  <a
                    href={chef.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-jk-olive hover:text-jk-tomato transition-colors"
                    title="Website"
                  >
                    <Globe className="w-5 h-5" />
                  </a>
                )}
                {chef.social_links?.instagram && (
                  <a
                    href={`https://instagram.com/${chef.social_links.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-jk-olive hover:text-jk-tomato transition-colors"
                    title="Instagram"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                )}
                {chef.social_links?.twitter && (
                  <a
                    href={`https://x.com/${chef.social_links.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-jk-olive hover:text-jk-tomato transition-colors"
                    title="X (Twitter)"
                  >
                    <FaXTwitter className="w-5 h-5" />
                  </a>
                )}
                {chef.social_links?.youtube && (
                  <a
                    href={chef.social_links.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-jk-olive hover:text-jk-tomato transition-colors"
                    title="YouTube"
                  >
                    <Youtube className="w-5 h-5" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recipes Section */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <ChefHat className="w-6 h-6 text-jk-olive" />
          <h2 className="text-2xl font-heading text-jk-olive">
            Recipes by {chef.display_name || chef.name}
          </h2>
          <span className="text-jk-olive/60">
            ({recipes.length} {recipes.length === 1 ? 'recipe' : 'recipes'})
          </span>
        </div>

        {recipes.length > 0 ? (
          <RecipeList recipes={recipes} fromChefSlug={slug} />
        ) : (
          <div className="text-center py-12 bg-jk-linen rounded-lg border border-jk-olive/20">
            <ChefHat className="w-12 h-12 mx-auto text-jk-olive/20 mb-3" />
            <p className="text-jk-olive/60">No recipes yet from this chef. Check back soon!</p>
          </div>
        )}
      </div>

      {/* Educational Disclaimer (skip for Joanie) */}
      {slug !== 'joanie' && <ChefDisclaimer chefName={chef.display_name || chef.name} />}
    </div>
  );
}
