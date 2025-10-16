#!/usr/bin/env python3
"""
Quick test of the Serious Eats scraper with first 3 recipes
Validates the scraping pipeline before running full 50 recipe scrape
"""

import json
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from recipe_scrapers import scrape_me
import re

# Configuration
URLS_FILE = Path(__file__).parent / "serious-eats-top50-urls.json"
RATE_LIMIT_SECONDS = 2

# Simple inline functions for testing
def parse_servings(yields_str: Optional[str]) -> Optional[int]:
    if not yields_str:
        return None
    match = re.search(r'(\d+)', yields_str)
    if match:
        return int(match.group(1))
    return None

def parse_instructions(instructions: str) -> str:
    if not instructions:
        return ""
    instructions = re.sub(r'\s+', ' ', instructions).strip()
    return instructions

def scrape_recipe(url: str, metadata: Dict[str, str]) -> Optional[Dict[str, Any]]:
    try:
        scraper = scrape_me(url)
        raw_data = {
            "url": url,
            "metadata": metadata,
            "scraped_at": datetime.now().isoformat(),
            "title": scraper.title(),
            "author": scraper.author() if hasattr(scraper, 'author') else None,
            "description": scraper.description() if hasattr(scraper, 'description') else None,
            "prep_time": scraper.prep_time() if hasattr(scraper, 'prep_time') else None,
            "cook_time": scraper.cook_time() if hasattr(scraper, 'cook_time') else None,
            "total_time": scraper.total_time() if hasattr(scraper, 'total_time') else None,
            "yields": scraper.yields() if hasattr(scraper, 'yields') else None,
            "ingredients": scraper.ingredients(),
            "instructions": scraper.instructions(),
            "image": scraper.image() if hasattr(scraper, 'image') else None,
            "cuisine": scraper.cuisine() if hasattr(scraper, 'cuisine') else None,
            "category": scraper.category() if hasattr(scraper, 'category') else None,
            "ratings": scraper.ratings() if hasattr(scraper, 'ratings') else None,
        }
        return raw_data
    except Exception as e:
        print(f"Error scraping: {e}")
        return None

def transform_to_schema(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    servings = parse_servings(raw_data.get('yields'))
    instructions = parse_instructions(raw_data.get('instructions', ''))

    tags = []
    if raw_data.get('category'):
        tags.append(raw_data['category'])
    if raw_data['metadata'].get('category'):
        tags.append(raw_data['metadata']['category'])
    tags = list(dict.fromkeys(tags))

    images = []
    if raw_data.get('image'):
        images.append(raw_data['image'])

    transformed = {
        "id": str(uuid.uuid4()),
        "user_id": "system",
        "name": raw_data['title'],
        "description": raw_data.get('description'),
        "ingredients": json.dumps(raw_data.get('ingredients', [])),
        "instructions": instructions,
        "prep_time": raw_data.get('prep_time'),
        "cook_time": raw_data.get('cook_time'),
        "servings": servings,
        "cuisine": raw_data.get('cuisine'),
        "tags": json.dumps(tags),
        "images": json.dumps(images),
        "is_system_recipe": True,
        "source": raw_data['url'],
    }
    return transformed

def validate_recipe(recipe: Dict[str, Any]) -> tuple[bool, List[str]]:
    issues = []
    if not recipe.get('name'):
        issues.append("Missing name")
    try:
        ingredients = json.loads(recipe.get('ingredients', '[]'))
        if not ingredients or len(ingredients) == 0:
            issues.append("No ingredients")
    except json.JSONDecodeError:
        issues.append("Invalid ingredients JSON")
    if not recipe.get('instructions'):
        issues.append("No instructions")
    elif len(recipe['instructions']) < 50:
        issues.append("Instructions too short")
    try:
        images = json.loads(recipe.get('images', '[]'))
        if not images or len(images) == 0:
            issues.append("No images")
    except json.JSONDecodeError:
        issues.append("Invalid images JSON")
    if not recipe.get('source'):
        issues.append("Missing source URL")
    is_valid = len(issues) == 0
    return is_valid, issues

def main():
    """Test scraper with first 3 recipes"""
    print("="*70)
    print("TESTING SERIOUS EATS SCRAPER (First 3 Recipes)")
    print("="*70)

    # Load URLs
    with open(URLS_FILE, 'r') as f:
        all_urls = json.load(f)

    # Test with first 3
    test_urls = all_urls[:3]
    print(f"\nTesting {len(test_urls)} recipes:\n")

    for i, recipe_info in enumerate(test_urls, 1):
        print(f"{i}. {recipe_info['url']}")
        print(f"   Author: {recipe_info['author']}")
        print(f"   Category: {recipe_info['category']}\n")

    print("="*70)
    print("SCRAPING")
    print("="*70)

    results = []
    for i, recipe_info in enumerate(test_urls, 1):
        url = recipe_info['url']
        metadata = {
            "author": recipe_info.get('author'),
            "category": recipe_info.get('category'),
            "notes": recipe_info.get('notes'),
        }

        print(f"\n[{i}/{len(test_urls)}] Testing: {url}")

        # Scrape
        raw_data = scrape_recipe(url, metadata)

        if raw_data:
            # Transform
            transformed = transform_to_schema(raw_data)

            # Validate
            is_valid, issues = validate_recipe(transformed)

            result = {
                "url": url,
                "success": True,
                "valid": is_valid,
                "issues": issues,
                "title": transformed['name'],
                "ingredients_count": len(json.loads(transformed['ingredients'])),
                "has_image": bool(json.loads(transformed['images'])),
                "prep_time": transformed.get('prep_time'),
                "cook_time": transformed.get('cook_time'),
            }
            print(f"   ✅ Success: {result['title']}")
            print(f"   📊 {result['ingredients_count']} ingredients, Prep: {result['prep_time']}min, Cook: {result['cook_time']}min")
            if not is_valid:
                print(f"   ⚠️  Issues: {', '.join(issues)}")
        else:
            result = {
                "url": url,
                "success": False,
                "valid": False,
            }
            print(f"   ❌ Failed to scrape")

        results.append(result)

    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)

    success_count = sum(1 for r in results if r['success'])
    valid_count = sum(1 for r in results if r.get('valid', False))

    print(f"\n✅ Scraped successfully: {success_count}/{len(test_urls)}")
    print(f"✅ Validated successfully: {valid_count}/{len(test_urls)}")

    if success_count == len(test_urls):
        print("\n🎉 All test recipes scraped successfully!")
        print("\nReady to run full scraper:")
        print("  python scripts/ingest-serious-eats-top50.py")
        return 0
    else:
        print("\n⚠️  Some tests failed. Review errors above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
