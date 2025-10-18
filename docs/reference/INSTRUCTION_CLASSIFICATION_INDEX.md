# Recipe Instruction Classification - Documentation Index

**Quick Navigation for the Complete Classification System Design**

---

## Overview

This index provides quick access to all documentation for the AI-powered recipe instruction classification system.

**Status**: ✅ Design Complete - Ready for Implementation
**Timeline**: 4 weeks
**Budget**: $5-10

---

## Core Documentation

### 🎯 Start Here

1. **[INSTRUCTION_CLASSIFICATION_SUMMARY.md](../../INSTRUCTION_CLASSIFICATION_SUMMARY.md)**
   - Executive summary of entire system
   - Quick overview of all components
   - Success criteria and next steps
   - **Read this first!**

### 📚 Design Documents

2. **[INSTRUCTION_CLASSIFICATION_TAXONOMY.md](./INSTRUCTION_CLASSIFICATION_TAXONOMY.md)**
   - Complete classification system
   - Work types, techniques, tools, roles
   - Skill levels and time multipliers
   - Examples and edge cases
   - **Reference**: 100+ techniques, 80+ tools, 20+ roles

3. **[INSTRUCTION_METADATA_SCHEMA.md](./INSTRUCTION_METADATA_SCHEMA.md)**
   - Database schema design
   - JSONB structure specification
   - Migration strategy
   - Query examples
   - Indexing and performance
   - **Technical**: Database architecture

4. **[INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md](./INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md)**
   - LLM pricing comparison
   - Cost per recipe calculations
   - Batch processing optimization
   - ROI analysis
   - Budget allocation
   - **Financial**: Cost planning

### 🛠️ Implementation Resources

5. **[INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md](../guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md)**
   - 4-week implementation roadmap
   - Phase-by-phase breakdown
   - Code examples and scripts
   - Quality assurance procedures
   - UI integration examples
   - **Practical**: Step-by-step guide

6. **[instruction-metadata.ts](../../src/types/instruction-metadata.ts)**
   - TypeScript type definitions
   - Zod validation schemas
   - Helper functions
   - Constants and labels
   - **Code**: Type system

7. **[instruction-classifier-prompt.ts](../../src/lib/ai/instruction-classifier-prompt.ts)**
   - LLM prompt templates
   - Response parsing
   - Validation logic
   - Batch processing support
   - **Code**: AI integration

---

## Quick Reference by Role

### For Product Managers

**Essential Reading**:
1. [INSTRUCTION_CLASSIFICATION_SUMMARY.md](../../INSTRUCTION_CLASSIFICATION_SUMMARY.md) - Full overview
2. [INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md](./INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md) - Budget and ROI

**Key Sections**:
- Success criteria
- User-facing features
- Timeline and milestones
- Risk analysis

### For Developers

**Essential Reading**:
1. [INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md](../guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md) - Implementation guide
2. [INSTRUCTION_METADATA_SCHEMA.md](./INSTRUCTION_METADATA_SCHEMA.md) - Database design
3. [instruction-metadata.ts](../../src/types/instruction-metadata.ts) - Type definitions
4. [instruction-classifier-prompt.ts](../../src/lib/ai/instruction-classifier-prompt.ts) - AI prompt system

**Key Sections**:
- Phase 1: Database migration
- Phase 2: Classification engine
- Code examples
- Testing procedures

### For Data Scientists / ML Engineers

**Essential Reading**:
1. [INSTRUCTION_CLASSIFICATION_TAXONOMY.md](./INSTRUCTION_CLASSIFICATION_TAXONOMY.md) - Classification system
2. [instruction-classifier-prompt.ts](../../src/lib/ai/instruction-classifier-prompt.ts) - Prompt engineering
3. [INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md](./INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md) - Model comparison

**Key Sections**:
- Prompt templates
- Validation strategies
- Quality assurance
- Model selection criteria

### For Designers / UX

