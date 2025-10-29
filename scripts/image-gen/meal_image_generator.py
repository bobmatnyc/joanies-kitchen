#!/usr/bin/env python3
"""
Meal Image Generator for Joanie's Kitchen - Stable Diffusion XL

Generates overhead food photography images for complete meals using Stable Diffusion XL.
Optimized for Apple Silicon M4 Max with MPS (Metal Performance Shaders).

This is a streamlined version optimized for TypeScript integration via subprocess.

Usage:
    python3 scripts/image-gen/meal_image_generator.py \
        --prompt "Professional overhead food photography..." \
        --output "tmp/meal-images/thanksgiving-dinner.png" \
        --steps 30
"""

import argparse
import sys
import time
from pathlib import Path
from typing import Optional

import torch
from diffusers import StableDiffusionXLPipeline
from PIL import Image


class MealImageGenerator:
    """Generate overhead food photography images for complete meals."""

    def __init__(
        self,
        model_id: str = "stabilityai/stable-diffusion-xl-base-1.0",
        device: str = "mps",
        num_inference_steps: int = 30,
    ):
        """Initialize the generator."""
        self.model_id = model_id
        self.device = device
        self.num_inference_steps = num_inference_steps
        self.pipe = None

        # Validate MPS availability
        if device == "mps" and not torch.backends.mps.is_available():
            print("⚠️  MPS not available, falling back to CPU", file=sys.stderr)
            self.device = "cpu"

        self._load_model()

    def _load_model(self):
        """Load the Stable Diffusion XL model."""
        print(f"Loading model: {self.model_id}")
        print(f"Device: {self.device}")
        sys.stdout.flush()

        start_time = time.time()

        # Use float32 for MPS to avoid NaN issues
        dtype = torch.float32 if self.device == "mps" else torch.float16

        self.pipe = StableDiffusionXLPipeline.from_pretrained(
            self.model_id,
            torch_dtype=dtype,
            use_safetensors=True,
        )

        self.pipe.to(self.device)

        # Enable memory optimizations
        self.pipe.enable_attention_slicing()

        load_time = time.time() - start_time
        print(f"✓ Model loaded in {load_time:.1f}s")
        sys.stdout.flush()

    def generate(
        self,
        prompt: str,
        negative_prompt: Optional[str] = None,
        guidance_scale: float = 7.5,
        width: int = 1024,
        height: int = 1024,
    ) -> Image.Image:
        """Generate meal image from prompt."""
        # Default negative prompt for food photography
        if negative_prompt is None:
            negative_prompt = (
                "blurry, low quality, ugly, distorted, watermark, text, "
                "logo, oversaturated, artificial, plastic looking, "
                "bad lighting, unappetizing, dirty, messy"
            )

        print(f"\nGenerating image...")
        print(f"Prompt: {prompt[:100]}...")
        print(f"Steps: {self.num_inference_steps}")
        print(f"Size: {width}x{height}")
        sys.stdout.flush()

        start_time = time.time()

        with torch.inference_mode():
            result = self.pipe(
                prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=self.num_inference_steps,
                guidance_scale=guidance_scale,
                height=height,
                width=width,
            )

        image = result.images[0]

        gen_time = time.time() - start_time
        print(f"✓ Image generated in {gen_time:.1f}s")
        sys.stdout.flush()

        return image

    def save_image(self, image: Image.Image, output_path: Path) -> None:
        """Save generated image to file."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        image.save(output_path, format="PNG", optimize=True)
        print(f"✓ Saved: {output_path}")
        sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(
        description="Generate meal images using Stable Diffusion XL"
    )
    parser.add_argument(
        "--prompt",
        type=str,
        required=True,
        help="Image generation prompt",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Output image path",
    )
    parser.add_argument(
        "--negative",
        type=str,
        help="Negative prompt (things to avoid)",
    )
    parser.add_argument(
        "--steps",
        type=int,
        default=30,
        help="Number of inference steps (default: 30)",
    )
    parser.add_argument(
        "--guidance",
        type=float,
        default=7.5,
        help="Guidance scale (default: 7.5)",
    )
    parser.add_argument(
        "--width",
        type=int,
        default=1024,
        help="Image width (default: 1024)",
    )
    parser.add_argument(
        "--height",
        type=int,
        default=1024,
        help="Image height (default: 1024)",
    )

    args = parser.parse_args()

    # Print header
    print("=" * 60)
    print("Meal Image Generator - Stable Diffusion XL")
    print("=" * 60)
    print()
    sys.stdout.flush()

    try:
        # Initialize generator
        generator = MealImageGenerator(num_inference_steps=args.steps)

        # Generate image
        image = generator.generate(
            prompt=args.prompt,
            negative_prompt=args.negative,
            guidance_scale=args.guidance,
            width=args.width,
            height=args.height,
        )

        # Save image
        generator.save_image(image, args.output)

        print()
        print("=" * 60)
        print("✓ Generation complete!")
        print("=" * 60)
        sys.stdout.flush()

        sys.exit(0)

    except Exception as e:
        print(f"\n✗ Generation failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
