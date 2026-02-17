#!/usr/bin/env tsx
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function verifyRecipeDetails() {
  const result = await sql`
    SELECT
      r.name, r.description, r.ingredients, r.instructions, r.tags
    FROM recipes r
    WHERE r.slug = 'dan-barbers-braised-short-ribs'
  `;

  const recipe = result[0];

  console.log('\n🍖 Dan Barber\'s Braised Short Ribs - Full Details\n');
  console.log('='.repeat(60));
  console.log('\n📝 Name:', recipe.name);
  console.log('\n📖 Description:');
  console.log(recipe.description);

  const ingredients = JSON.parse(recipe.ingredients as string);
  console.log('\n🥘 Ingredients (' + ingredients.length + ' items):');
  ingredients.forEach((ing: string, idx: number) => {
    console.log(`  ${idx + 1}. ${ing}`);
  });

  const instructions = JSON.parse(recipe.instructions as string);
  console.log('\n👨‍🍳 Instructions (' + instructions.length + ' steps):');
  instructions.forEach((step: string, idx: number) => {
    console.log(`\n  Step ${idx + 1}:`);
    console.log(`  ${step.substring(0, 120)}${step.length > 120 ? '...' : ''}`);
  });

  const tags = JSON.parse(recipe.tags as string);
  console.log('\n🏷️  Tags (' + tags.length + ' tags):');
  console.log('  ', tags.join(', '));

  console.log('\n' + '='.repeat(60));
  console.log('✅ Recipe successfully added to database!');
  console.log('\n🌐 View at: /recipes/dan-barbers-braised-short-ribs');
  console.log('👨‍🍳 Chef page: /chef/dan-barber\n');
}

verifyRecipeDetails()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
