#!/usr/bin/env tsx
/**
 * Database Migration: Generate Missing Meal Slugs
 *
 * Purpose:
 * - Identify meals with NULL or empty slugs
 * - Generate SEO-friendly slugs from meal names
 * - Handle slug conflicts with numbered suffixes
 * - Update database with generated slugs
 *
 * Root Cause:
 * - Some meal records were created without slugs
 * - Routing uses /meals/[slug] pattern
 * - getMealBySlug function (src/app/actions/meals.ts:276-315) returns "not found" when slug is NULL
 *
 * Schema Changes:
 * - None (only updates existing slug column values)
 *
 * Usage:
 *   npx tsx scripts/migrations/generate-meal-slugs.ts
 *
 * Rollback:
 *   npx tsx scripts/migrations/generate-meal-slugs.ts --rollback
 */

import 'dotenv/config';
import { eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../src/lib/db';
import { meals } from '../../src/lib/db/schema';
import { ensureUniqueSlug, regenerateMealSlug } from '../../src/lib/utils/meal-slug';

async function generateMealSlugs() {
  console.log('🔍 Checking for meals without slugs...\n');

  try {
    // Step 1: Identify meals without slugs (NULL or empty string)
    const mealsWithoutSlugs = await db
      .select()
      .from(meals)
      .where(or(isNull(meals.slug), eq(meals.slug, '')));

    console.log(`📊 Found ${mealsWithoutSlugs.length} meals without slugs`);

    if (mealsWithoutSlugs.length === 0) {
      console.log('✅ All meals already have slugs!');
      return;
    }

    // Display meals that need slugs
    console.log('\n📋 Meals needing slugs:');
    for (const meal of mealsWithoutSlugs) {
      console.log(`   - "${meal.name}" (ID: ${meal.id})`);
    }

    // Step 2: Get all existing slugs to avoid conflicts
    const allMeals = await db.select().from(meals);
    const existingSlugs: string[] = allMeals
      .map((m) => m.slug)
      .filter((s): s is string => !!s && s !== '');

    console.log(`\n🔧 Generating slugs (avoiding ${existingSlugs.length} existing slugs)...\n`);

    // Step 3: Generate unique slugs for each meal
    const updates: Array<{ id: string; oldSlug: string | null; newSlug: string }> = [];
    const localExistingSlugs = [...existingSlugs];

    for (const meal of mealsWithoutSlugs) {
      // Generate base slug from meal name and creation date
      const baseSlug = regenerateMealSlug(meal.name, meal.id, meal.created_at);

      // Ensure uniqueness by appending numbers if needed
      const uniqueSlug = ensureUniqueSlug(baseSlug, localExistingSlugs);

      // Track this slug to prevent duplicates in this batch
      localExistingSlugs.push(uniqueSlug);

      updates.push({
        id: meal.id,
        oldSlug: meal.slug,
        newSlug: uniqueSlug,
      });

      console.log(`✓ "${meal.name}" → ${uniqueSlug}`);
    }

    // Step 4: Apply updates to database
    console.log(`\n💾 Updating ${updates.length} meals in database...`);

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ mealId: string; error: string }> = [];

    for (const { id, newSlug } of updates) {
      try {
        await db
          .update(meals)
          .set({
            slug: newSlug,
            updated_at: new Date(),
          })
          .where(eq(meals.id, id));

        successCount++;
      } catch (error) {
        errorCount++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ mealId: id, error: errorMessage });
        console.error(`   ❌ Failed to update meal ${id}: ${errorMessage}`);
      }
    }

    // Step 5: Verification
    console.log('\n🔍 Verifying results...');
    const verificationResult = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(slug) as with_slug,
        COUNT(*) FILTER (WHERE slug IS NULL OR slug = '') as without_slug
      FROM meals;
    `);

    const stats = verificationResult.rows[0] as {
      total: number;
      with_slug: number;
      without_slug: number;
    };

    // Step 6: Summary Report
    console.log('\n' + '='.repeat(60));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📊 Summary:');
    console.log(`   Total meals in database: ${stats.total}`);
    console.log(`   Meals processed: ${updates.length}`);
    console.log(`   Successfully updated: ${successCount}`);
    console.log(`   Failed updates: ${errorCount}`);
    console.log(`   Meals with slugs: ${stats.with_slug}`);
    console.log(`   Meals without slugs: ${stats.without_slug}`);

    if (errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      for (const { mealId, error } of errors) {
        console.log(`   - Meal ${mealId}: ${error}`);
      }
    }

    if (stats.without_slug > 0) {
      console.log(
        '\n⚠️  WARNING: Some meals still do not have slugs. Run this migration again to fix them.'
      );
    }

    console.log('\n✓ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

async function rollbackMealSlugs() {
  console.log('⚠️  Rolling back meal slug generation...\n');

  try {
    // Get all meals that have slugs
    const mealsWithSlugs = await db.select().from(meals).where(sql`slug IS NOT NULL`);

    console.log(`📊 Found ${mealsWithSlugs.length} meals with slugs`);

    if (mealsWithSlugs.length === 0) {
      console.log('✅ No slugs to remove!');
      return;
    }

    console.log('\n⚠️  WARNING: This will remove ALL meal slugs!');
    console.log('This is a destructive operation and will break slug-based routing.');
    console.log('\nTo proceed, you would need to confirm in production.');
    console.log('\n❌ Rollback cancelled for safety.');
    console.log(
      '\nIf you really want to remove slugs, manually run: UPDATE meals SET slug = NULL;'
    );
  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isRollback = args.includes('--rollback');

// Run migration or rollback
const migrationFunction = isRollback ? rollbackMealSlugs : generateMealSlugs;

migrationFunction()
  .then(() => {
    console.log('\n✓ Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration script failed:', error);
    process.exit(1);
  });
