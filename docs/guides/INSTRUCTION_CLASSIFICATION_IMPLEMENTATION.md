# Instruction Classification Implementation Guide

**Version**: 1.0.0
**Last Updated**: 2025-10-18
**Status**: Design Phase → Implementation Ready

---

## Executive Summary

This guide provides a complete, phase-by-phase implementation plan for adding AI-powered instruction classification to the recipe manager. The system will analyze recipe steps to extract:

- Work types, techniques, and required tools
- Time estimates by skill level
- Parallelization opportunities
- Equipment conflicts

**Timeline**: 4 weeks
**Budget**: $5-10
**Risk Level**: Low

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Phase 1: Foundation (Week 1)](#phase-1-foundation-week-1)
3. [Phase 2: Classification Engine (Week 2)](#phase-2-classification-engine-week-2)
4. [Phase 3: Batch Processing (Week 3)](#phase-3-batch-processing-week-3)
5. [Phase 4: UI Integration (Week 4)](#phase-4-ui-integration-week-4)
6. [Quality Assurance](#quality-assurance)
7. [Monitoring & Maintenance](#monitoring--maintenance)
8. [Rollback Plan](#rollback-plan)

---

## Prerequisites

### Required Knowledge

- ✅ TypeScript & Next.js 15
- ✅ Drizzle ORM
- ✅ PostgreSQL JSONB
- ✅ OpenRouter API
- ✅ Zod validation

### Environment Setup

```bash
# Ensure OpenRouter API key is set
echo $OPENROUTER_API_KEY  # Should be set in .env.local

# Verify database access
pnpm db:studio  # Should open Drizzle Studio

# Ensure dependencies are installed
pnpm install
```

### Files Created (Already Complete)

✅ `docs/reference/INSTRUCTION_CLASSIFICATION_TAXONOMY.md`
✅ `docs/reference/INSTRUCTION_METADATA_SCHEMA.md`
✅ `docs/reference/INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md`
✅ `src/types/instruction-metadata.ts`
✅ `src/lib/ai/instruction-classifier-prompt.ts`

---

## Phase 1: Foundation (Week 1)

**Goal**: Set up database schema and core infrastructure

### Day 1: Database Migration

#### Task 1.1: Create Migration Script

```typescript
// File: scripts/migrations/add-instruction-metadata-column.ts

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function addInstructionMetadataColumn() {
  console.log('🚀 Starting instruction metadata migration...');

  try {
    // Add columns
    await db.execute(sql`
      ALTER TABLE recipes
      ADD COLUMN IF NOT EXISTS instruction_metadata JSONB,
      ADD COLUMN IF NOT EXISTS instruction_metadata_version VARCHAR(20) DEFAULT '1.0.0',
      ADD COLUMN IF NOT EXISTS instruction_metadata_generated_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS instruction_metadata_model VARCHAR(100);
    `);

    console.log('✅ Columns added successfully');

    // Create indexes
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_instruction_metadata
      ON recipes USING GIN (instruction_metadata);
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_recipes_has_instruction_metadata
      ON recipes (instruction_metadata)
      WHERE instruction_metadata IS NOT NULL;
    `);

    console.log('✅ Indexes created successfully');

    // Verify migration
    const result = await db.execute(sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'recipes'
      AND column_name LIKE 'instruction_metadata%';
    `);

    console.log('📊 Columns created:', result.rows);

    console.log('✅ Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run migration
addInstructionMetadataColumn()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

**Run**:
```bash
tsx scripts/migrations/add-instruction-metadata-column.ts
```

#### Task 1.2: Update Drizzle Schema

```typescript
// File: src/lib/db/schema.ts

// Add to recipes table definition (around line 65)
export const recipes = pgTable(
  'recipes',
  {
    // ... existing fields ...

    // Instruction classification metadata
    instruction_metadata: text('instruction_metadata'), // JSONB array
    instruction_metadata_version: varchar('instruction_metadata_version', { length: 20 }),
    instruction_metadata_generated_at: timestamp('instruction_metadata_generated_at'),
    instruction_metadata_model: varchar('instruction_metadata_model', { length: 100 }),

    // ... rest of fields ...
  },
  (table) => ({
    // ... existing indexes ...

    instructionMetadataIdx: index('idx_recipes_instruction_metadata')
      .on(table.instruction_metadata),
  })
);
```

**Verify**:
```bash
pnpm db:studio
# Check that new columns appear in recipes table
```

---

### Day 2-3: Classification Service

#### Task 1.3: Create Classification Service

```typescript
// File: src/lib/ai/instruction-classifier.ts

import { generateWithOpenRouter } from '@/lib/ai/openrouter-server';
import {
  buildBatchClassificationPrompt,
  buildInstructionClassifierPrompt,
  INSTRUCTION_CLASSIFIER_SYSTEM_PROMPT,
  parseClassificationResponse,
  validateClassification,
} from '@/lib/ai/instruction-classifier-prompt';
import type {
  InstructionClassification,
  InstructionMetadata,
} from '@/types/instruction-metadata';

const DEFAULT_MODEL = 'google/gemini-2.0-flash-exp:free';
const CLASSIFICATION_TEMPERATURE = 0.1; // Low for consistency

/**
 * Classifies a single instruction step
 */
export async function classifyInstruction(
  instruction: string,
  recipeContext?: {
    recipeName?: string;
    cuisine?: string;
    difficulty?: string;
    mainIngredients?: string[];
  }
): Promise<InstructionMetadata | null> {
  try {
    const prompt = buildInstructionClassifierPrompt(instruction, recipeContext);

    const response = await generateWithOpenRouter({
      messages: [
        {
          role: 'system',
          content: INSTRUCTION_CLASSIFIER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: DEFAULT_MODEL,
      temperature: CLASSIFICATION_TEMPERATURE,
    });

    const classification = parseClassificationResponse(response);

    if (!classification) {
      console.error('Failed to parse classification response');
      return null;
    }

    // Validate classification
    const validation = validateClassification(classification);
    if (!validation.valid) {
      console.error('Validation errors:', validation.errors);
      return null;
    }

    // Build metadata object
    const metadata: InstructionMetadata = {
      step_index: 0, // Will be set by caller
      step_text: instruction,
      classification,
      generated_at: new Date().toISOString(),
      model_used: DEFAULT_MODEL,
      confidence: classification.confidence,
    };

    return metadata;
  } catch (error) {
    console.error('Classification error:', error);
    return null;
  }
}

/**
 * Classifies all instructions in a recipe (batch)
 */
export async function classifyRecipeInstructions(
  instructions: string[],
  recipeContext?: {
    recipeName?: string;
    cuisine?: string;
    difficulty?: string;
    mainIngredients?: string[];
  }
): Promise<InstructionMetadata[]> {
  try {
    const prompt = buildBatchClassificationPrompt(instructions, recipeContext);

    const response = await generateWithOpenRouter({
      messages: [
        {
          role: 'system',
          content: INSTRUCTION_CLASSIFIER_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      model: DEFAULT_MODEL,
      temperature: CLASSIFICATION_TEMPERATURE,
    });

    // Parse batch response
    const classifications = JSON.parse(response) as Array<
      InstructionClassification & { step_index: number }
    >;

    // Convert to metadata array
    const metadata: InstructionMetadata[] = classifications.map((classification) => ({
      step_index: classification.step_index,
      step_text: instructions[classification.step_index] || '',
      classification,
      generated_at: new Date().toISOString(),
      model_used: DEFAULT_MODEL,
      confidence: classification.confidence,
    }));

    return metadata;
  } catch (error) {
    console.error('Batch classification error:', error);
    return [];
  }
}

/**
 * Checks if a recipe needs classification
 */
export function needsClassification(recipe: {
  instructions: string | null;
  instruction_metadata: string | null;
}): boolean {
  if (!recipe.instructions) return false;
  if (recipe.instruction_metadata) return false; // Already classified

  return true;
}

/**
 * Estimates cost for classifying a recipe
 */
export function estimateClassificationCost(instructionCount: number): number {
  const tokensPerInstruction = 550; // Average
  const totalTokens = tokensPerInstruction * instructionCount;

  // Gemini Flash pricing
  const inputCost = (totalTokens * 0.6 * 0.075) / 1_000_000; // 60% input
  const outputCost = (totalTokens * 0.4 * 0.3) / 1_000_000; // 40% output

  return inputCost + outputCost;
}
```

#### Task 1.4: Create Server Action

```typescript
// File: src/app/actions/classify-instructions.ts

'use server';

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { classifyRecipeInstructions } from '@/lib/ai/instruction-classifier';
import type { InstructionMetadata } from '@/types/instruction-metadata';

export async function classifyRecipe(recipeId: string): Promise<{
  success: boolean;
  metadata?: InstructionMetadata[];
  error?: string;
}> {
  try {
    // Get recipe
    const recipe = await db.query.recipes.findFirst({
      where: eq(recipes.id, recipeId),
    });

    if (!recipe) {
      return { success: false, error: 'Recipe not found' };
    }

    // Parse instructions
    const instructions = JSON.parse(recipe.instructions) as string[];

    if (instructions.length === 0) {
      return { success: false, error: 'No instructions to classify' };
    }

    // Classify
    const metadata = await classifyRecipeInstructions(instructions, {
      recipeName: recipe.name,
      cuisine: recipe.cuisine || undefined,
      difficulty: recipe.difficulty || undefined,
    });

    if (metadata.length === 0) {
      return { success: false, error: 'Classification failed' };
    }

    // Save to database
    await db
      .update(recipes)
      .set({
        instruction_metadata: JSON.stringify(metadata),
        instruction_metadata_version: '1.0.0',
        instruction_metadata_generated_at: new Date(),
        instruction_metadata_model: 'google/gemini-2.0-flash-exp:free',
      })
      .where(eq(recipes.id, recipeId));

    return { success: true, metadata };
  } catch (error) {
    console.error('Failed to classify recipe:', error);
    return { success: false, error: 'Classification failed' };
  }
}
```

---

### Day 4-5: Testing & Validation

#### Task 1.5: Create Test Script

```typescript
// File: scripts/test-instruction-classification.ts

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
  console.log('🧪 Testing instruction classification...\n');

  const metadata = await classifyRecipeInstructions(TEST_RECIPE.instructions, {
    recipeName: TEST_RECIPE.name,
    cuisine: TEST_RECIPE.cuisine,
    difficulty: TEST_RECIPE.difficulty,
  });

  console.log(`✅ Classified ${metadata.length} instructions\n`);

  metadata.forEach((step, idx) => {
    console.log(`\n📝 Step ${idx + 1}: "${step.step_text}"`);
    console.log(`   Work Type: ${step.classification.work_type}`);
    console.log(`   Technique: ${step.classification.technique || 'N/A'}`);
    console.log(`   Tools: ${step.classification.tools.join(', ')}`);
    console.log(`   Time (intermediate): ${step.classification.estimated_time_minutes.intermediate} min`);
    console.log(`   Can Parallelize: ${step.classification.can_parallelize ? 'Yes' : 'No'}`);
    console.log(`   Confidence: ${step.confidence}`);
  });

  // Calculate summary
  const totalTime = metadata.reduce(
    (sum, step) => sum + step.classification.estimated_time_minutes.intermediate,
    0
  );
  const avgConfidence =
    metadata.reduce((sum, step) => sum + step.confidence, 0) / metadata.length;

  console.log(`\n📊 Summary:`);
  console.log(`   Total Time (intermediate): ${totalTime} minutes`);
  console.log(`   Average Confidence: ${avgConfidence.toFixed(2)}`);
  console.log(`   Model: ${metadata[0]?.model_used}`);
}

testClassification()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
```

**Run**:
```bash
tsx scripts/test-instruction-classification.ts
```

**Success Criteria**:
- ✅ All 9 steps classified
- ✅ Average confidence > 0.85
- ✅ Time estimates reasonable
- ✅ Tools correctly identified

---

## Phase 2: Classification Engine (Week 2)

**Goal**: Build robust batch processing system

### Day 6-7: Batch Processor

#### Task 2.1: Create Batch Processing Script

```typescript
// File: scripts/classify-all-recipes.ts

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { isNull } from 'drizzle-orm';
import { classifyRecipeInstructions } from '@/lib/ai/instruction-classifier';
import PQueue from 'p-queue';

const BATCH_SIZE = 100;
const REQUESTS_PER_MINUTE = 15; // Gemini free tier limit
const DRY_RUN = process.env.DRY_RUN === 'true';

async function classifyAllRecipes() {
  console.log('🚀 Starting batch classification...\n');

  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No database writes\n');
  }

  // Get unclassified recipes
  const unclassified = await db
    .select()
    .from(recipes)
    .where(isNull(recipes.instruction_metadata))
    .limit(BATCH_SIZE);

  console.log(`📊 Found ${unclassified.length} unclassified recipes\n`);

  if (unclassified.length === 0) {
    console.log('✅ All recipes are classified!');
    return;
  }

  // Create rate-limited queue
  const queue = new PQueue({
    concurrency: 1,
    interval: 60000, // 1 minute
    intervalCap: REQUESTS_PER_MINUTE,
  });

  let successCount = 0;
  let errorCount = 0;
  let totalCost = 0;

  for (const recipe of unclassified) {
    await queue.add(async () => {
      try {
        const instructions = JSON.parse(recipe.instructions) as string[];

        if (instructions.length === 0) {
          console.log(`⚠️  Skipping ${recipe.name} - no instructions`);
          return;
        }

        // Classify
        const metadata = await classifyRecipeInstructions(instructions, {
          recipeName: recipe.name,
          cuisine: recipe.cuisine || undefined,
          difficulty: recipe.difficulty || undefined,
        });

        if (metadata.length === 0) {
          console.error(`❌ Failed to classify: ${recipe.name}`);
          errorCount++;
          return;
        }

        // Save to database (unless dry run)
        if (!DRY_RUN) {
          await db
            .update(recipes)
            .set({
              instruction_metadata: JSON.stringify(metadata),
              instruction_metadata_version: '1.0.0',
              instruction_metadata_generated_at: new Date(),
              instruction_metadata_model: 'google/gemini-2.0-flash-exp:free',
            })
            .where(eq(recipes.id, recipe.id));
        }

        successCount++;
        const avgConfidence =
          metadata.reduce((sum, step) => sum + step.confidence, 0) / metadata.length;

        console.log(
          `✅ [${successCount}/${unclassified.length}] ${recipe.name} (confidence: ${avgConfidence.toFixed(2)})`
        );

        // Estimate cost
        const cost = (instructions.length * 550 * 0.0003) / 1000; // Rough estimate
        totalCost += cost;
      } catch (error) {
        console.error(`❌ Error classifying ${recipe.name}:`, error);
        errorCount++;
      }
    });
  }

  await queue.onIdle();

  console.log(`\n📊 Batch Classification Complete:`);
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   💰 Estimated Cost: $${totalCost.toFixed(4)}`);
}

classifyAllRecipes()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Batch processing failed:', error);
    process.exit(1);
  });
```

**Install Dependencies**:
```bash
pnpm add p-queue
```

**Test (Dry Run)**:
```bash
DRY_RUN=true tsx scripts/classify-all-recipes.ts
```

**Run (Production)**:
```bash
tsx scripts/classify-all-recipes.ts
```

---

### Day 8-9: Quality Assurance

#### Task 2.2: Create Validation Script

```typescript
// File: scripts/validate-classifications.ts

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import type { InstructionMetadata } from '@/types/instruction-metadata';

async function validateClassifications() {
  console.log('🔍 Validating classifications...\n');

  // Count classified recipes
  const stats = await db.execute(sql`
    SELECT
      COUNT(*) as total_recipes,
      COUNT(instruction_metadata) as classified_recipes,
      COUNT(*) FILTER (WHERE instruction_metadata IS NOT NULL) * 100.0 / COUNT(*) as coverage_pct
    FROM recipes;
  `);

  console.log('📊 Coverage Statistics:');
  console.log(`   Total Recipes: ${stats.rows[0].total_recipes}`);
  console.log(`   Classified: ${stats.rows[0].classified_recipes}`);
  console.log(`   Coverage: ${Number(stats.rows[0].coverage_pct).toFixed(2)}%\n`);

  // Get average confidence
  const confidence = await db.execute(sql`
    SELECT AVG((metadata->>'confidence')::numeric) as avg_confidence
    FROM recipes,
         jsonb_array_elements(instruction_metadata) metadata
    WHERE instruction_metadata IS NOT NULL;
  `);

  console.log('🎯 Quality Metrics:');
  console.log(`   Average Confidence: ${Number(confidence.rows[0].avg_confidence).toFixed(3)}\n`);

  // Find low-confidence classifications
  const lowConfidence = await db.execute(sql`
    SELECT id, name, instruction_metadata
    FROM recipes
    WHERE instruction_metadata IS NOT NULL
    AND (instruction_metadata->0->>'confidence')::numeric < 0.8
    LIMIT 10;
  `);

  if (lowConfidence.rows.length > 0) {
    console.log('⚠️  Low Confidence Recipes (< 0.8):');
    for (const row of lowConfidence.rows) {
      const metadata = JSON.parse(row.instruction_metadata) as InstructionMetadata[];
      const avgConf = metadata.reduce((sum, m) => sum + m.confidence, 0) / metadata.length;
      console.log(`   - ${row.name} (${avgConf.toFixed(2)})`);
    }
    console.log('');
  }

  // Check for missing classifications
  const missing = await db.execute(sql`
    SELECT COUNT(*) as missing_count
    FROM recipes
    WHERE instructions IS NOT NULL
    AND instruction_metadata IS NULL;
  `);

  console.log('📋 Missing Classifications:');
  console.log(`   Count: ${missing.rows[0].missing_count}\n`);

  console.log('✅ Validation complete!');
}

validateClassifications()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Validation failed:', error);
    process.exit(1);
  });
```

**Run**:
```bash
tsx scripts/validate-classifications.ts
```

---

## Phase 3: Batch Processing (Week 3)

**Goal**: Classify all 3,500 recipes

### Day 10-16: Full Classification

#### Process

1. **Dry Run** (Day 10):
   ```bash
   DRY_RUN=true tsx scripts/classify-all-recipes.ts
   ```

2. **Classify First 100** (Day 11):
   ```bash
   tsx scripts/classify-all-recipes.ts
   ```

3. **Validate** (Day 11):
   ```bash
   tsx scripts/validate-classifications.ts
   ```

4. **Review Sample** (Day 12):
   - Manually review 50 random classifications
   - Check time estimates, tools, techniques
   - Adjust prompts if needed

5. **Full Batch** (Days 13-16):
   - Process remaining recipes in batches of 500/day
   - Monitor costs and quality
   - Address errors

---

## Phase 4: UI Integration (Week 4)

**Goal**: Surface classification data in user-facing features

### Day 17-18: Enhanced Timeline

#### Task 4.1: Update Meal Prep Timeline

```typescript
// File: src/components/meals/EnhancedMealPrepTimeline.tsx

'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { InstructionMetadata } from '@/types/instruction-metadata';

interface EnhancedTimelineStepProps {
  metadata: InstructionMetadata;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
}

export function EnhancedTimelineStep({ metadata, skillLevel }: EnhancedTimelineStepProps) {
  const { classification } = metadata;
  const estimatedTime = classification.estimated_time_minutes[skillLevel];

  return (
    <Card className="p-4">
      <div className="space-y-2">
        {/* Work Type Badge */}
        <Badge variant="outline">{classification.work_type}</Badge>

        {/* Instruction */}
        <p className="text-sm font-medium">{metadata.step_text}</p>

        {/* Time Estimate */}
        <p className="text-xs text-muted-foreground">
          ⏱️ {estimatedTime} minutes ({skillLevel})
        </p>

        {/* Tools */}
        {classification.tools.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {classification.tools.map((tool) => (
              <Badge key={tool} variant="secondary" className="text-xs">
                {tool.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        )}

        {/* Parallelization */}
        {classification.can_parallelize && (
          <Badge variant="outline" className="text-xs bg-green-50">
            Can parallelize
          </Badge>
        )}
      </div>
    </Card>
  );
}
```

---

### Day 19-20: Equipment Checklist

#### Task 4.2: Create Equipment Checklist Component

```typescript
// File: src/components/meals/EquipmentChecklist.tsx

'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRequiredTools } from '@/types/instruction-metadata';
import type { InstructionMetadata } from '@/types/instruction-metadata';

interface EquipmentChecklistProps {
  metadata: InstructionMetadata[];
}

export function EquipmentChecklist({ metadata }: EquipmentChecklistProps) {
  const tools = getRequiredTools(metadata);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment Checklist</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {tools.map((tool) => (
            <div key={tool} className="flex items-center space-x-2">
              <Checkbox id={tool} />
              <label htmlFor={tool} className="text-sm capitalize">
                {tool.replace(/_/g, ' ')}
              </label>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

---

### Day 21-23: Recipe Detail Enhancements

#### Task 4.3: Add Skill Level Indicators

```typescript
// File: src/components/recipe/SkillLevelBadge.tsx

import { Badge } from '@/components/ui/badge';
import { calculateRecipeDifficulty } from '@/types/instruction-metadata';
import type { InstructionMetadata } from '@/types/instruction-metadata';

interface SkillLevelBadgeProps {
  metadata: InstructionMetadata[];
}

export function SkillLevelBadge({ metadata }: SkillLevelBadgeProps) {
  const difficulty = calculateRecipeDifficulty(metadata);

  const colors = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-red-100 text-red-800',
  };

  return (
    <Badge className={colors[difficulty]}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </Badge>
  );
}
```

---

## Quality Assurance

### Manual Review Checklist

- [ ] Review 50 random recipes
- [ ] Verify time estimates are reasonable
- [ ] Check tool detection accuracy
- [ ] Validate technique classification
- [ ] Test parallel task detection
- [ ] Verify equipment conflict detection

### Automated Tests

```typescript
// File: src/lib/ai/__tests__/instruction-classifier.test.ts

import { describe, expect, it } from 'vitest';
import { classifyInstruction } from '../instruction-classifier';

describe('Instruction Classifier', () => {
  it('classifies basic prep step', async () => {
    const result = await classifyInstruction('Dice 2 onions');

    expect(result).toBeDefined();
    expect(result?.classification.work_type).toBe('prep');
    expect(result?.classification.technique).toBe('dice');
    expect(result?.classification.tools).toContain('chef_knife');
  });

  it('classifies cooking step', async () => {
    const result = await classifyInstruction('Sauté onions over medium heat');

    expect(result).toBeDefined();
    expect(result?.classification.work_type).toBe('cook');
    expect(result?.classification.technique).toBe('saute');
    expect(result?.classification.equipment_conflicts).toContain('stove');
  });
});
```

---

## Monitoring & Maintenance

### Ongoing Monitoring

```typescript
// File: scripts/monitor-classification-health.ts

async function monitorHealth() {
  const metrics = await db.execute(sql`
    SELECT
      COUNT(*) as total,
      COUNT(instruction_metadata) as classified,
      AVG((metadata->>'confidence')::numeric) as avg_confidence,
      COUNT(*) FILTER (
        WHERE (metadata->>'confidence')::numeric < 0.8
      ) as low_confidence_count
    FROM recipes,
         jsonb_array_elements(instruction_metadata) metadata
  `);

  console.log('📊 Health Metrics:', metrics.rows[0]);

  // Alert if quality drops
  if (Number(metrics.rows[0].avg_confidence) < 0.85) {
    console.warn('⚠️  WARNING: Average confidence below threshold');
  }
}
```

**Run Weekly**:
```bash
tsx scripts/monitor-classification-health.ts
```

---

## Rollback Plan

### If Classification Quality is Poor

```sql
-- Rollback: Remove all classifications
UPDATE recipes
SET instruction_metadata = NULL,
    instruction_metadata_version = NULL,
    instruction_metadata_generated_at = NULL,
    instruction_metadata_model = NULL;
```

### If Database Migration Fails

```sql
-- Rollback: Remove columns
ALTER TABLE recipes
DROP COLUMN IF EXISTS instruction_metadata,
DROP COLUMN IF EXISTS instruction_metadata_version,
DROP COLUMN IF EXISTS instruction_metadata_generated_at,
DROP COLUMN IF EXISTS instruction_metadata_model;
```

---

## Success Criteria

- ✅ 95%+ recipes classified
- ✅ 85%+ average confidence
- ✅ <5% error rate
- ✅ <$10 total cost
- ✅ Enhanced meal prep timeline working
- ✅ Equipment checklist functional
- ✅ All tests passing

---

## Next Steps

After successful implementation:

1. **User Feedback**: Gather feedback on enhanced features
2. **Optimization**: Refine time estimates based on user data
3. **Advanced Features**:
   - Skill progression tracking
   - Personalized time estimates
   - Smart recipe recommendations based on available equipment
4. **Analytics**: Track feature usage and impact on engagement

---

## Related Documents

- `INSTRUCTION_CLASSIFICATION_TAXONOMY.md` - Classification system
- `INSTRUCTION_METADATA_SCHEMA.md` - Storage design
- `INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md` - Cost analysis
- `src/types/instruction-metadata.ts` - Type definitions
- `src/lib/ai/instruction-classifier-prompt.ts` - Prompt template
