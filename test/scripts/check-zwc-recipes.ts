import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function check() {
  const result = await sql`
    SELECT id, name, chef_id, is_public, source
    FROM recipes
    WHERE source LIKE '%zerowastechef.com%'
    LIMIT 5
  `;

  console.log('Sample Zero Waste Chef recipes from database:\n');
  result.forEach(r => {
    console.log(`ID: ${r.id}`);
    console.log(`Name: ${r.name}`);
    console.log(`chef_id: ${r.chef_id}`);
    console.log(`is_public: ${r.is_public}\n`);
  });

  process.exit(0);
}

check();
