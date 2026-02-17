#!/usr/bin/env node
/**
 * Direct Database Data Validation
 * Checks actual database state vs API/page behavior
 */

import postgres from 'postgres';

const sql = postgres(
  process.env.DATABASE_URL || 'postgresql://masa@localhost:5432/joanies_kitchen_dev'
);

async function validateRecipes() {
  console.log('\n' + '='.repeat(80));
  console.log('RECIPE DATA VALIDATION');
  console.log('='.repeat(80));

  try {
    // Get total recipe count
    const totalResult = await sql`
      SELECT COUNT(*) as total
      FROM recipes
      WHERE deleted_at IS NULL
    `;
    const totalRecipes = parseInt(totalResult[0].total);

    // Check image_url field
    const imageUrlStats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE image_url IS NULL) as null_image_url,
        COUNT(*) FILTER (WHERE image_url = '') as empty_image_url,
        COUNT(*) FILTER (WHERE image_url IS NOT NULL AND image_url != '') as has_image_url,
        COUNT(*) as total
      FROM recipes
      WHERE deleted_at IS NULL
    `;

    console.log('\n📊 Recipe Image URL (image_url field):');
    console.log(`   Total recipes: ${imageUrlStats[0].total}`);
    console.log(
      `   NULL image_url: ${imageUrlStats[0].null_image_url} (${((imageUrlStats[0].null_image_url / imageUrlStats[0].total) * 100).toFixed(2)}%)`
    );
    console.log(`   Empty image_url: ${imageUrlStats[0].empty_image_url}`);
    console.log(
      `   Has image_url: ${imageUrlStats[0].has_image_url} (${((imageUrlStats[0].has_image_url / imageUrlStats[0].total) * 100).toFixed(2)}%)`
    );

    // Check images field (TEXT field that may contain JSON)
    const imagesFieldStats = await sql`
      SELECT
        COUNT(*) FILTER (WHERE images IS NULL OR images = '') as null_or_empty_images,
        COUNT(*) FILTER (WHERE images IS NOT NULL AND images != '' AND images != '[]') as has_images,
        COUNT(*) as total
      FROM recipes
      WHERE deleted_at IS NULL
    `;

    console.log('\n📊 Recipe Images Field (images TEXT field):');
    console.log(`   NULL or empty: ${imagesFieldStats[0].null_or_empty_images}`);
    console.log(`   Has images data: ${imagesFieldStats[0].has_images}`);

    // Sample recipes with NULL image_url (first 10)
    const recipesWithoutImages = await sql`
      SELECT id, name, slug, image_url, images
      FROM recipes
      WHERE deleted_at IS NULL AND image_url IS NULL
      LIMIT 10
    `;

    console.log('\n📋 Sample recipes with NULL image_url (first 10):');
    recipesWithoutImages.forEach((recipe) => {
      let hasImagesArray = false;
      let imageCount = 0;

      if (recipe.images && recipe.images !== '') {
        try {
          const parsed = JSON.parse(recipe.images);
          hasImagesArray = Array.isArray(parsed) && parsed.length > 0;
          imageCount = Array.isArray(parsed) ? parsed.length : 0;
        } catch (e) {
          // Not valid JSON
        }
      }

      console.log(`   - ID: ${recipe.id}`);
      console.log(`     Name: "${recipe.name}"`);
      console.log(`     Slug: ${recipe.slug}`);
      console.log(`     image_url: ${recipe.image_url === null ? 'NULL' : recipe.image_url}`);
      console.log(`     images field: ${hasImagesArray ? `${imageCount} images` : 'empty/null'}`);
    });

    return {
      totalRecipes,
      nullImageUrl: parseInt(imageUrlStats[0].null_image_url),
      hasImageUrl: parseInt(imageUrlStats[0].has_image_url),
      hasImagesArray: parseInt(imagesFieldStats[0].has_images),
    };
  } catch (error) {
    console.error('Error validating recipes:', error);
    throw error;
  }
}

async function validateMeals() {
  console.log('\n' + '='.repeat(80));
  console.log('MEAL DATA VALIDATION');
  console.log('='.repeat(80));

  try {
    // Get all meals with slugs
    const meals = await sql`
      SELECT id, name, slug, image_url, meal_type, is_public, created_at
      FROM meals
      ORDER BY created_at DESC
    `;

    console.log(`\n📊 Total meals in database: ${meals.length}`);

    // Check slug presence
    const mealsWithSlugs = meals.filter((m) => m.slug && m.slug !== '');
    const mealsWithoutSlugs = meals.filter((m) => !m.slug || m.slug === '');

    console.log(`   Meals with slugs: ${mealsWithSlugs.length}`);
    console.log(`   Meals without slugs: ${mealsWithoutSlugs.length}`);

    // Check public meals
    const publicMeals = meals.filter((m) => m.is_public);
    console.log(`   Public meals: ${publicMeals.length}`);

    // Check image URLs
    const mealsWithImages = meals.filter((m) => m.image_url && m.image_url !== '');
    const mealsWithoutImages = meals.filter((m) => !m.image_url || m.image_url === '');

    console.log(
      `   Meals with image_url: ${mealsWithImages.length} (${((mealsWithImages.length / meals.length) * 100).toFixed(2)}%)`
    );
    console.log(
      `   Meals without image_url: ${mealsWithoutImages.length} (${((mealsWithoutImages.length / meals.length) * 100).toFixed(2)}%)`
    );

    // List all meal slugs for testing
    console.log('\n📋 All meal slugs (for routing tests):');
    mealsWithSlugs.slice(0, 20).forEach((meal) => {
      console.log(`   - Slug: "${meal.slug}", Name: "${meal.name}", Public: ${meal.is_public}`);
    });

    if (mealsWithoutSlugs.length > 0) {
      console.log('\n⚠️  Meals WITHOUT slugs (CRITICAL ISSUE):');
      mealsWithoutSlugs.forEach((meal) => {
        console.log(`   - ID: ${meal.id}, Name: "${meal.name}", Slug: ${meal.slug || 'NULL'}`);
      });
    }

    return {
      totalMeals: meals.length,
      withSlugs: mealsWithSlugs.length,
      withoutSlugs: mealsWithoutSlugs.length,
      publicMeals: publicMeals.length,
      withImages: mealsWithImages.length,
      allSlugs: mealsWithSlugs.map((m) => m.slug),
    };
  } catch (error) {
    console.error('Error validating meals:', error);
    throw error;
  }
}

async function validateChefs() {
  console.log('\n' + '='.repeat(80));
  console.log('CHEF DATA VALIDATION');
  console.log('='.repeat(80));

  try {
    const chefs = await sql`
      SELECT id, name, slug, specialties
      FROM chefs
      ORDER BY name
    `;

    console.log(`\n📊 Total chefs in database: ${chefs.length}`);

    if (chefs.length > 0) {
      // Check specialties
      const chefsWithSpecialties = chefs.filter((c) => c.specialties && c.specialties.length > 0);
      console.log(`   Chefs with specialties: ${chefsWithSpecialties.length}`);

      console.log('\n📋 Chef list:');
      chefs.slice(0, 10).forEach((chef) => {
        console.log(
          `   - Name: "${chef.name}", Slug: ${chef.slug}, Specialties: ${chef.specialties?.length || 0}`
        );
      });
    }

    return {
      totalChefs: chefs.length,
      withSpecialties: chefs.filter((c) => c.specialties && c.specialties.length > 0).length,
    };
  } catch (error) {
    console.error('Error validating chefs:', error);
    throw error;
  }
}

async function checkDatabaseSchema() {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE SCHEMA CHECK');
  console.log('='.repeat(80));

  try {
    // Check recipes table columns
    const recipeColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name IN ('image_url', 'images', 'deleted_at')
      ORDER BY column_name
    `;

    console.log('\n📋 Recipes table relevant columns:');
    recipeColumns.forEach((col) => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Check meals table columns
    const mealColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'meals'
      AND column_name IN ('slug', 'image_url', 'is_public')
      ORDER BY column_name
    `;

    console.log('\n📋 Meals table relevant columns:');
    mealColumns.forEach((col) => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

async function runValidation() {
  console.log('🔍 Starting Database Validation');
  console.log(`Time: ${new Date().toISOString()}\n`);

  try {
    await checkDatabaseSchema();
    const recipeStats = await validateRecipes();
    const mealStats = await validateMeals();
    const chefStats = await validateChefs();

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATION SUMMARY');
    console.log('='.repeat(80));

    console.log('\n🚨 CRITICAL ISSUES FOUND:');

    if (recipeStats.nullImageUrl / recipeStats.totalRecipes > 0.5) {
      console.log(
        `   ✗ ${((recipeStats.nullImageUrl / recipeStats.totalRecipes) * 100).toFixed(2)}% of recipes have NULL image_url`
      );
      console.log('     → This explains the "broken images" issue in production');
      console.log('     → Action: Run migration to populate image_url from images array');
    }

    if (mealStats.withoutSlugs > 0) {
      console.log(`   ✗ ${mealStats.withoutSlugs} meals have no slug`);
      console.log('     → This explains the "meal not found" errors');
      console.log('     → Action: Run migration to generate slugs for all meals');
    }

    if (mealStats.withImages / mealStats.totalMeals < 0.5) {
      console.log(
        `   ✗ ${((mealStats.withImages / mealStats.totalMeals) * 100).toFixed(2)}% of meals have no image_url`
      );
      console.log('     → This explains missing meal images');
      console.log('     → Action: Populate meal images from associated recipes');
    }

    console.log('\n💡 RECOMMENDED FIXES:');
    console.log('   1. Recipe images: Migrate image_url from images[0] where NULL');
    console.log('   2. Meal slugs: Generate slugs for meals with NULL slugs');
    console.log('   3. Meal images: Populate from first recipe image or default');
    console.log('   4. Consider adding DB constraints to prevent NULL slugs');

    // Save report
    const fs = await import('fs');
    const report = {
      timestamp: new Date().toISOString(),
      recipes: recipeStats,
      meals: mealStats,
      chefs: chefStats,
    };
    fs.writeFileSync(
      '/Users/masa/Projects/joanies-kitchen/tests/database-validation-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log('\n📄 Report saved to: tests/database-validation-report.json');
  } catch (error) {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }

  console.log('\n✅ Validation complete');
}

runValidation();
