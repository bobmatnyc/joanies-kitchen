#!/usr/bin/env python3
"""
Production Recipe Scraper for Lidia Bastianich Recipes
Scrapes recipes from lidiasitaly.com using custom BeautifulSoup parser

Features:
- Custom HTML parser (lidiasitaly.com not supported by recipe-scrapers)
- Automatic recipe URL discovery from category pages
- Rate limiting (2s between requests)
- Error handling with retries (3 attempts, exponential backoff)
- Progress logging with emoji indicators
- Quality validation
- Database-ready output matching Drizzle schema

Usage:
    python scripts/ingest-lidia-bastianich.py

Output:
    - data/recipes/incoming/lidia-bastianich/recipes-raw.json (raw scraped data)
    - data/recipes/incoming/lidia-bastianich/recipes-transformed.json (database-ready)
    - tmp/lidia-bastianich-scraping-log-[timestamp].txt (detailed log)
    - tmp/lidia-bastianich-errors-[timestamp].txt (error log)

Author: Joanie's Kitchen Team
Date: 2025-10-17
"""

import json
import sys
import time
import uuid
import re
import requests
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from bs4 import BeautifulSoup

# Configuration
OUTPUT_DIR = (
    Path(__file__).parent.parent / "data" / "recipes" / "incoming" / "lidia-bastianich"
)
TMP_DIR = Path(__file__).parent.parent / "tmp"
RATE_LIMIT_SECONDS = 2
MAX_RETRIES = 3
RETRY_BACKOFF = 2
TARGET_RECIPE_COUNT = 30  # Target number of recipes to scrape

# Recipe category pages to scrape from
CATEGORY_URLS = [
    "https://lidiasitaly.com/recipes-categories/pastas-polenta-risottos/",
    "https://lidiasitaly.com/recipes-categories/main-courses/",
    "https://lidiasitaly.com/recipes-categories/chicken-turkey/",
    "https://lidiasitaly.com/recipes-categories/soups/",
    "https://lidiasitaly.com/recipes-categories/sides-vegetable/",
    "https://lidiasitaly.com/recipes-categories/salads/",
]

# HTTP Headers to avoid blocking
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

# Ensure output directories exist
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TMP_DIR.mkdir(parents=True, exist_ok=True)

# Create timestamped log files
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
LOG_FILE = TMP_DIR / f"lidia-bastianich-scraping-log-{TIMESTAMP}.txt"
ERROR_LOG_FILE = TMP_DIR / f"lidia-bastianich-errors-{TIMESTAMP}.txt"


class Logger:
    """Simple logger that writes to both console and file"""

    def __init__(self, log_file: Path):
        self.log_file = log_file
        self.error_log = ERROR_LOG_FILE

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


def fetch_recipe_urls(category_url: str, limit: int = 10) -> List[str]:
    """
    Fetch recipe URLs from a category page

    Args:
        category_url: URL of category page
        limit: Maximum number of URLs to extract

    Returns:
        List of recipe URLs
    """
    try:
        logger.info(f"Fetching recipe URLs from: {category_url}")
        response = requests.get(category_url, headers=HEADERS, timeout=15)

        if response.status_code != 200:
            logger.error(f"Failed to fetch category page: {response.status_code}")
            return []

        soup = BeautifulSoup(response.content, "html.parser")

        # Find all links to recipe pages
        # Recipe URLs follow pattern: https://lidiasitaly.com/recipes/[recipe-name]/
        recipe_links = []
        for link in soup.find_all("a", href=True):
            href = link["href"]
            if "/recipes/" in href and href.endswith("/") and href.count("/") >= 4:
                # Ensure full URL
                if not href.startswith("http"):
                    href = "https://lidiasitaly.com" + href
                if href not in recipe_links:
                    recipe_links.append(href)

        logger.success(f"Found {len(recipe_links)} recipe URLs")
        return recipe_links[:limit]

    except Exception as e:
        logger.error(f"Error fetching category URLs: {type(e).__name__} - {str(e)}")
        return []


