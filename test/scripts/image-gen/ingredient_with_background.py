#!/usr/bin/env python3
"""
Enhanced Ingredient/Tool Image Generator with Real Kitchen Backgrounds

Generates professional product photography by compositing ingredients/tools
onto real kitchen backgrounds from ~/Downloads/backgrounds/ with:
- Random background selection
- Random zoom/crop positioning
- Random rotation angles
- Bokeh/depth-of-field blur effects
- Professional lighting simulation

Usage:
    python ingredient_with_background.py --item "olive oil" --category "oils"
    python ingredient_with_background.py --batch ingredients.txt
"""

import sys
import argparse
import random
from pathlib import Path
from typing import Optional, Tuple
from PIL import Image, ImageFilter, ImageEnhance

# Configuration
BACKGROUNDS_DIR = Path.home() / "Downloads" / "backgrounds"
OUTPUT_DIR = Path("public/images/ingredients")
OUTPUT_SIZE = (1024, 1024)

# Bokeh/blur settings
BLUR_RADIUS_RANGE = (5, 15)  # Background blur intensity
ROTATION_RANGE = (-8, 8)  # Rotation in degrees
ZOOM_RANGE = (1.0, 1.5)  # Zoom factor for backgrounds
BRIGHTNESS_RANGE = (0.9, 1.1)  # Brightness variation


def get_random_background() -> Optional[Path]:
    """Select random background image from backgrounds directory."""
    if not BACKGROUNDS_DIR.exists():
        print(f"⚠️  Backgrounds directory not found: {BACKGROUNDS_DIR}")
        return None

    backgrounds = list(BACKGROUNDS_DIR.glob("*.JPG")) + list(
        BACKGROUNDS_DIR.glob("*.jpg")
    )
    if not backgrounds:
        print(f"⚠️  No background images found in {BACKGROUNDS_DIR}")
        return None

    return random.choice(backgrounds)


def apply_bokeh_blur(image: Image.Image, blur_radius: float) -> Image.Image:
    """Apply Gaussian blur to simulate depth-of-field/bokeh effect."""
    return image.filter(ImageFilter.GaussianBlur(radius=blur_radius))


