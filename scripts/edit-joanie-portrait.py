#!/usr/bin/env python3
"""
Edit Joanie's portrait photo with ocean blue eyes and fuller lips.

This script makes minimal, natural-looking edits while preserving the artistic style.
"""

import cv2
import numpy as np
from pathlib import Path


def change_eye_color_to_ocean_blue(image: np.ndarray, eye_regions: list) -> np.ndarray:
    """
    Change eye color to ocean blue using HSV color space manipulation.

    Args:
        image: Input image in BGR format
        eye_regions: List of (x, y, width, height) tuples for eye regions

    Returns:
        Image with modified eye color
    """
    result = image.copy()
    hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV)

    # Ocean blue target color (vibrant blue-green)
    # HSV values: H=200 (blue-cyan), S=255 (full saturation), V=190 (bright)
    target_hue = 100  # OpenCV uses 0-180 for hue (200° / 2)
    target_saturation = 200

    for (x, y, w, h) in eye_regions:
        # Extract eye region
        eye_region = hsv[y:y+h, x:x+w]

        # Create mask for the iris (avoid changing white parts)
        # Detect darker areas (iris) vs lighter areas (whites)
        v_channel = eye_region[:, :, 2]
        iris_mask = v_channel < 180  # Threshold to isolate iris from whites

        # Also check saturation to avoid changing skin tones
        s_channel = eye_region[:, :, 1]
        color_mask = s_channel > 30  # Areas with some color

        # Combine masks
        final_mask = np.logical_and(iris_mask, color_mask)

        # Change hue to ocean blue
        eye_region[:, :, 0] = np.where(final_mask, target_hue, eye_region[:, :, 0])

        # Boost saturation for vibrant ocean blue
        eye_region[:, :, 1] = np.where(
            final_mask,
            np.clip(eye_region[:, :, 1] + target_saturation - 100, 0, 255).astype(np.uint8),
            eye_region[:, :, 1]
        )

        # Slightly brighten the iris for ocean effect
        eye_region[:, :, 2] = np.where(
            final_mask,
            np.clip(eye_region[:, :, 2] * 1.1, 0, 255).astype(np.uint8),
            eye_region[:, :, 2]
        )

        # Apply Gaussian blur to smooth the transition
        eye_region_blurred = cv2.GaussianBlur(eye_region, (5, 5), 0)

        # Blend original and modified using the mask
        for i in range(3):  # For each HSV channel
            eye_region[:, :, i] = np.where(
                final_mask,
                eye_region_blurred[:, :, i],
                hsv[y:y+h, x:x+w, i]
            )

        hsv[y:y+h, x:x+w] = eye_region

    result = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
    return result


