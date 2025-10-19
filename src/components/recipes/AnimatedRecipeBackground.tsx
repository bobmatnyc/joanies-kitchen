'use client';

import { useEffect, useState } from 'react';

interface AnimatedRecipeBackgroundProps {
  images: string[];
}

/**
 * Animated background component that cycles through recipe images
 * with smooth fade transitions every 15 seconds.
 */
export function AnimatedRecipeBackground({ images }: AnimatedRecipeBackgroundProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (images.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 15000); // 15 seconds

    return () => clearInterval(interval);
  }, [images.length]);

  if (images.length === 0) return null;

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {images.map((image, index) => (
        <div
          key={index}
          className="absolute inset-0 transition-opacity"
          style={{
            backgroundImage: `url(${image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(8px)',
            opacity: index === currentIndex ? 0.15 : 0,
            transitionDuration: '2000ms',
          }}
        />
      ))}
    </div>
  );
}
