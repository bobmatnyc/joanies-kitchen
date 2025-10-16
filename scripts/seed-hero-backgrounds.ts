import { db } from '@/lib/db';
import { heroBackgrounds } from '@/lib/db/schema';

async function seedHeroBackgrounds() {
  console.log('🌅 Seeding hero background images...');

  const backgrounds = [
    {
      image_url: 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/hero/background-textured.png',
      display_order: 1,
      is_active: true,
    },
    {
      image_url: 'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/hero/background-watercolor.png',
      display_order: 2,
      is_active: true,
    },
  ];

  try {
    for (const bg of backgrounds) {
      await db.insert(heroBackgrounds).values(bg);
      console.log(`✓ Added background: ${bg.image_url.split('/').pop()}`);
    }

    console.log('✅ Hero backgrounds seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding hero backgrounds:', error);
    throw error;
  }
}

// Run the seed function
seedHeroBackgrounds()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
