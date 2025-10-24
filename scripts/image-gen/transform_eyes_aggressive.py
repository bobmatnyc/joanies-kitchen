#!/usr/bin/env python3
"""
Aggressive eye color transformation to ocean blue.
Replaces brown iris colors completely with vibrant blue while preserving texture.
"""

from PIL import Image
import numpy as np
import colorsys

def rgb_to_hsv_array(rgb_array):
    """Convert RGB numpy array to HSV."""
    h, s, v = np.zeros_like(rgb_array[:,:,0], dtype=float), \
              np.zeros_like(rgb_array[:,:,0], dtype=float), \
              np.zeros_like(rgb_array[:,:,0], dtype=float)

    for i in range(rgb_array.shape[0]):
        for j in range(rgb_array.shape[1]):
            r, g, b = rgb_array[i, j] / 255.0
            h[i, j], s[i, j], v[i, j] = colorsys.rgb_to_hsv(r, g, b)

    return h, s, v

def hsv_to_rgb_array(h, s, v):
    """Convert HSV numpy arrays back to RGB."""
    rgb = np.zeros((*h.shape, 3), dtype=np.uint8)

    for i in range(h.shape[0]):
        for j in range(h.shape[1]):
            r, g, b = colorsys.hsv_to_rgb(h[i, j], s[i, j], v[i, j])
            rgb[i, j] = [int(r * 255), int(g * 255), int(b * 255)]

    return rgb

def transform_eyes_to_blue(image_path, output_path):
    """
    Transform brown eyes to ocean blue with aggressive color replacement.

    Eye regions approximate coordinates for 1024x1536 image:
    - Left eye (viewer's right): around x=380-480, y=580-680
    - Right eye (viewer's left): around x=540-640, y=560-660

    These are rough estimates - we'll use elliptical regions.
    """
    # Load image
    img = Image.open(image_path)
    img_array = np.array(img)

    # Convert to float for processing
    img_float = img_array.astype(float)

    # Define eye regions (elliptical masks)
    height, width = img_array.shape[:2]

    # Left eye center and radius (viewer's right eye)
    left_eye_center = (430, 630)  # (x, y)
    left_eye_radius = (50, 60)    # (x_radius, y_radius)

    # Right eye center and radius (viewer's left eye)
    right_eye_center = (590, 610)  # (x, y)
    right_eye_radius = (50, 60)    # (x_radius, y_radius)

    # Create coordinate grids
    y_coords, x_coords = np.ogrid[:height, :width]

    # Create elliptical masks for both eyes
    left_eye_mask = (((x_coords - left_eye_center[0]) / left_eye_radius[0]) ** 2 +
                     ((y_coords - left_eye_center[1]) / left_eye_radius[1]) ** 2) <= 1

    right_eye_mask = (((x_coords - right_eye_center[0]) / right_eye_radius[0]) ** 2 +
                      ((y_coords - right_eye_center[1]) / right_eye_radius[1]) ** 2) <= 1

    # Combine both eye masks
    eye_mask = left_eye_mask | right_eye_mask

    # Convert to HSV for color manipulation
    h, s, v = rgb_to_hsv_array(img_array)

    # Target ocean blue color
    blue_hue = 210 / 360.0  # Ocean blue hue (210 degrees in 0-1 range)

    # Process each eye region
    for i in range(height):
        for j in range(width):
            if eye_mask[i, j]:
                current_v = v[i, j]

                # Identify iris pixels (exclude very dark pupil and very bright highlights)
                # Pupil: value < 0.15 (very dark)
                # Highlights: value > 0.85 (very bright)
                # Iris: 0.15 <= value <= 0.85

                if 0.15 <= current_v <= 0.85:
                    # This is an iris pixel - replace with blue
                    h[i, j] = blue_hue

                    # Aggressive saturation boost for vibrant blue
                    # Map the original saturation to a higher range
                    original_saturation = s[i, j]

                    # If very desaturated (gray/brown), boost significantly
                    if original_saturation < 0.3:
                        s[i, j] = 0.7  # Strong saturation
                    else:
                        # Otherwise boost moderately
                        s[i, j] = min(0.85, original_saturation * 1.5)

                    # Slightly enhance value for brightness (but preserve texture)
                    v[i, j] = min(0.85, current_v * 1.15)

                # For very dark pixels (pupil), keep them dark
                elif current_v < 0.15:
                    # Keep as is (pupil should stay black/very dark)
                    pass

                # For very bright pixels (highlights), reduce saturation but tint blue
                else:  # current_v > 0.85
                    h[i, j] = blue_hue
                    s[i, j] = 0.3  # Light blue tint for highlights

    # Convert back to RGB
    result_array = hsv_to_rgb_array(h, s, v)

    # Enhance lips (from previous script - keep this part)
    # Define lip region (approximate)
    lip_center = (510, 970)  # (x, y)
    lip_radius = (80, 50)    # (x_radius, y_radius)

    # Create elliptical mask for lips
    lip_mask = (((x_coords - lip_center[0]) / lip_radius[0]) ** 2 +
                ((y_coords - lip_center[1]) / lip_radius[1]) ** 2) <= 1

    # Convert result back to HSV for lip enhancement
    h_result, s_result, v_result = rgb_to_hsv_array(result_array)

    # Enhance lip color
    for i in range(height):
        for j in range(width):
            if lip_mask[i, j]:
                # Shift hue slightly toward red-pink if not already
                current_hue = h_result[i, j]
                if not (0.9 <= current_hue <= 1.0 or 0.0 <= current_hue <= 0.1):
                    # Shift toward red (hue = 0)
                    h_result[i, j] = 0.98  # Deep red-pink

                # Increase saturation for more vibrant lips
                s_result[i, j] = min(1.0, s_result[i, j] * 1.4)

                # Slightly darken for depth
                v_result[i, j] = v_result[i, j] * 0.95

    # Convert final result to RGB
    final_result = hsv_to_rgb_array(h_result, s_result, v_result)

    # Save result
    result_img = Image.fromarray(final_result)
    result_img.save(output_path, quality=95)
    print(f"✅ Transformation complete!")
    print(f"   Input: {image_path}")
    print(f"   Output: {output_path}")
    print(f"   Changes applied:")
    print(f"   - Eyes: Aggressive ocean blue replacement (hue=210°, high saturation)")
    print(f"   - Lips: Enhanced color and depth")

if __name__ == "__main__":
    input_path = "/Users/masa/Downloads/joanie-portrait.png"
    output_path = "/Users/masa/Downloads/joanie-portrait-edited.png"

    transform_eyes_to_blue(input_path, output_path)