**Essential Reading**:
1. [INSTRUCTION_CLASSIFICATION_SUMMARY.md](../../INSTRUCTION_CLASSIFICATION_SUMMARY.md) - System overview
2. [INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md](../guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md) - UI integration

**Key Sections**:
- Phase 4: UI integration
- Enhanced meal prep timeline
- Equipment checklist
- Skill level indicators

---

## Documentation by Topic

### Classification System Design

| Topic                  | Document                                        | Section              |
|------------------------|-------------------------------------------------|----------------------|
| Work Types             | INSTRUCTION_CLASSIFICATION_TAXONOMY.md          | Work Types           |
| Cooking Techniques     | INSTRUCTION_CLASSIFICATION_TAXONOMY.md          | Cooking Techniques   |
| Tools & Equipment      | INSTRUCTION_CLASSIFICATION_TAXONOMY.md          | Tools & Equipment    |
| Kitchen Roles          | INSTRUCTION_CLASSIFICATION_TAXONOMY.md          | Kitchen Roles        |
| Skill Levels           | INSTRUCTION_CLASSIFICATION_TAXONOMY.md          | Skill Levels         |
| Time Estimation        | INSTRUCTION_CLASSIFICATION_TAXONOMY.md          | Skill Level Time Adjustments |

### Technical Architecture

| Topic                  | Document                                        | Section              |
|------------------------|-------------------------------------------------|----------------------|
| Database Schema        | INSTRUCTION_METADATA_SCHEMA.md                  | Database Schema Design |
| JSONB Structure        | INSTRUCTION_METADATA_SCHEMA.md                  | JSONB Structure      |
| Indexes                | INSTRUCTION_METADATA_SCHEMA.md                  | Indexing Strategy    |
| Queries                | INSTRUCTION_METADATA_SCHEMA.md                  | Query Examples       |
| Migration              | INSTRUCTION_METADATA_SCHEMA.md                  | Migration Strategy   |
| TypeScript Types       | instruction-metadata.ts                         | Type Exports         |
| Validation             | instruction-metadata.ts                         | Zod Schemas          |

### Implementation Details

| Topic                  | Document                                        | Section              |
|------------------------|-------------------------------------------------|----------------------|
| Week 1 Tasks           | INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md    | Phase 1: Foundation  |
| Week 2 Tasks           | INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md    | Phase 2: Classification Engine |
| Week 3 Tasks           | INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md    | Phase 3: Batch Processing |
| Week 4 Tasks           | INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md    | Phase 4: UI Integration |
| Quality Assurance      | INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md    | Quality Assurance    |
| Monitoring             | INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md    | Monitoring & Maintenance |
| Rollback Plan          | INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md    | Rollback Plan        |

### Cost & Budget

| Topic                  | Document                                        | Section              |
|------------------------|-------------------------------------------------|----------------------|
| LLM Comparison         | INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md     | LLM Comparison       |
| Cost Breakdown         | INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md     | Cost Breakdown       |
| Budget Allocation      | INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md     | Budget Allocation    |
| ROI Analysis           | INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md     | ROI Analysis         |
| Risk Analysis          | INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md     | Risk Analysis        |

---

## Key Concepts

### Classification Workflow

```
Recipe Instructions
    ↓
Classification Service (LLM)
    ↓
InstructionMetadata (JSONB)
    ↓
Database Storage
    ↓
Application Features
```

### Data Structure

```typescript
InstructionMetadata {
  step_index: number
  step_text: string
  classification: {
    work_type: "prep" | "cook" | "setup" | ...
    technique: "dice" | "saute" | "roast" | ...
    tools: ["chef_knife", "skillet", ...]
    roles: ["prep_cook", "saucier", ...]
    estimated_time_minutes: {
      beginner: number
      intermediate: number
      advanced: number
    }
    can_parallelize: boolean
    requires_attention: boolean
    ...
  }
  generated_at: timestamp
  model_used: string
  confidence: number
}
```

