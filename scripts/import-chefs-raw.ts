import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';

/**
 * Chef Import Script using raw SQL
 *
 * Imports celebrity chef profiles into the database using raw SQL
 * to avoid Drizzle schema caching issues.
 */

interface ChefData {
  name: string;
  slug: string;
  bio: string;
  specialties: string[];
  website?: string;
  instagram?: string;
  twitter?: string;
  youtube?: string;
}

const CHEFS: ChefData[] = [
  {
    name: 'Lidia Bastianich',
    slug: 'lidia-bastianich',
    bio: 'Lidia Bastianich is an Emmy award-winning television host, best-selling cookbook author, and restaurateur. Born in Istria, she is a champion of authentic Italian cuisine and has been sharing her culinary expertise for over four decades. Her warm, grandmotherly approach to cooking has made her a beloved figure in American kitchens.',
    specialties: ['Italian', 'Mediterranean', 'Traditional Italian'],
    website: 'https://lidiasitaly.com',
    instagram: 'https://instagram.com/lidiabastianich',
    twitter: 'https://twitter.com/lidiabastianich',
    youtube: 'https://youtube.com/@LidiaBastianich',
  },
  {
    name: 'Nancy Silverton',
    slug: 'nancy-silverton',
    bio: "Nancy Silverton is an award-winning chef, baker, and restaurateur known for pioneering the artisan bread movement in America. She is the co-founder of Osteria Mozza and Pizzeria Mozza, and author of multiple cookbooks. Her expertise in bread-making and Italian cuisine has earned her the James Beard Foundation's Outstanding Chef Award.",
    specialties: ['Italian', 'Bread & Pastry', 'Contemporary American'],
    website: 'https://www.osteriamozza.com',
    instagram: 'https://instagram.com/nancysilverton',
  },
  {
    name: 'J. Kenji López-Alt',
    slug: 'kenji-lopez-alt',
    bio: 'J. Kenji López-Alt is a chef, author, and food scientist known for his science-based approach to cooking. His book "The Food Lab" won the James Beard Award, and his YouTube channel features first-person cooking videos. He combines rigorous testing with accessible techniques to help home cooks understand the science behind great cooking.',
    specialties: ['American', 'Asian', 'Science-Based Cooking', 'Technique'],
    website: 'https://www.kenjilopezalt.com',
    instagram: 'https://instagram.com/kenjilopezalt',
    twitter: 'https://twitter.com/kenjilopezalt',
    youtube: 'https://youtube.com/@JKenjiLopezAlt',
  },
  {
    name: 'Madhur Jaffrey',
    slug: 'madhur-jaffrey',
    bio: 'Madhur Jaffrey is an Indian-born actress, food and travel writer, and television personality. She is recognized for bringing Indian cuisine to the Western world through her cookbooks and television shows. Her work has demystified Indian cooking and made it accessible to home cooks worldwide.',
    specialties: ['Indian', 'South Asian', 'Vegetarian'],
    website: 'https://www.madhurjaffrey.com',
    instagram: 'https://instagram.com/madhurjaffreyofficial',
    twitter: 'https://twitter.com/madhur_jaffrey',
  },
  {
    name: 'Jacques Pépin',
    slug: 'jacques-pepin',
    bio: 'Jacques Pépin is a French chef, author, and television personality who has been teaching Americans to cook for over 50 years. A former personal chef to Charles de Gaulle, he is known for his fundamental techniques and elegant, accessible French cuisine. His partnership with Julia Child helped define American culinary television.',
    specialties: ['French', 'Classical Technique', 'European'],
    website: 'https://www.jacquespepin.net',
    instagram: 'https://instagram.com/jacquespepinofficial',
    twitter: 'https://twitter.com/JacquesPepin',
  },
  {
    name: 'Nigella Lawson',
    slug: 'nigella-lawson',
    bio: 'Nigella Lawson is a British food writer, television cook, and journalist known for her sensual approach to cooking and eating. Her cookbooks emphasize pleasure and simplicity, making cooking accessible and enjoyable. She has hosted numerous cooking shows and authored bestselling cookbooks that celebrate the joy of food.',
    specialties: ['British', 'Comfort Food', 'Baking', 'Contemporary'],
    website: 'https://www.nigella.com',
    instagram: 'https://instagram.com/nigellalawson',
    twitter: 'https://twitter.com/Nigella_Lawson',
  },
  {
    name: 'Alton Brown',
    slug: 'alton-brown',
    bio: 'Alton Brown is an American television personality, food show presenter, chef, author, and cinematographer. He is the creator and host of the Food Network series "Good Eats" and known for his scientific approach to cooking. His quirky, educational style has made food science entertaining and accessible.',
    specialties: ['American', 'Food Science', 'Technique', 'Baking'],
    website: 'https://altonbrown.com',
    instagram: 'https://instagram.com/altonbrown',
    twitter: 'https://twitter.com/altonbrown',
    youtube: 'https://youtube.com/@altonbrown',
  },
  {
    name: 'Samin Nosrat',
    slug: 'samin-nosrat',
    bio: 'Samin Nosrat is a chef, teacher, and author of the bestselling cookbook "Salt, Fat, Acid, Heat," which won the James Beard Award. Her approach focuses on the four fundamental elements of good cooking, empowering home cooks to cook intuitively. She hosted the Netflix series of the same name, traveling the world to explore these elements.',
    specialties: ['Mediterranean', 'Middle Eastern', 'Teaching & Technique'],
    instagram: 'https://instagram.com/ciaosamin',
    twitter: 'https://twitter.com/ciaosamin',
  },
  {
    name: 'Yotam Ottolenghi',
    slug: 'yotam-ottolenghi',
    bio: 'Yotam Ottolenghi is an Israeli-British chef, restaurateur, and food writer known for his vibrant, vegetable-forward Middle Eastern and Mediterranean cuisine. His cookbooks have revolutionized home cooking with bold flavors and innovative combinations. He has popularized ingredients and techniques from Middle Eastern cuisine in the Western culinary world.',
    specialties: ['Middle Eastern', 'Mediterranean', 'Vegetarian', 'Modern'],
    website: 'https://ottolenghi.co.uk',
    instagram: 'https://instagram.com/ottolenghi',
    twitter: 'https://twitter.com/ottolenghi',
  },
];

