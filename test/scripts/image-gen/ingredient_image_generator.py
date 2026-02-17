#!/usr/bin/env python3
"""
Ingredient Image Generator for Joanie's Kitchen.

Specialized generator for ingredient photography with consistent styling.

Usage:
    # Generate single ingredient
    python scripts/image-gen/ingredient_image_generator.py --ingredient "Tomato"

    # Batch generate from database query
    python scripts/image-gen/ingredient_image_generator.py \
        --batch tmp/ingredient-batch.txt
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import List

import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image


class IngredientImageGenerator:
    """Generate ingredient photography images."""

    def __init__(self):
        """Initialize the generator."""
        self.config = {
            "model_id": "stabilityai/stable-diffusion-xl-base-1.0",
            "device": "mps",
            "dtype": torch.float32,  # Use float32 for MPS to avoid NaN issues
            "steps": 25,  # Slightly fewer steps for ingredients
            "guidance": 7.5,
            "height": 1024,
            "width": 1024,
        }
        self.pipe = None
        self._load_model()

    def _load_model(self):
        """Load the Stable Diffusion XL model."""
        print(f"Loading model: {self.config['model_id']}")
        print(f"Device: {self.config['device']}")
        print()

        if not torch.backends.mps.is_available():
            raise RuntimeError("MPS not available! Run test_mps.py to diagnose.")

        start_time = time.time()

        self.pipe = StableDiffusionXLPipeline.from_pretrained(
            self.config["model_id"],
            torch_dtype=self.config["dtype"],
            use_safetensors=True,
        )

        self.pipe.to(self.config["device"])
        self.pipe.enable_attention_slicing()

        load_time = time.time() - start_time
        print(f"✓ Model loaded in {load_time:.1f}s")
        print()

    def _build_ingredient_prompt(self, ingredient_name: str) -> tuple[str, str]:
        """Build optimized prompt for ingredient photography."""

        # Determine if this is fresh produce (gets subtle water droplets)
        fresh_produce_keywords = [
            "tomato",
            "lettuce",
            "spinach",
            "kale",
            "basil",
            "cilantro",
            "parsley",
            "cucumber",
            "pepper",
            "apple",
            "berry",
            "grape",
            "cherry",
            "peach",
            "strawberry",
            "blueberry",
            "raspberry",
            "orange",
            "lemon",
            "lime",
            "carrot",
            "celery",
            "broccoli",
            "cauliflower",
            "cabbage",
            "sprouts",
        ]

        ingredient_lower = ingredient_name.lower()
        has_droplets = any(
            keyword in ingredient_lower for keyword in fresh_produce_keywords
        )

        # Ingredient-specific enhancements
        ingredient_descriptor = f"single fresh {ingredient_name}"
        color_emphasis = ""

        # Enhance watermelon with specific descriptors
        if "watermelon" in ingredient_lower:
            ingredient_descriptor = "fresh cut watermelon slice"
            color_emphasis = "vibrant red flesh, crisp texture, juicy appearance, "

        # Base photorealistic style with kitchen context
        ingredient_style = (
            f"{ingredient_descriptor}, "
            f"{color_emphasis}"
            "macro food photography, "
            "photorealistic, "
            "shot on Canon EOS R5, "
            "100mm macro lens, "
            "soft natural lighting, "
            "placed on rustic wooden cutting board, "
            "kitchen counter setting, "
            "shallow depth of field, "
            "sharp focus on ingredient, "
            "natural imperfections, "
        )

        # Add subtle water droplets only for fresh produce
        if has_droplets:
            ingredient_style += "subtle water droplets, "

        # Complete the style
        ingredient_style += (
            "organic surface details, "
            "professional commercial photography, "
            "product shot, "
            "high resolution, "
            "RAW photo quality"
        )

        # Enhanced negative prompt to avoid artificial look and white background
        negative_prompt = (
            "artificial, "
            "plastic looking, "
            "fake, "
            "CGI, "
            "3D render, "
            "cartoon, "
            "illustration, "
            "painting, "
            "digital art, "
            "synthetic, "
            "oversaturated, "
            "overexposed, "
            "blurry, "
            "low quality, "
            "distorted, "
            "deformed, "
            "watermark, "
            "text, "
            "logo, "
            "multiple items, "
            "cluttered, "
            "white background, "
            "plain background, "
            "studio backdrop, "
            "grainy, "
            "noisy"
        )

        return ingredient_style, negative_prompt

    def generate(self, ingredient_name: str, num_images: int = 1) -> List[Image.Image]:
        """Generate images for an ingredient."""
        prompt, neg_prompt = self._build_ingredient_prompt(ingredient_name)

        print(f"Ingredient: {ingredient_name}")
        print(f"Generating {num_images} image(s)...")
        print()

        images = []
        for i in range(num_images):
            start_time = time.time()

            with torch.inference_mode():
                result = self.pipe(
                    prompt,
                    negative_prompt=neg_prompt,
                    num_inference_steps=self.config["steps"],
                    guidance_scale=self.config["guidance"],
                    height=self.config["height"],
                    width=self.config["width"],
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
            .strip()
            .replace(" ", "_")
            .lower()
        )

        timestamp = time.strftime("%Y%m%d_%H%M%S")

        saved_paths = []
        for i, image in enumerate(images):
            if len(images) == 1:
                filename = f"{safe_name}.png"
            else:
                filename = f"{safe_name}_{i+1}.png"

            output_path = output_dir / filename
            image.save(output_path, format="PNG", optimize=True)
            saved_paths.append(output_path)

            print(f"✓ Saved: {output_path}")

        # Save metadata
        metadata_path = output_dir / f"{safe_name}_metadata.json"
        metadata = {
            "ingredient_name": ingredient_name,
            "timestamp": timestamp,
            "model": self.config["model_id"],
            "images": [str(p.name) for p in saved_paths],
            "config": {
                "steps": self.config["steps"],
                "guidance": self.config["guidance"],
                "resolution": f"{self.config['width']}x{self.config['height']}",
            },
        }

        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        return saved_paths


def main():
    parser = argparse.ArgumentParser(
        description="Generate ingredient images using Stable Diffusion XL"
    )
    parser.add_argument(
        "--ingredient", type=str, help="Ingredient name to generate image for"
    )
    parser.add_argument(
        "--batch", type=Path, help="Batch file with ingredient names (one per line)"
    )
    parser.add_argument(
        "--num-images",
        type=int,
        default=1,
        help="Number of images to generate per ingredient (default: 1)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("tmp/ingredient-images"),
        help="Output directory (default: tmp/ingredient-images)",
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.ingredient and not args.batch:
        parser.error("Either --ingredient or --batch must be specified")

    # Initialize generator
    print("=" * 60)
    print("Ingredient Image Generator - Joanie's Kitchen")
    print("=" * 60)
    print()

    try:
        generator = IngredientImageGenerator()
    except Exception as e:
        print(f"✗ Failed to initialize generator: {e}")
        sys.exit(1)

    # Single ingredient generation
    if args.ingredient:
        try:
            images = generator.generate(
                ingredient_name=args.ingredient, num_images=args.num_images
            )

            saved_paths = generator.save_images(
                images, args.ingredient, args.output_dir
            )

            print()
            print("=" * 60)
            print("✓ Generation complete!")
            print("=" * 60)
            print()
            print("Open images:")
            for path in saved_paths:
                print(f"  open {path}")
            print()

        except Exception as e:
            print(f"✗ Generation failed: {e}")
            sys.exit(1)

    # Batch generation
    elif args.batch:
        if not args.batch.exists():
            print(f"✗ Batch file not found: {args.batch}")
            sys.exit(1)

        with open(args.batch) as f:
            ingredients = [
                line.strip() for line in f if line.strip() and not line.startswith("#")
            ]

        print(f"Processing {len(ingredients)} ingredients from {args.batch}")
        print()

        successful = 0
        failed = 0

        for i, ingredient in enumerate(ingredients, 1):
            print(f"[{i}/{len(ingredients)}] {ingredient}")
            print("-" * 60)

            try:
                images = generator.generate(
                    ingredient_name=ingredient, num_images=args.num_images
                )

                generator.save_images(images, ingredient, args.output_dir)
                successful += 1

            except Exception as e:
                print(f"✗ Failed for {ingredient}: {e}")
                failed += 1
                continue

            print()

        print("=" * 60)
        print("✓ Batch generation complete!")
        print("=" * 60)
        print()
        print(f"Successful: {successful}/{len(ingredients)}")
        if failed > 0:
            print(f"Failed: {failed}/{len(ingredients)}")
        print()
        print(f"Output directory: {args.output_dir}")
        print(f"Open folder: open {args.output_dir}")
        print()


if __name__ == "__main__":
    main()
