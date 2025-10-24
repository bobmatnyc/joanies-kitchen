#!/usr/bin/env tsx

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

/**
 * Seed 20 Sustainable Chefs into Database
 *
 * Based on docs/roadmap/sustainable-chefs.md PRD
 * All chefs focus on sustainability: zero-waste, fermentation, seasonal, regenerative, etc.
 *
 * Run with: pnpm tsx scripts/seed-sustainable-chefs.ts
 */

interface SustainableChef {
  name: string;
  slug: string;
  displayName?: string;
  bio: string;
  website?: string;
  socialLinks: {
    instagram?: string;
    twitter?: string;
    youtube?: string;
    tiktok?: string;
    facebook?: string;
  };
  specialties: string[]; // Sustainability focus areas
  latitude?: string; // Decimal degrees
  longitude?: string;
  locationCity?: string;
  locationState?: string;
  locationCountry?: string;
  isVerified: boolean; // All sustainable chefs are verified
}

const SUSTAINABLE_CHEFS: SustainableChef[] = [
  // TIER 1: HIGH-PRIORITY (Permission-based scraping targets)
  {
    name: 'Anne-Marie Bonneau',
    slug: 'anne-marie-bonneau',
    displayName: 'Anne-Marie Bonneau (Zero-Waste Chef)',
    bio: 'Author of "The Zero-Waste Chef" and creator of the Zero-Waste Chef blog. Pioneer in plastic-free living, sourdough fermentation, and waste reduction in the kitchen. 15+ years of zero-waste cooking content with 300-400 recipes focused on using every scrap.',
    website: 'https://www.zerowastechef.com',
    socialLinks: {
      instagram: '@zerowastechef',
      facebook: 'TheZeroWasteChef',
    },
    specialties: ['zero-waste', 'fermentation', 'sourdough', 'plastic-free', 'waste-reduction', 'condiments'],
    latitude: '37.8715',
    longitude: '-122.2730',
    locationCity: 'Oakland',
    locationState: 'California',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Vivian Li',
    slug: 'vivian-li',
    displayName: 'Vivian Li (Omnivore\'s Cookbook)',
    bio: 'Author of "The Art and Science of Low Carb Chinese Cooking" and creator of Omnivore\'s Cookbook. 500+ authentic Chinese recipes with modern techniques. Former software engineer turned food blogger specializing in accessible Asian home cooking.',
    website: 'https://omnivorescookbook.com',
    socialLinks: {
      instagram: '@omnivorescookbook',
      facebook: 'omnivorescookbook',
      pinterest: 'omnicook',
    },
    specialties: ['chinese', 'asian', 'authentic', 'home-cooking', 'low-carb'],
    latitude: '40.7614',
    longitude: '-111.8910',
    locationCity: 'Salt Lake City',
    locationState: 'Utah',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Lidia Bastianich',
    slug: 'lidia-bastianich',
    displayName: 'Lidia Bastianich',
    bio: 'Emmy award-winning television host, chef, restaurateur, and author. Known for authentic Italian cuisine with emphasis on simple, quality ingredients and traditional techniques. Multiple James Beard Awards and honorary doctorates. Promotes nose-to-tail cooking and minimizing waste.',
    website: 'https://lidiasitaly.com',
    socialLinks: {
      instagram: '@lidiabastianich',
      facebook: 'LidiaBastianich',
      twitter: '@lidiabastianich',
    },
    specialties: ['italian', 'nose-to-tail', 'traditional', 'seasonal', 'quality-ingredients'],
    latitude: '40.7580',
    longitude: '-73.9855',
    locationCity: 'New York',
    locationState: 'New York',
    locationCountry: 'USA',
    isVerified: true,
  },

  // TIER 2: COOKBOOK LICENSING TARGETS
  {
    name: 'Tamar Adler',
    slug: 'tamar-adler',
    displayName: 'Tamar Adler',
    bio: 'Author of "An Everlasting Meal: Cooking with Economy and Grace" and "Something Old, Something New". Specialist in transforming leftovers and scraps into complete meals. Writes for The New York Times Magazine on food philosophy and intuitive cooking without strict recipes.',
    website: 'https://tamareadler.com',
    socialLinks: {},
    specialties: ['leftovers', 'scraps', 'intuitive-cooking', 'philosophy', 'economy'],
    latitude: '40.7128',
    longitude: '-74.0060',
    locationCity: 'Brooklyn',
    locationState: 'New York',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Joshua McFadden',
    slug: 'joshua-mcfadden',
    displayName: 'Joshua McFadden',
    bio: 'James Beard Award winner and author of "Six Seasons: A New Way with Vegetables". Chef/owner of Ava Gene\'s in Portland. Celebrates vegetables through all seasons with innovative preparations. Former chef at Chez Panisse, deeply influenced by Alice Waters\' seasonal philosophy.',
    website: 'https://www.avagenes.com',
    socialLinks: {
      instagram: '@joshuamcfadden',
    },
    specialties: ['vegetables', 'seasonal', 'six-seasons', 'farm-to-table', 'italian-influenced'],
    latitude: '45.5152',
    longitude: '-122.6784',
    locationCity: 'Portland',
    locationState: 'Oregon',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Shannon Martinez',
    slug: 'shannon-martinez',
    displayName: 'Shannon Martinez (Smith & Daughters)',
    bio: 'Australian chef and restaurateur behind Smith & Daughters and Smith & Deli. Pioneer in plant-based cooking with bold flavors and innovative vegan techniques. Multiple Good Food Guide awards. Challenges perceptions of vegan cuisine with creative, indulgent dishes.',
    website: 'https://smithanddaughters.com',
    socialLinks: {
      instagram: '@smithanddaughters',
      facebook: 'smithanddaughtersmelbourne',
    },
    specialties: ['vegan', 'plant-based', 'bold-flavors', 'innovative', 'australian'],
    latitude: '-37.8136',
    longitude: '144.9631',
    locationCity: 'Melbourne',
    locationState: 'Victoria',
    locationCountry: 'Australia',
    isVerified: true,
  },
  {
    name: 'Molly Katzen',
    slug: 'molly-katzen',
    displayName: 'Molly Katzen',
    bio: 'Author of "The Moosewood Cookbook" (1977) - one of the top 10 bestselling cookbooks of all time. Pioneer of modern vegetarian cuisine in America. Hand-illustrated cookbooks with accessible, flavorful recipes that made vegetarian cooking mainstream.',
    website: 'https://www.mollykatzen.com',
    socialLinks: {},
    specialties: ['vegetarian', 'accessible', 'illustration', 'classic', 'american'],
    latitude: '37.8716',
    longitude: '-122.2727',
    locationCity: 'Berkeley',
    locationState: 'California',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Bryant Terry',
    slug: 'bryant-terry',
    displayName: 'Bryant Terry',
    bio: 'James Beard Award-winning chef, author, and activist. Author of "Vegetable Kingdom" and "Afro-Vegan". Chef-in-Residence at MOAD in San Francisco. Celebrates Afro-Asian-American cuisine with plant-based focus and cultural storytelling.',
    website: 'https://www.bryant-terry.com',
    socialLinks: {
      instagram: '@bryant_terry',
      twitter: '@bryant_terry',
    },
    specialties: ['afro-vegan', 'plant-based', 'cultural-storytelling', 'justice', 'vegetables'],
    latitude: '37.7749',
    longitude: '-122.4194',
    locationCity: 'San Francisco',
    locationState: 'California',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Katrina Blair',
    slug: 'katrina-blair',
    displayName: 'Katrina Blair',
    bio: 'Author of "The Wild Wisdom of Weeds" and founder of Turtle Lake Refuge. Foraging expert and ethnobotanist specializing in wild edibles and permaculture. Teaches sustainable food systems and plant identification across North America.',
    website: 'https://turtlelakerefuge.org',
    socialLinks: {},
    specialties: ['foraging', 'weeds', 'wild-edibles', 'permaculture', 'ethnobotany'],
    latitude: '37.2753',
    longitude: '-107.8801',
    locationCity: 'Durango',
    locationState: 'Colorado',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Nik Sharma',
    slug: 'nik-sharma',
    displayName: 'Nik Sharma',
    bio: 'James Beard Award-winning food writer, photographer, and author of "Season" and "The Flavor Equation". Creates recipes at the intersection of science and storytelling. Former molecular biologist brings scientific precision to home cooking with cultural fusion.',
    website: 'https://www.abrowntable.com',
    socialLinks: {
      instagram: '@abrowntable',
      twitter: '@abrowntable',
    },
    specialties: ['science', 'flavor', 'photography', 'fusion', 'indian-american'],
    latitude: '37.8044',
    longitude: '-122.2712',
    locationCity: 'Oakland',
    locationState: 'California',
    locationCountry: 'USA',
    isVerified: true,
  },

  // TIER 3: FINE DINING & PARTNERSHIPS
  {
    name: 'Dan Barber',
    slug: 'dan-barber',
    displayName: 'Dan Barber (Blue Hill)',
    bio: 'Chef/co-owner of Blue Hill and Blue Hill at Stone Barns. Pioneer in farm-to-table movement and regenerative agriculture. Author of "The Third Plate". Works directly with farmers and seed savers to promote biodiversity and soil health. Advocate for nose-to-tail and root-to-stem cooking.',
    website: 'https://www.bluehillfarm.com',
    socialLinks: {
      instagram: '@danbarberbluehillfarm',
      twitter: '@danbluehillfarm',
    },
    specialties: ['farm-to-table', 'regenerative', 'biodiversity', 'nose-to-tail', 'seed-saving'],
    latitude: '40.7614',
    longitude: '-73.9776',
    locationCity: 'New York',
    locationState: 'New York',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Alice Waters',
    slug: 'alice-waters',
    displayName: 'Alice Waters',
    bio: 'Founder of Chez Panisse (1971) and the Edible Schoolyard Project. Pioneer of California cuisine and the farm-to-table movement. James Beard Foundation Lifetime Achievement Award. Advocate for organic, local, and seasonal ingredients. Transformed American dining with emphasis on ingredient quality over technique.',
    website: 'https://www.chezpanisse.com',
    socialLinks: {
      instagram: '@alicewaters',
      twitter: '@alicewaters',
    },
    specialties: ['farm-to-table', 'seasonal', 'organic', 'california-cuisine', 'education'],
    latitude: '37.8799',
    longitude: '-122.2688',
    locationCity: 'Berkeley',
    locationState: 'California',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Massimo Bottura',
    slug: 'massimo-bottura',
    displayName: 'Massimo Bottura',
    bio: 'Chef/owner of Osteria Francescana (3 Michelin stars, #1 World\'s 50 Best Restaurants 2016, 2018). Founder of Food for Soul nonprofit fighting food waste globally. Uses surplus ingredients to create dignified meals for vulnerable communities. Combines modern art with traditional Italian cuisine.',
    website: 'https://www.osteriafrancescana.it',
    socialLinks: {
      instagram: '@massimobottura',
      facebook: 'MassimobotturaChef',
    },
    specialties: ['food-waste', 'surplus', 'social-impact', 'italian', 'modern'],
    latitude: '44.6471',
    longitude: '10.9252',
    locationCity: 'Modena',
    locationState: 'Emilia-Romagna',
    locationCountry: 'Italy',
    isVerified: true,
  },
  {
    name: 'René Redzepi',
    slug: 'rene-redzepi',
    displayName: 'René Redzepi',
    bio: 'Chef/co-owner of Noma (3 Michelin stars, #1 World\'s 50 Best Restaurants 5x). Pioneer of New Nordic cuisine emphasizing local, seasonal, and foraged ingredients. Author of "The Noma Guide to Fermentation". Transformed modern cooking with focus on terroir and preservation techniques.',
    website: 'https://noma.dk',
    socialLinks: {
      instagram: '@reneredzepinoma',
      twitter: '@reneredzepinoma',
    },
    specialties: ['nordic', 'foraging', 'fermentation', 'seasonal', 'local'],
    latitude: '55.6761',
    longitude: '12.5683',
    locationCity: 'Copenhagen',
    locationState: 'Capital Region',
    locationCountry: 'Denmark',
    isVerified: true,
  },
  {
    name: 'Jeremy Fox',
    slug: 'jeremy-fox',
    displayName: 'Jeremy Fox',
    bio: 'Chef/owner of Rustic Canyon and author of "On Vegetables". Former chef at Ubuntu (Michelin star for vegetarian). James Beard Award winner. Celebrates vegetables with innovative techniques while respecting their natural character. Focuses on local California produce.',
    website: 'https://www.rusticcanyonrestaurant.com',
    socialLinks: {
      instagram: '@jeremyfoxfood',
    },
    specialties: ['vegetables', 'california', 'seasonal', 'michelin', 'technique'],
    latitude: '34.0522',
    longitude: '-118.2437',
    locationCity: 'Los Angeles',
    locationState: 'California',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Cristina Scarpaleggia',
    slug: 'cristina-scarpaleggia',
    displayName: 'Cristina Scarpaleggia',
    bio: 'Tuscan food writer, photographer, and author of "Cucina Povera" and "The Tuscan Cookbook". Documents traditional Italian peasant cooking and forgotten recipes. Lives in Tuscany, chronicling seasonal, local, and frugal Italian cuisine on Tuscan Vistas blog.',
    website: 'https://www.tuscanvistas.com',
    socialLinks: {
      instagram: '@tuscanvistas',
      facebook: 'TuscanVistas',
    },
    specialties: ['cucina-povera', 'tuscan', 'traditional', 'peasant-cooking', 'seasonal'],
    latitude: '43.7696',
    longitude: '11.2558',
    locationCity: 'Florence',
    locationState: 'Tuscany',
    locationCountry: 'Italy',
    isVerified: true,
  },
  {
    name: 'David Zilber',
    slug: 'david-zilber',
    displayName: 'David Zilber',
    bio: 'Former head of Noma\'s fermentation lab and co-author of "The Noma Guide to Fermentation". Now Director of Culinary Science at Verb Energy. Expert in koji, miso, and innovative preservation techniques. Bridges traditional fermentation with modern science.',
    website: 'https://www.instagram.com/david.zilber',
    socialLinks: {
      instagram: '@david.zilber',
    },
    specialties: ['fermentation', 'koji', 'miso', 'preservation', 'science'],
    latitude: '40.7128',
    longitude: '-74.0060',
    locationCity: 'New York',
    locationState: 'New York',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Kirsten and Christopher Shockey',
    slug: 'kirsten-christopher-shockey',
    displayName: 'Kirsten and Christopher Shockey',
    bio: 'Authors of "Fermented Vegetables", "Fiery Ferments", and "Miso, Tempeh, Natto & Other Tasty Ferments". Founders of The Fermentation School. Experts in vegetable fermentation, live-culture foods, and preservation. Teach fermentation worldwide.',
    website: 'https://www.thefermentationschool.com',
    socialLinks: {
      instagram: '@fermentationschool',
      facebook: 'TheFermentationSchool',
    },
    specialties: ['fermentation', 'vegetables', 'preservation', 'live-culture', 'teaching'],
    latitude: '42.3265',
    longitude: '-122.8756',
    locationCity: 'Medford',
    locationState: 'Oregon',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Skye Gyngell',
    slug: 'skye-gyngell',
    displayName: 'Skye Gyngell',
    bio: 'Australian chef and author of "A Year in My Kitchen" and "Spring". Former head chef at Petersham Nurseries (Michelin star). Now at Spring restaurant in London. Passionate about seasonal, organic ingredients and simple preparations that honor produce quality.',
    website: 'https://springrestaurant.co.uk',
    socialLinks: {
      instagram: '@skyegyngell',
    },
    specialties: ['seasonal', 'organic', 'simple', 'vegetables', 'british'],
    latitude: '51.5074',
    longitude: '-0.1278',
    locationCity: 'London',
    locationState: 'England',
    locationCountry: 'UK',
    isVerified: true,
  },
  {
    name: 'Bren Smith',
    slug: 'bren-smith',
    displayName: 'Bren Smith (GreenWave)',
    bio: 'Ocean farmer and founder of GreenWave, nonprofit promoting regenerative ocean farming. Former commercial fisherman turned climate advocate. Author of "Eat Like a Fish". Pioneers 3D ocean farming of seaweed and shellfish as climate solution. Promotes kelp and bycatch utilization.',
    website: 'https://www.greenwave.org',
    socialLinks: {
      instagram: '@greenwave.org',
      twitter: '@greenwaveorg',
    },
    specialties: ['ocean-farming', 'seaweed', 'bycatch', 'regenerative', 'climate'],
    latitude: '41.3083',
    longitude: '-72.9279',
    locationCity: 'New Haven',
    locationState: 'Connecticut',
    locationCountry: 'USA',
    isVerified: true,
  },
  {
    name: 'Jacques Pépin',
    slug: 'jacques-pepin',
    displayName: 'Jacques Pépin',
    bio: 'Legendary French chef, television personality, and author of 30+ cookbooks. PBS host of "Jacques Pépin: More Fast Food My Way". James Beard Foundation Lifetime Achievement Award. Former personal chef to Charles de Gaulle. Known for teaching fundamental French techniques to American home cooks.',
    website: 'https://www.jacquespepin.net',
    socialLinks: {
      instagram: '@jacquespepinofficial',
      facebook: 'ChefJacquesPepin',
    },
    specialties: ['french', 'technique', 'fundamentals', 'classic', 'education'],
    latitude: '41.3083',
    longitude: '-73.3709',
    locationCity: 'Madison',
    locationState: 'Connecticut',
    locationCountry: 'USA',
    isVerified: true,
  },
];

