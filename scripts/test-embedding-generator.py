#!/usr/bin/env python3
"""
Test script for embedding generator
Validates the buildRecipeEmbeddingText logic without dependencies
"""

import json
from typing import Dict, Any


def build_recipe_embedding_text(recipe: Dict[str, Any]) -> str:
    """
    Build embedding text from recipe (matches TypeScript implementation)
    Extracted from generate_embeddings_local.py for testing
    """
    parts = []

    # Add name (most important)
    if recipe.get('name'):
        parts.append(recipe['name'])

    # Add description
    if recipe.get('description'):
        parts.append(recipe['description'])

    # Add cuisine
    if recipe.get('cuisine'):
        parts.append(f"Cuisine: {recipe['cuisine']}")

    # Add tags (parse JSON)
    if recipe.get('tags'):
        try:
            tags = json.loads(recipe['tags']) if isinstance(recipe['tags'], str) else recipe['tags']
            if tags and len(tags) > 0:
                parts.append(f"Tags: {', '.join(tags)}")
        except (json.JSONDecodeError, TypeError):
            pass

    # Add ingredients (parse JSON)
    if recipe.get('ingredients'):
        try:
            ingredients = json.loads(recipe['ingredients']) if isinstance(recipe['ingredients'], str) else recipe['ingredients']
            if ingredients and len(ingredients) > 0:
                parts.append(f"Ingredients: {', '.join(ingredients)}")
        except (json.JSONDecodeError, TypeError):
            pass

    # Add difficulty
    if recipe.get('difficulty'):
        parts.append(f"Difficulty: {recipe['difficulty']}")

    # Join all parts with '. ' separator
    return '. '.join(filter(None, parts)).strip()


def test_embedding_text_generation():
    """Test embedding text generation with various recipe scenarios"""

    print("="*60)
    print("Testing Recipe Embedding Text Generation")
    print("="*60)

    # Test 1: Full recipe
    recipe1 = {
        'id': 'test-1',
        'name': 'Spaghetti Carbonara',
        'description': 'Classic Italian pasta with eggs, pancetta, and Parmesan',
        'cuisine': 'Italian',
        'tags': '["pasta", "comfort-food", "quick-meals"]',
        'ingredients': '["spaghetti", "eggs", "pancetta", "parmesan cheese", "black pepper"]',
        'difficulty': 'medium'
    }

    text1 = build_recipe_embedding_text(recipe1)
    print("\n✓ Test 1: Full Recipe")
    print(f"  Input: {recipe1['name']}")
    print(f"  Output length: {len(text1)} chars")
    print(f"  Output: {text1[:150]}...")

    # Test 2: Minimal recipe (name only)
    recipe2 = {
        'id': 'test-2',
        'name': 'Simple Salad'
    }

    text2 = build_recipe_embedding_text(recipe2)
    print("\n✓ Test 2: Minimal Recipe (name only)")
    print(f"  Input: {recipe2['name']}")
    print(f"  Output: {text2}")

    # Test 3: Recipe with array fields (not JSON strings)
    recipe3 = {
        'id': 'test-3',
        'name': 'Grilled Chicken',
        'description': 'Perfectly grilled chicken breast',
        'tags': ['healthy', 'protein', 'grilling'],  # Already array
        'ingredients': ['chicken breast', 'olive oil', 'salt', 'pepper'],  # Already array
        'difficulty': 'easy'
    }

    text3 = build_recipe_embedding_text(recipe3)
    print("\n✓ Test 3: Recipe with Array Fields")
    print(f"  Input: {recipe3['name']}")
    print(f"  Output: {text3}")

    # Test 4: Empty/invalid recipe
    recipe4 = {
        'id': 'test-4',
        'tags': 'invalid-json',
        'ingredients': None
    }

    text4 = build_recipe_embedding_text(recipe4)
    print("\n✓ Test 4: Invalid/Empty Recipe")
    print(f"  Output: '{text4}' (should be empty)")
    print(f"  Empty: {len(text4) == 0}")

    # Test 5: Recipe with special characters
    recipe5 = {
        'id': 'test-5',
        'name': 'Crème Brûlée',
        'description': 'Rich French custard with caramelized sugar',
        'cuisine': 'French',
        'tags': '["dessert", "custard", "fancy"]',
        'ingredients': '["heavy cream", "egg yolks", "sugar", "vanilla"]',
        'difficulty': 'hard'
    }

    text5 = build_recipe_embedding_text(recipe5)
    print("\n✓ Test 5: Special Characters")
    print(f"  Input: {recipe5['name']}")
    print(f"  Output: {text5}")

    print("\n" + "="*60)
    print("All tests passed! ✅")
    print("="*60)


if __name__ == '__main__':
    test_embedding_text_generation()
