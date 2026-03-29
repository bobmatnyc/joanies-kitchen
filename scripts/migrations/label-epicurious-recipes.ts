import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';

config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);

async function labelEpicuriousRecipes() {
  console.log('Starting Epicurious recipe labeling...');

  // Count recipes that need source fix (epicurious.com → Epicurious)
  const [{ count: needsSourceFix }] = await sql`
    SELECT COUNT(*) as count FROM recipes
    WHERE source = 'epicurious.com' AND user_id = 'system_imported'
  `;
  console.log(`Recipes still with source='epicurious.com': ${needsSourceFix}`);

  // Step 1: Update source name from 'epicurious.com' to 'Epicurious' (idempotent)
  if (Number(needsSourceFix) > 0) {
    const sourceResult = await sql`
      UPDATE recipes
      SET source = 'Epicurious'
      WHERE source = 'epicurious.com' AND user_id = 'system_imported'
      RETURNING id
    `;
    console.log(`Updated source name: ${sourceResult.length} recipes`);
  } else {
    console.log('Source name already updated, skipping.');
  }

  // Count total Epicurious recipes (with updated source)
  const [{ count: totalEpicurious }] = await sql`
    SELECT COUNT(*) as count FROM recipes
    WHERE source = 'Epicurious' AND user_id = 'system_imported'
  `;
  console.log(`Total Epicurious recipes (source='Epicurious'): ${totalEpicurious}`);

  if (Number(totalEpicurious) === 0) {
    console.log('No Epicurious recipes found. Exiting.');
    return;
  }

  // Step 2: Add 'general' tag to existing tags text array (idempotent).
  // Tags column is text storing a JSON array string (e.g. '["Tag1","Tag2"]').
  // Strategy:
  //   - NULL/empty tags → set to '["general"]'
  //   - Already contains "general" as a JSON string value → leave unchanged
  //   - Otherwise → strip trailing ']', append ,"general"]
  // Use text search for '"general"' (with quotes) to avoid partial matches.
  const tagResult = await sql`
    UPDATE recipes
    SET tags = CASE
      WHEN tags IS NULL OR tags = '' OR tags = 'null'
        THEN '["general"]'
      WHEN position('"general"' IN tags) > 0
        THEN tags
      ELSE
        rtrim(tags, ']') || ',"general"]'
    END
    WHERE source = 'Epicurious' AND user_id = 'system_imported'
    RETURNING id
  `;
  console.log(`Tags updated (upserted general tag): ${tagResult.length} recipes`);

  // Step 3: Verify final state
  const [verify] = await sql`
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE position('"general"' IN COALESCE(tags, '')) > 0) as with_general_tag,
      COUNT(*) FILTER (WHERE moderation_status = 'pending') as pending_moderation,
      COUNT(*) FILTER (WHERE moderation_status IS NULL) as null_moderation
    FROM recipes
    WHERE source = 'Epicurious' AND user_id = 'system_imported'
  `;
  console.log('Verification:', verify);

  // Sanity check: confirm no epicurious.com source strings remain
  const [{ count: remaining }] = await sql`
    SELECT COUNT(*) as count FROM recipes
    WHERE source = 'epicurious.com' AND user_id = 'system_imported'
  `;
  console.log(`Remaining 'epicurious.com' source records: ${remaining} (should be 0)`);

  console.log('Done!');
}

labelEpicuriousRecipes().catch(console.error);