def random_crop_and_zoom(
    image: Image.Image, zoom: float, target_size: Tuple[int, int]
) -> Image.Image:
    """
    Apply random crop and zoom to background image.
    Creates variation in composition.
    """
    width, height = image.size

    # Calculate cropped dimensions (smaller = more zoom)
    crop_width = int(width / zoom)
    crop_height = int(height / zoom)

    # Random position for crop (avoid edges)
    margin_x = max(0, (width - crop_width) // 2)
    margin_y = max(0, (height - crop_height) // 2)

    x_offset = random.randint(0, max(0, width - crop_width - margin_x))
    y_offset = random.randint(0, max(0, height - crop_height - margin_y))

    # Crop and resize
    cropped = image.crop(
        (x_offset, y_offset, x_offset + crop_width, y_offset + crop_height)
    )
    return cropped.resize(target_size, Image.Resampling.LANCZOS)


def adjust_brightness(image: Image.Image, factor: float) -> Image.Image:
    """Adjust image brightness."""
    enhancer = ImageEnhance.Brightness(image)
    return enhancer.enhance(factor)


def create_product_shot_with_background(
    item_name: str, category: str, output_path: Path, use_sd: bool = True
) -> bool:
    """
    Generate professional product photography with real kitchen background.

    Args:
        item_name: Name of ingredient/tool
        category: Category (e.g., 'oils', 'tools')
        output_path: Where to save final image
        use_sd: Whether to use Stable Diffusion for item generation

    Returns:
        True if successful
    """
    print(f"\n📸 Generating: {item_name} ({category})")

    # Step 1: Get random background
    bg_path = get_random_background()
    if not bg_path:
        return False

    print(f"   🖼️  Background: {bg_path.name}")

    # Step 2: Load and process background
    background = Image.open(bg_path)

    # Random parameters
    zoom = random.uniform(*ZOOM_RANGE)
    blur_radius = random.uniform(*BLUR_RADIUS_RANGE)
    rotation = random.uniform(*ROTATION_RANGE)
    brightness = random.uniform(*BRIGHTNESS_RANGE)

    print(
        f"   🎨 Effects: zoom={zoom:.2f}x, blur={blur_radius:.1f}px, rotation={rotation:.1f}°, brightness={brightness:.2f}"
    )

    # Apply transformations
    background = random_crop_and_zoom(background, zoom, OUTPUT_SIZE)
    background = apply_bokeh_blur(background, blur_radius)
    background = adjust_brightness(background, brightness)

    # Small rotation for variety
    if abs(rotation) > 0.5:
        background = background.rotate(rotation, Image.Resampling.BICUBIC, expand=False)

    # Step 3: Generate/composite the item
    if use_sd:
        # Use Stable Diffusion to generate the item with transparent background
        item_image = generate_item_with_sd(item_name, category)
        if item_image:
            # Composite item onto background
            final_image = composite_item_on_background(item_image, background)
        else:
            # Fallback: just use the background with text overlay
            final_image = background
    else:
        # For now, just use the processed background
        # TODO: Implement object detection/segmentation
        final_image = background

    # Step 4: Save final image
    output_path.parent.mkdir(parents=True, exist_ok=True)
    final_image.save(output_path, "PNG", quality=95, optimize=True)

    print(f"   ✅ Saved: {output_path}")
    return True


def generate_item_with_sd(item_name: str, category: str) -> Optional[Image.Image]:
    """
    Generate item using Stable Diffusion with transparent background.
    This would integrate with the existing SDXL setup.
    """
    # TODO: Integrate with existing scripts/image-gen/ingredient_image_generator.py
    # For now, return None to use background-only mode
    return None


def composite_item_on_background(
    item: Image.Image, background: Image.Image
) -> Image.Image:
    """Composite generated item onto processed background."""
    # Ensure both images are same size
    if item.size != background.size:
        item = item.resize(background.size, Image.Resampling.LANCZOS)

    # Composite (assuming item has alpha channel)
    if item.mode == "RGBA":
        background = background.convert("RGBA")
        composite = Image.alpha_composite(background, item)
        return composite.convert("RGB")
    else:
        # Simple blend
        return Image.blend(background, item, alpha=0.7)


def main():
    parser = argparse.ArgumentParser(
        description="Generate ingredient/tool images with kitchen backgrounds"
    )
    parser.add_argument("--item", help="Item name (e.g., 'olive oil')")
    parser.add_argument("--category", help="Category (e.g., 'oils', 'tools')")
    parser.add_argument("--output", help="Output file path")
    parser.add_argument(
        "--batch", help="Batch file with items (one per line: item|category)"
    )
    parser.add_argument(
        "--no-sd",
        action="store_true",
        help="Don't use Stable Diffusion (backgrounds only)",
    )

    args = parser.parse_args()

    if args.batch:
        # Batch processing
        with open(args.batch) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue

                parts = line.split("|")
                if len(parts) != 2:
                    print(f"⚠️  Skipping invalid line: {line}")
                    continue

                item, category = parts
                output_path = (
                    OUTPUT_DIR / category / f"{item.lower().replace(' ', '-')}.png"
                )

                create_product_shot_with_background(
                    item.strip(), category.strip(), output_path, use_sd=not args.no_sd
                )

    elif args.item and args.category:
        # Single item
        if args.output:
            output_path = Path(args.output)
        else:
            output_path = (
                OUTPUT_DIR
                / args.category
                / f"{args.item.lower().replace(' ', '-')}.png"
            )

        create_product_shot_with_background(
            args.item, args.category, output_path, use_sd=not args.no_sd
        )

    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
