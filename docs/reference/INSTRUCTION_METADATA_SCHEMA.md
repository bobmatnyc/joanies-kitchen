# Instruction Metadata Storage Schema

**Version**: 1.0.0
**Last Updated**: 2025-10-18
**Status**: Design Phase

---

## Overview

This document defines the database schema for storing AI-generated instruction classifications. The design prioritizes:

- **Flexibility**: JSONB storage for evolving metadata structure
- **Performance**: Indexed queries for common access patterns
- **Cost-efficiency**: Store once, query many times
- **Maintainability**: Clear versioning and provenance tracking

---

## Table of Contents

1. [Database Schema Design](#database-schema-design)
2. [JSONB Structure](#jsonb-structure)
3. [Migration Strategy](#migration-strategy)
4. [Query Examples](#query-examples)
5. [Indexing Strategy](#indexing-strategy)
6. [Storage Estimates](#storage-estimates)

---

## Database Schema Design

### Option 1: JSONB Column on `recipes` Table (Recommended)

**Advantages**:
- Simple schema addition
- Atomic updates with recipe data
- No additional joins required
- Lower storage overhead

**Implementation**:

```sql
-- Add JSONB column to existing recipes table
ALTER TABLE recipes
ADD COLUMN instruction_metadata JSONB;

-- Add GIN index for efficient JSONB queries
CREATE INDEX idx_recipes_instruction_metadata
ON recipes USING GIN (instruction_metadata);

-- Add index for confidence scores
CREATE INDEX idx_recipes_instruction_confidence
ON recipes ((instruction_metadata->'confidence'));

-- Add index for skill level queries
CREATE INDEX idx_recipes_instruction_skill
ON recipes ((instruction_metadata->0->'classification'->>'skill_level_required'));
```

**Drizzle Schema Addition**:

```typescript
// In src/lib/db/schema.ts

export const recipes = pgTable(
  'recipes',
  {
    // ... existing fields ...

    // Instruction classification metadata (JSONB)
    instruction_metadata: text('instruction_metadata'), // JSON array of InstructionMetadata
    instruction_metadata_version: varchar('instruction_metadata_version', { length: 20 }), // Schema version (e.g., "1.0.0")
    instruction_metadata_generated_at: timestamp('instruction_metadata_generated_at'), // When classification was done
    instruction_metadata_model: varchar('instruction_metadata_model', { length: 100 }), // Model used (e.g., "gpt-4o-mini")

    // ... existing fields ...
  },
  (table) => ({
    // ... existing indexes ...

    // Index for recipes with classified instructions
    instructionMetadataIdx: index('idx_recipes_instruction_metadata')
      .on(table.instruction_metadata),
  })
);
```

### Option 2: Separate `recipe_instruction_metadata` Table

**Advantages**:
- Normalized design
- Easier to version metadata independently
- Can store multiple versions for A/B testing

**Disadvantages**:
- Requires JOIN for queries
- More complex schema
- Additional storage overhead

**Implementation** (Not Recommended):

```sql
CREATE TABLE recipe_instruction_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,

  -- Metadata
  step_index INTEGER NOT NULL,
  step_text TEXT NOT NULL,
  classification JSONB NOT NULL,

  -- Provenance
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_used VARCHAR(100) NOT NULL,
  schema_version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
  confidence DECIMAL(3, 2) NOT NULL,

  -- Constraints
  UNIQUE(recipe_id, step_index),
  CHECK (confidence >= 0.0 AND confidence <= 1.0)
);

CREATE INDEX idx_instruction_metadata_recipe ON recipe_instruction_metadata(recipe_id);
CREATE INDEX idx_instruction_metadata_confidence ON recipe_instruction_metadata(confidence);
```

**Decision**: Use **Option 1** (JSONB column) for simplicity and performance.

---

## JSONB Structure

### Complete Structure

```typescript
// Stored in recipes.instruction_metadata as JSONB
type InstructionMetadataArray = InstructionMetadata[];

interface InstructionMetadata {
  step_index: number;
  step_text: string;
  classification: InstructionClassification;
  generated_at: string; // ISO 8601 timestamp
  model_used: string;   // e.g., "gpt-4o-mini", "gemini-2.0-flash"
  confidence: number;   // 0.0-1.0
}

interface InstructionClassification {
  work_type: WorkType;
  technique: Technique | null;
  tools: Tool[];
  roles: KitchenRole[];
  skill_level_required: SkillLevel;

  estimated_time_minutes: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };

  can_parallelize: boolean;
  requires_attention: boolean;

  temperature: {
    value: number;
    unit: "F" | "C";
    type: "oven_preheat" | "surface" | "liquid" | "storage";
  } | null;

  equipment_conflicts: Tool[];
  prerequisite_steps: number[];

  notes?: string;
  confidence: number; // 0.0-1.0
}
```

### Example Stored Data

```json
[
  {
    "step_index": 0,
    "step_text": "Preheat oven to 375°F.",
    "classification": {
      "work_type": "setup",
      "technique": null,
      "tools": ["oven"],
      "roles": ["home_cook"],
      "skill_level_required": "beginner",
      "estimated_time_minutes": {
        "beginner": 10,
        "intermediate": 10,
        "advanced": 10
      },
      "can_parallelize": true,
      "requires_attention": false,
      "temperature": {
        "value": 375,
        "unit": "F",
        "type": "oven_preheat"
      },
      "equipment_conflicts": ["oven"],
      "prerequisite_steps": [],
      "notes": "Oven preheating typically takes 10-15 minutes",
      "confidence": 0.99
    },
    "generated_at": "2025-10-18T14:30:00.000Z",
    "model_used": "gpt-4o-mini",
    "confidence": 0.99
  },
  {
    "step_index": 1,
    "step_text": "Dice 2 medium onions into 1/4-inch pieces.",
    "classification": {
      "work_type": "prep",
      "technique": "dice",
      "tools": ["chef_knife", "cutting_board"],
      "roles": ["prep_cook", "home_cook"],
      "skill_level_required": "beginner",
      "estimated_time_minutes": {
        "beginner": 8,
        "intermediate": 4,
        "advanced": 2
      },
      "can_parallelize": true,
      "requires_attention": true,
      "temperature": null,
      "equipment_conflicts": [],
      "prerequisite_steps": [],
      "notes": "Standard prep task, beginner-friendly",
      "confidence": 0.98
    },
    "generated_at": "2025-10-18T14:30:01.000Z",
    "model_used": "gpt-4o-mini",
    "confidence": 0.98
  }
]
```

---

## Migration Strategy

### Phase 1: Schema Migration (Week 1)

```typescript
// Script: scripts/apply-instruction-metadata-migration.ts

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function addInstructionMetadataColumn() {
  console.log('Adding instruction_metadata column...');

  await db.execute(sql`
    ALTER TABLE recipes
    ADD COLUMN IF NOT EXISTS instruction_metadata JSONB,
    ADD COLUMN IF NOT EXISTS instruction_metadata_version VARCHAR(20),
    ADD COLUMN IF NOT EXISTS instruction_metadata_generated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS instruction_metadata_model VARCHAR(100);
  `);

  console.log('Creating indexes...');

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_recipes_instruction_metadata
    ON recipes USING GIN (instruction_metadata);
  `);

  console.log('Migration complete!');
}

addInstructionMetadataColumn();
```

### Phase 2: Batch Classification (Weeks 2-3)

```typescript
// Script: scripts/classify-recipe-instructions.ts

import { db } from '@/lib/db';
import { recipes } from '@/lib/db/schema';
import { eq, isNull } from 'drizzle-orm';
import { buildBatchClassificationPrompt } from '@/lib/ai/instruction-classifier-prompt';
import { generateWithOpenRouter } from '@/lib/ai/openrouter-server';

async function classifyAllRecipes() {
  // Get recipes without classifications
  const unclassifiedRecipes = await db
    .select()
    .from(recipes)
    .where(isNull(recipes.instruction_metadata))
    .limit(100); // Process in batches

  for (const recipe of unclassifiedRecipes) {
    try {
      const instructions = JSON.parse(recipe.instructions) as string[];

      // Generate classification
      const prompt = buildBatchClassificationPrompt(instructions, {
        recipeName: recipe.name,
        cuisine: recipe.cuisine || undefined,
        difficulty: recipe.difficulty || undefined,
      });

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
        model: 'google/gemini-2.0-flash-exp:free',
        temperature: 0.1,
      });

      const classifications = JSON.parse(response);

      // Update recipe
      await db
        .update(recipes)
        .set({
          instruction_metadata: JSON.stringify(classifications),
          instruction_metadata_version: '1.0.0',
          instruction_metadata_generated_at: new Date(),
          instruction_metadata_model: 'google/gemini-2.0-flash-exp:free',
        })
        .where(eq(recipes.id, recipe.id));

      console.log(`✓ Classified recipe: ${recipe.name}`);
    } catch (error) {
      console.error(`✗ Failed to classify recipe ${recipe.id}:`, error);
    }
  }
}

classifyAllRecipes();
```

### Phase 3: Quality Review (Week 4)

```typescript
// Script: scripts/review-instruction-classifications.ts

async function reviewClassifications() {
  // Find low-confidence classifications
  const lowConfidence = await db.execute(sql`
    SELECT id, name, instruction_metadata
    FROM recipes
    WHERE instruction_metadata IS NOT NULL
    AND (instruction_metadata->0->>'confidence')::numeric < 0.8
    LIMIT 50;
  `);

  console.log(`Found ${lowConfidence.rows.length} recipes with low confidence`);

  // Export for manual review
  const fs = require('fs');
  fs.writeFileSync(
    'low-confidence-classifications.json',
    JSON.stringify(lowConfidence.rows, null, 2)
  );
}

reviewClassifications();
```

---

## Query Examples

### 1. Get Recipes by Technique

```typescript
// Find all recipes using "saute" technique
const sauteRecipes = await db.execute(sql`
  SELECT id, name
  FROM recipes
  WHERE instruction_metadata @> '[{"classification": {"technique": "saute"}}]'::jsonb;
`);
```

### 2. Get Recipes by Required Tool

```typescript
// Find recipes requiring a stand_mixer
const standMixerRecipes = await db.execute(sql`
  SELECT id, name
  FROM recipes
  WHERE instruction_metadata @> '[{"classification": {"tools": ["stand_mixer"]}}]'::jsonb;
`);
```

### 3. Get Beginner-Friendly Recipes

```typescript
// Recipes where ALL steps are beginner-level
const beginnerRecipes = await db.execute(sql`
  SELECT id, name
  FROM recipes
  WHERE instruction_metadata IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(instruction_metadata) elem
    WHERE elem->'classification'->>'skill_level_required' != 'beginner'
  );
`);
```

### 4. Get Total Prep Time by Skill Level

```typescript
// Calculate total estimated time for intermediate cooks
const recipeWithTime = await db.execute(sql`
  SELECT
    id,
    name,
    (
      SELECT SUM((elem->'classification'->'estimated_time_minutes'->>'intermediate')::integer)
      FROM jsonb_array_elements(instruction_metadata) elem
    ) as total_time_intermediate
  FROM recipes
  WHERE instruction_metadata IS NOT NULL
  AND id = '123';
`);
```

### 5. Get Equipment Checklist

```typescript
// Extract unique tools needed for a recipe
const equipmentList = await db.execute(sql`
  SELECT DISTINCT jsonb_array_elements_text(elem->'classification'->'tools') as tool
  FROM recipes,
       jsonb_array_elements(instruction_metadata) elem
  WHERE id = '123';
`);
```

### 6. Find Recipes with Oven Conflicts

```typescript
// Recipes with multiple oven steps (potential conflicts)
const ovenConflicts = await db.execute(sql`
  SELECT id, name,
    (
      SELECT COUNT(*)
      FROM jsonb_array_elements(instruction_metadata) elem
      WHERE elem->'classification'->'equipment_conflicts' @> '["oven"]'::jsonb
    ) as oven_steps
  FROM recipes
  WHERE instruction_metadata IS NOT NULL
  HAVING oven_steps > 1;
`);
```

### 7. Get Parallel vs. Sequential Steps

```typescript
// Count parallelizable steps
const parallelAnalysis = await db.execute(sql`
  SELECT
    id,
    name,
    (
      SELECT COUNT(*)
      FROM jsonb_array_elements(instruction_metadata) elem
      WHERE (elem->'classification'->>'can_parallelize')::boolean = true
    ) as parallel_steps,
    (
      SELECT COUNT(*)
      FROM jsonb_array_elements(instruction_metadata) elem
      WHERE (elem->'classification'->>'can_parallelize')::boolean = false
    ) as sequential_steps
  FROM recipes
  WHERE instruction_metadata IS NOT NULL;
`);
```

---

## Indexing Strategy

### Recommended Indexes

```sql
-- 1. GIN index for JSONB queries (contains, exists)
CREATE INDEX idx_recipes_instruction_metadata
ON recipes USING GIN (instruction_metadata);

-- 2. Index for recipes WITH classifications
CREATE INDEX idx_recipes_has_instruction_metadata
ON recipes (instruction_metadata)
WHERE instruction_metadata IS NOT NULL;

-- 3. Index for classification version
CREATE INDEX idx_recipes_instruction_version
ON recipes (instruction_metadata_version)
WHERE instruction_metadata_version IS NOT NULL;

-- 4. Index for model used
CREATE INDEX idx_recipes_instruction_model
ON recipes (instruction_metadata_model)
WHERE instruction_metadata_model IS NOT NULL;

-- 5. Partial index for low-confidence classifications (manual review)
CREATE INDEX idx_recipes_low_confidence
ON recipes ((instruction_metadata->0->>'confidence'))
WHERE (instruction_metadata->0->>'confidence')::numeric < 0.8;
```

### Query Performance Expectations

| Query Type                  | Expected Performance | Index Used               |
|-----------------------------|----------------------|--------------------------|
| Get recipe by ID            | <10ms                | Primary key              |
| Filter by technique         | <100ms               | GIN (instruction_metadata)|
| Filter by tool              | <100ms               | GIN (instruction_metadata)|
| Calculate total time        | <50ms                | None (in-memory)         |
| Find low-confidence         | <100ms               | idx_recipes_low_confidence|
| Count classified recipes    | <50ms                | idx_recipes_has_instruction_metadata|

---

## Storage Estimates

### Per-Recipe Storage

**Assumptions**:
- Average recipe: 8 instruction steps
- Each classification: ~500 bytes (JSON)
- Total per recipe: ~4 KB

**Database Size Impact**:
- 3,500 recipes × 4 KB = **14 MB**
- Negligible impact on database size

### JSONB vs. Normalized Storage

| Approach         | Storage per Recipe | Query Performance | Complexity |
|------------------|--------------------|-------------------|------------|
| JSONB (Option 1) | 4 KB               | Fast (GIN index)  | Low        |
| Normalized (Option 2) | 5-6 KB        | Slower (JOINs)    | High       |

**Conclusion**: JSONB is more efficient for this use case.

---

## Backup & Recovery

### Backup Strategy

```bash
# Export all instruction metadata to JSON file
psql -d DATABASE_URL -c "
  COPY (
    SELECT id, name, instruction_metadata
    FROM recipes
    WHERE instruction_metadata IS NOT NULL
  ) TO STDOUT CSV HEADER
" > instruction_metadata_backup.csv
```

### Restore Strategy

```typescript
// Re-populate from backup if needed
async function restoreFromBackup() {
  const backup = JSON.parse(fs.readFileSync('instruction_metadata_backup.json'));

  for (const item of backup) {
    await db
      .update(recipes)
      .set({ instruction_metadata: item.instruction_metadata })
      .where(eq(recipes.id, item.id));
  }
}
```

---

## Versioning Strategy

### Schema Version Field

The `instruction_metadata_version` field allows for schema evolution:

```typescript
const CURRENT_SCHEMA_VERSION = '1.0.0';

// When schema changes, increment version
const SCHEMA_VERSIONS = {
  '1.0.0': InstructionMetadataSchemaV1,
  '1.1.0': InstructionMetadataSchemaV1_1, // Future version
};

// Migration function
async function migrateMetadataSchema(from: string, to: string) {
  // Transform old schema to new schema
}
```

### Future Schema Changes

Potential future enhancements:
- Add `nutritional_impact` (calories burned per step)
- Add `difficulty_score` (0-100 scale)
- Add `sensory_cues` (what to look for: "golden brown", "soft peaks")
- Add `common_mistakes` (what to avoid)

---

## Performance Monitoring

### Metrics to Track

1. **Classification Coverage**: % of recipes with metadata
2. **Average Confidence**: Mean confidence score across all classifications
3. **Classification Time**: Time to classify one recipe
4. **Query Performance**: p95 latency for JSONB queries
5. **Storage Growth**: Size of instruction_metadata column

### Monitoring Queries

```sql
-- Classification coverage
SELECT
  COUNT(*) FILTER (WHERE instruction_metadata IS NOT NULL) * 100.0 / COUNT(*) as coverage_pct
FROM recipes;

-- Average confidence
SELECT AVG((metadata->>'confidence')::numeric) as avg_confidence
FROM recipes,
     jsonb_array_elements(instruction_metadata) metadata
WHERE instruction_metadata IS NOT NULL;

-- Low-confidence count
SELECT COUNT(*)
FROM recipes
WHERE instruction_metadata IS NOT NULL
AND (instruction_metadata->0->>'confidence')::numeric < 0.8;
```

---

## Related Documents

- `INSTRUCTION_CLASSIFICATION_TAXONOMY.md` - Classification system design
- `INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md` - Cost analysis
- `INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md` - Implementation roadmap
- `src/types/instruction-metadata.ts` - TypeScript definitions