def enhance_lips(image: np.ndarray, lip_region: tuple) -> np.ndarray:
    """
    Subtly enhance lip fullness using morphological operations.

    Args:
        image: Input image in BGR format
        lip_region: (x, y, width, height) tuple for lip region

    Returns:
        Image with enhanced lips
    """
    result = image.copy()
    x, y, w, h = lip_region

    # Extract lip region
    lip_area = result[y:y+h, x:x+w].copy()

    # Convert to HSV to detect lip color
    hsv_lip = cv2.cvtColor(lip_area, cv2.COLOR_BGR2HSV)

    # Create mask for lip area (typically red/pink hues)
    # Hue range for red/pink: 0-10 and 160-180 in OpenCV (0-180 scale)
    lower_red1 = np.array([0, 50, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([160, 50, 50])
    upper_red2 = np.array([180, 255, 255])

    mask1 = cv2.inRange(hsv_lip, lower_red1, upper_red1)
    mask2 = cv2.inRange(hsv_lip, lower_red2, upper_red2)
    lip_mask = cv2.bitwise_or(mask1, mask2)

    # Also include darker pinks
    lower_pink = np.array([150, 30, 40])
    upper_pink = np.array([180, 200, 200])
    pink_mask = cv2.inRange(hsv_lip, lower_pink, upper_pink)
    lip_mask = cv2.bitwise_or(lip_mask, pink_mask)

    # Clean up mask with morphological operations
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    lip_mask = cv2.morphologyEx(lip_mask, cv2.MORPH_CLOSE, kernel)
    lip_mask = cv2.morphologyEx(lip_mask, cv2.MORPH_OPEN, kernel)

    # Apply subtle dilation for fullness (small kernel for natural look)
    dilation_kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    dilated_mask = cv2.dilate(lip_mask, dilation_kernel, iterations=1)

    # Create smooth transition between original and dilated
    dilated_mask_smooth = cv2.GaussianBlur(dilated_mask, (7, 7), 0)
    lip_mask_smooth = cv2.GaussianBlur(lip_mask, (7, 7), 0)

    # Blend original lip area with slightly expanded version
    alpha = (dilated_mask_smooth - lip_mask_smooth) / 255.0
    alpha = np.stack([alpha] * 3, axis=-1)  # Convert to 3-channel

    # Apply very subtle enhancement
    enhanced_lip = lip_area.copy()

    # Slight color boost for fullness perception
    hsv_enhanced = cv2.cvtColor(enhanced_lip, cv2.COLOR_BGR2HSV)
    hsv_enhanced[:, :, 1] = np.clip(hsv_enhanced[:, :, 1] * 1.05, 0, 255).astype(np.uint8)
    enhanced_lip = cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)

    # Blend with original using alpha
    lip_area = (lip_area * (1 - alpha * 0.3) + enhanced_lip * (alpha * 0.3)).astype(np.uint8)

    # Apply gentle bilateral filter to smooth edges while preserving detail
    lip_area = cv2.bilateralFilter(lip_area, 5, 50, 50)

    result[y:y+h, x:x+w] = lip_area
    return result


def main():
    """Main execution function."""
    # Input and output paths
    input_path = Path.home() / "Downloads" / "joanie-portrait.png"
    output_path = Path.home() / "Downloads" / "joanie-portrait-edited.png"

    # Check if input exists
    if not input_path.exists():
        print(f"❌ Error: Input file not found at {input_path}")
        return

    # Load image
    print(f"📂 Loading image from {input_path}")
    image = cv2.imread(str(input_path))

    if image is None:
        print("❌ Error: Failed to load image")
        return

    height, width = image.shape[:2]
    print(f"✅ Image loaded: {width}x{height} pixels")

    # Define regions manually (approximate coordinates)
    # These are estimates - adjust based on actual image
    # Eye regions: (x, y, width, height)
    # Assuming portrait is centered and face takes ~60% of width
    face_center_x = width // 2
    face_width = int(width * 0.4)
    eye_y = int(height * 0.35)  # Eyes typically in upper third
    eye_width = int(face_width * 0.15)
    eye_height = int(eye_width * 0.7)

    # Left and right eye positions
    left_eye = (
        face_center_x - face_width // 4 - eye_width // 2,
        eye_y,
        eye_width,
        eye_height
    )
    right_eye = (
        face_center_x + face_width // 4 - eye_width // 2,
        eye_y,
        eye_width,
        eye_height
    )

    eye_regions = [left_eye, right_eye]

    # Lip region: typically in lower third of face
    lip_y = int(height * 0.55)
    lip_width = int(face_width * 0.25)
    lip_height = int(lip_width * 0.4)
    lip_region = (
        face_center_x - lip_width // 2,
        lip_y,
        lip_width,
        lip_height
    )

    print("\n🎨 Applying edits...")

    # Apply eye color change
    print("  👁️  Changing eye color to ocean blue...")
    result = change_eye_color_to_ocean_blue(image, eye_regions)

    # Apply lip enhancement
    print("  👄 Enhancing lip fullness...")
    result = enhance_lips(result, lip_region)

    # Save result
    print(f"\n💾 Saving edited image to {output_path}")
    cv2.imwrite(str(output_path), result)

    print(f"\n✅ SUCCESS! Edited portrait saved to:")
    print(f"   {output_path}")
    print("\n📋 Applied changes:")
    print("   • Eye color changed to ocean blue")
    print("   • Lips subtly enhanced for fullness")
    print("   • Artistic style preserved")


if __name__ == "__main__":
    main()