async function main() {
  console.log('🌱 Seeding 20 Sustainable Chefs...\n');

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const chefData of SUSTAINABLE_CHEFS) {
    try {
      // Check if chef already exists
      const existing = await db
        .select()
        .from(chefs)
        .where(eq(chefs.slug, chefData.slug))
        .limit(1);

      if (existing.length > 0) {
        // Update existing chef with sustainability data
        await db
          .update(chefs)
          .set({
            name: chefData.name,
            display_name: chefData.displayName,
            bio: chefData.bio,
            website: chefData.website,
            social_links: chefData.socialLinks,
            specialties: chefData.specialties,
            is_verified: chefData.isVerified,
            latitude: chefData.latitude,
            longitude: chefData.longitude,
            location_city: chefData.locationCity,
            location_state: chefData.locationState,
            location_country: chefData.locationCountry,
            updated_at: new Date(),
          })
          .where(eq(chefs.slug, chefData.slug));

        console.log(`✓ Updated: ${chefData.name} (${chefData.slug})`);
        updated++;
      } else {
        // Insert new chef
        await db.insert(chefs).values({
          slug: chefData.slug,
          name: chefData.name,
          display_name: chefData.displayName,
          bio: chefData.bio,
          website: chefData.website,
          social_links: chefData.socialLinks,
          specialties: chefData.specialties,
          is_verified: chefData.isVerified,
          is_active: true,
          latitude: chefData.latitude,
          longitude: chefData.longitude,
          location_city: chefData.locationCity,
          location_state: chefData.locationState,
          location_country: chefData.locationCountry,
        });

        console.log(`+ Added: ${chefData.name} (${chefData.slug})`);
        added++;
      }
    } catch (error) {
      console.error(`✗ Error processing ${chefData.name}:`, error);
      skipped++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Added: ${added}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total: ${SUSTAINABLE_CHEFS.length}`);

  console.log('\n✅ Sustainable chefs seeding complete!');
  console.log('\n🗺️  All chefs have geographic coordinates for map display');
  console.log('✓ All chefs marked as verified (is_verified: true)');
  console.log('✓ Specialties tagged for filtering (zero-waste, fermentation, seasonal, etc.)');

  process.exit(0);
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
