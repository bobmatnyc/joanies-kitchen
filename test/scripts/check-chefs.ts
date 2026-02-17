import { db } from '@/lib/db/index.js';
import { chefs } from '@/lib/db/chef-schema.js';

async function main() {
  console.log('Querying chefs table...\n');

  const allChefs = await db
    .select({
      slug: chefs.slug,
      name: chefs.name,
      specialties: chefs.specialties,
      is_verified: chefs.is_verified,
    })
    .from(chefs)
    .limit(20);

  console.log(`Found ${allChefs.length} chefs:\n`);

  for (const chef of allChefs) {
    console.log(`${chef.name} (@${chef.slug})`);
    console.log(`  Verified: ${chef.is_verified}`);
    console.log(`  Specialties: ${chef.specialties?.join(', ') || 'none'}`);
    console.log('');
  }

  // Check for sustainability-related specialties
  const sustainabilityKeywords = ['sustainability', 'zero-waste', 'food waste', 'waste', 'sustainable', 'eco'];
  const sustainableChefs = allChefs.filter(chef =>
    chef.specialties?.some(s =>
      sustainabilityKeywords.some(kw => s.toLowerCase().includes(kw))
    )
  );

  console.log(`\n${sustainableChefs.length} chefs with sustainability focus:`);
  sustainableChefs.forEach(chef => {
    console.log(`  - ${chef.name}: ${chef.specialties?.filter(s =>
      sustainabilityKeywords.some(kw => s.toLowerCase().includes(kw))
    ).join(', ')}`);
  });

  process.exit(0);
}

main().catch(console.error);
