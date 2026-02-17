#!/usr/bin/env python3
"""
Test script for Stable Diffusion XL image generation on Apple Silicon.

Usage:
    python scripts/image-gen/generate_test.py
    python scripts/image-gen/generate_test.py --prompt "your custom prompt"
"""

import argparse
import sys
import time
from pathlib import Path


def generate_test_image(prompt: str, output_dir: Path):
    """Generate a test image using Stable Diffusion XL."""
    print("=" * 60)
    print("Stable Diffusion XL - Test Image Generation")
    print("=" * 60)
    print()

    # Check PyTorch and MPS
    try:
        import torch

        print(f"✓ PyTorch version: {torch.__version__}")

        if not torch.backends.mps.is_available():
            print("✗ MPS not available! Run test_mps.py first.")
            return False
        print("✓ MPS available")
    except ImportError:
        print("✗ PyTorch not installed!")
        print("  Install with: pip install -r scripts/image-gen/requirements.txt")
        return False

    # Import diffusers
    try:
        from diffusers import StableDiffusionXLPipeline

        print("✓ Diffusers imported")
    except ImportError:
        print("✗ Diffusers not installed!")
        print("  Install with: pip install -r scripts/image-gen/requirements.txt")
        return False

    # Load model
    print()
    print("Loading Stable Diffusion XL model...")
    print("(First run will download ~7GB - be patient!)")
    print()

    try:
        start_time = time.time()

        pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float32,  # Use float32 for MPS to avoid NaN issues
            use_safetensors=True,
        )

        # Move to MPS device
        pipe.to("mps")

        # Enable memory optimizations
        pipe.enable_attention_slicing()

        load_time = time.time() - start_time
        print(f"✓ Model loaded in {load_time:.1f}s")

    except Exception as e:
        print(f"✗ Failed to load model: {e}")
        return False

    # Generate image
    print()
    print("Generating image with prompt:")
    print(f'  "{prompt}"')
    print()

    try:
        start_time = time.time()

        # Generate
        with torch.inference_mode():
            result = pipe(
                prompt,
                num_inference_steps=30,  # Balance quality/speed
                guidance_scale=7.5,
                height=1024,
                width=1024,
            )

        image = result.images[0]
        gen_time = time.time() - start_time

        print(f"✓ Image generated in {gen_time:.1f}s")

    except Exception as e:
        print(f"✗ Failed to generate image: {e}")
        return False

    # Save image
    output_dir.mkdir(parents=True, exist_ok=True)
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    output_path = output_dir / f"test_{timestamp}.png"

    try:
        image.save(output_path)
        print(f"✓ Image saved to: {output_path}")
    except Exception as e:
        print(f"✗ Failed to save image: {e}")
        return False

    # Memory stats
    print()
    print("Performance:")
    print(f"  Model load time: {load_time:.1f}s")
    print(f"  Generation time: {gen_time:.1f}s")
    print(f"  Total time: {load_time + gen_time:.1f}s")

    try:
        import psutil

        mem = psutil.virtual_memory()
        print(f"  Memory used: {(mem.total - mem.available) / (1024**3):.1f} GB")
    except ImportError:
        pass

    print()
    print("=" * 60)
    print("✓ Test successful!")
    print("=" * 60)
    print()
    print(f"Open image: open {output_path}")
    print()

    return True


def main():
    parser = argparse.ArgumentParser(
        description="Test Stable Diffusion XL image generation"
    )
    parser.add_argument(
        "--prompt",
        type=str,
        default="a beautiful sunset over mountains, professional food photography",
        help="Text prompt for image generation",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("tmp/image-gen-tests"),
        help="Output directory for generated images",
    )

    args = parser.parse_args()

    success = generate_test_image(args.prompt, args.output_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