### Cost Model

- **Per Recipe**: $0.0006 (Gemini Flash)
- **3,500 Recipes**: ~$2.00
- **Ongoing**: ~$10/year
- **Timeline**: 2-3 weeks

---

## Code Examples

### Classify a Recipe

```typescript
import { classifyRecipeInstructions } from '@/lib/ai/instruction-classifier';

const metadata = await classifyRecipeInstructions(
  recipe.instructions,
  {
    recipeName: recipe.name,
    cuisine: recipe.cuisine,
    difficulty: recipe.difficulty,
  }
);
```

### Query by Technique

```sql
SELECT id, name
FROM recipes
WHERE instruction_metadata @> '[{"classification": {"technique": "saute"}}]'::jsonb;
```

### Calculate Total Time

```typescript
import { calculateTotalTime } from '@/types/instruction-metadata';

const totalTime = calculateTotalTime(metadata, 'intermediate');
```

### Get Equipment List

```typescript
import { getRequiredTools } from '@/types/instruction-metadata';

const tools = getRequiredTools(metadata);
```

---

## FAQs

### General Questions

**Q: What is instruction classification?**
A: AI-powered analysis of recipe steps to extract structured metadata (work types, techniques, tools, time estimates).

**Q: Why is this useful?**
A: Enables skill-based time estimates, equipment planning, parallel task detection, and enhanced meal prep timelines.

**Q: How much does it cost?**
A: ~$2 one-time for 3,500 recipes, ~$10/year for ongoing classification.

### Technical Questions

**Q: Which LLM should we use?**
A: Google Gemini 2.0 Flash (primary), GPT-4o-mini (backup). See [Cost Analysis](./INSTRUCTION_CLASSIFICATION_COST_ANALYSIS.md).

**Q: How is metadata stored?**
A: JSONB column on `recipes` table. See [Schema Design](./INSTRUCTION_METADATA_SCHEMA.md).

**Q: How accurate is classification?**
A: Target 85%+ confidence. Manual review for low-confidence items. See [Quality Assurance](../guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md#quality-assurance).

### Implementation Questions

**Q: How long will implementation take?**
A: 4 weeks (1 week per phase). See [Implementation Guide](../guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md).

**Q: What if something goes wrong?**
A: Comprehensive rollback plan included. See [Rollback Plan](../guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md#rollback-plan).

**Q: Can we add new techniques later?**
A: Yes! Schema versioning supports evolution. See [Versioning Strategy](./INSTRUCTION_METADATA_SCHEMA.md#versioning-strategy).

---

## Success Criteria Checklist

- [ ] Phase 1: Database migration complete
- [ ] Phase 1: Classification service working
- [ ] Phase 1: Test recipe classified successfully
- [ ] Phase 2: Batch processor handles 100 recipes
- [ ] Phase 2: Average confidence > 0.85
- [ ] Phase 3: 95%+ recipes classified
- [ ] Phase 3: Total cost < $10
- [ ] Phase 4: Enhanced timeline working
- [ ] Phase 4: Equipment checklist functional
- [ ] All: User feedback positive

---

## Version History

| Version | Date       | Changes                               |
|---------|------------|---------------------------------------|
| 1.0.0   | 2025-10-18 | Initial design documentation complete |

---

## Related Project Documentation

- [PROJECT_ORGANIZATION.md](./PROJECT_ORGANIZATION.md) - Overall project structure
- [AUTHENTICATION_GUIDE.md](../guides/AUTHENTICATION_GUIDE.md) - Auth setup
- [MOBILE_PARITY_REQUIREMENTS.md](../guides/MOBILE_PARITY_REQUIREMENTS.md) - Current priority

---

**Questions?** Review the [Summary Document](../../INSTRUCTION_CLASSIFICATION_SUMMARY.md) or [Implementation Guide](../guides/INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md).
