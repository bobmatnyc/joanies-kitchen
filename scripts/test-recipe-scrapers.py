#!/usr/bin/env python3
"""
Test script for recipe-scrapers with Serious Eats recipes
Tests extraction of 3 iconic Kenji López-Alt recipes
"""

import json
import sys
from recipe_scrapers import scrape_me

# Test recipes - Kenji's most iconic recipes
TEST_RECIPES = [
    {
        "url": "https://www.seriouseats.com/the-best-cheeseburger-recipe",
        "name": "The Best Cheeseburger (Kenji)",
    },
    {
        "url": "https://www.seriouseats.com/foolproof-pan-pizza-recipe",
        "name": "Foolproof Pan Pizza (Kenji)",
    },
    {
        "url": "https://www.seriouseats.com/the-food-lab-best-chocolate-chip-cookie-recipe",
        "name": "The Food Lab's Best Chocolate Chip Cookies (Kenji)",
    },
]

def test_scraper(recipe_info):
    """Test recipe-scrapers with a single URL"""
    print(f"\n{'='*70}")
    print(f"Testing: {recipe_info['name']}")
    print(f"URL: {recipe_info['url']}")
    print('='*70)

    try:
        # Scrape the recipe
        scraper = scrape_me(recipe_info['url'])

        # Extract data
        data = {
            "name": scraper.title(),
            "description": scraper.description() if hasattr(scraper, 'description') else None,
            "author": scraper.author() if hasattr(scraper, 'author') else None,
            "prep_time": scraper.prep_time() if hasattr(scraper, 'prep_time') else None,
            "cook_time": scraper.cook_time() if hasattr(scraper, 'cook_time') else None,
            "total_time": scraper.total_time() if hasattr(scraper, 'total_time') else None,
            "servings": scraper.yields() if hasattr(scraper, 'yields') else None,
            "ingredients": scraper.ingredients(),
            "instructions": scraper.instructions(),
            "image": scraper.image() if hasattr(scraper, 'image') else None,
            "cuisine": scraper.cuisine() if hasattr(scraper, 'cuisine') else None,
            "category": scraper.category() if hasattr(scraper, 'category') else None,
            "ratings": scraper.ratings() if hasattr(scraper, 'ratings') else None,
        }

        # Display results
        print(f"\n✅ Successfully scraped!")
        print(f"\nTitle: {data['name']}")
        print(f"Author: {data['author']}")
        print(f"Prep Time: {data['prep_time']} min")
        print(f"Cook Time: {data['cook_time']} min")
        print(f"Servings: {data['servings']}")
        print(f"Ingredients: {len(data['ingredients'])} items")
        print(f"Instructions: {len(data['instructions'])} characters")
        print(f"Image: {data['image'][:80] + '...' if data['image'] and len(data['image']) > 80 else data['image']}")
        print(f"Ratings: {data['ratings']}")

        # Show first 3 ingredients
        print(f"\nFirst 3 Ingredients:")
        for i, ingredient in enumerate(data['ingredients'][:3], 1):
            print(f"  {i}. {ingredient}")

        # Show first 150 chars of instructions
        instructions_preview = data['instructions'][:150] + '...' if len(data['instructions']) > 150 else data['instructions']
        print(f"\nInstructions Preview:")
        print(f"  {instructions_preview}")

        return {"success": True, "data": data}

    except Exception as e:
        print(f"\n❌ Failed to scrape: {type(e).__name__}")
        print(f"Error: {str(e)}")
        return {"success": False, "error": str(e)}

def main():
    """Run tests on all sample recipes"""
    print("\n" + "="*70)
    print("TESTING RECIPE-SCRAPERS WITH SERIOUS EATS")
    print("="*70)
    print(f"\nTesting {len(TEST_RECIPES)} recipes...")

    results = []
    for recipe_info in TEST_RECIPES:
        result = test_scraper(recipe_info)
        results.append({
            "recipe": recipe_info['name'],
            "url": recipe_info['url'],
            **result
        })

    # Summary
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)

    successful = sum(1 for r in results if r['success'])
    print(f"\n✅ Successful: {successful}/{len(TEST_RECIPES)}")
    print(f"❌ Failed: {len(TEST_RECIPES) - successful}/{len(TEST_RECIPES)}")

    if successful == len(TEST_RECIPES):
        print("\n🎉 All tests passed! recipe-scrapers works perfectly with Serious Eats.")
        print("\nNext steps:")
        print("  1. Create Top 50 recipe URL list")
        print("  2. Run full scraping script")
        print("  3. Transform to Joanie's Kitchen schema")
        return 0
    else:
        print("\n⚠️  Some tests failed. Review errors above.")
        failed = [r for r in results if not r['success']]
        for f in failed:
            print(f"\n  Failed: {f['recipe']}")
            print(f"  Error: {f['error']}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
