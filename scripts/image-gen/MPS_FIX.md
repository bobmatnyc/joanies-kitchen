# MPS (Metal Performance Shaders) Fix for Stable Diffusion

## Issue: Black Images on Apple Silicon

When using Stable Diffusion XL with MPS (Metal Performance Shaders) on Apple Silicon (M-series chips), you may encounter black/empty images due to NaN (Not a Number) values in the output.

### Root Cause

The issue occurs when using `torch.float16` (fp16) precision with MPS:

1. MPS doesn't handle fp16 as well as CUDA
2. Intermediate calculations can produce NaN values
3. NaN values get clamped to 0 during image conversion
4. Result: Completely black images (all pixels = 0)

### Error Signature

```python
RuntimeWarning: invalid value encountered in cast
  images = (images * 255).round().astype("uint8")
```

This warning from `diffusers/image_processor.py` indicates NaN values are present.

## Solution: Use float32

**Change the dtype from `torch.float16` to `torch.float32`:**

### Before (Broken)
```python
config = {
    'dtype': torch.float16,  # ❌ Causes black images on MPS
}

pipe = StableDiffusionXLPipeline.from_pretrained(
    model_id,
    torch_dtype=torch.float16,
    variant="fp16",  # This tries to load fp16 weights
    use_safetensors=True
)
```

### After (Fixed)
```python
config = {
    'dtype': torch.float32,  # ✅ Works correctly on MPS
}

pipe = StableDiffusionXLPipeline.from_pretrained(
    model_id,
    torch_dtype=torch.float32,
    use_safetensors=True  # No variant needed
)
```

## Trade-offs

### Memory Usage
- **fp16**: ~7GB VRAM for SDXL
- **fp32**: ~12-14GB VRAM for SDXL

On M4 Max with 128GB unified memory, this is not an issue.

### Performance
- **fp16**: Slightly faster (~10-15%)
- **fp32**: Slightly slower but produces correct results

**Generation times on M4 Max:**
- Model loading: ~135-150 seconds (one-time)
- Image generation: ~45-50 seconds per image (25 steps)

## Verification

To verify the fix is working:

```bash
# Generate test image
source venv-image-gen/bin/activate
python scripts/image-gen/generate_test.py

# Check image is not black
python3 -c "
from PIL import Image
import numpy as np
img = Image.open('tmp/image-gen-tests/test_image.png')
arr = np.array(img)
print(f'Min: {arr.min()}, Max: {arr.max()}')
print(f'Mean: {arr.mean():.2f}')
# Should show values > 0, not all zeros
"
```

## Files Modified

The following files were updated to use `float32`:

1. `scripts/image-gen/ingredient_image_generator.py`
2. `scripts/image-gen/recipe_image_generator.py`
3. `scripts/image-gen/generate_test.py`

## References

- [PyTorch MPS Backend Documentation](https://pytorch.org/docs/stable/notes/mps.html)
- [Diffusers MPS Guide](https://huggingface.co/docs/diffusers/optimization/mps)
- [Known MPS Issues with fp16](https://github.com/pytorch/pytorch/issues/77764)

## Alternative Solutions (Not Recommended)

### 1. Use CPU Instead
```python
device = "cpu"  # Slower but works with fp16
```
**Drawback**: 10-20x slower than MPS

### 2. Use Attention Slicing + fp16
```python
pipe.enable_attention_slicing()
pipe.enable_vae_slicing()
```
**Drawback**: Still produces NaN values, doesn't solve the issue

### 3. Post-process to Fix NaN
```python
image_array = np.nan_to_num(image_array, nan=0.0)
```
**Drawback**: Produces artifacts, doesn't address root cause

## Conclusion

**Use `torch.float32` for MPS** - it's the most reliable solution with minimal downside on M4 Max's ample unified memory.
