#!/usr/bin/env tsx

import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';
import { eq } from 'drizzle-orm';

/**
 * Initialize famous chef profiles
 * Run with: pnpm tsx scripts/init-famous-chefs.ts
 */

interface ChefProfile {
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
  specialties: string[];
}

const FAMOUS_CHEFS: ChefProfile[] = [
  {
    name: 'Gordon Ramsay',
    slug: 'gordon-ramsay',
    displayName: 'Gordon Ramsay',
    bio: 'Multi-Michelin star chef, restaurateur, and television personality. Known for his fiery personality, technical precision, and elevating British cuisine to world-class standards. Author of numerous cookbooks and host of Hell\'s Kitchen, MasterChef, and Kitchen Nightmares.',
    website: 'https://www.gordonramsay.com',
    socialLinks: {
      instagram: '@gordongram',
      youtube: '@gordonramsay',
      twitter: '@gordonramsay',
      tiktok: '@gordonramsayofficial',
      facebook: 'GordonRamsay',
    },
    specialties: ['british', 'fine-dining', 'technique', 'french', 'european'],
  },
  {
    name: 'Ina Garten',
    slug: 'ina-garten',
    displayName: 'Ina Garten (Barefoot Contessa)',
    bio: 'Author of bestselling cookbooks and host of Barefoot Contessa on Food Network. Known for approachable, elegant recipes perfect for entertaining. Former White House budget analyst turned self-taught chef who built a beloved culinary brand focused on making people feel comfortable in the kitchen.',
    website: 'https://barefootcontessa.com',
    socialLinks: {
      instagram: '@inagarten',
      youtube: '@inagarten',
      twitter: '@inagarten',
      facebook: 'InaGarten',
    },
    specialties: ['american', 'comfort-food', 'entertaining', 'simple-elegance', 'baking'],
  },
  {
    name: 'Yotam Ottolenghi',
    slug: 'yotam-ottolenghi',
    displayName: 'Yotam Ottolenghi',
    bio: 'Israeli-British chef and restaurateur celebrated for his vibrant, flavor-forward approach to vegetables and Middle Eastern cuisine. Author of bestselling cookbooks including Plenty, Jerusalem, and Simple. Known for transforming vegetables into the star of the plate with bold spices and innovative techniques.',
    website: 'https://ottolenghi.co.uk',
    socialLinks: {
      instagram: '@ottolenghi',
      youtube: '@ottolenghi',
      twitter: '@ottolenghi',
      facebook: 'OttolenghiUK',
    },
    specialties: ['mediterranean', 'middle-eastern', 'vegetarian', 'israeli', 'flavor-forward'],
  },
  {
    name: 'Samin Nosrat',
    slug: 'samin-nosrat',
    displayName: 'Samin Nosrat',
    bio: 'James Beard Award-winning chef, teacher, and author of "Salt, Fat, Acid, Heat: Mastering the Elements of Good Cooking." Host of the Netflix documentary series of the same name. Known for her educational approach that empowers home cooks to understand the fundamental principles of cooking rather than just following recipes.',
    website: 'https://ciaosamin.com',
    socialLinks: {
      instagram: '@ciaosamin',
      twitter: '@ciaosamin',
    },
    specialties: ['education', 'technique', 'mediterranean', 'italian', 'fundamentals'],
  },
  {
    name: 'Alton Brown',
    slug: 'alton-brown',
    displayName: 'Alton Brown',
    bio: 'Food science expert, television personality, and creator of Good Eats. Known for explaining the scientific principles behind cooking techniques, making complex concepts accessible and entertaining. Author, cinematographer, and host who revolutionized food television by combining humor, science, and practical cooking advice.',
    website: 'https://altonbrown.com',
    socialLinks: {
      instagram: '@altonbrown',
      youtube: '@altonbrown',
      twitter: '@altonbrown',
      facebook: 'AltonBrown',
    },
    specialties: ['science', 'american', 'technique', 'education', 'equipment'],
  },
  {
    name: 'Nigella Lawson',
    slug: 'nigella-lawson',
    displayName: 'Nigella Lawson',
    bio: 'British food writer, television chef, and journalist known for her sensual approach to cooking and celebration of indulgence. Author of bestselling cookbooks including How to Eat and Nigella Bites. Emphasizes the pleasure and comfort of home cooking over restaurant-style perfection.',
    website: 'https://www.nigella.com',
    socialLinks: {
      instagram: '@nigellalawson',
      youtube: '@nigella',
      twitter: '@nigella_lawson',
      facebook: 'OfficialNigellaLawson',
    },
    specialties: ['british', 'comfort-food', 'baking', 'desserts', 'indulgent'],
  },
  {
    name: 'Jacques Pépin',
    slug: 'jacques-pepin',
    displayName: 'Jacques Pépin',
    bio: 'Master French chef, author of over 30 cookbooks, and PBS television personality. Former personal chef to Charles de Gaulle and culinary institution at Le Pavillon. Dean of Special Programs at The International Culinary Center. Known for impeccable technique, efficiency, and making French cooking accessible to American home cooks.',
    website: 'https://www.jacquespepin.net',
    socialLinks: {
      instagram: '@jacquespepinofficial',
      youtube: '@jacquespepin',
      twitter: '@JacquesPepin',
      facebook: 'ChefJacquesPepin',
    },
    specialties: ['french', 'classic-technique', 'fundamentals', 'efficient', 'mastery'],
  },
  {
    name: 'Madhur Jaffrey',
    slug: 'madhur-jaffrey',
    displayName: 'Madhur Jaffrey',
    bio: 'Pioneering cookbook author and actress who introduced authentic Indian cuisine to Western audiences. Author of "An Invitation to Indian Cooking" and over a dozen other cookbooks. James Beard Award winner and CBE recipient. Known for demystifying Indian cooking and preserving traditional recipes while making them accessible to home cooks worldwide.',
    website: 'https://madhurjaffrey.com',
    socialLinks: {
      twitter: '@MadhurJaffrey1',
      facebook: 'MadhurJaffrey',
    },
    specialties: ['indian', 'asian', 'authentic', 'traditional', 'spices'],
  },
];

