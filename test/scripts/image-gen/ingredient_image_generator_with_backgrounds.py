#!/usr/bin/env python3
"""
Enhanced Ingredient Image Generator with Real Kitchen Backgrounds.

Uses actual kitchen background photos for authentic food photography.

Usage:
    # Generate with random kitchen background
    python scripts/image-gen/ingredient_image_generator_with_backgrounds.py \
        --ingredient "Tomato"

    # Batch generate from file
    python scripts/image-gen/ingredient_image_generator_with_backgrounds.py \
        --batch tmp/ingredients-names-only.txt \
        --output-dir public/images/ingredients
"""

import argparse
import random
import sys
import time
from pathlib import Path
from typing import List, Optional

import torch
from diffusers import StableDiffusionXLImg2ImgPipeline
from PIL import Image


class EnhancedIngredientImageGenerator:
    """Generate ingredient photography with real kitchen backgrounds."""

    def __init__(self, backgrounds_dir: str = "public/images/backgrounds"):
        """Initialize the generator."""
        self.backgrounds_dir = Path(backgrounds_dir)
        self.backgrounds = self._load_backgrounds()

        self.config = {
            "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
            "device": "mps",
            "dtype": torch.float32,
            "steps": 40,  # More steps for better photorealism
            "guidance": 8.0,  # Lower guidance = less AI artifacts, more natural
            "strength": 0.85,  # Very high strength = foreground focus
            "height": 1024,
            "width": 1024,
        }
        self.pipe = None
        self._load_model()

    def _load_backgrounds(self) -> List[Path]:
        """Load all background images."""
        backgrounds = list(self.backgrounds_dir.glob("*.JPG"))
        backgrounds.extend(self.backgrounds_dir.glob("*.jpg"))
        backgrounds.extend(self.backgrounds_dir.glob("*.png"))

        if not backgrounds:
            print(f"⚠️  No backgrounds found in {self.backgrounds_dir}")
            print("   Using text-to-image mode instead")
            return []

        print(f"✓ Loaded {len(backgrounds)} kitchen backgrounds")
        return backgrounds

    def _load_model(self):
        """Load the Stable Diffusion XL model for img2img."""
        print(f"Loading model: {self.config['model_id']}")
        print(f"Device: {self.config['device']}")
        print()

        # Use img2img pipeline for background compositing
        self.pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
            self.config["model_id"],
            torch_dtype=self.config["dtype"],
            use_safetensors=True,
            variant=None,  # Use full precision for MPS
        )

        self.pipe = self.pipe.to(self.config["device"])
        print("✓ Model loaded successfully\n")

    def _get_random_background(self) -> Optional[Image.Image]:
        """Get a random kitchen background image."""
        if not self.backgrounds:
            return None

        bg_path = random.choice(self.backgrounds)
        img = Image.open(bg_path)

        # Resize to target dimensions while maintaining aspect ratio
        img.thumbnail((1024, 1024), Image.Resampling.LANCZOS)

        # Create 1024x1024 canvas and paste centered
        canvas = Image.new("RGB", (1024, 1024), (255, 255, 255))
        offset = ((1024 - img.size[0]) // 2, (1024 - img.size[1]) // 2)
        canvas.paste(img, offset)

        return canvas

    def _build_ingredient_prompt(self, ingredient_name: str) -> tuple[str, str]:
        """Build optimized prompt for ingredient on kitchen background."""

        # Check if this ingredient typically has water droplets
        fresh_produce = [
            "lettuce",
            "spinach",
            "kale",
            "arugula",
            "tomato",
            "cucumber",
            "bell pepper",
            "carrot",
            "celery",
            "apple",
            "grape",
            "berry",
            "strawberry",
            "blueberry",
            "raspberry",
            "blackberry",
            "cherry",
            "orange",
            "lemon",
            "lime",
            "peach",
            "plum",
            "nectarine",
            "watermelon",
        ]
        has_droplets = any(
            produce in ingredient_name.lower() for produce in fresh_produce
        )

        # Determine portion size and presentation
        is_herb = any(
            h in ingredient_name.lower()
            for h in [
                "herb",
                "basil",
                "parsley",
                "cilantro",
                "thyme",
                "rosemary",
                "mint",
                "oregano",
                "sage",
            ]
        )
        is_packaged = any(
            p in ingredient_name.lower()
            for p in ["milk", "cream", "bottle", "can", "package", "box", "jar"]
        )

        # Randomize surface for variety (including induction stove)
        import random

        surfaces = ["wooden cutting board", "marble countertop", "induction cooktop"]

        if is_herb:
            ingredient_descriptor = f"fresh bunch of {ingredient_name}"
            surface = random.choice(surfaces)
        elif is_packaged:
            ingredient_descriptor = f"{ingredient_name}"
            surface = random.choice(
                ["kitchen counter", "marble countertop", "induction cooktop"]
            )
        else:
            ingredient_descriptor = f"fresh {ingredient_name}"
            surface = random.choice(surfaces)

        # Optimized prompt under 77 tokens - emphasize photorealism
        ingredient_style = (
            f"{ingredient_descriptor} centered, "
            f"filling 70% of frame, "
            f"on {surface}, "
            "photorealistic, "
            "Canon EOS R5, "
            "f/1.4 bokeh, "
            "natural imperfections, "
            "organic texture, "
            "kitchen blurred background"
        )

        # Add water droplets for fresh produce
        if has_droplets:
            ingredient_style += "subtle water droplets, "

        # Complete the style
        ingredient_style += (
            "organic texture details, " "high resolution, " "RAW photo quality"
        )

        # Optimized negative prompt under 77 tokens - prevent fake/artificial look
        negative_prompt = (
            "text, words, labels, watermark, "
            "sharp background, deep focus, "
            "ingredient blurry, "
            "artificial leaves, fake, plastic, "
            "CGI, 3D render, cartoon, illustration, "
            "oversaturated, perfect, "
            "synthetic, generated look, "
            "low quality, distorted"
        )

        return ingredient_style, negative_prompt

    def generate(self, ingredient_name: str, num_images: int = 1) -> List[Image.Image]:
        """Generate images for an ingredient on kitchen background."""
        prompt, neg_prompt = self._build_ingredient_prompt(ingredient_name)

        print(f"Ingredient: {ingredient_name}")
        print(f"Generating {num_images} image(s) with kitchen backgrounds...")
        print()

        images = []
        for i in range(num_images):
            start_time = time.time()

            # Get random kitchen background
            init_image = self._get_random_background()

            if init_image is None:
                print("  ⚠️  No backgrounds available, skipping...")
                continue

            with torch.inference_mode():
                result = self.pipe(
                    prompt,
                    image=init_image,
                    negative_prompt=neg_prompt,
                    num_inference_steps=self.config["steps"],
                    guidance_scale=self.config["guidance"],
                    strength=self.config["strength"],
                )

            image = result.images[0]
            images.append(image)

            gen_time = time.time() - start_time
            print(f"  Image {i+1}/{num_images} generated in {gen_time:.1f}s")

        return images

    def save_images(
        self, images: List[Image.Image], ingredient_name: str, output_dir: Path
    ) -> List[Path]:
        """Save generated images with metadata."""
        output_dir.mkdir(parents=True, exist_ok=True)

        # Sanitize ingredient name for filename
        safe_name = (
            "".join(
                c if c.isalnum() or c in (" ", "-", "_") else "_"
                for c in ingredient_name
            )
            .lower()
            .replace(" ", "_")
        )

        saved_paths = []
        for i, image in enumerate(images):
            # Single image: ingredient_name.png
            # Multiple: ingredient_name_1.png, ingredient_name_2.png, etc.
            if len(images) == 1:
                filename = f"{safe_name}.png"
            else:
                filename = f"{safe_name}_{i+1}.png"

            filepath = output_dir / filename
            image.save(filepath, "PNG", optimize=True)

            print(f"✓ Saved: {filepath}")
            print(f"  Size: {filepath.stat().st_size / 1024:.1f}KB")

            saved_paths.append(filepath)

        return saved_paths


def main():
    parser = argparse.ArgumentParser(
        description="Generate ingredient images with real kitchen backgrounds"
    )
    parser.add_argument(
        "--ingredient", type=str, help="Single ingredient name to generate"
    )
    parser.add_argument(
        "--batch", type=Path, help="File with ingredient names (one per line)"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("output/ingredients"),
        help="Output directory for generated images",
    )
    parser.add_argument(
        "--backgrounds-dir",
        type=str,
        default="public/images/backgrounds",
        help="Directory with kitchen background images",
    )
    parser.add_argument(
        "--num-images", type=int, default=1, help="Number of images per ingredient"
    )

    args = parser.parse_args()

    # Validate inputs
    if not args.ingredient and not args.batch:
        print("Error: Either --ingredient or --batch must be provided")
        parser.print_help()
        sys.exit(1)

    # Initialize generator
    generator = EnhancedIngredientImageGenerator(backgrounds_dir=args.backgrounds_dir)

    # Generate for single ingredient
    if args.ingredient:
        images = generator.generate(args.ingredient, args.num_images)
        if images:
            generator.save_images(images, args.ingredient, args.output_dir)
        print()

    # Batch generate
    elif args.batch:
        if not args.batch.exists():
            print(f"Error: Batch file not found: {args.batch}")
            sys.exit(1)

        # Read ingredients
        with open(args.batch) as f:
            ingredients = [line.strip() for line in f if line.strip()]

        print(f"Batch processing {len(ingredients)} ingredients")
        print(f"Output directory: {args.output_dir}")
        print()

        # Process each ingredient
        for idx, ingredient in enumerate(ingredients, 1):
            print(f"[{idx}/{len(ingredients)}] Processing: {ingredient}")

            images = generator.generate(ingredient, args.num_images)
            if images:
                generator.save_images(images, ingredient, args.output_dir)

            print()

        print(f"✓ Batch complete: {len(ingredients)} ingredients processed")


if __name__ == "__main__":
    main()
