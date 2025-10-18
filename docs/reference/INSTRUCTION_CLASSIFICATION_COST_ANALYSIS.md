# Instruction Classification Cost Analysis

**Version**: 1.0.0
**Last Updated**: 2025-10-18
**Status**: Design Phase

---

## Executive Summary

**Objective**: Classify ~28,000 recipe instruction steps across 3,500 recipes using AI.

**Recommended Model**: **Google Gemini 2.0 Flash** (free tier)

**Estimated Total Cost**: **$21 - $35** (one-time)

**Cost per Recipe**: **$0.006 - $0.01**

**Timeline**: 2-3 weeks of batch processing

---

## Table of Contents

1. [Scope & Assumptions](#scope--assumptions)
2. [LLM Comparison](#llm-comparison)
3. [Cost Breakdown](#cost-breakdown)
4. [Batch Processing Strategy](#batch-processing-strategy)
5. [Budget Allocation](#budget-allocation)
6. [Risk Analysis](#risk-analysis)
7. [Optimization Strategies](#optimization-strategies)

---

## Scope & Assumptions

### Current Recipe Database

- **Total Recipes**: ~3,500
- **Average Instructions per Recipe**: 8 steps
- **Total Steps to Classify**: ~28,000
- **New Recipes per Week**: ~50-100 (ongoing classification needed)

### Token Estimates

#### Per Instruction Classification

| Component           | Tokens | Notes                              |
|---------------------|--------|------------------------------------|
| System Prompt       | 200    | Fixed instructions                 |
| User Prompt         | 150    | Instruction + context              |
| Response (JSON)     | 200    | Structured classification          |
| **Total per Step**  | **550**| ~350 input, ~200 output            |

#### Batch Classification (8 steps)

| Component           | Tokens | Notes                              |
|---------------------|--------|------------------------------------|
| System Prompt       | 200    | Fixed instructions                 |
| User Prompt         | 800    | 8 instructions + context           |
| Response (JSON)     | 1600   | 8 classifications                  |
| **Total per Recipe**| **2600**| ~1000 input, ~1600 output         |

**Optimization**: Batch processing is **40% more efficient** than individual steps.

---

## LLM Comparison

### Option 1: Google Gemini 2.0 Flash (RECOMMENDED)

**Pricing**:
- Input: $0.075 / 1M tokens
- Output: $0.30 / 1M tokens
- **Free Tier**: 15 RPM, 1M TPM, 1500 RPD

**Cost Calculation** (Batch):
```
Input:  1000 tokens × 3500 recipes = 3.5M tokens × $0.075/1M = $0.26
Output: 1600 tokens × 3500 recipes = 5.6M tokens × $0.30/1M  = $1.68
Total: $1.94
```

**With Free Tier**:
- **First ~1000 recipes**: FREE (within free tier limits)
- **Remaining ~2500 recipes**: $1.94
- **Total Cost**: **~$2.00**

**Advantages**:
- ✅ Cheapest option
- ✅ Fast inference (low latency)
- ✅ Good structured output support
- ✅ Generous free tier

**Disadvantages**:
- ⚠️ Rate limits (15 RPM)
- ⚠️ Newer model (less proven)

---

### Option 2: GPT-4o-mini (BACKUP)

**Pricing**:
- Input: $0.15 / 1M tokens
- Output: $0.60 / 1M tokens

**Cost Calculation** (Batch):
```
Input:  1000 tokens × 3500 recipes = 3.5M tokens × $0.15/1M = $0.53
Output: 1600 tokens × 3500 recipes = 5.6M tokens × $0.60/1M  = $3.36
Total: $3.89
```

**Total Cost**: **~$4.00**

**Advantages**:
- ✅ Excellent structured output (JSON mode)
- ✅ High reliability
- ✅ Well-documented

**Disadvantages**:
- ⚠️ 2x more expensive than Gemini
- ⚠️ No free tier

---

### Option 3: Claude 3.5 Haiku (BACKUP)

**Pricing**:
- Input: $0.25 / 1M tokens
- Output: $1.25 / 1M tokens

**Cost Calculation** (Batch):
```
Input:  1000 tokens × 3500 recipes = 3.5M tokens × $0.25/1M = $0.88
Output: 1600 tokens × 3500 recipes = 5.6M tokens × $1.25/1M = $7.00
Total: $7.88
```

**Total Cost**: **~$8.00**

**Advantages**:
- ✅ High-quality classifications
- ✅ Good reasoning ability
- ✅ Strong context understanding

**Disadvantages**:
- ⚠️ 4x more expensive than Gemini
- ⚠️ Slower inference

---

### Option 4: Local LLM (Llama 3.1 8B)

**Pricing**: Free (self-hosted)

**Infrastructure Costs**:
- GPU instance (A10G or similar): ~$1.50/hour
- Estimated processing time: ~10 hours
- **Total Infrastructure**: $15

**Advantages**:
- ✅ No per-token costs
- ✅ No rate limits
- ✅ Complete control

**Disadvantages**:
- ⚠️ Requires infrastructure setup
- ⚠️ Lower quality than commercial models
- ⚠️ Need to validate accuracy

**Conclusion**: Not cost-effective for one-time classification.

---

## Cost Breakdown

### One-Time Classification (3,500 Recipes)

| Model               | Cost per Recipe | Total Cost | Timeline   |
|---------------------|----------------|------------|------------|
| Gemini 2.0 Flash    | $0.0006        | **$2.00**  | 2 weeks    |
| GPT-4o-mini         | $0.0011        | **$4.00**  | 1 week     |
| Claude 3.5 Haiku    | $0.0023        | **$8.00**  | 1 week     |
| Local LLM           | $0.0043        | **$15.00** | 2 days     |

### Ongoing Classification (100 Recipes/Week)

| Model               | Cost per Week | Cost per Year |
|---------------------|---------------|---------------|
| Gemini 2.0 Flash    | $0.06         | **$3.00**     |
| GPT-4o-mini         | $0.11         | **$6.00**     |
| Claude 3.5 Haiku    | $0.23         | **$12.00**    |

### Total First Year Cost

| Model               | Initial + 1 Year | Notes                    |
|---------------------|------------------|--------------------------|
| Gemini 2.0 Flash    | **$5.00**        | Best value               |
| GPT-4o-mini         | **$10.00**       | Good reliability         |
| Claude 3.5 Haiku    | **$20.00**       | Premium quality          |

---

## Batch Processing Strategy

### Recommended Approach: Hybrid Batching

**Phase 1: Free Tier Exploitation** (Days 1-3)
- Process 1000 recipes using Gemini Free Tier
- 15 requests/minute × 60 minutes × 8 hours = ~7200 requests/day
- Coverage: ~1000 recipes (limited by RPD)

**Phase 2: Paid Processing** (Days 4-14)
- Process remaining 2500 recipes
- Rate: 250 recipes/day (respecting rate limits)
- Cost: $2.00

**Total Timeline**: 14 days
**Total Cost**: $2.00

### Batch Size Optimization

```typescript
// Optimal batch configuration
const BATCH_CONFIG = {
  model: 'google/gemini-2.0-flash-exp:free',
  batchSize: 8, // instructions per batch
  requestsPerMinute: 15, // Free tier limit
  requestsPerDay: 1500, // Free tier limit
  retryAttempts: 3,
  retryDelay: 2000, // ms
};

// Process in waves to respect rate limits
async function processBatch(recipes: Recipe[]) {
  const queue = new PQueue({
    concurrency: 1,
    interval: 60000, // 1 minute
    intervalCap: 15, // 15 requests per minute
  });

  for (const recipe of recipes) {
    await queue.add(async () => {
      const classification = await classifyRecipe(recipe);
      await saveClassification(recipe.id, classification);
    });
  }
}
```

---

## Budget Allocation

### Recommended Budget: $50

| Category                  | Allocation | Notes                          |
|---------------------------|------------|--------------------------------|
| Initial Classification    | $5         | 3500 recipes                   |
| Quality Review            | $5         | Re-classify low-confidence     |
| Ongoing Classification    | $10/year   | New recipes                    |
| Model Testing             | $10        | A/B test different models      |
| Error Handling            | $5         | Retries, edge cases            |
| Buffer (20%)              | $10        | Unexpected costs               |
| **Total Year 1**          | **$45**    |                                |

---

## Risk Analysis

### Risk 1: Rate Limits

**Probability**: High
**Impact**: Moderate (delays processing)

**Mitigation**:
- Implement exponential backoff
- Use queue system (Bull, BullMQ)
- Spread processing over multiple days
- Monitor API quotas in real-time

### Risk 2: Poor Classification Quality

**Probability**: Moderate
**Impact**: High (requires re-classification)

**Mitigation**:
- Sample and manually review 100 classifications
- Set confidence threshold (0.8+)
- Flag low-confidence for manual review
- Use multiple models for validation

### Risk 3: Schema Changes

**Probability**: Low
**Impact**: Moderate (requires re-classification)

**Mitigation**:
- Version metadata schema
- Store raw LLM responses for re-processing
- Design schema to be extensible

### Risk 4: Cost Overruns

**Probability**: Low
**Impact**: Low (max $50)

**Mitigation**:
- Set hard spending limits in OpenRouter
- Monitor costs daily
- Use free tier maximally
- Cache all classifications

---

## Optimization Strategies

### 1. Prompt Optimization

**Current Prompt**: ~350 tokens
**Optimized Prompt**: ~250 tokens (30% reduction)

**Savings**: $0.30 per 3500 recipes

**Technique**:
- Remove verbose examples
- Use abbreviated field names
- Compress system instructions

### 2. Caching Strategy

**Implementation**:
```typescript
const classificationCache = new Map<string, InstructionClassification>();

async function classifyWithCache(instruction: string) {
  const hash = crypto.createHash('sha256').update(instruction).digest('hex');

  if (classificationCache.has(hash)) {
    return classificationCache.get(hash);
  }

  const classification = await classifyInstruction(instruction);
  classificationCache.set(hash, classification);

  return classification;
}
```

**Savings**: Avoid re-classifying identical instructions (5-10% reduction)

### 3. Incremental Classification

**Strategy**: Only classify recipes without metadata

```typescript
async function classifyUnclassified() {
  const recipes = await db
    .select()
    .from(recipes)
    .where(isNull(recipes.instruction_metadata));

  // Process only new recipes
}
```

**Savings**: Avoid duplicate work

### 4. Parallel Processing

**Strategy**: Use multiple API keys for higher throughput

```typescript
const apiKeys = [KEY_1, KEY_2, KEY_3];

async function classifyParallel(recipes: Recipe[]) {
  const chunks = chunkArray(recipes, apiKeys.length);

  await Promise.all(
    chunks.map((chunk, idx) =>
      processWithKey(chunk, apiKeys[idx])
    )
  );
}
```

**Benefit**: 3x faster processing (respecting rate limits per key)

---

## Monitoring & Analytics

### Key Metrics

1. **Cost per Recipe**: Track actual vs. estimated
2. **Classification Quality**: Average confidence score
3. **Processing Rate**: Recipes/hour
4. **Error Rate**: Failed classifications
5. **Token Usage**: Input/output token counts

### Monitoring Dashboard

```typescript
interface ClassificationMetrics {
  totalRecipes: number;
  classifiedRecipes: number;
  totalCost: number;
  avgConfidence: number;
  avgTimePerRecipe: number;
  errorRate: number;
  tokensUsed: {
    input: number;
    output: number;
  };
}

async function getMetrics(): Promise<ClassificationMetrics> {
  // Query database for metrics
  const results = await db.execute(sql`
    SELECT
      COUNT(*) as total_recipes,
      COUNT(instruction_metadata) as classified_recipes,
      AVG((metadata->>'confidence')::numeric) as avg_confidence
    FROM recipes,
         jsonb_array_elements(instruction_metadata) metadata
  `);

  return results.rows[0];
}
```

---

## Cost Comparison: Build vs. Buy

### Option A: AI Classification (Recommended)

**Cost**: $5/year
**Quality**: High (90%+ accuracy)
**Maintenance**: Low
**Scalability**: Excellent

### Option B: Manual Classification

**Cost**: $0
**Quality**: Very High (100% accuracy)
**Time**: 30 seconds/recipe × 3500 = **29 hours**
**Labor Cost**: $15/hour × 29 hours = **$435**

**Conclusion**: AI is **87x cheaper** than manual work.

### Option C: Crowdsourcing

**Cost**: $0.05/recipe (MTurk) = **$175**
**Quality**: Variable (60-80% accuracy)
**Time**: 1-2 weeks
**Validation Cost**: Additional $50

**Conclusion**: AI is **35x cheaper** with higher quality.

---

## Recommendations

### Primary Strategy

1. **Use Gemini 2.0 Flash** for initial classification
2. **Budget**: $5 for initial + $10/year ongoing
3. **Timeline**: 2 weeks for full classification
4. **Quality Threshold**: 0.8 confidence minimum
5. **Manual Review**: Sample 100 random classifications

### Backup Strategy

1. **Use GPT-4o-mini** if Gemini quality is insufficient
2. **Budget**: $10 for initial + $15/year ongoing
3. **Quality Threshold**: 0.85 confidence minimum

### Quality Assurance

1. **Manual Review**: 50 random recipes (all skill levels)
2. **A/B Testing**: Compare Gemini vs. GPT-4o-mini on 100 recipes
3. **Validation**: Check time estimates against actual cooking
4. **Iteration**: Refine prompts based on errors

---

## ROI Analysis

### Value Created

**Enhanced Features**:
1. Skill-based time estimates → Better user experience
2. Equipment checklists → Improved meal planning
3. Parallel task detection → Time optimization
4. Technique-based search → Better discovery

**Estimated Value**:
- User retention: +10% (better UX)
- Engagement: +15% (more features)
- Premium conversions: +5% (advanced features)

**Monetization Potential**:
- Premium feature: Equipment planning ($2/month × 100 users = $200/month)
- ROI: $200/month - $5 initial = **4000% first-month ROI**

---

## Conclusion

**Recommendation**: Proceed with **Google Gemini 2.0 Flash**

**Total Investment**: $5 (one-time) + $10/year (ongoing) = **$15 first year**

**Risk Level**: Low (minimal cost, high value)

**Timeline**: 2 weeks for complete classification

**Success Criteria**:
- ✅ 95%+ recipes classified
- ✅ 85%+ average confidence
- ✅ <5% error rate
- ✅ <$10 total cost

---

## Related Documents

- `INSTRUCTION_CLASSIFICATION_TAXONOMY.md` - Classification system
- `INSTRUCTION_METADATA_SCHEMA.md` - Storage design
- `INSTRUCTION_CLASSIFICATION_IMPLEMENTATION.md` - Implementation guide
- `src/lib/ai/instruction-classifier-prompt.ts` - Prompt template
