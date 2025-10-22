# Semantic Consolidation Guide

## Overview

This guide explains how to use the semantic consolidation system to intelligently merge duplicate ingredients using local LLM (Large Language Model) analysis.

## Prerequisites

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Start Ollama service
ollama serve
```

### 2. Install Mistral Model

```bash
# Pull the Mistral model (4.4 GB)
ollama pull mistral

# Verify installation
ollama list
```

### 3. Verify Ollama is Running

```bash
# Test API endpoint
curl http://localhost:11434/api/tags

# Should return JSON with installed models
```

## Workflow

### Step 1: Analyze Duplicates

First, identify potential duplicate ingredients:

```bash
npx tsx scripts/analyze-ingredient-duplicates.ts
```

**Output**: `tmp/potential-duplicates.json`
- Lists all potential duplicate groups
- Normalized keys for comparison
- Usage statistics

### Step 2: Test Semantic Comparison

Validate the LLM is working correctly:

```bash
npx tsx scripts/test-semantic-comparison.ts
```

**Expected Results**:
- ✅ 10/10 tests passing (100% accuracy)
- Average ~5-6s per comparison
- All edge cases handled correctly

### Step 3: Run Semantic Consolidation

Execute the hybrid consolidation:

```bash
npx tsx scripts/semantic-consolidation.ts
```

**Processing Time**: 4-5 minutes for ~272 duplicate groups

**Output**: `tmp/semantic-consolidation-decisions.json`

**Decision Types**:
1. **merge** - Ingredients should be consolidated
2. **keep_separate** - Ingredients are truly different
3. **needs_review** - Uncertain, requires manual review

### Step 4: Analyze Results

Review consolidation decisions:

```bash
npx tsx scripts/analyze-consolidation-results.ts
```

**Shows**:
- Decision statistics
- Sample merges
- Complex cases handled by LLM
- Consolidation impact

### Step 5: Execute Consolidation

Apply the consolidation decisions (script to be created):

```bash
npx tsx scripts/execute-consolidation.ts
```

## How It Works

### Hybrid Approach

The system uses a two-phase approach:

#### Phase 1: Rule-Based (Fast)

Handles ~85% of cases instantly:

1. **Plural/Singular Variants**
   - Example: "onion" → "onions"
   - Detection: Simple suffix matching (+s, +es, -y+ies)

2. **Punctuation Variants**
   - Example: "chile" → "chili"
   - Detection: Same after removing punctuation

3. **Category Duplicates**
   - Example: "Salt" in multiple categories
   - Detection: Same normalized name, different categories

4. **Zero Usage**
   - Example: Both variants unused
   - Action: Recommend deletion

#### Phase 2: LLM-Validated (Intelligent)

Handles ~15% of complex cases:

1. **Ambiguous Display Names**
   - Example: "Red Bell Pepper" vs "Marinated Roasted Bell Peppers"
   - Trigger: <50% word overlap between display names

2. **Preparation States**
   - Example: "Dried Cranberry" vs "Cranberries"
   - LLM: Determines if preparation difference matters

3. **Product Relationships**
   - Example: "Balsamic Vinegar" vs "Balsamic Vinaigrette"
   - LLM: Distinguishes ingredient from derived product

4. **Variety Differences**
   - Example: "Butter Bean" vs "Great Northern Beans"
   - LLM: Identifies different varieties of same category

### Decision Confidence Levels

- **High (>0.85)**: Execute automatically
- **Medium (0.7-0.85)**: Review before executing
- **Low (<0.7)**: Requires manual review

## Configuration

### Adjusting Word Overlap Threshold

In `scripts/semantic-consolidation.ts`:

```typescript
// Line ~270
if (wordOverlap < 0.5) {  // Default: 50%
  // Trigger LLM validation
}
```

**Recommendations**:
- **40%**: More LLM calls, fewer false negatives
- **50%**: Balanced (recommended)
- **60%**: Fewer LLM calls, more false negatives

### Adjusting LLM Temperature

```typescript
// Line ~180
options: {
  temperature: 0.3,  // Default: 0.3 (deterministic)
}
```

**Recommendations**:
- **0.1-0.3**: Deterministic, consistent
- **0.5-0.7**: More creative, less predictable
- **0.8+**: Too random for this task

### Changing LLM Model

```typescript
// Line ~177
model: 'mistral',  // Default model
```

**Available Models** (via `ollama list`):
- **mistral**: Fast, accurate (recommended)
- **llama3.1**: Larger, more capable
- **qwen2.5-coder**: Code-focused
- **deepseek-v3**: Very large, very capable

## Troubleshooting

### Ollama Not Running

**Error**: `Ollama is not running or not installed!`

**Solution**:
```bash
# Start Ollama
ollama serve

