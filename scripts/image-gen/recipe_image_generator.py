#!/usr/bin/env python3
"""
Recipe Image Generator for Joanie's Kitchen.

Generates food photography images for recipes using Stable Diffusion XL.
Optimized for Apple Silicon M4 Max with MPS (Metal Performance Shaders).

Usage:
    # Generate single image
    python scripts/image-gen/recipe_image_generator.py --recipe "Roasted Vegetables"

    # Generate with custom prompt
    python scripts/image-gen/recipe_image_generator.py \
        --recipe "Pasta Carbonara" \
        --style "rustic italian kitchen"

    # Batch generate from file
    python scripts/image-gen/recipe_image_generator.py --batch recipes.txt
"""

import argparse
import json
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image


@dataclass
class ImageGenerationConfig:
    """Configuration for image generation."""
    model_id: str = "stabilityai/stable-diffusion-xl-base-1.0"
    device: str = "mps"
    dtype: torch.dtype = torch.float32  # Use float32 for MPS to avoid NaN issues
    num_inference_steps: int = 30
    guidance_scale: float = 7.5
    height: int = 1024
    width: int = 1024
    batch_size: int = 1


class RecipeImageGenerator:
    """Generate food photography images for recipes."""

    def __init__(self, config: Optional[ImageGenerationConfig] = None):
        """Initialize the generator with given config."""
        self.config = config or ImageGenerationConfig()
        self.pipe = None
        self._load_model()

    def _load_model(self):
        """Load the Stable Diffusion XL model."""
        print(f"Loading model: {self.config.model_id}")
        print(f"Device: {self.config.device}")
        print()

        if not torch.backends.mps.is_available():
            raise RuntimeError("MPS not available! Run test_mps.py to diagnose.")

        start_time = time.time()

        self.pipe = StableDiffusionXLPipeline.from_pretrained(
            self.config.model_id,
            torch_dtype=self.config.dtype,
            use_safetensors=True
        )

        self.pipe.to(self.config.device)
        self.pipe.enable_attention_slicing()

        load_time = time.time() - start_time
        print(f"✓ Model loaded in {load_time:.1f}s")
        print()

    def _build_prompt(
        self,
        recipe_name: str,
        style: Optional[str] = None,
        negative_prompt: Optional[str] = None
    ) -> tuple[str, str]:
        """Build optimized prompt for food photography."""
        # Base style for Joanie's Kitchen
        base_style = (
            "professional food photography, "
            "rustic kitchen setting, "
            "natural lighting, "
            "warm tones, "
            "detailed textures, "
            "appetizing, "
            "high resolution, "
            "8k quality"
        )

        # Custom style override
        if style:
            prompt = f"{recipe_name}, {style}, {base_style}"
        else:
            prompt = f"{recipe_name}, {base_style}"

        # Default negative prompt (things to avoid)
        default_negative = (
            "blurry, "
            "low quality, "
            "ugly, "
            "distorted, "
            "watermark, "
            "text, "
            "oversaturated, "
            "artificial, "
            "plastic looking"
        )

        final_negative = negative_prompt or default_negative

        return prompt, final_negative

    def generate(
        self,
        recipe_name: str,
        style: Optional[str] = None,
        negative_prompt: Optional[str] = None,
        num_images: int = 1
    ) -> List[Image.Image]:
        """Generate images for a recipe."""
        prompt, neg_prompt = self._build_prompt(recipe_name, style, negative_prompt)

        print(f"Recipe: {recipe_name}")
        print(f"Prompt: {prompt}")
        print(f"Negative: {neg_prompt}")
        print(f"Generating {num_images} image(s)...")
        print()

        images = []
        for i in range(num_images):
            start_time = time.time()

            with torch.inference_mode():
                result = self.pipe(
                    prompt,
                    negative_prompt=neg_prompt,
                    num_inference_steps=self.config.num_inference_steps,
                    guidance_scale=self.config.guidance_scale,
                    height=self.config.height,
                    width=self.config.width
                )

            image = result.images[0]
            images.append(image)

            gen_time = time.time() - start_time
            print(f"  Image {i+1}/{num_images} generated in {gen_time:.1f}s")

        return images

    def save_images(
        self,
        images: List[Image.Image],
        recipe_name: str,
        output_dir: Path
    ) -> List[Path]:
        """Save generated images with metadata."""
        output_dir.mkdir(parents=True, exist_ok=True)

        # Sanitize recipe name for filename
        safe_name = "".join(
            c if c.isalnum() or c in (' ', '-', '_') else '_'
            for c in recipe_name
        ).strip().replace(' ', '_').lower()

        timestamp = time.strftime("%Y%m%d_%H%M%S")

        saved_paths = []
        for i, image in enumerate(images):
            if len(images) == 1:
                filename = f"{safe_name}_{timestamp}.png"
            else:
                filename = f"{safe_name}_{timestamp}_{i+1}.png"

            output_path = output_dir / filename
            image.save(output_path, format="PNG", optimize=True)
            saved_paths.append(output_path)

            print(f"✓ Saved: {output_path}")

        # Save metadata
        metadata_path = output_dir / f"{safe_name}_{timestamp}.json"
        metadata = {
            "recipe_name": recipe_name,
            "timestamp": timestamp,
            "model": self.config.model_id,
            "images": [str(p.name) for p in saved_paths],
            "config": {
                "steps": self.config.num_inference_steps,
                "guidance": self.config.guidance_scale,
                "resolution": f"{self.config.width}x{self.config.height}"
            }
        }

        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"✓ Metadata: {metadata_path}")

        return saved_paths