async function importChefs() {
  console.log('Starting chef import (raw SQL)...\n');

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const chefData of CHEFS) {
    try {
      const avatarUrl = `/chefs/avatars/${chefData.slug}.jpg`;
      const specialtiesJson = JSON.stringify(chefData.specialties);

      // Use INSERT ... ON CONFLICT to handle updates
      await db.execute(sql`
        INSERT INTO chefs (
          name, slug, bio, avatar_url, specialties, website, instagram, twitter, youtube
        )
        VALUES (
          ${chefData.name},
          ${chefData.slug},
          ${chefData.bio},
          ${avatarUrl},
          ${specialtiesJson},
          ${chefData.website || null},
          ${chefData.instagram || null},
          ${chefData.twitter || null},
          ${chefData.youtube || null}
        )
        ON CONFLICT (slug)
        DO UPDATE SET
          name = EXCLUDED.name,
          bio = EXCLUDED.bio,
          avatar_url = EXCLUDED.avatar_url,
          specialties = EXCLUDED.specialties,
          website = EXCLUDED.website,
          instagram = EXCLUDED.instagram,
          twitter = EXCLUDED.twitter,
          youtube = EXCLUDED.youtube,
          updated_at = now()
      `);

      // Check if it was an insert or update
      const result = await db.execute(sql`
        SELECT created_at, updated_at FROM chefs WHERE slug = ${chefData.slug}
      `);

      if (result.rows[0] && result.rows[0].created_at === result.rows[0].updated_at) {
        console.log(`✓ Imported: ${chefData.name}`);
        imported++;
      } else {
        console.log(`✓ Updated: ${chefData.name}`);
        updated++;
      }
    } catch (error) {
      console.error(`✗ Error importing ${chefData.name}:`, error);
      skipped++;
    }
  }

  console.log('\n=== Import Summary ===');
  console.log(`Imported: ${imported}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total: ${CHEFS.length}`);
}

// Run the import
importChefs()
  .then(() => {
    console.log('\nChef import completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Chef import failed:', error);
    process.exit(1);
  });
