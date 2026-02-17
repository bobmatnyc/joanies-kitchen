#!/usr/bin/env python3
"""
Test script to verify Metal Performance Shaders (MPS) availability
for Apple Silicon M4 Max.

Usage:
    python scripts/image-gen/test_mps.py
"""

import sys


def check_mps_availability():
    """Check if MPS (Metal Performance Shaders) is available."""
    print("=" * 60)
    print("Apple Metal Performance Shaders (MPS) Availability Check")
    print("=" * 60)
    print()

    try:
        import torch

        print(f"✓ PyTorch version: {torch.__version__}")
    except ImportError:
        print("✗ PyTorch not installed!")
        print("  Install with: pip install torch torchvision")
        return False

    # Check MPS availability
    mps_available = torch.backends.mps.is_available()
    print(f"{'✓' if mps_available else '✗'} MPS available: {mps_available}")

    if not mps_available:
        print("\nMPS is not available. Possible reasons:")
        print("  - Not running on Apple Silicon (M1/M2/M3/M4)")
        print("  - PyTorch version too old (need >= 1.12)")
        print("  - macOS version too old (need >= 12.3)")
        return False

    # Check MPS built
    mps_built = torch.backends.mps.is_built()
    print(f"{'✓' if mps_built else '✗'} MPS built: {mps_built}")

    # Test device creation
    try:
        device = torch.device("mps")
        print(f"✓ MPS device created: {device}")
    except Exception as e:
        print(f"✗ Failed to create MPS device: {e}")
        return False

    # Test tensor operation
    try:
        x = torch.randn(1000, 1000, device="mps")
        y = torch.randn(1000, 1000, device="mps")
        z = x @ y  # Matrix multiplication
        print("✓ MPS tensor operations working")
        print(f"  Test tensor shape: {z.shape}")
        print(f"  Test tensor device: {z.device}")
    except Exception as e:
        print(f"✗ MPS tensor operations failed: {e}")
        return False

    # Check CUDA (should not be available on Mac)
    cuda_available = torch.cuda.is_available()
    print(f"{'✓' if not cuda_available else '⚠'} CUDA available: {cuda_available}")
    if cuda_available:
        print("  Note: CUDA shouldn't be available on Mac - this is unexpected")

    # System info
    print()
    print("System Information:")
    print(f"  Python version: {sys.version.split()[0]}")
    print(f"  Platform: {sys.platform}")

    # Memory info (if available)
    try:
        import psutil

        mem = psutil.virtual_memory()
        print(f"  Total RAM: {mem.total / (1024**3):.1f} GB")
        print(f"  Available RAM: {mem.available / (1024**3):.1f} GB")
    except ImportError:
        print("  (Install psutil for memory info: pip install psutil)")

    print()
    print("=" * 60)
    print("✓ MPS is ready for Stable Diffusion!")
    print("=" * 60)
    print()
    print("Next steps:")
    print(
        "  1. Install requirements: pip install -r scripts/image-gen/requirements.txt"
    )
    print("  2. Test image generation: python scripts/image-gen/generate_test.py")
    print()

    return True


if __name__ == "__main__":
    success = check_mps_availability()
    sys.exit(0 if success else 1)