def main():
    parser = argparse.ArgumentParser(
        description="Generate recipe images using Stable Diffusion XL"
    )
    parser.add_argument(
        "--recipe",
        type=str,
        help="Recipe name to generate image for"
    )
    parser.add_argument(
        "--style",
        type=str,
        help="Custom style description (optional)"
    )
    parser.add_argument(
        "--negative",
        type=str,
        help="Negative prompt (things to avoid)"
    )
    parser.add_argument(
        "--num-images",
        type=int,
        default=1,
        help="Number of images to generate (default: 1)"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("tmp/recipe-images"),
        help="Output directory (default: tmp/recipe-images)"
    )
    parser.add_argument(
        "--batch",
        type=Path,
        help="Batch file with recipe names (one per line)"
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=30,
        help="Number of inference steps (default: 30)"
    )

    args = parser.parse_args()

    # Validate arguments
    if not args.recipe and not args.batch:
        parser.error("Either --recipe or --batch must be specified")

    # Create config
    config = ImageGenerationConfig(
        num_inference_steps=args.steps
    )

    # Initialize generator
    print("=" * 60)
    print("Recipe Image Generator - Joanie's Kitchen")
    print("=" * 60)
    print()

    try:
        generator = RecipeImageGenerator(config)
    except Exception as e:
        print(f"✗ Failed to initialize generator: {e}")
        sys.exit(1)

    # Single recipe generation
    if args.recipe:
        try:
            images = generator.generate(
                recipe_name=args.recipe,
                style=args.style,
                negative_prompt=args.negative,
                num_images=args.num_images
            )

            saved_paths = generator.save_images(
                images,
                args.recipe,
                args.output_dir
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
            recipes = [line.strip() for line in f if line.strip()]

        print(f"Processing {len(recipes)} recipes from {args.batch}")
        print()

        for i, recipe in enumerate(recipes, 1):
            print(f"[{i}/{len(recipes)}] {recipe}")
            print("-" * 60)

            try:
                images = generator.generate(
                    recipe_name=recipe,
                    style=args.style,
                    num_images=args.num_images
                )

                generator.save_images(images, recipe, args.output_dir)

            except Exception as e:
                print(f"✗ Failed for {recipe}: {e}")
                continue

            print()

        print("=" * 60)
        print("✓ Batch generation complete!")
        print("=" * 60)


if __name__ == "__main__":
    main()