# Or check if already running
pgrep ollama
```

### Model Not Found

**Error**: `model 'mistral' not found`

**Solution**:
```bash
# Install the model
ollama pull mistral

# Verify
ollama list
```

### Slow Performance

**Issue**: LLM calls taking >10s each

**Solutions**:
1. Close other applications using GPU
2. Use a smaller model (e.g., TinyLlama)
3. Reduce `num_predict` in API call
4. Increase `timeout` in fetch call

### LLM Failures

**Issue**: Frequent LLM call failures

**Solutions**:
1. Check Ollama logs: `ollama logs`
2. Restart Ollama: `killall ollama && ollama serve`
3. Reduce retry count from 2 to 1
4. Add more specific error handling

## Performance Benchmarks

### Test Results

| Metric | Value |
|--------|-------|
| Test cases | 10 |
| Accuracy | 100% |
| Avg latency | 5.61s |
| Success rate | 100% |

### Production Results

| Metric | Value |
|--------|-------|
| Total groups | 272 |
| Rule-based | 222 (81.6%) |
| LLM-validated | 50 (18.4%) |
| Total time | 4-5 minutes |
| Ingredients to merge | 230 |
| Ingredients to delete | 84 (42 groups × 2) |
| **Net reduction** | **314 ingredients (6.8%)** |

## Best Practices

### 1. Test First

Always run the test suite before production:

```bash
npx tsx scripts/test-semantic-comparison.ts
```

### 2. Review Edge Cases

Manually review decisions with:
- Low confidence (<0.7)
- Semantic validation present
- Ambiguous display names

### 3. Backup Database

Before executing consolidation:

```bash
# Export current ingredients
npx tsx scripts/export-ingredients.ts

# Create database backup
pg_dump $DATABASE_URL > backup.sql
```

### 4. Incremental Execution

Execute high-confidence merges first:

```bash
# Filter by confidence
jq '.[] | select(.confidence == "high")' \
  tmp/semantic-consolidation-decisions.json
```

### 5. Monitor Results

After execution:
- Check recipe-ingredient links are updated
- Verify no broken references
- Test search functionality
- Validate aliases are preserved

## Future Enhancements

### 1. Batch Processing

Group LLM calls to reduce latency:

```typescript
// Process multiple comparisons in parallel
const batch = await Promise.all(
  groups.map(g => semanticCompare(g.v1, g.v2))
);
```

### 2. Caching

Cache LLM results for similar comparisons:

```typescript
const cache = new Map();
const cacheKey = [ing1, ing2].sort().join('|');
if (cache.has(cacheKey)) return cache.get(cacheKey);
```

### 3. Fine-Tuning

Create domain-specific rules for common patterns:

```typescript
// Add preparation state detection
const prepStates = ['dried', 'frozen', 'roasted', 'marinated'];
if (hasDifferentPrepState(ing1, ing2)) {
  return keepSeparate();
}
```

### 4. UI Integration

Build web interface for reviewing decisions:
- Visual comparison
- Side-by-side usage stats
- One-click approval
- Bulk actions

## References

- **Ollama**: https://ollama.ai
- **Mistral AI**: https://mistral.ai
- **Project Roadmap**: ROADMAP.md
- **Test Results**: tmp/semantic-consolidation-summary.md
- **Examples**: tmp/semantic-comparison-examples.md

---

**Last Updated**: 2025-10-21
**Version**: 1.0
**Status**: Production Ready ✅
