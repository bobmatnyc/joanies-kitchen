import { readFileSync, writeFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/index.js';
import { ingredients } from '@/lib/db/ingredients-schema.js';

// Load ontology specification
const ONTOLOGY_SPEC = `
INGREDIENT ONTOLOGY (5 Main Types, 64 Subtypes):

1. FRESH_PRODUCE
   - vegetables_leafy, vegetables_root, vegetables_nightshade, vegetables_cruciferous
   - vegetables_allium, vegetables_squash, vegetables_legume_pod, vegetables_other
   - fruits_citrus, fruits_berries, fruits_stone, fruits_tropical, fruits_other
   - herbs_fresh, mushrooms

2. PROTEINS
   - meat_beef, meat_pork, meat_lamb, meat_game, meat_processed
   - poultry_chicken, poultry_turkey, poultry_duck, poultry_other
   - seafood_fish, seafood_shellfish, seafood_processed
   - plant_legumes, plant_tofu_tempeh

3. DAIRY_EGGS
   - milk_products, cheese_soft, cheese_hard, cheese_blue, cheese_fresh
   - cultured_products, cream_butter, eggs, alternatives_nondairy

4. PANTRY_STAPLES
   - grains_rice, grains_wheat, grains_other, flours_wheat, flours_alternative
   - pasta_noodles, oils_cooking, oils_specialty, vinegars, condiments_sauces
   - condiments_pickled, sweeteners_sugar, sweeteners_alternative, spices_ground
   - spices_whole, beverages_alcoholic, beverages_nonalcoholic

5. BAKING_SPECIALTY
   - leavening, chocolate, nuts_tree, nuts_seeds, dried_fruits
   - extracts_flavorings, decorations, specialty_flours, specialty_sweeteners
   - mixes, gelatin_thickeners, specialty_ingredients
`;

interface IngredientToClassify {
  id: string;
  name: string;
  display_name: string;
  category: string | null;
}

interface Classification {
  type: string;
  subtype: string;
  reasoning: string;
}

async function classifyWithAI(ingredient: IngredientToClassify): Promise<Classification> {
  const prompt = `Given this ingredient ontology:

${ONTOLOGY_SPEC}

Classify the following ingredient:
Name: ${ingredient.display_name}
Original Category: ${ingredient.category || 'unknown'}

Return ONLY a JSON object with this exact format:
{
  "type": "ONE_OF_5_TYPES",
  "subtype": "matching_subtype",
  "reasoning": "brief explanation"
}

Examples:
- Vodka → {"type": "PANTRY_STAPLES", "subtype": "beverages_alcoholic", "reasoning": "distilled spirit"}
- Porcini Mushrooms → {"type": "FRESH_PRODUCE", "subtype": "mushrooms", "reasoning": "edible fungus"}
- Sesame Seeds → {"type": "BAKING_SPECIALTY", "subtype": "nuts_seeds", "reasoning": "seed used in baking"}
- Pie Crust → {"type": "BAKING_SPECIALTY", "subtype": "mixes", "reasoning": "prepared baking product"}

Classify: ${ingredient.display_name}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`No JSON found in response: ${content}`);
    }

    const classification = JSON.parse(jsonMatch[0]);

    // Validate format
    if (!classification.type || !classification.subtype) {
      throw new Error(`Invalid classification format: ${JSON.stringify(classification)}`);
    }

    return classification;
  } catch (error) {
    console.error(`AI classification failed for ${ingredient.display_name}:`, error);

    // Fallback to rule-based for common patterns
    return fallbackClassification(ingredient);
  }
}

function fallbackClassification(ingredient: IngredientToClassify): Classification {
  const nameLower = ingredient.display_name.toLowerCase();

  // Alcohol
  if (
    nameLower.match(
      /vodka|gin|rum|whiskey|bourbon|tequila|brandy|cognac|vermouth|bitters|liqueur|schnapps/
    )
  ) {
    return {
      type: 'PANTRY_STAPLES',
      subtype: 'beverages_alcoholic',
      reasoning: 'alcoholic beverage (fallback rule)',
    };
  }

  // Mushrooms
  if (nameLower.includes('mushroom')) {
    return {
      type: 'FRESH_PRODUCE',
      subtype: 'mushrooms',
      reasoning: 'edible fungus (fallback rule)',
    };
  }

  // Seeds
  if (nameLower.match(/seeds?$/) || nameLower.includes('sesame')) {
    return {
      type: 'BAKING_SPECIALTY',
      subtype: 'nuts_seeds',
      reasoning: 'seed ingredient (fallback rule)',
    };
  }

  // Mixes
  if (nameLower.includes('mix') || nameLower.includes('crust')) {
    return {
      type: 'BAKING_SPECIALTY',
      subtype: 'mixes',
      reasoning: 'prepared mix (fallback rule)',
    };
  }

  // Default to PANTRY_STAPLES other
  return {
    type: 'PANTRY_STAPLES',
    subtype: 'specialty_ingredients',
    reasoning: 'uncategorized pantry item (fallback)',
  };
}

async function main() {
  console.log('Starting refined classification of "other_other" ingredients...\n');

  // Load ingredients to reclassify
  const otherIngredients: IngredientToClassify[] = JSON.parse(
    readFileSync('tmp/other-ingredients.json', 'utf-8')
  );

  console.log(`Loaded ${otherIngredients.length} ingredients to reclassify`);

  const results: Array<{
    ingredient: IngredientToClassify;
    classification: Classification;
  }> = [];

  let processed = 0;
  let updated = 0;

  for (const ingredient of otherIngredients) {
    processed++;

    console.log(`[${processed}/${otherIngredients.length}] ${ingredient.display_name}`);

    // Classify with AI
    const classification = await classifyWithAI(ingredient);

    console.log(`  → ${classification.type} / ${classification.subtype}`);
    console.log(`     ${classification.reasoning}`);

    results.push({ ingredient, classification });

    // Update database
    try {
      await db
        .update(ingredients)
        .set({
          type: classification.type,
          subtype: classification.subtype,
        })
        .where(eq(ingredients.id, ingredient.id));

      updated++;
    } catch (error) {
      console.error(`  ✗ Failed to update database:`, error);
    }

    // Rate limit: ~1 request per second
    if (processed % 10 === 0) {
      console.log(`\nProgress: ${processed}/${otherIngredients.length} (${updated} updated)\n`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  // Save results
  writeFileSync('tmp/refined-classification-results.json', JSON.stringify(results, null, 2));

  // Generate summary
  const typeCounts: Record<string, number> = {};
  const subtypeCounts: Record<string, number> = {};

  for (const result of results) {
    const { type, subtype } = result.classification;
    typeCounts[type] = (typeCounts[type] || 0) + 1;
    subtypeCounts[`${type}/${subtype}`] = (subtypeCounts[`${type}/${subtype}`] || 0) + 1;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('REFINED CLASSIFICATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total processed: ${processed}`);
  console.log(`Database updated: ${updated}`);
  console.log('\nDistribution by Type:');
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

  console.log('\nDistribution by Subtype (Top 20):');
  Object.entries(subtypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([subtype, count]) => {
      console.log(`  ${subtype}: ${count}`);
    });

  console.log('\n✅ Refined classification complete!');
  console.log(`📊 Results saved to tmp/refined-classification-results.json`);

  process.exit(0);
}

main().catch(console.error);
