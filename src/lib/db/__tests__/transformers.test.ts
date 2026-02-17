/**
 * Tests for DB → Frontend type transformers
 *
 * These tests verify that type transformation utilities correctly convert
 * database types (strings, JSON text) into frontend-ready types (numbers, objects/arrays).
 */

import { describe, expect, it } from 'vitest';
import {
  parseDecimal,
  parseInteger,
  parseJsonArray,
  parseJsonField,
  parseRecipe,
  parseIngredient,
  parseMeal,
  parseChef,
  parseTool,
  parseInventoryItem,
} from '../transformers';
import type { Recipe, Ingredient, Meal, Chef, Tool, InventoryItem } from '../schema';

describe('Type Transformers', () => {
  describe('parseDecimal', () => {
    it('should parse valid decimal strings to numbers', () => {
      expect(parseDecimal('3.14')).toBe(3.14);
      expect(parseDecimal('0.99')).toBe(0.99);
      expect(parseDecimal('100')).toBe(100);
    });

    it('should return null for invalid inputs', () => {
      expect(parseDecimal(null)).toBeNull();
      expect(parseDecimal(undefined)).toBeNull();
      expect(parseDecimal('')).toBeNull();
      expect(parseDecimal('invalid')).toBeNull();
    });
  });

  describe('parseInteger', () => {
    it('should parse integers from strings or numbers', () => {
      expect(parseInteger('42')).toBe(42);
      expect(parseInteger(42)).toBe(42);
      expect(parseInteger('0')).toBe(0);
    });

    it('should return null for invalid inputs', () => {
      expect(parseInteger(null)).toBeNull();
      expect(parseInteger(undefined)).toBeNull();
      expect(parseInteger('')).toBeNull();
      expect(parseInteger('invalid')).toBeNull();
    });
  });

  describe('parseJsonField', () => {
    it('should parse valid JSON strings', () => {
      expect(parseJsonField('{"key":"value"}', {})).toEqual({ key: 'value' });
      expect(parseJsonField('[1,2,3]', [])).toEqual([1, 2, 3]);
      expect(parseJsonField('true', false)).toBe(true);
    });

    it('should return default value for invalid JSON', () => {
      expect(parseJsonField('invalid json', { default: true })).toEqual({ default: true });
      expect(parseJsonField(null, [])).toEqual([]);
      expect(parseJsonField(undefined, [])).toEqual([]);
      expect(parseJsonField('', [])).toEqual([]);
    });
  });

  describe('parseJsonArray', () => {
    it('should parse JSON arrays', () => {
      expect(parseJsonArray('["a","b","c"]')).toEqual(['a', 'b', 'c']);
      expect(parseJsonArray('[]')).toEqual([]);
    });

    it('should return empty array for invalid inputs', () => {
      expect(parseJsonArray(null)).toEqual([]);
      expect(parseJsonArray(undefined)).toEqual([]);
      expect(parseJsonArray('')).toEqual([]);
      expect(parseJsonArray('invalid')).toEqual([]);
    });
  });

  describe('parseRecipe', () => {
    it('should transform recipe with numeric and JSON fields', () => {
      const mockRecipe = {
        id: 'recipe-1',
        user_id: 'user-1',
        name: 'Test Recipe',
        description: 'A test recipe',
        ingredients: '[{"ingredient_name":"salt","amount":"1","unit":"tsp"}]',
        instructions: 'Test instructions',
        confidence_score: '0.95',
        system_rating: '4.5',
        avg_user_rating: '4.2',
        images: '["image1.jpg","image2.jpg"]',
        tags: '["dinner","easy"]',
        nutrition_info: '{"calories":200}',
        instruction_metadata: null,
        dominant_textures: '["crispy"]',
        dominant_flavors: '["savory"]',
        waste_reduction_tags: '["one-pot"]',
        // ... other required fields with defaults
        prep_time: 10,
        cook_time: 20,
        servings: 4,
        difficulty: 'easy',
        cuisine: 'American',
        image_url: null,
        is_ai_generated: false,
        is_public: false,
        is_system_recipe: false,
        is_meal_prep_friendly: false,
        model_used: null,
        source: null,
        license: 'ALL_RIGHTS_RESERVED',
        created_at: new Date(),
        updated_at: new Date(),
        discovery_date: null,
        validation_model: null,
        embedding_model: null,
        discovery_week: null,
        discovery_year: null,
        published_date: null,
        system_rating_reason: null,
        total_user_ratings: 0,
        search_query: null,
        chef_id: null,
        slug: 'test-recipe',
        image_flagged_for_regeneration: false,
        image_regeneration_requested_at: null,
        image_regeneration_requested_by: null,
        like_count: 0,
        fork_count: 0,
        collection_count: 0,
        instruction_metadata_version: null,
        instruction_metadata_generated_at: null,
        instruction_metadata_model: null,
        content_flagged_for_cleanup: false,
        ingredients_need_cleanup: false,
        instructions_need_cleanup: false,
        deleted_at: null,
        deleted_by: null,
        weight_score: null,
        richness_score: null,
        acidity_score: null,
        sweetness_level: null,
        serving_temperature: null,
        pairing_rationale: null,
        source_id: null,
        video_url: null,
        resourcefulness_score: null,
        scrap_utilization_notes: null,
        environmental_notes: null,
        qa_status: 'pending',
        qa_timestamp: null,
        qa_method: null,
        qa_confidence: null,
        qa_notes: null,
        qa_issues_found: null,
        qa_fixes_applied: null,
        moderation_status: 'pending',
        moderation_notes: null,
        moderated_by: null,
        moderated_at: null,
        submission_notes: null,
      } as unknown as Recipe;

      const parsed = parseRecipe(mockRecipe);

      // Check numeric conversions
      expect(parsed.confidence_score).toBe(0.95);
      expect(parsed.system_rating).toBe(4.5);
      expect(parsed.avg_user_rating).toBe(4.2);
      expect(typeof parsed.confidence_score).toBe('number');

      // Check JSON array conversions
      expect(parsed.images).toEqual(['image1.jpg', 'image2.jpg']);
      expect(parsed.tags).toEqual(['dinner', 'easy']);
      expect(parsed.dominant_textures).toEqual(['crispy']);
      expect(parsed.dominant_flavors).toEqual(['savory']);
      expect(parsed.waste_reduction_tags).toEqual(['one-pot']);

      // Check JSON object conversion
      expect(parsed.nutrition_info).toEqual({ calories: 200 });

      // Check parsed ingredient structure
      expect(parsed.ingredients).toEqual([
        {
          ingredient_name: 'salt',
          amount: '1',
          unit: 'tsp',
        },
      ]);
    });
  });

  describe('parseIngredient', () => {
    it('should transform ingredient with JSON text fields', () => {
      const mockIngredient = {
        id: 'ingredient-1',
        name: 'salt',
        display_name: 'Salt',
        category: 'spice',
        is_common: true,
        aliases: '["table salt","sea salt"]',
        common_units: '["tsp","tbsp"]',
        substitutions: '["kosher salt"]',
        is_allergen: false,
        usage_count: 100,
        created_at: new Date(),
        updated_at: new Date(),
        typical_unit: 'tsp',
        slug: 'salt',
        description: null,
        storage_tips: null,
        image_url: null,
        is_suitable_for_image: true,
        type: null,
        subtype: null,
      } as Ingredient;

      const parsed = parseIngredient(mockIngredient);

      expect(parsed.aliases).toEqual(['table salt', 'sea salt']);
      expect(parsed.common_units).toEqual(['tsp', 'tbsp']);
      expect(parsed.substitutions).toEqual(['kosher salt']);
      expect(Array.isArray(parsed.aliases)).toBe(true);
    });
  });

  describe('parseMeal', () => {
    it('should transform meal with numeric and JSON fields', () => {
      const mockMeal = {
        id: 'meal-1',
        user_id: 'user-1',
        name: 'Sunday Dinner',
        occasion: 'family',
        serves: 6,
        description: 'A hearty meal',
        estimated_total_cost: '25.50',
        estimated_cost_per_serving: '4.25',
        price_estimation_confidence: '0.90',
        tags: '["family","comfort"]',
        is_public: false,
        created_at: new Date(),
        updated_at: new Date(),
        meal_type: 'dinner',
        is_template: false,
        price_estimation_date: null,
        total_prep_time: null,
        total_cook_time: null,
        slug: 'sunday-dinner',
      } as Meal;

      const parsed = parseMeal(mockMeal);

      expect(parsed.estimated_total_cost).toBe(25.5);
      expect(parsed.estimated_cost_per_serving).toBe(4.25);
      expect(parsed.price_estimation_confidence).toBe(0.9);
      expect(parsed.tags).toEqual(['family', 'comfort']);
    });
  });

  describe('parseChef', () => {
    it('should transform chef with numeric fields', () => {
      const mockChef = {
        id: 'chef-1',
        slug: 'gordon-ramsay',
        name: 'Gordon Ramsay',
        display_name: 'Gordon Ramsay',
        bio: 'British chef',
        profile_image_url: null,
        website: null,
        social_links: { twitter: '@gordonramsay' },
        specialties: ['French'],
        is_verified: true,
        is_active: true,
        recipe_count: 50,
        created_at: new Date(),
        updated_at: new Date(),
        latitude: '51.5074',
        longitude: '-0.1278',
        location_city: 'London',
        location_state: null,
        location_country: 'UK',
        source_id: null,
      } as Chef;

      const parsed = parseChef(mockChef);

      expect(parsed.latitude).toBe(51.5074);
      expect(parsed.longitude).toBe(-0.1278);
      expect(typeof parsed.latitude).toBe('number');
      expect(typeof parsed.longitude).toBe('number');
    });
  });

  describe('parseTool', () => {
    it('should transform tool with numeric and JSON fields', () => {
      const mockTool = {
        id: 'tool-1',
        name: 'chef-knife',
        display_name: "Chef's Knife",
        category: 'knives',
        type: 'CUTTING_PREP',
        subtype: 'knives_chef',
        is_essential: true,
        is_specialized: false,
        alternatives: '["santoku","cleaver"]',
        typical_price_usd: '75.99',
        description: 'Essential kitchen knife',
        image_url: null,
        slug: 'chef-knife',
        created_at: new Date(),
        updated_at: new Date(),
      } as Tool;

      const parsed = parseTool(mockTool);

      expect(parsed.typical_price_usd).toBe(75.99);
      expect(parsed.alternatives).toEqual(['santoku', 'cleaver']);
      expect(typeof parsed.typical_price_usd).toBe('number');
    });
  });

  describe('parseInventoryItem', () => {
    it('should transform inventory item with numeric fields', () => {
      const mockItem = {
        id: 'item-1',
        user_id: 'user-1',
        ingredient_id: 'ingredient-1',
        storage_location: 'fridge',
        status: 'fresh',
        quantity: '2.50',
        unit: 'lbs',
        acquisition_date: new Date(),
        expiry_date: null,
        cost_usd: '4.99',
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as InventoryItem;

      const parsed = parseInventoryItem(mockItem);

      expect(parsed.quantity).toBe(2.5);
      expect(parsed.cost_usd).toBe(4.99);
      expect(typeof parsed.quantity).toBe('number');
      expect(typeof parsed.cost_usd).toBe('number');
    });

    it('should default quantity to 0 if null', () => {
      const mockItem = {
        id: 'item-1',
        user_id: 'user-1',
        ingredient_id: 'ingredient-1',
        storage_location: 'fridge',
        status: 'fresh',
        quantity: null as any,
        unit: 'lbs',
        acquisition_date: new Date(),
        expiry_date: null,
        cost_usd: null,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as InventoryItem;

      const parsed = parseInventoryItem(mockItem);

      expect(parsed.quantity).toBe(0);
      expect(parsed.cost_usd).toBeNull();
    });
  });
});
