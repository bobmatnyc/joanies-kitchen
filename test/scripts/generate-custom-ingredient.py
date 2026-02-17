#!/usr/bin/env python3
"""Generate a custom ingredient image with specific visual requirements"""

import sys
import torch
from diffusers import StableDiffusionXLPipeline
from pathlib import Path


def generate_custom_image(ingredient_name: str, custom_prompt: str, output_path: str):
    """Generate a single custom ingredient image"""

    print(f"\n🎨 Generating custom image: {ingredient_name}")
    print(f"📝 Custom prompt: {custom_prompt}\n")

    # Load model with Apple MPS
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"🖥️  Using device: {device}\n")

    model_id = "stabilityai/stable-diffusion-xl-base-1.0"
    pipe = StableDiffusionXLPipeline.from_pretrained(
        model_id,
        torch_dtype=torch.float16 if device == "mps" else torch.float32,
        use_safetensors=True,
    )
    pipe = pipe.to(device)

    # Generate image
    print("🎨 Generating image (25 steps)...")
    image = pipe(
        prompt=custom_prompt,
        num_inference_steps=25,
        guidance_scale=7.5,
        height=1024,
        width=1024,
    ).images[0]

    # Save
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_file)

    print(f"\n✅ Saved: {output_file}")
    print(f"📏 Size: {output_file.stat().st_size / 1024:.1f}KB\n")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(
            "Usage: python generate-custom-ingredient.py <name> <prompt> <output-path>"
        )
        sys.exit(1)

    ingredient_name = sys.argv[1]
    custom_prompt = sys.argv[2]
    output_path = sys.argv[3]

    generate_custom_image(ingredient_name, custom_prompt, output_path)
