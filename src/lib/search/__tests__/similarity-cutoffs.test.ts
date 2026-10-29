/**
 * #96 D57: calibrated bge-small cutoffs. Score sets mirror the production
 * calibration: nonsense queries score flat around 0.55-0.62, real queries
 * reach 0.70-0.88 at rank 1.
 */

import { describe, expect, it } from 'vitest';
import {
  applySearchCutoff,
  RECIPE_SIMILAR_MIN_SIMILARITY,
  SEARCH_MIN_SIMILARITY,
  SEARCH_RELATIVE_DELTA,
} from '../similarity-cutoffs';

const scored = (scores: number[]) => scores.map((similarity, i) => ({ id: `r${i}`, similarity }));

describe('#96 D57 similarity cutoffs', () => {
  it('pins the calibrated values', () => {
    expect(SEARCH_MIN_SIMILARITY).toBe(0.65);
    expect(SEARCH_RELATIVE_DELTA).toBe(0.1);
    expect(RECIPE_SIMILAR_MIN_SIMILARITY).toBe(0.72);
  });

  it('a nonsense-like score set yields no results', () => {
    expect(applySearchCutoff(scored([0.62, 0.6, 0.59, 0.57, 0.55]))).toEqual([]);
  });

  it('keeps only scores at or above max(0.65, top1 - 0.10)', () => {
    // top1 0.84 -> cutoff 0.74
    const kept = applySearchCutoff(scored([0.84, 0.8, 0.74, 0.739, 0.7, 0.66]));
    expect(kept.map((r) => r.similarity)).toEqual([0.84, 0.8, 0.74]);
    // top1 0.70 -> cutoff is the 0.65 floor, not 0.60
    const nearFloor = applySearchCutoff(scored([0.7, 0.66, 0.65, 0.64, 0.61]));
    expect(nearFloor.map((r) => r.similarity)).toEqual([0.7, 0.66, 0.65]);
  });

  it('an explicit floor of 0 leaves only the relative step', () => {
    const kept = applySearchCutoff(scored([0.4, 0.35, 0.29]), 0);
    expect(kept.map((r) => r.similarity)).toEqual([0.4, 0.35]);
  });

  it('keeps input order and handles an empty list', () => {
    expect(applySearchCutoff(scored([0.7, 0.9, 0.85])).map((r) => r.similarity)).toEqual([
      0.9, 0.85,
    ]);
    expect(applySearchCutoff([])).toEqual([]);
  });
});