async function initFamousChefs() {
  console.log('🧑‍🍳 Initializing famous chef profiles...\n');

  const results = {
    created: [] as string[],
    skipped: [] as string[],
    failed: [] as { name: string; error: string }[],
  };

  for (const chefProfile of FAMOUS_CHEFS) {
    try {
      console.log(`\n📝 Processing: ${chefProfile.name}`);

      // Check if already exists
      const existing = await db.query.chefs.findFirst({
        where: eq(chefs.slug, chefProfile.slug),
      });

      if (existing) {
        console.log(`   ⚠️  Already exists (ID: ${existing.id})`);
        results.skipped.push(chefProfile.name);
        continue;
      }

      // Create chef profile
      const chef = await db.insert(chefs).values({
        name: chefProfile.name,
        slug: chefProfile.slug,
        displayName: chefProfile.displayName || chefProfile.name,
        bio: chefProfile.bio,
        website: chefProfile.website,
        socialLinks: chefProfile.socialLinks,
        specialties: chefProfile.specialties,
        isVerified: true,
        isActive: true,
        recipeCount: 0,
      }).returning();

      console.log(`   ✅ Created successfully (ID: ${chef[0].id})`);
      console.log(`   🔗 URL: /chef/${chefProfile.slug}`);
      results.created.push(chefProfile.name);
    } catch (error) {
      console.error(`   ❌ Failed:`, error);
      results.failed.push({
        name: chefProfile.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${results.created.length} chef(s)`);
  if (results.created.length > 0) {
    results.created.forEach((name) => console.log(`   - ${name}`));
  }

  console.log(`⚠️  Skipped: ${results.skipped.length} chef(s)`);
  if (results.skipped.length > 0) {
    results.skipped.forEach((name) => console.log(`   - ${name}`));
  }

  console.log(`❌ Failed: ${results.failed.length} chef(s)`);
  if (results.failed.length > 0) {
    results.failed.forEach(({ name, error }) => {
      console.log(`   - ${name}: ${error}`);
    });
  }

  // Final instructions
  if (results.created.length > 0) {
    console.log('\n🎉 Chef profiles ready!');
    console.log('\nNext steps:');
    console.log('  1. Visit /discover/chefs to view all chefs');
    console.log('  2. Visit individual chef pages (e.g., /chef/gordon-ramsay)');
    console.log('  3. Use admin panel to start scraping recipes');
    console.log('  4. Or manually link existing recipes to chefs');
  }

  return results;
}

// Run if executed directly
if (require.main === module) {
  initFamousChefs()
    .then((results) => {
      console.log('\n✨ Done!');
      process.exit(results.failed.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('\n💥 Fatal error:', error);
      process.exit(1);
    });
}

export { initFamousChefs, FAMOUS_CHEFS };
