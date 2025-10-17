#!/usr/bin/env python3
"""Quick test of a single Nancy Silverton recipe"""

from recipe_scrapers import scrape_me

# Test with one Nancy Silverton recipe
url = "https://www.foodandwine.com/recipes/nancy-silvertons-tomato-oregano-pizza"

print(f"Testing: {url}\n")

try:
    scraper = scrape_me(url)

    print(f"✅ SUCCESS!")
    print(f"\nTitle: {scraper.title()}")
    print(f"Author: {scraper.author() if hasattr(scraper, 'author') else 'N/A'}")
    print(f"Prep Time: {scraper.prep_time() if hasattr(scraper, 'prep_time') else 'N/A'} min")
    print(f"Cook Time: {scraper.cook_time() if hasattr(scraper, 'cook_time') else 'N/A'} min")
    print(f"Servings: {scraper.yields() if hasattr(scraper, 'yields') else 'N/A'}")
    print(f"Ingredients: {len(scraper.ingredients())} items")
    print(f"Instructions: {len(scraper.instructions())} chars")

    print(f"\nFirst 3 ingredients:")
    for i, ing in enumerate(scraper.ingredients()[:3], 1):
        print(f"  {i}. {ing}")

except Exception as e:
    print(f"❌ FAILED: {type(e).__name__}")
    print(f"Error: {str(e)}")
