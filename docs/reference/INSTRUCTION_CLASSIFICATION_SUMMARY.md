# Recipe Instruction Classification System - Design Summary

**Project**: Recipe Manager - AI-Powered Instruction Analysis
**Version**: 1.0.0
**Date**: 2025-10-18
**Status**: Design Complete - Ready for Implementation

---

## Executive Summary

This document summarizes the complete design for an AI-powered recipe instruction classification system. The system analyzes individual cooking steps to extract structured metadata including work types, techniques, tools, time estimates, and parallelization opportunities.

**Key Benefits**:
- 🎯 Accurate time estimates by skill level (beginner/intermediate/advanced)
- 🔧 Equipment checklist generation
- ⚡ Parallel task detection for efficient meal prep
- 🏆 Enhanced meal preparation timeline
- 📊 Recipe difficulty scoring

**Implementation Timeline**: 4 weeks
**Total Cost**: $5-10 (one-time) + $10/year (ongoing)
**Risk Level**: Low

---

## Design Documents Overview

### 1. Classification Taxonomy
**File**: `docs/reference/INSTRUCTION_CLASSIFICATION_TAXONOMY.md`

**Contents**:
- ✅ Comprehensive work type enums (12 types: prep, cook, setup, rest, assemble, clean, marinate, mix, monitor, serve, chill, strain)
- ✅ Cooking techniques library (60+ techniques: dice, mince, saute, roast, braise, etc.)
- ✅ Tools & equipment catalog (80+ items categorized by type)
- ✅ Kitchen roles (brigade system: prep_cook, saucier, rotisseur, patissier, etc.)
- ✅ Skill levels (beginner, intermediate, advanced)
- ✅ Classification examples with confidence scores
- ✅ Edge case handling strategies

