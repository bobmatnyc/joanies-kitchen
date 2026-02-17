#!/usr/bin/env python3
"""
Extract Recipe URLs from Food & Wine Chef Pages
Extracts all recipe links from a chef's profile page on Food & Wine

Usage:
    python scripts/extract-foodandwine-chef-urls.py <chef_url> <output_file>

Example:
    python scripts/extract-foodandwine-chef-urls.py \
        https://www.foodandwine.com/chefs/nancy-silverton \
        scripts/nancy-silverton-urls.json
"""

import json
import sys
import time
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse


def extract_recipe_urls(chef_url: str, max_pages: int = 10) -> list:
    """
    Extract all recipe URLs from a Food & Wine chef page

    Args:
        chef_url: URL of the chef's profile page
        max_pages: Maximum pages to scrape (pagination handling)

    Returns:
        List of recipe URLs
    """
    print(f"\n{'='*70}")
    print(f"Extracting recipes from: {chef_url}")
    print("=" * 70)

    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    all_recipe_urls = []
    page_num = 1

    while page_num <= max_pages:
        print(f"\nFetching page {page_num}...")

        # Handle pagination (Food & Wine may use query params)
        if page_num == 1:
            url = chef_url
        else:
            # Common pagination patterns
            url = f"{chef_url}?page={page_num}"

        try:
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            print(f"✅ Fetched page {page_num} (status: {response.status_code})")

            # Parse HTML
            soup = BeautifulSoup(response.content, "html.parser")

            # Find recipe links
            # Food & Wine uses various patterns, try multiple selectors
            recipe_links = []

            # Method 1: Links with /recipes/ in URL
            for link in soup.find_all("a", href=True):
                href = link["href"]
                # Convert relative URLs to absolute
                absolute_url = urljoin(chef_url, href)

                # Check if it's a recipe URL
                if "/recipes/" in absolute_url and "foodandwine.com" in absolute_url:
                    # Skip gallery/collection pages
                    if (
                        "/gallery/" not in absolute_url
                        and "/collection/" not in absolute_url
                    ):
                        recipe_links.append(absolute_url)

            # Remove duplicates while preserving order
            recipe_links = list(dict.fromkeys(recipe_links))

            if recipe_links:
                print(f"✅ Found {len(recipe_links)} recipe URLs on page {page_num}")
                all_recipe_urls.extend(recipe_links)

                # Check if there's a next page
                # Look for pagination links
                next_page = (
                    soup.find("a", {"rel": "next"})
                    or soup.find("a", string="Next")
                    or soup.find(
                        "a", class_=lambda c: c and "next" in c.lower() if c else False
                    )
                )

                if not next_page and page_num == 1:
                    # No pagination found, stop after first page
                    print("\nℹ️  No pagination detected, stopping after page 1")
                    break

                if not next_page:
                    print(f"\nℹ️  No more pages found, stopping at page {page_num}")
                    break

                # Rate limiting
                print("⏱️  Rate limiting: waiting 2 seconds...")
                time.sleep(2)
                page_num += 1
            else:
                print(f"⚠️  No recipe URLs found on page {page_num}, stopping")
                break

        except requests.exceptions.RequestException as e:
            print(f"❌ Error fetching page {page_num}: {type(e).__name__}")
            print(f"   {str(e)}")
            break

    # Remove duplicates from all pages
    all_recipe_urls = list(dict.fromkeys(all_recipe_urls))

    print(f"\n{'='*70}")
    print(f"✅ Total recipes found: {len(all_recipe_urls)}")
    print("=" * 70)

    return all_recipe_urls


def main():
    """Main execution"""
    if len(sys.argv) < 3:
        print(
            "\nUsage: python extract-foodandwine-chef-urls.py <chef_url> <output_file>"
        )
        print("\nExample:")
        print("  python scripts/extract-foodandwine-chef-urls.py \\")
        print("    https://www.foodandwine.com/chefs/nancy-silverton \\")
        print("    scripts/nancy-silverton-urls.json")
        return 1

    chef_url = sys.argv[1]
    output_file = Path(sys.argv[2])

    # Extract chef name from URL
    chef_name = urlparse(chef_url).path.split("/")[-1].replace("-", " ").title()

    print(f"\n{'='*70}")
    print("FOOD & WINE CHEF URL EXTRACTOR")
    print("=" * 70)
    print(f"Chef: {chef_name}")
    print(f"URL: {chef_url}")
    print(f"Output: {output_file}")

    # Extract URLs
    recipe_urls = extract_recipe_urls(chef_url)

    if not recipe_urls:
        print(
            "\n❌ No recipes found. Check the URL or site structure may have changed."
        )
        return 1

    # Prepare data for output
    recipes_data = []
    for i, url in enumerate(recipe_urls, 1):
        # Extract recipe slug from URL
        slug = urlparse(url).path.split("/")[-1]

        recipes_data.append(
            {
                "url": url,
                "slug": slug,
                "author": chef_name,
                "source": "Food & Wine",
                "chef_page": chef_url,
                "extraction_order": i,
            }
        )

    # Save to file
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w") as f:
        json.dump(recipes_data, f, indent=2)

    print(f"\n✅ Saved {len(recipes_data)} recipe URLs to: {output_file}")

    # Show sample
    print("\n📋 Sample recipes (first 5):")
    for recipe in recipes_data[:5]:
        print(f"  - {recipe['slug']}")
        print(f"    {recipe['url']}")

    print("\n✅ Ready for scraping!")
    print("\nNext step:")
    print("  python scripts/ingest-nancy-silverton.py")

    return 0


if __name__ == "__main__":
    sys.exit(main())
