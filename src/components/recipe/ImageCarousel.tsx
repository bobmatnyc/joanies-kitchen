'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { RecipeImageFlag } from '@/components/admin/RecipeImageFlag';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ImageCarouselProps {
  images: string[];
  title?: string;
  className?: string;
  recipeId?: string;
  isFlagged?: boolean | null;
  isAdmin?: boolean;
}

export function ImageCarousel({
  images,
  title,
  className = '',
  recipeId,
  isFlagged,
  isAdmin = false,
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (!images || images.length === 0) {
    return null;
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? images.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === images.length - 1 ? 0 : prevIndex + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Main Image Display */}
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        <img
          src={images[currentIndex]}
          alt={`${title || 'Recipe'} - Image ${currentIndex + 1}`}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => setIsFullscreen(true)}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/api/placeholder/800/600';
          }}
        />

        {/* Admin Image Flag Button */}
        {recipeId && isAdmin && (
          <RecipeImageFlag recipeId={recipeId} isFlagged={isFlagged || false} isAdmin={isAdmin} />
        )}

        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        )}
      </div>

      {/* Thumbnail Navigation */}
      {images.length > 1 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`
                relative flex-shrink-0 w-20 h-20 rounded overflow-hidden border-2 transition-all
                ${
                  index === currentIndex
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-muted-foreground/50'
                }
              `}
            >
              <img
                src={image}
                alt={`Thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/api/placeholder/80/80';
                }}
              />
              {index === currentIndex && <div className="absolute inset-0 bg-primary/10" />}
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Modal */}
      <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0">
          <div className="relative bg-black">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative flex items-center justify-center min-h-[60vh]">
              <img
                src={images[currentIndex]}
                alt={`${title || 'Recipe'} - Image ${currentIndex + 1}`}
                className="max-w-full max-h-[85vh] object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/api/placeholder/1200/800';
                }}
              />

              {/* Fullscreen Navigation */}
              {images.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20 transition-colors"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur text-white hover:bg-white/20 transition-colors"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>

            {/* Fullscreen Thumbnails */}
            {images.length > 1 && (
              <div className="bg-black/80 p-4">
                <div className="flex gap-2 justify-center overflow-x-auto">
                  {images.map((image, index) => (
                    <button
                      key={index}
                      onClick={() => goToSlide(index)}
                      className={`
                        relative flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 transition-all
                        ${
                          index === currentIndex
                            ? 'border-white ring-2 ring-white/20'
                            : 'border-transparent hover:border-white/50 opacity-70 hover:opacity-100'
                        }
                      `}
                    >
                      <img
                        src={image}
                        alt={`Thumbnail ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = '/api/placeholder/64/64';
                        }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Simple Image Grid variant for recipe cards
export function ImageGrid({ images, maxImages = 4 }: { images: string[]; maxImages?: number }) {
  if (!images || images.length === 0) {
    return null;
  }

  const displayImages = images.slice(0, maxImages);
  const remainingCount = images.length - maxImages;

  if (displayImages.length === 1) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
        <img
          src={displayImages[0]}
          alt="Recipe"
          className="w-full h-full object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/api/placeholder/400/300';
          }}
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1 aspect-video overflow-hidden rounded-lg bg-muted">
      {displayImages.map((image, index) => (
        <div
          key={index}
          className={`
            relative overflow-hidden
            ${displayImages.length === 3 && index === 0 ? 'col-span-2' : ''}
            ${displayImages.length === 2 ? 'aspect-[4/3]' : ''}
          `}
        >
          <img
            src={image}
            alt={`Recipe image ${index + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = '/api/placeholder/200/150';
            }}
          />
          {index === displayImages.length - 1 && remainingCount > 0 && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-2xl font-semibold">+{remainingCount}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
