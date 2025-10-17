/**
 * Test suite for normalization utilities
 */

import { describe, expect, it } from 'vitest';
import {
  calculateCompletenessScore,
  calculateEngagementScore,
  calculateQualityScore,
  calculateRecencyScore,
  calculateTrendingScore,
  normalizeCount,
  normalizeRating,
  normalizeSimilarity,
} from '../normalization';

describe('Normalization Utilities', () => {
  describe('normalizeRating', () => {
    it('should normalize ratings to 0-1 scale', () => {
      expect(normalizeRating(0)).toBe(0);
      expect(normalizeRating(2.5)).toBe(0.5);
      expect(normalizeRating(5)).toBe(1);
    });

    it('should handle edge cases', () => {
      expect(normalizeRating(-1)).toBe(0);
      expect(normalizeRating(6)).toBe(1);
    });

    it('should support custom max rating', () => {
      expect(normalizeRating(5, 10)).toBe(0.5);
      expect(normalizeRating(10, 10)).toBe(1);
    });
  });

  describe('normalizeCount', () => {
    it('should apply logarithmic scaling', () => {
      expect(normalizeCount(0)).toBe(0);
      expect(normalizeCount(1)).toBeCloseTo(0.1, 1);
      expect(normalizeCount(10)).toBeCloseTo(0.35, 1);
      expect(normalizeCount(100)).toBeCloseTo(0.67, 1);
    });

    it('should support bounded normalization', () => {
      const result = normalizeCount(50, 100);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('should handle zero counts', () => {
      expect(normalizeCount(0)).toBe(0);
      expect(normalizeCount(-5)).toBe(0);
    });
  });

  describe('normalizeSimilarity', () => {
    it('should keep similarity in 0-1 range', () => {
      expect(normalizeSimilarity(0)).toBe(0);
      expect(normalizeSimilarity(0.5)).toBe(0.5);
      expect(normalizeSimilarity(1)).toBe(1);
    });

    it('should handle out of range values', () => {
      expect(normalizeSimilarity(-0.5)).toBe(0);
      expect(normalizeSimilarity(1.5)).toBe(1);
    });
  });

  describe('calculateRecencyScore', () => {
    it('should return 1.0 for current date', () => {
      const now = new Date();
      expect(calculateRecencyScore(now)).toBe(1);
    });

    it('should apply exponential decay', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const score = calculateRecencyScore(thirtyDaysAgo, 30);
      expect(score).toBeCloseTo(0.5, 1); // Half-life of 30 days
    });

    it('should approach zero for old dates', () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const score = calculateRecencyScore(oneYearAgo, 30);
      expect(score).toBeLessThan(0.01);
    });

    it('should handle future dates', () => {
      const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      expect(calculateRecencyScore(future)).toBe(1);
    });
  });

  describe('calculateCompletenessScore', () => {
    it('should return 0 for empty recipe', () => {
      const score = calculateCompletenessScore({});
      expect(score).toBe(0);
    });

    it('should score complete recipe highly', () => {
      const completeRecipe = {
        description: 'A delicious recipe',
        ingredients: '["flour", "sugar", "eggs"]',
        instructions: '["Step 1", "Step 2"]',
        images: '["image1.jpg", "image2.jpg"]',
        nutrition_info: '{"calories": 250}',
        prep_time: 15,
        cook_time: 30,
        difficulty: 'medium',
        cuisine: 'Italian',
      };

      const score = calculateCompletenessScore(completeRecipe);
      expect(score).toBe(1.0);
    });

    it('should award partial scores correctly', () => {
      const partialRecipe = {
        description: 'A recipe',
        ingredients: '["flour"]',
        instructions: '["Step 1"]',
      };

      const score = calculateCompletenessScore(partialRecipe);
      expect(score).toBeCloseTo(0.6, 1); // description (20%) + ingredients (20%) + instructions (20%)
    });

    it('should handle invalid JSON gracefully', () => {
      const invalidRecipe = {
        ingredients: 'invalid json',
        instructions: '["Step 1"]',
      };

      const score = calculateCompletenessScore(invalidRecipe);
      expect(score).toBe(0.2); // Only instructions count
    });
  });

  describe('calculateQualityScore', () => {
    it('should combine rating, completeness, and confidence', () => {
      const score = calculateQualityScore(4.5, 0.9, 0.95);
      expect(score).toBeGreaterThan(0.8);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle missing values', () => {
      const score = calculateQualityScore(0, 0, 1);
      expect(score).toBe(0.2); // Only confidence contributes
    });

    it('should weight components correctly', () => {
      // System rating: 50%, Completeness: 30%, Confidence: 20%
      const score = calculateQualityScore(5, 1, 1);
      expect(score).toBe(1.0);

      const lowRating = calculateQualityScore(0, 1, 1);
      expect(lowRating).toBe(0.5); // Completeness (30%) + Confidence (20%)
    });
  });

  describe('calculateEngagementScore', () => {
    it('should combine multiple engagement metrics', () => {
      const score = calculateEngagementScore(4.5, 100, 50, 1000);
      expect(score).toBeGreaterThan(0.7);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle zero engagement', () => {
      const score = calculateEngagementScore(0, 0, 0, 0);
      expect(score).toBe(0);
    });

    it('should weight rating highly', () => {
      const highRating = calculateEngagementScore(5, 0, 0, 0);
      const highCounts = calculateEngagementScore(0, 1000, 1000, 10000);

      // Rating is 40% weight, so 5-star rating = 0.4
      // Counts can still add up to 0.6 (30% + 20% + 10%)
      expect(highRating).toBeGreaterThan(0.3);
      expect(highCounts).toBeGreaterThan(0.3);
    });
  });

  describe('calculateTrendingScore', () => {
    it('should favor recent activity', () => {
      const recent = calculateTrendingScore(new Date(), 10, 4.5);

      const old = calculateTrendingScore(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), 10, 4.5);

      expect(recent).toBeGreaterThan(old);
    });

    it('should consider engagement and quality', () => {
      const now = new Date();
      const lowEngagement = calculateTrendingScore(now, 1, 3);
      const highEngagement = calculateTrendingScore(now, 100, 5);

      expect(highEngagement).toBeGreaterThan(lowEngagement);
    });

    it('should return reasonable values', () => {
      const score = calculateTrendingScore(new Date(), 50, 4.5);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