def parse_servings(servings_text: Optional[str]) -> Optional[int]:
    """
    Parse servings from text like "Serves 6 to 8"
    Returns the first number found
    """
    if not servings_text:
        return None
    match = re.search(r"(\d+)", servings_text)
    if match:
        return int(match.group(1))
    return None


def scrape_recipe(url: str, attempt: int = 1) -> Optional[Dict[str, Any]]:
    """
    Scrape a single recipe with retry logic

    Args:
        url: Recipe URL
        attempt: Current retry attempt (1-indexed)

    Returns:
        Dict with raw scraped data, or None if failed
    """
    try:
        logger.info(f"Scraping (attempt {attempt}/{MAX_RETRIES}): {url}")

        response = requests.get(url, headers=HEADERS, timeout=15)

        if response.status_code != 200:
            logger.warning(f"HTTP {response.status_code} for {url}")
            return None

        soup = BeautifulSoup(response.content, "html.parser")

        # Extract title
        title_elem = soup.find("h1")
        title = title_elem.text.strip() if title_elem else None

        if not title:
            logger.warning(f"No title found for {url}")
            return None

        # Extract servings
        servings_text = None
        servings_h3 = soup.find("h3", string=re.compile(r"Serves", re.I))
        if servings_h3:
            servings_text = servings_h3.text.strip()

        # Extract ingredients
        ingredients = []
        ingredients_h2 = soup.find("h2", string=re.compile(r"Ingredients", re.I))
        if ingredients_h2:
            ingredients_list = ingredients_h2.find_next(["ul", "ol"])
            if ingredients_list:
                ingredients = [
                    li.text.strip()
                    for li in ingredients_list.find_all("li")
                    if li.text.strip()
                ]

        # Extract directions/instructions
        # Instructions are in <div class="recipe-text"> as <p> tags
        instructions_text = ""
        directions_h2 = soup.find("h2", string=re.compile(r"Directions", re.I))
        if directions_h2:
            # Find the recipe-text div that follows
            recipe_text_div = directions_h2.find_next("div", class_="recipe-text")

            if recipe_text_div:
                # Extract all paragraph tags
                paragraphs = recipe_text_div.find_all("p")
                instruction_parts = []

                for p in paragraphs:
                    text = p.text.strip()
                    # Skip social media text and copyright notices
                    skip_patterns = [
                        "facebook",
                        "twitter",
                        "pinterest",
                        "email",
                        "copyright",
                        "excerpted from",
                        "all rights reserved",
                    ]
                    if (
                        text
                        and not any(
                            pattern in text.lower() for pattern in skip_patterns
                        )
                        and len(text) > 20
                    ):
                        instruction_parts.append(text)

                instructions_text = "\n\n".join(instruction_parts)

        # Extract notes
        notes = None
        notes_h2 = soup.find("h2", string=re.compile(r"Notes", re.I))
        if notes_h2:
            notes_content = notes_h2.find_next(["p", "div"])
            if notes_content:
                notes = notes_content.text.strip()

        # Extract description (if available)
        description = notes  # Use notes as description for now

        # Extract images
        images = soup.find_all("img")
        image_urls = []
        for img in images:
            src = img.get("src") or img.get("data-src", "")
            # Filter for actual recipe images (not logos, icons, etc.)
            if (
                src
                and any(
                    word in src.lower() for word in ["upload", "wp-content/uploads"]
                )
                and not any(word in src.lower() for word in ["logo", "icon", "button"])
            ):
                if src not in image_urls:
                    image_urls.append(src)

        # Build raw data structure
        raw_data = {
            "url": url,
            "scraped_at": datetime.now().isoformat(),
            "title": title,
            "author": "Lidia Bastianich",
            "description": description,
            "servings_text": servings_text,
            "ingredients": ingredients,
            "instructions": instructions_text,
            "notes": notes,
            "images": image_urls,
            "cuisine": "Italian",
        }

        logger.success(f"Scraped: {title}")
        return raw_data

    except Exception as e:
        error_type = type(e).__name__
        error_msg = str(e)

        if attempt < MAX_RETRIES:
            wait_time = RETRY_BACKOFF**attempt
            logger.warning(f"Retry {attempt}/{MAX_RETRIES} failed: {error_type}")
            logger.info(f"Waiting {wait_time}s before retry...")
            time.sleep(wait_time)
            return scrape_recipe(url, attempt + 1)
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
    servings = parse_servings(raw_data.get("servings_text"))

    # Build tags array
    tags = ["Italian", "Lidia Bastianich"]

    # Create database-ready record
    transformed = {
        "id": str(uuid.uuid4()),
        "user_id": "system",  # System recipes
        "chef_id": None,  # Will be set when chef profile created
        "name": raw_data["title"],
        "description": raw_data.get("description"),
        "ingredients": json.dumps(raw_data.get("ingredients", [])),
        "instructions": raw_data.get("instructions", ""),
        "prep_time": None,  # Not provided on site
        "cook_time": None,  # Not provided on site
        "servings": servings,
        "difficulty": None,
        "cuisine": "Italian",
        "tags": json.dumps(tags),
        "image_url": None,  # Deprecated
        "images": json.dumps(raw_data.get("images", [])),
        "is_ai_generated": False,
        "is_public": True,
        "is_system_recipe": True,
        "nutrition_info": None,
        "model_used": None,
        "source": raw_data["url"],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat(),
        "_metadata": {
            "chef": "Lidia Bastianich",
            "scraped_at": raw_data["scraped_at"],
            "servings_text": raw_data.get("servings_text"),
            "notes": raw_data.get("notes"),
        },
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
    if not recipe.get("name"):
        issues.append("Missing name")

    # Ingredients validation
    try:
        ingredients = json.loads(recipe.get("ingredients", "[]"))
        if not ingredients or len(ingredients) == 0:
            issues.append("No ingredients")
        elif len(ingredients) < 3:
            issues.append(f"Too few ingredients ({len(ingredients)})")
    except json.JSONDecodeError:
        issues.append("Invalid ingredients JSON")

    # Instructions validation
    if not recipe.get("instructions"):
        issues.append("No instructions")
    elif len(recipe["instructions"]) < 50:
        issues.append("Instructions too short")

    # Source validation
    if not recipe.get("source"):
        issues.append("Missing source URL")

    is_valid = len(issues) == 0
    return is_valid, issues


def main():
    """Main scraping workflow"""
    logger.info("=" * 70)
    logger.info("LIDIA BASTIANICH RECIPE SCRAPER")
    logger.info("=" * 70)
    logger.info(f"Output directory: {OUTPUT_DIR}")
    logger.info(f"Log file: {LOG_FILE}")
    logger.info(f"Target: {TARGET_RECIPE_COUNT} recipes")

    # Collect recipe URLs from all category pages
    logger.info("=" * 70)
    logger.info("DISCOVERING RECIPE URLS")
    logger.info("=" * 70)

    all_recipe_urls = []
    for category_url in CATEGORY_URLS:
        urls = fetch_recipe_urls(category_url, limit=10)
        all_recipe_urls.extend(urls)
        time.sleep(RATE_LIMIT_SECONDS)  # Rate limit category requests

        if len(all_recipe_urls) >= TARGET_RECIPE_COUNT:
            break

    # Remove duplicates while preserving order
    seen = set()
    unique_urls = []
    for url in all_recipe_urls:
        if url not in seen:
            seen.add(url)
            unique_urls.append(url)

    # Limit to target count
    recipe_urls = unique_urls[:TARGET_RECIPE_COUNT]

    logger.success(f"Collected {len(recipe_urls)} unique recipe URLs")

    # Scrape recipes
    logger.info("=" * 70)
    logger.info("SCRAPING RECIPES")
    logger.info("=" * 70)

    raw_recipes = []
    failed_urls = []

    for i, url in enumerate(recipe_urls, 1):
        logger.info(f"\n[{i}/{len(recipe_urls)}] Processing: {url}")

        raw_data = scrape_recipe(url)

        if raw_data:
            raw_recipes.append(raw_data)
        else:
            failed_urls.append(url)

        # Rate limiting
        if i < len(recipe_urls):
            logger.info(f"Rate limiting: waiting {RATE_LIMIT_SECONDS}s...")
            time.sleep(RATE_LIMIT_SECONDS)

    # Save raw data
    raw_output = OUTPUT_DIR / "recipes-raw.json"
    logger.info(f"\nSaving raw data to: {raw_output}")
    with open(raw_output, "w") as f:
        json.dump(raw_recipes, f, indent=2)
    logger.success(f"Saved {len(raw_recipes)} raw recipes")

    # Transform to database schema
    logger.info("=" * 70)
    logger.info("TRANSFORMING TO DATABASE SCHEMA")
    logger.info("=" * 70)

    transformed_recipes = []
    validation_failures = []

    for raw_data in raw_recipes:
        transformed = transform_to_schema(raw_data)
        is_valid, issues = validate_recipe(transformed)

        if is_valid:
            transformed_recipes.append(transformed)
            logger.success(f"Validated: {transformed['name']}")
        else:
            validation_failures.append(
                {
                    "recipe": transformed["name"],
                    "url": transformed["source"],
                    "issues": issues,
                }
            )
            logger.warning(
                f"Validation issues for {transformed['name']}: {', '.join(issues)}"
            )
            transformed["_validation_issues"] = issues
            transformed_recipes.append(transformed)

    # Save transformed data
    transformed_output = OUTPUT_DIR / "recipes-transformed.json"
    logger.info(f"\nSaving transformed data to: {transformed_output}")
    with open(transformed_output, "w") as f:
        json.dump(transformed_recipes, f, indent=2)
    logger.success(f"Saved {len(transformed_recipes)} transformed recipes")

    # Summary
    logger.info("=" * 70)
    logger.info("SUMMARY")
    logger.info("=" * 70)

    success_count = len(raw_recipes)
    failed_count = len(failed_urls)
    total_count = len(recipe_urls)
    success_rate = (success_count / total_count * 100) if total_count > 0 else 0

    logger.info("\n📊 Scraping Results:")
    logger.success(f"  Successful: {success_count}/{total_count} ({success_rate:.1f}%)")
    if failed_count > 0:
        logger.error(f"  Failed: {failed_count}/{total_count}")

    logger.info("\n📊 Validation Results:")
    valid_count = len(transformed_recipes) - len(validation_failures)
    logger.success(f"  Valid: {valid_count}/{len(transformed_recipes)}")
    if validation_failures:
        logger.warning(f"  Issues found: {len(validation_failures)}")

    # Quality checks
    logger.info("\n📊 Quality Checks:")
    recipes_with_images = sum(
        1 for r in transformed_recipes if json.loads(r.get("images", "[]"))
    )
    recipes_with_servings = sum(1 for r in transformed_recipes if r.get("servings"))

    logger.info(f"  With images: {recipes_with_images}/{len(transformed_recipes)}")
    logger.info(f"  With servings: {recipes_with_servings}/{len(transformed_recipes)}")

    # Failed URLs
    if failed_urls:
        logger.warning(f"\n❌ Failed URLs ({len(failed_urls)}):")
        for url in failed_urls[:5]:
            logger.warning(f"  - {url}")
        if len(failed_urls) > 5:
            logger.warning(f"  ... and {len(failed_urls) - 5} more")

    # Validation failures
    if validation_failures:
        logger.warning(f"\n⚠️  Validation Issues ({len(validation_failures)}):")
        for failure in validation_failures[:5]:
            logger.warning(f"  - {failure['recipe']}: {', '.join(failure['issues'])}")
        if len(validation_failures) > 5:
            logger.warning(f"  ... and {len(validation_failures) - 5} more")

    # Final status
    logger.info("\n" + "=" * 70)
    if success_rate >= 80:
        logger.success("🎉 SUCCESS! Scraping complete")
        logger.info("\n📁 Output files:")
        logger.info(f"  - Raw data: {raw_output}")
        logger.info(f"  - Transformed: {transformed_output}")
        logger.info(f"  - Log: {LOG_FILE}")
        logger.info("\n✅ Ready for database import!")
        return 0
    else:
        logger.warning(f"⚠️  Completed with {success_rate:.1f}% success rate")
        logger.info("Review error log for details")
        return 1


if __name__ == "__main__":
    sys.exit(main())
