'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

interface AnimatedRecipeBackgroundProps {
  images: string[];
  displayDuration?: number; // milliseconds (default: 5000)
  fadeDuration?: number; // milliseconds (default: 2000)
}

/**
 * Animated background component that cycles through recipe images
 * with smooth crossfade transitions.
 * - Uses Next.js Image component for optimized loading
 * - Cycles every 5 seconds with 2-second fade transitions
 * - Matches home page background animation pattern
 */
export function AnimatedRecipeBackground({
  images,
  displayDuration = 5000, // 5 seconds display
  fadeDuration = 2000, // 2 seconds fade
}: AnimatedRecipeBackgroundProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (images.length <= 1) return; // No slideshow needed for single image

    const interval = setInterval(() => {
      setIsTransitioning(true);

      // After fade starts, update index
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setIsTransitioning(false);
      }, fadeDuration / 2);
    }, displayDuration);

    return () => clearInterval(interval);
  }, [images.length, displayDuration, fadeDuration]);

  // If no images, render nothing
  if (images.length === 0) {
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {images.map((imageUrl, index) => {
        const isActive = index === currentIndex;
        const isPrevious = index === (currentIndex - 1 + images.length) % images.length;

        // Show current and previous images for crossfade effect
        if (!isActive && !isPrevious) return null;

        return (
          <div
            key={imageUrl}
            className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out"
            style={{
              opacity: isActive ? (isTransitioning ? 0.2 : 0.2) : 0,
              zIndex: isActive ? 1 : 0,
            }}
          >
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              priority={index === 0} // Only prioritize first image
              quality={75}
              sizes="100vw"
            />
          </div>
        );
      })}
    </div>
  );
}
