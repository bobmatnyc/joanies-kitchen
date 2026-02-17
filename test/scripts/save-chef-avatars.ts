import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chefs } from '@/lib/db/chef-schema';

/**
 * Update chef records with local avatar image paths
 *
 * This script updates the avatar_url field for each chef to point to
 * local images stored in public/chefs/avatars/
 */

const chefAvatarMappings = [
  {
    slug: 'yotam-ottolenghi',
    name: 'Yotam Ottolenghi',
    avatarPath: '/chefs/avatars/yotam-ottolenghi.jpg',
  },
  {
    slug: 'nigella-lawson',
    name: 'Nigella Lawson',
    avatarPath: '/chefs/avatars/nigella-lawson.jpg',
  },
  {
    slug: 'samin-nosrat',
    name: 'Samin Nosrat',
    avatarPath: '/chefs/avatars/samin-nosrat.jpg',
  },
  {
    slug: 'lidia-bastianich',
    name: 'Lidia Bastianich',
    avatarPath: '/chefs/avatars/lidia-bastianich.jpg',
  },
  {
    slug: 'nancy-silverton',
    name: 'Nancy Silverton',
    avatarPath: '/chefs/avatars/nancy-silverton.jpg',
  },
  {
    slug: 'kenji-lopez-alt',
    name: 'Kenji López-Alt',
    avatarPath: '/chefs/avatars/kenji-lopez-alt.jpg',
  },
  {
    slug: 'madhur-jaffrey',
    name: 'Madhur Jaffrey',
    avatarPath: '/chefs/avatars/madhur-jaffrey.jpg',
  },
  {
    slug: 'jacques-pepin',
    name: 'Jacques Pépin',
    avatarPath: '/chefs/avatars/jacques-pepin.jpg',
  },
  {
    slug: 'alton-brown',
    name: 'Alton Brown',
    avatarPath: '/chefs/avatars/alton-brown.jpg',
  },
  {
    slug: 'gordon-ramsay',
    name: 'Gordon Ramsay',
    avatarPath: '/chefs/avatars/gordon-ramsay.jpg',
  },
];

async function updateChefAvatars() {
  console.log('🖼️  Updating chef avatar URLs...\n');

  for (const chef of chefAvatarMappings) {
    try {
      const result = await db
        .update(chefs)
        .set({
          avatar_url: chef.avatarPath,
          updated_at: new Date(),
        })
        .where(eq(chefs.slug, chef.slug))
        .returning();

      if (result.length > 0) {
        console.log(`✅ Updated ${chef.name}: ${chef.avatarPath}`);
      } else {
        console.log(`⚠️  Chef not found: ${chef.name} (${chef.slug})`);
      }
    } catch (error) {
      console.error(`❌ Failed to update ${chef.name}:`, error);
    }
  }

  console.log('\n✨ Chef avatar update complete!');
}

updateChefAvatars()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
