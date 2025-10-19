#!/usr/bin/env tsx
/**
 * Backfill Meal Slugs
 *
 * This script generates and assigns slugs to all existing meals in the database.
 * Run this AFTER adding the slug column but BEFORE making it NOT NULL.
 *
 * Usage: tsx scripts/backfill-meal-slugs.ts
 */

import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import { meals } from '../src/lib/db/schema';
import { ensureUniqueSlug, regenerateMealSlug } from '../src/lib/utils/meal-slug';

async function backfillMealSlugs() {
  console.log('🔄 Starting meal slug backfill...\n');

  try {
    // Fetch all meals
    const allMeals = await db.select().from(meals);
    console.log(`📊 Found ${allMeals.length} meals to process\n`);

    if (allMeals.length === 0) {
      console.log('✅ No meals to backfill');
      return;
    }

    const existingSlugs: string[] = [];
    const updates: Array<{ id: string; slug: string }> = [];

    // Generate slugs for all meals
    for (const meal of allMeals) {
      // Skip if already has a slug
      if (meal.slug) {
        console.log(`⏭️  Skipping "${meal.name}" (already has slug: ${meal.slug})`);
        existingSlugs.push(meal.slug);
        continue;
      }

      // Generate base slug
      const baseSlug = regenerateMealSlug(meal.name, meal.id, meal.created_at);

      // Ensure uniqueness
      const uniqueSlug = ensureUniqueSlug(baseSlug, existingSlugs);
      existingSlugs.push(uniqueSlug);

      updates.push({
        id: meal.id,
        slug: uniqueSlug,
      });

      console.log(`✓ Generated slug for "${meal.name}": ${uniqueSlug}`);
    }

    // Apply updates
    if (updates.length > 0) {
      console.log(`\n📝 Updating ${updates.length} meals with slugs...`);

      for (const { id, slug } of updates) {
        await db
          .update(meals)
          .set({ slug, updated_at: new Date() })
          .where(eq(meals.id, id));
      }

      console.log('✅ All slugs updated successfully!');
    } else {
      console.log('✅ All meals already have slugs');
    }

    // Verify results
    console.log('\n🔍 Verification:');
    const updatedMeals = await db.select().from(meals);
    const mealsWithSlugs = updatedMeals.filter((m) => m.slug);
    const mealsWithoutSlugs = updatedMeals.filter((m) => !m.slug);

    console.log(`✓ Meals with slugs: ${mealsWithSlugs.length}/${updatedMeals.length}`);
    if (mealsWithoutSlugs.length > 0) {
      console.log(`⚠️  Meals without slugs: ${mealsWithoutSlugs.length}`);
      mealsWithoutSlugs.forEach((meal) => {
        console.log(`   - ${meal.name} (${meal.id})`);
      });
    }

    console.log('\n✅ Backfill complete!');
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the backfill
backfillMealSlugs();
