import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function analyzeChefImages() {
  try {
    const results = await sql`
      SELECT
        id,
        display_name,
        profile_image_url,
        CASE
          WHEN profile_image_url LIKE '/images/%' THEN 'LOCAL (BROKEN)'
          WHEN profile_image_url LIKE '%blob.vercel-storage.com%' THEN 'BLOB (OK)'
          WHEN profile_image_url IS NULL THEN 'NO IMAGE'
          ELSE 'OTHER'
        END as image_status
      FROM chefs
      ORDER BY image_status, display_name
    `;

    // Count by status
    const counts = results.reduce((acc: Record<string, number>, row: any) => {
      acc[row.image_status] = (acc[row.image_status] || 0) + 1;
      return acc;
    }, {});

    console.log('\n=== CHEF IMAGE ANALYSIS ===\n');
    console.log('Total Chefs:', results.length);
    console.log('\nStatus Breakdown:');
    Object.entries(counts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

    const broken = results.filter((r: any) => r.image_status === 'LOCAL (BROKEN)');
    if (broken.length > 0) {
      console.log('\n=== CHEFS WITH BROKEN LOCAL PATHS ===');
      broken.forEach((chef: any) => {
        console.log(`- ${chef.display_name}: ${chef.profile_image_url}`);
      });
    }

    const blob = results.filter((r: any) => r.image_status === 'BLOB (OK)');
    if (blob.length > 0) {
      console.log('\n=== CHEFS WITH WORKING BLOB URLS (SAMPLE) ===');
      blob.slice(0, 5).forEach((chef: any) => {
        console.log(`- ${chef.display_name}: ${chef.profile_image_url}`);
      });
    }

    const other = results.filter((r: any) => r.image_status === 'OTHER');
    if (other.length > 0) {
      console.log('\n=== CHEFS WITH OTHER URL TYPES ===');
      other.forEach((chef: any) => {
        console.log(`- ${chef.display_name}: ${chef.profile_image_url}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

analyzeChefImages();
