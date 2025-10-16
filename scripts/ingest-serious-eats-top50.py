#!/usr/bin/env python3
"""
Production Recipe Scraper for Serious Eats Top 50
Scrapes iconic recipes and transforms to Joanie's Kitchen database schema

Features:
- Loads curated URLs from serious-eats-top50-urls.json
- Uses recipe-scrapers library (no LLM cost)
- Rate limiting (2s between requests)
- Error handling with retries (3 attempts, exponential backoff)
- Progress logging with emoji indicators
- Quality validation
- Database-ready output matching Drizzle schema

Usage:
    python scripts/ingest-serious-eats-top50.py

Output:
    - data/recipes/incoming/serious-eats/top50-raw.json (raw scraped data)
    - data/recipes/incoming/serious-eats/top50-transformed.json (database-ready)
    - tmp/serious-eats-scraping-log-[timestamp].txt (detailed log)
    - tmp/serious-eats-errors-[timestamp].txt (error log)

Author: Joanie's Kitchen Team
Date: 2025-10-16
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
OUTPUT_DIR = Path(__file__).parent.parent / "data" / "recipes" / "incoming" / "serious-eats"
TMP_DIR = Path(__file__).parent.parent / "tmp"
RATE_LIMIT_SECONDS = 2
MAX_RETRIES = 3
RETRY_BACKOFF = 2  # Exponential backoff multiplier

# Ensure output directories exist
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

# Create timestamped log files
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = TMP_DIR / f"serious-eats-scraping-log-{TIMESTAMP}.txt"
ERROR_LOG_FILE = TMP_DIR / f"serious-eats-errors-{TIMESTAMP}.txt"


class Logger:
    """Simple logger that writes to both console and file"""

    def __init__(self, log_file: Path):
        self.log_file = log_file
        self.error_log = TMP_DIR / f"serious-eats-errors-{TIMESTAMP}.txt"

    def log(self, message: str, level: str = "INFO"):
        """Log message to both console and file"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_line = f"[{timestamp}] [{level}] {message}"
        print(log_line)
        with open(self.log_file, "a") as f:
            f.write(log_line + "\n")

    def error(self, message: str):
        """Log error message"""
        self.log(message, "ERROR")
        with open(self.error_log, "a") as f:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"[{timestamp}] {message}\n")

    def success(self, message: str):
        """Log success message with emoji"""
        self.log(f"✅ {message}", "SUCCESS")

    def warning(self, message: str):
        """Log warning message with emoji"""
        self.log(f"⚠️  {message}", "WARNING")

    def info(self, message: str):
        """Log info message"""
        self.log(f"ℹ️  {message}", "INFO")


logger = Logger(LOG_FILE)


def parse_servings(yields_str: Optional[str]) -> Optional[int]:
    """
    Parse servings from recipe yields string
    Examples: "4 servings", "Makes 12 cookies", "6-8 servings"
    """
    if not yields_str:
        return None

    # Try to extract first number
    match = re.search(r'(\d+)', yields_str)
    if match:
        return int(match.group(1))

    return None


def parse_instructions(instructions: str) -> str:
    """
    Parse instructions - recipe-scrapers returns as single string
    Keep as-is per schema (text field, not JSON array)
    """
    if not instructions:
        return ""

    # Clean up excessive whitespace
    instructions = re.sub(r'\s+', ' ', instructions).strip()
    return instructions


def scrape_recipe(url: str, metadata: Dict[str, str], attempt: int = 1) -> Optional[Dict[str, Any]]:
    """
    Scrape a single recipe with retry logic

    Args:
        url: Recipe URL
        metadata: Additional metadata (author, category, notes)
        attempt: Current retry attempt (1-indexed)

    Returns:
        Dict with raw scraped data, or None if failed
    """
    try:
        logger.info(f"Scraping (attempt {attempt}/{MAX_RETRIES}): {url}")

        # Scrape recipe
        scraper = scrape_me(url)

        # Extract all available data
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

        logger.success(f"Scraped: {raw_data['title']}")
        return raw_data

    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)

        if "404" in error_msg or "Not Found" in error_msg:
            logger.warning(f"Recipe not found (404): {url}")
            logger.error(f"404 Error: {url} - {error_msg}")
            return None

        if attempt < MAX_RETRIES:
            wait_time = RETRY_BACKOFF ** attempt
            logger.warning(f"Retry {attempt}/{MAX_RETRIES} failed: {error_type}")
            logger.info(f"Waiting {wait_time}s before retry...")
            time.sleep(wait_time)
            return scrape_recipe(url, metadata, attempt + 1)
        else:
            logger.error(f"Failed after {MAX_RETRIES} attempts: {url}")
            logger.error(f"Error: {error_type} - {error_msg}")
            return None


