'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const SLIDESHOW_IMAGES = [
  'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/hero/background-textured.png',
  'https://ljqhvy0frzhuigv1.public.blob.vercel-storage.com/hero/background-watercolor.png',
];

const TRANSITION_DURATION = 5000; // 5 seconds per image
const FADE_DURATION = 1000; // 1 second fade

export function HeroSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);

      // After fade starts, update indices
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % SLIDESHOW_IMAGES.length);
        setNextIndex((prev) => (prev + 1) % SLIDESHOW_IMAGES.length);
        setIsTransitioning(false);
      }, FADE_DURATION);
    }, TRANSITION_DURATION);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Current Image */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <Image
          src={SLIDESHOW_IMAGES[currentIndex]}
          alt=""
          fill
          className="object-cover"
          priority={currentIndex === 0}
          quality={85}
        />
      </div>

      {/* Next Image (fading in) */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ${
          isTransitioning ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Image
          src={SLIDESHOW_IMAGES[nextIndex]}
          alt=""
          fill
          className="object-cover"
          priority={nextIndex === 0}
          quality={85}
        />
      </div>

      {/* Gradient overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-jk-olive/40 via-transparent to-jk-olive/60" />
    </div>
  );
}
