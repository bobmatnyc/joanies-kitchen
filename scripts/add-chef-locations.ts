import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const sql = neon(process.env.DATABASE_URL!);

// Chef location data based on where each chef is known to work/live
const chefLocations = [
  {
    slug: 'yotam-ottolenghi',
    latitude: '51.5074',
    longitude: '-0.1278',
    city: 'London',
    state: null,
    country: 'United Kingdom',
  },
  {
    slug: 'nigella-lawson',
    latitude: '51.5074',
    longitude: '-0.1278',
    city: 'London',
    state: null,
    country: 'United Kingdom',
  },
  {
    slug: 'samin-nosrat',
    latitude: '37.8715',
    longitude: '-122.2730',
    city: 'Berkeley',
    state: 'CA',
    country: 'United States',
  },
  {
    slug: 'lidia-bastianich',
    latitude: '40.7128',
    longitude: '-74.0060',
    city: 'New York',
    state: 'NY',
    country: 'United States',
  },
  {
    slug: 'nancy-silverton',
    latitude: '34.0522',
    longitude: '-118.2437',
    city: 'Los Angeles',
    state: 'CA',
    country: 'United States',
  },
  {
    slug: 'kenji-lopez-alt',
    latitude: '37.7749',
    longitude: '-122.4194',
    city: 'San Francisco',
    state: 'CA',
    country: 'United States',
  },
  {
    slug: 'madhur-jaffrey',
    latitude: '40.7128',
    longitude: '-74.0060',
    city: 'New York',
    state: 'NY',
    country: 'United States',
  },
  {
    slug: 'jacques-pepin',
    latitude: '41.6032',
    longitude: '-73.0877',
    city: 'Madison',
    state: 'CT',
    country: 'United States',
  },
  {
    slug: 'alton-brown',
    latitude: '33.7490',
    longitude: '-84.3880',
    city: 'Atlanta',
    state: 'GA',
    country: 'United States',
  },
  {
    slug: 'gordon-ramsay',
    latitude: '51.5074',
    longitude: '-0.1278',
    city: 'London',
    state: null,
    country: 'United Kingdom',
  },
];

async function addLocationFields() {
  console.log('Adding location fields to chefs table...');

  try {
    // Add location columns if they don't exist
    console.log('Adding latitude column...');
    await sql`
      ALTER TABLE chefs
      ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 7)
    `;

    console.log('Adding longitude column...');
    await sql`
      ALTER TABLE chefs
      ADD COLUMN IF NOT EXISTS longitude DECIMAL(10, 7)
    `;

    console.log('Adding location_city column...');
    await sql`
      ALTER TABLE chefs
      ADD COLUMN IF NOT EXISTS location_city VARCHAR(100)
    `;

    console.log('Adding location_state column...');
    await sql`
      ALTER TABLE chefs
      ADD COLUMN IF NOT EXISTS location_state VARCHAR(50)
    `;

    console.log('Adding location_country column...');
    await sql`
      ALTER TABLE chefs
      ADD COLUMN IF NOT EXISTS location_country VARCHAR(50)
    `;

    console.log('\nLocation columns added successfully!');
    console.log('\nPopulating chef location data...');

    // Update each chef with their location data
    let updated = 0;
    for (const location of chefLocations) {
      try {
        await sql`
          UPDATE chefs
          SET
            latitude = ${location.latitude},
            longitude = ${location.longitude},
            location_city = ${location.city},
            location_state = ${location.state},
            location_country = ${location.country},
            updated_at = NOW()
          WHERE slug = ${location.slug}
        `;
        console.log(`✓ Updated ${location.slug} - ${location.city}, ${location.country}`);
        updated++;
      } catch (error) {
        console.error(`✗ Failed to update ${location.slug}:`, error);
      }
    }

    console.log(`\n✅ Location data populated for ${updated}/${chefLocations.length} chefs`);

    // Show summary of chefs with locations
    const chefsWithLocations = await sql`
      SELECT
        name,
        slug,
        location_city,
        location_state,
        location_country,
        latitude,
        longitude
      FROM chefs
      WHERE latitude IS NOT NULL
      ORDER BY name
    `;

    console.log('\nChefs with location data:');
    console.table(
      chefsWithLocations.map((chef) => ({
        Name: chef.name,
        Location: `${chef.location_city}${chef.location_state ? `, ${chef.location_state}` : ''}, ${chef.location_country}`,
        Coordinates: `${chef.latitude}, ${chef.longitude}`,
      }))
    );
  } catch (error) {
    console.error('Error adding location fields:', error);
    throw error;
  }
}

addLocationFields()
  .then(() => {
    console.log('\n✅ Chef location migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