**Key Decisions**:
- Work types categorize **nature of activity** (what you're doing)
- Techniques specify **culinary method** (how you're doing it)
- Tools are **inferred** even when not explicitly mentioned
- Time estimates use **skill multipliers** (2.0x for beginners, 1.3x for intermediate)

### 2. LLM Prompt System
**File**: `src/lib/ai/instruction-classifier-prompt.ts`

**Contents**:
- ✅ System prompt for LLM classification
- ✅ User prompt template with recipe context
- ✅ Batch classification support (8 steps at once)
- ✅ Response parsing and validation
- ✅ Confidence scoring guidelines
- ✅ Example inputs/outputs

**Key Features**:
- Optimized for inexpensive models (Gemini Flash, GPT-4o-mini)
- Structured JSON output with Zod validation
- Temperature: 0.1 (low for consistency)
- Batch processing for 40% cost reduction

### 3. TypeScript Type Definitions
**File**: `src/types/instruction-metadata.ts`

**Contents**:
- ✅ Zod schemas for all enums and interfaces
- ✅ InstructionClassification interface
- ✅ InstructionMetadata interface (with provenance)
- ✅ Helper functions (time calculation, parallel detection, etc.)
- ✅ Validation functions
- ✅ Constants and labels for UI

**Key Types**:
```typescript
interface InstructionMetadata {
  step_index: number;
  step_text: string;
  classification: InstructionClassification;
  generated_at: string;
  model_used: string;
  confidence: number;
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
  temperature: Temperature | null;
  equipment_conflicts: Tool[];
  prerequisite_steps: number[];
  notes?: string;
  confidence: number;
}
```

### 4. Storage Schema Design
**File**: `docs/reference/INSTRUCTION_METADATA_SCHEMA.md`

**Contents**:
- ✅ Database migration plan (JSONB column on recipes table)
- ✅ JSONB structure specification
- ✅ Indexing strategy (GIN indexes for JSONB queries)
- ✅ Query examples (filter by technique, tool, skill level)
- ✅ Storage estimates (~14 MB for 3,500 recipes)
- ✅ Backup and versioning strategy

**Key Decisions**:
- **JSONB column** on `recipes` table (vs. separate table)
- Schema versioning field for future evolution
- GIN indexes for efficient JSONB queries
- Provenance tracking (model used, generation timestamp)

**Schema Addition**:
```typescript
// Add to recipes table
instruction_metadata: text('instruction_metadata'), // JSONB
instruction_metadata_version: varchar('instruction_metadata_version', { length: 20 }),
instruction_metadata_generated_at: timestamp('instruction_metadata_generated_at'),
instruction_metadata_model: varchar('instruction_metadata_model', { length: 100 }),
```

### 5. Cost Analysis Report
**File**: `docs/reference/INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md`

**Contents**:
- ✅ LLM pricing comparison (Gemini Flash, GPT-4o-mini, Claude Haiku)
- ✅ Cost breakdown per recipe and total
- ✅ Batch processing optimization (40% savings)
- ✅ Free tier exploitation strategy
- ✅ ROI analysis (4000% first-month ROI)
- ✅ Risk mitigation strategies

**Cost Summary**:

| Model             | Cost/Recipe | Total (3500) | Recommendation |
|-------------------|-------------|--------------|----------------|
| Gemini Flash      | $0.0006     | **$2.00**    | ✅ PRIMARY      |
| GPT-4o-mini       | $0.0011     | $4.00        | Backup         |
| Claude Haiku      | $0.0023     | $8.00        | Backup         |

**Timeline**: 2-3 weeks with rate-limited batch processing

### 6. Implementation Roadmap
**File**: `docs/guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md`

**Contents**:
- ✅ Phase-by-phase implementation plan (4 weeks)
- ✅ Database migration scripts
- ✅ Classification service code
- ✅ Batch processing scripts
- ✅ Quality assurance procedures
- ✅ UI integration examples
- ✅ Rollback plan

**Implementation Phases**:

| Phase | Duration | Goal                                    |
|-------|----------|-----------------------------------------|
| 1     | Week 1   | Foundation (schema, core service)       |
| 2     | Week 2   | Classification engine & testing         |
| 3     | Week 3   | Batch process all 3,500 recipes         |
| 4     | Week 4   | UI integration (timeline, checklist)    |

---

## System Architecture

### Data Flow

```
Recipe Instructions (JSON array)
        ↓
[Classification Service]
    - Build prompt with recipe context
    - Call OpenRouter API (Gemini Flash)
    - Parse JSON response
    - Validate with Zod schemas
        ↓
InstructionMetadata[] (JSONB)
        ↓
Database (recipes.instruction_metadata)
        ↓
[Application Features]
    - Enhanced meal prep timeline
    - Equipment checklist
    - Skill level indicators
    - Parallel task suggestions
```

### Key Components

```typescript
// 1. Classification Service
src/lib/ai/instruction-classifier.ts
  ├── classifyInstruction()         // Single step
  ├── classifyRecipeInstructions()  // Batch (8 steps)
  └── estimateClassificationCost()  // Cost estimation

// 2. Server Action
src/app/actions/classify-instructions.ts
  └── classifyRecipe()  // Classify and save to DB

// 3. Batch Processor
scripts/classify-all-recipes.ts
  ├── Rate-limited queue (15 RPM)
  ├── Error handling & retries
  └── Cost tracking

// 4. UI Components
src/components/meals/
  ├── EnhancedMealPrepTimeline.tsx  // Timeline with metadata
  ├── EquipmentChecklist.tsx        // Tool checklist
  └── SkillLevelBadge.tsx           // Difficulty indicator
```

---

## Integration with Existing Features

### Enhanced Meal Prep Timeline

**Current State** (90% complete):
- Timeline generation from recipes in a meal
- Equipment conflict detection (basic)
- Parallel task suggestions (basic)

**Enhanced with Classifications**:
- ✅ Skill-specific time estimates
- ✅ Accurate tool identification
- ✅ Better parallelization logic
- ✅ Step-by-step breakdown with work types
- ✅ Confidence indicators

**Example Enhancement**:
```typescript
// BEFORE: Simple time calculation
const totalTime = recipe.prep_time + recipe.cook_time;

// AFTER: Skill-specific, step-by-step
const metadata = JSON.parse(recipe.instruction_metadata);
const totalTime = calculateTotalTime(metadata, userSkillLevel);
const parallelSteps = getParallelSteps(metadata);
const equipmentNeeded = getRequiredTools(metadata);
```

### New Features Enabled

1. **Equipment Planning**
   - Generate shopping lists for kitchen tools
   - Warn users if specialized equipment required
   - Suggest alternatives

2. **Skill Progression**
   - Track which techniques users have mastered
   - Suggest recipes to build skills
   - Personalized difficulty ratings

3. **Smart Search**
   - Filter by technique ("show me all recipes using 'braise'")
   - Filter by available equipment ("recipes I can make with just a skillet")
   - Filter by skill level ("show me beginner-friendly pasta recipes")

4. **Time Optimization**
   - Identify recipes with high parallelization potential
   - Suggest prep-ahead steps
   - Optimize meal prep schedules

---

## Quality Assurance Strategy

### Automated Validation

```typescript
// Validation checks performed on every classification
validateClassification(classification) {
  ✓ Work type is valid enum
  ✓ Skill level is valid enum
  ✓ Time estimates: beginner ≥ intermediate ≥ advanced
  ✓ Time estimates are positive
  ✓ Confidence is between 0.0 and 1.0
  ✓ Tools and roles are arrays
}
```

### Manual Review Process

1. **Sample Review** (50 recipes):
   - Verify time estimates match reality
   - Check tool detection accuracy
   - Validate technique classification

2. **Low-Confidence Review**:
   - Flag classifications with confidence < 0.8
   - Manually review and potentially re-classify
   - Adjust prompts based on errors

3. **User Feedback Loop**:
   - Allow users to report inaccurate time estimates
   - Track user corrections
   - Retrain/refine over time

---

## Success Metrics

### Phase 1 Success Criteria (Week 1)
- ✅ Database migration successful
- ✅ Classification service working
- ✅ Test recipe classified with 0.85+ confidence
- ✅ Time estimates reasonable (±20% of expected)

### Phase 2 Success Criteria (Week 2)
- ✅ Batch processor handles 100 recipes without errors
- ✅ Average confidence > 0.85
- ✅ Cost tracking accurate
- ✅ Error rate < 5%

### Phase 3 Success Criteria (Week 3)
- ✅ 95%+ recipes classified
- ✅ Total cost < $10
- ✅ Manual review of 50 recipes passes quality check
- ✅ Low-confidence recipes identified for review

### Phase 4 Success Criteria (Week 4)
- ✅ Enhanced timeline displays metadata
- ✅ Equipment checklist functional
- ✅ Skill level badges display correctly
- ✅ User feedback mechanism in place

---

## Risk Mitigation

| Risk                      | Probability | Impact | Mitigation                          |
|---------------------------|-------------|--------|-------------------------------------|
| Rate limits hit           | High        | Medium | Queue system, exponential backoff   |
| Poor classification       | Medium      | High   | Manual review, confidence threshold |
| Cost overrun              | Low         | Low    | Free tier exploitation, monitoring  |
| Schema needs changes      | Medium      | Medium | Versioning, extensible design       |
| LLM API downtime          | Low         | Medium | Retry logic, multiple model support |

---

## Future Enhancements

### Phase 2 Features (Post-Launch)

1. **Nutritional Impact**
   - Calories burned per cooking step
   - Energy expenditure tracking

2. **Sensory Cues**
   - Extract visual cues ("golden brown", "soft peaks")
   - Audio cues ("sizzling", "bubbling")
   - Texture cues ("tender", "crispy")

3. **Common Mistakes**
   - Identify pitfalls in instructions
   - Provide tips to avoid errors
   - Link to educational content

4. **Video Integration**
   - Map techniques to video tutorials
   - Generate timestamps for recipe videos
   - Link to technique demonstrations

### Advanced Analytics

1. **Recipe Complexity Scoring**
   - Calculate difficulty based on techniques
   - Identify bottlenecks in workflow
   - Suggest simplifications

2. **Personalized Time Estimates**
   - Learn user's actual cooking speed
   - Adjust estimates based on history
   - Provide personalized schedules

3. **Kitchen Optimization**
   - Analyze equipment usage patterns
   - Suggest optimal kitchen layout
   - Identify missing essential tools

---

## Documentation Index

All design documents are complete and ready for implementation:

1. **Taxonomy Reference**
   - `docs/reference/INSTRUCTION_CLASSIFICATION_TAXONOMY.md`
   - Comprehensive classification system with examples

2. **Storage Schema**
   - `docs/reference/INSTRUCTION_METADATA_SCHEMA.md`
   - Database design and query examples

3. **Cost Analysis**
   - `docs/reference/INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md`
   - LLM comparison and budget planning

4. **Implementation Guide**
   - `docs/guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md`
   - Step-by-step implementation roadmap

5. **Type Definitions**
   - `src/types/instruction-metadata.ts`
   - TypeScript interfaces and Zod schemas

6. **Prompt Template**
   - `src/lib/ai/instruction-classifier-prompt.ts`
   - LLM prompts and response parsing

---

## Next Steps

### Immediate Actions

1. **Review Design Documents**
   - Read all 6 documents
   - Verify design meets requirements
   - Identify any gaps or questions

2. **Approve Budget**
   - Confirm $5-10 budget for classification
   - Set up OpenRouter API access
   - Configure spending limits

3. **Schedule Implementation**
   - Allocate 4 weeks for implementation
   - Assign development resources
   - Set milestone dates

### Implementation Kickoff

1. **Week 1**: Database migration and core service
2. **Week 2**: Classification engine and testing
3. **Week 3**: Batch process all recipes
4. **Week 4**: UI integration and launch

---

## Questions & Answers

**Q: Why JSONB instead of a separate table?**
A: Simpler schema, faster queries (no JOINs), lower storage overhead. JSONB is perfect for semi-structured metadata that evolves over time.

**Q: Why Gemini Flash instead of GPT-4?**
A: Cost efficiency. Gemini Flash is 10x cheaper with comparable quality for structured output tasks. We can upgrade to GPT-4 if quality is insufficient.

**Q: What if classifications are inaccurate?**
A: We have multiple safety nets: confidence scores, manual review of low-confidence items, user feedback mechanism, and ability to re-classify with different models.

**Q: How do we handle recipe updates?**
A: If instructions change, we detect it and re-classify. The `instruction_metadata_generated_at` timestamp helps track staleness.

**Q: Can we add new work types or techniques later?**
A: Yes! The schema versioning system (`instruction_metadata_version`) allows us to evolve the taxonomy. We can migrate old classifications to new schemas.

**Q: How much does ongoing classification cost?**
A: ~$10/year for 100 new recipes per week. Extremely affordable for continuous operation.

---

## Conclusion

This comprehensive design provides a complete blueprint for implementing AI-powered recipe instruction classification. The system is:

- ✅ **Cost-Effective**: $5-10 one-time, $10/year ongoing
- ✅ **High-Quality**: 85%+ confidence, validated classifications
- ✅ **Extensible**: Versioned schema, supports future enhancements
- ✅ **Well-Documented**: 6 comprehensive design documents
- ✅ **Low-Risk**: Rollback plan, quality assurance, budget controls
- ✅ **User-Focused**: Enhances existing features, enables new capabilities

**Status**: Ready for implementation approval and kickoff.

---

**Document Version**: 1.0.0
**Last Updated**: 2025-10-18
**Next Review**: After Phase 1 completion