def transform_to_schema(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform raw scraped data to Joanie's Kitchen database schema
    Matches src/lib/db/schema.ts recipes table
    """
    # Parse servings
    servings = parse_servings(raw_data.get('yields'))

    # Parse instructions
    instructions = parse_instructions(raw_data.get('instructions', ''))

    # Build tags array from category
    tags = []
    if raw_data.get('category'):
        tags.append(raw_data['category'])
    if raw_data['metadata'].get('category'):
        tags.append(raw_data['metadata']['category'])

    # Remove duplicates while preserving order
    tags = list(dict.fromkeys(tags))

    # Build images array (single image)
    images = []
    if raw_data.get('image'):
        images.append(raw_data['image'])

    # Create database-ready record
    transformed = {
        "id": str(uuid.uuid4()),
        "user_id": "system",  # System recipes
        "chef_id": None,
        "name": raw_data['title'],
        "description": raw_data.get('description'),
        "ingredients": json.dumps(raw_data.get('ingredients', [])),  # JSON array
        "instructions": instructions,  # Plain text
        "prep_time": raw_data.get('prep_time'),
        "cook_time": raw_data.get('cook_time'),
        "servings": servings,
        "difficulty": None,  # Not provided by scraper
        "cuisine": raw_data.get('cuisine'),
        "tags": json.dumps(tags),  # JSON array
        "image_url": None,  # Deprecated field
        "images": json.dumps(images),  # JSON array
        "is_ai_generated": False,
        "is_public": True,
        "is_system_recipe": True,
        "nutrition_info": None,  # Not consistently available
        "model_used": None,
        "source": raw_data['url'],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        # Enhanced fields (optional)
        "search_query": None,
        "discovery_date": datetime.now().isoformat(),
        "confidence_score": None,
        "validation_model": None,
        "embedding_model": None,
        "discovery_week": None,
        "discovery_year": None,
        "published_date": None,
        "system_rating": None,
        "system_rating_reason": None,
        "avg_user_rating": None,
        "total_user_ratings": 0,
        # Metadata for reference
        "_metadata": {
            "author": raw_data['metadata'].get('author'),
            "category": raw_data['metadata'].get('category'),
            "notes": raw_data['metadata'].get('notes'),
            "scraped_author": raw_data.get('author'),
            "scraped_ratings": raw_data.get('ratings'),
            "scraped_at": raw_data['scraped_at'],
        }
    }

    return transformed


def validate_recipe(recipe: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate recipe has all required fields with quality checks

    Returns:
        (is_valid, list_of_issues)
    """
    issues = []

    # Required fields
    if not recipe.get('name'):
        issues.append("Missing name")

    # Ingredients validation
    try:
        ingredients = json.loads(recipe.get('ingredients', '[]'))
        if not ingredients or len(ingredients) == 0:
            issues.append("No ingredients")
    except json.JSONDecodeError:
        issues.append("Invalid ingredients JSON")

    # Instructions validation
    if not recipe.get('instructions'):
        issues.append("No instructions")
    elif len(recipe['instructions']) < 50:
        issues.append("Instructions too short (< 50 chars)")

    # Image validation
    try:
        images = json.loads(recipe.get('images', '[]'))
        if not images or len(images) == 0:
            issues.append("No images")
    except json.JSONDecodeError:
        issues.append("Invalid images JSON")

    # Source validation
    if not recipe.get('source'):
        issues.append("Missing source URL")

    is_valid = len(issues) == 0
    return is_valid, issues


def main():
    """Main scraping workflow"""
    logger.info("=" * 70)
    logger.info("SERIOUS EATS TOP 50 RECIPE SCRAPER")
    logger.info("=" * 70)
    logger.info(f"Output directory: {OUTPUT_DIR}")
    logger.info(f"Log file: {LOG_FILE}")
    logger.info(f"Error log: {ERROR_LOG_FILE}")

    # Load URLs
    logger.info(f"Loading URLs from: {URLS_FILE}")
    try:
        with open(URLS_FILE, 'r') as f:
            url_data = json.load(f)
        logger.success(f"Loaded {len(url_data)} recipe URLs")
    except FileNotFoundError:
        logger.error(f"URLs file not found: {URLS_FILE}")
        return 1
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in URLs file: {e}")
        return 1

    # Scrape recipes
    logger.info("=" * 70)
    logger.info("STARTING SCRAPING")
    logger.info("=" * 70)

    raw_recipes = []
    failed_urls = []

    for i, recipe_info in enumerate(url_data, 1):
        url = recipe_info['url']
        metadata = {
            "author": recipe_info.get('author'),
            "category": recipe_info.get('category'),
            "notes": recipe_info.get('notes'),
        }

        logger.info(f"\n[{i}/{len(url_data)}] Processing: {url}")

        # Scrape recipe
        raw_data = scrape_recipe(url, metadata)

        if raw_data:
            raw_recipes.append(raw_data)
        else:
            failed_urls.append(url)

        # Rate limiting (skip on last recipe)
        if i < len(url_data):
            logger.info(f"Rate limiting: waiting {RATE_LIMIT_SECONDS}s...")
            time.sleep(RATE_LIMIT_SECONDS)

    # Save raw data
    raw_output = OUTPUT_DIR / "top50-raw.json"
    logger.info(f"\nSaving raw data to: {raw_output}")
    with open(raw_output, 'w') as f:
        json.dump(raw_recipes, f, indent=2)
    logger.success(f"Saved {len(raw_recipes)} raw recipes")

    # Transform to database schema
    logger.info("=" * 70)
    logger.info("TRANSFORMING TO DATABASE SCHEMA")
    logger.info("=" * 70)

    transformed_recipes = []
    validation_failures = []

    for raw_data in raw_recipes:
        # Transform
        transformed = transform_to_schema(raw_data)

        # Validate
        is_valid, issues = validate_recipe(transformed)

        if is_valid:
            transformed_recipes.append(transformed)
            logger.success(f"Validated: {transformed['name']}")
        else:
            validation_failures.append({
                "recipe": transformed['name'],
                "url": transformed['source'],
                "issues": issues
            })
            logger.warning(f"Validation issues for {transformed['name']}: {', '.join(issues)}")
            # Still include recipe with flag
            transformed['_validation_issues'] = issues
            transformed_recipes.append(transformed)

    # Save transformed data
    transformed_output = OUTPUT_DIR / "top50-transformed.json"
    logger.info(f"\nSaving transformed data to: {transformed_output}")
    with open(transformed_output, 'w') as f:
        json.dump(transformed_recipes, f, indent=2)
    logger.success(f"Saved {len(transformed_recipes)} transformed recipes")

    # Summary
    logger.info("=" * 70)
    logger.info("SUMMARY")
    logger.info("=" * 70)

    success_count = len(raw_recipes)
    failed_count = len(failed_urls)
    total_count = len(url_data)
    success_rate = (success_count / total_count * 100) if total_count > 0 else 0

    logger.info(f"\n📊 Scraping Results:")
    logger.success(f"  Successful: {success_count}/{total_count} ({success_rate:.1f}%)")
    if failed_count > 0:
        logger.error(f"  Failed: {failed_count}/{total_count}")

    logger.info(f"\n📊 Validation Results:")
    valid_count = len(transformed_recipes) - len(validation_failures)
    logger.success(f"  Valid: {valid_count}/{len(transformed_recipes)}")
    if validation_failures:
        logger.warning(f"  Issues found: {len(validation_failures)}/{len(transformed_recipes)}")

    # Quality checks
    logger.info(f"\n📊 Quality Checks:")
    recipes_with_images = sum(1 for r in transformed_recipes if json.loads(r.get('images', '[]')))
    recipes_with_prep_time = sum(1 for r in transformed_recipes if r.get('prep_time'))
    recipes_with_cook_time = sum(1 for r in transformed_recipes if r.get('cook_time'))
    recipes_with_servings = sum(1 for r in transformed_recipes if r.get('servings'))

    logger.info(f"  With images: {recipes_with_images}/{len(transformed_recipes)}")
    logger.info(f"  With prep time: {recipes_with_prep_time}/{len(transformed_recipes)}")
    logger.info(f"  With cook time: {recipes_with_cook_time}/{len(transformed_recipes)}")
    logger.info(f"  With servings: {recipes_with_servings}/{len(transformed_recipes)}")

    # Failed URLs
    if failed_urls:
        logger.warning(f"\n❌ Failed URLs ({len(failed_urls)}):")
        for url in failed_urls:
            logger.warning(f"  - {url}")

    # Validation failures
    if validation_failures:
        logger.warning(f"\n⚠️  Validation Issues ({len(validation_failures)}):")
        for failure in validation_failures:
            logger.warning(f"  - {failure['recipe']}: {', '.join(failure['issues'])}")

    # Final status
    logger.info("\n" + "=" * 70)
    if success_rate >= 90:
        logger.success("🎉 SUCCESS! Scraping complete with 90%+ success rate")
        logger.info("\n📁 Output files:")
        logger.info(f"  - Raw data: {raw_output}")
        logger.info(f"  - Transformed: {transformed_output}")
        logger.info(f"  - Log: {LOG_FILE}")
        logger.info(f"  - Errors: {ERROR_LOG_FILE}")
        logger.info("\n✅ Ready for database import!")
        return 0
    else:
        logger.warning(f"⚠️  Completed with {success_rate:.1f}% success rate (target: 90%)")
        logger.info("Review error log for details")
        return 1


if __name__ == "__main__":
    sys.exit(main())
