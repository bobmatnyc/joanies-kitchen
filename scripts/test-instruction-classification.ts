/**
 * Test Script: Recipe Instruction Classification
 *
 * Tests the instruction classification system on a sample recipe.
 *
 * Run with: pnpm tsx scripts/test-instruction-classification.ts
 */

import { classifyRecipeInstructions } from '@/lib/ai/instruction-classifier';

const TEST_RECIPE = {
  name: 'Classic Spaghetti Carbonara',
  cuisine: 'Italian',
  difficulty: 'intermediate',
  instructions: [
    'Bring a large pot of salted water to a boil.',
    'Cook spaghetti according to package directions until al dente.',
    'While pasta cooks, cut bacon into small pieces and cook in a large skillet over medium heat until crispy.',
    'In a bowl, whisk together eggs, Parmesan cheese, and black pepper.',
    'Drain pasta, reserving 1 cup of pasta water.',
    'Add hot pasta to the skillet with bacon and toss to coat.',
    'Remove from heat and slowly add the egg mixture, tossing constantly.',
    'Add pasta water as needed to create a creamy sauce.',
    'Serve immediately with extra Parmesan and black pepper.',
  ],
};

async function testClassification() {
  console.log('🧪 Testing Instruction Classification System\n');
  console.log('═══════════════════════════════════════════\n');

  console.log(`Recipe: ${TEST_RECIPE.name}`);
  console.log(`Cuisine: ${TEST_RECIPE.cuisine}`);
  console.log(`Difficulty: ${TEST_RECIPE.difficulty}`);
  console.log(`Instructions: ${TEST_RECIPE.instructions.length} steps\n`);

  console.log('🚀 Classifying instructions...\n');

  const startTime = Date.now();

  const metadata = await classifyRecipeInstructions(TEST_RECIPE.instructions, {
    recipeName: TEST_RECIPE.name,
    cuisine: TEST_RECIPE.cuisine,
    difficulty: TEST_RECIPE.difficulty,
  });

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  if (metadata.length === 0) {
    console.error('❌ Classification failed - no metadata returned');
    process.exit(1);
  }

  console.log(`✅ Successfully classified ${metadata.length} instructions in ${duration}s\n`);

  console.log('═══════════════════════════════════════════\n');
  console.log('DETAILED CLASSIFICATION RESULTS\n');
  console.log('═══════════════════════════════════════════\n');

  metadata.forEach((step, idx) => {
    console.log(`\n📝 Step ${idx + 1}/${metadata.length}`);
    console.log(`─────────────────────────────────────────`);
    console.log(`Instruction: "${step.step_text}"`);
    console.log('');
    console.log(`Work Type:       ${step.classification.work_type}`);
    console.log(`Technique:       ${step.classification.technique || 'N/A'}`);
    console.log(`Tools:           ${step.classification.tools.join(', ') || 'None'}`);
    console.log(`Roles:           ${step.classification.roles.join(', ')}`);
    console.log(`Skill Required:  ${step.classification.skill_level_required}`);
    console.log('');
    console.log(`Time Estimates:`);
    console.log(
      `  Beginner:      ${step.classification.estimated_time_minutes.beginner} min`
    );
    console.log(
      `  Intermediate:  ${step.classification.estimated_time_minutes.intermediate} min`
    );
    console.log(
      `  Advanced:      ${step.classification.estimated_time_minutes.advanced} min`
    );
    console.log('');
    console.log(`Can Parallelize: ${step.classification.can_parallelize ? 'Yes ✓' : 'No ✗'}`);
    console.log(
      `Needs Attention: ${step.classification.requires_attention ? 'Yes ✓' : 'No ✗'}`
    );

    if (step.classification.temperature) {
      console.log('');
      console.log(`Temperature:     ${step.classification.temperature.value}°${step.classification.temperature.unit} (${step.classification.temperature.type})`);
    }

    if (step.classification.equipment_conflicts.length > 0) {
      console.log('');
      console.log(
        `Conflicts:       ${step.classification.equipment_conflicts.join(', ')}`
      );
    }

    if (step.classification.notes) {
      console.log('');
      console.log(`Notes:           ${step.classification.notes}`);
    }

    console.log('');
    console.log(`Confidence:      ${(step.confidence * 100).toFixed(1)}%`);
  });

  // Calculate summary statistics
  console.log('\n═══════════════════════════════════════════');
  console.log('SUMMARY STATISTICS\n');
  console.log('═══════════════════════════════════════════\n');

  const totalTime = {
    beginner: metadata.reduce(
      (sum, step) => sum + step.classification.estimated_time_minutes.beginner,
      0
    ),
    intermediate: metadata.reduce(
      (sum, step) => sum + step.classification.estimated_time_minutes.intermediate,
      0
    ),
    advanced: metadata.reduce(
      (sum, step) => sum + step.classification.estimated_time_minutes.advanced,
      0
    ),
  };

  const avgConfidence =
    metadata.reduce((sum, step) => sum + step.confidence, 0) / metadata.length;

  const parallelSteps = metadata.filter((s) => s.classification.can_parallelize).length;
  const attentionSteps = metadata.filter((s) => s.classification.requires_attention).length;

  const uniqueTools = new Set<string>();
  metadata.forEach((s) => s.classification.tools.forEach((t) => uniqueTools.add(t)));

  const uniqueTechniques = new Set<string>();
  metadata.forEach((s) => {
    if (s.classification.technique) uniqueTechniques.add(s.classification.technique);
  });

  console.log(`Total Cooking Time:`);
  console.log(`  Beginner:      ${totalTime.beginner} min (${(totalTime.beginner / 60).toFixed(1)}h)`);
  console.log(
    `  Intermediate:  ${totalTime.intermediate} min (${(totalTime.intermediate / 60).toFixed(1)}h)`
  );
  console.log(`  Advanced:      ${totalTime.advanced} min (${(totalTime.advanced / 60).toFixed(1)}h)`);
  console.log('');
  console.log(`Average Confidence:    ${(avgConfidence * 100).toFixed(1)}%`);
  console.log(`Model Used:            ${metadata[0]?.model_used}`);
  console.log('');
  console.log(`Parallelizable Steps:  ${parallelSteps}/${metadata.length} (${((parallelSteps / metadata.length) * 100).toFixed(0)}%)`);
  console.log(`Attention Required:    ${attentionSteps}/${metadata.length} (${((attentionSteps / metadata.length) * 100).toFixed(0)}%)`);
  console.log('');
  console.log(`Unique Tools:          ${uniqueTools.size} (${Array.from(uniqueTools).join(', ')})`);
  console.log(
    `Unique Techniques:     ${uniqueTechniques.size} (${Array.from(uniqueTechniques).join(', ')})`
  );

  console.log('\n═══════════════════════════════════════════');
  console.log('✅ TEST COMPLETED SUCCESSFULLY\n');

  // Validation checks
  console.log('Validation Checks:');
  const checks = [
    {
      name: 'All steps classified',
      pass: metadata.length === TEST_RECIPE.instructions.length,
    },
    { name: 'Average confidence > 85%', pass: avgConfidence > 0.85 },
    { name: 'Time estimates reasonable', pass: totalTime.intermediate > 0 },
    { name: 'Tools identified', pass: uniqueTools.size > 0 },
    { name: 'Model specified', pass: !!metadata[0]?.model_used },
  ];

  checks.forEach((check) => {
    console.log(`  ${check.pass ? '✓' : '✗'} ${check.name}`);
  });

  const allPassed = checks.every((c) => c.pass);
  console.log('');
  if (allPassed) {
    console.log('🎉 All validation checks passed!');
  } else {
    console.log('⚠️  Some validation checks failed');
  }

  console.log('\n═══════════════════════════════════════════\n');
}

testClassification()
  .then(() => {
    console.log('Test completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  });
