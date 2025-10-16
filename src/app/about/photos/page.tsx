'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAllPhotos } from '@/app/actions/slideshow';
import type { SlideshowPhoto } from '@/lib/db/schema';

const DESKTOP_PHOTOS_PER_PAGE = 9; // 3x3 grid
const MOBILE_PHOTOS_PER_PAGE = 3; // 1x3 grid
const ROTATION_INTERVAL = 5000; // 5 seconds

export default function PhotoGalleryPage() {
  const [photos, setPhotos] = useState<SlideshowPhoto[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<SlideshowPhoto | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Load photos
  useEffect(() => {
    async function loadPhotos() {
      try {
        const data = await getAllPhotos();
        setPhotos(data);
      } catch (error) {
        console.error('Failed to load photos:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPhotos();
  }, []);

  // Auto-rotate slideshow
  useEffect(() => {
    if (photos.length === 0) return;

    const photosPerPage = isMobile ? MOBILE_PHOTOS_PER_PAGE : DESKTOP_PHOTOS_PER_PAGE;
    const totalPages = Math.ceil(photos.length / photosPerPage);

    const timer = setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % totalPages);
    }, ROTATION_INTERVAL);

    return () => clearInterval(timer);
  }, [photos.length, isMobile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-jk-linen flex items-center justify-center">
        <div className="text-jk-clay text-xl font-body">Loading photos...</div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="min-h-screen bg-jk-linen">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <Link href="/about">
            <Button variant="ghost" className="mb-8">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back to About
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="font-heading text-4xl text-jk-olive mb-4">Photo Gallery</h1>
            <p className="text-jk-clay font-body">No photos available yet.</p>
          </div>
        </div>
      </div>
    );
  }

  const photosPerPage = isMobile ? MOBILE_PHOTOS_PER_PAGE : DESKTOP_PHOTOS_PER_PAGE;
  const totalPages = Math.ceil(photos.length / photosPerPage);
  const startIndex = currentPage * photosPerPage;
  const endIndex = Math.min(startIndex + photosPerPage, photos.length);
  const currentPhotos = photos.slice(startIndex, endIndex);

  return (
    <>
      <div className="min-h-screen bg-jk-linen">
        {/* Header */}
        <div className="bg-jk-olive text-jk-linen py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <Link href="/about">
              <Button variant="ghost" className="mb-4 text-jk-linen hover:text-white hover:bg-jk-olive/80">
                <ChevronLeft className="h-4 w-4 mr-2" />
                Back to About
              </Button>
            </Link>
            <h1 className="font-heading text-5xl text-jk-linen mb-4">Photo Gallery</h1>
            <p className="text-jk-sage text-xl font-body italic">
              Moments from Joanie's Kitchen and Garden
            </p>
          </div>
        </div>

        {/* Photo Grid */}
        <div className="max-w-6xl mx-auto px-4 py-12">
          <div className="mb-8 text-center">
            <p className="text-jk-clay font-body">
              Showing {startIndex + 1}-{endIndex} of {photos.length} photos
              <span className="mx-2">•</span>
              Page {currentPage + 1} of {totalPages}
            </p>
          </div>

          {/* Grid: 3x3 on desktop, 1x3 on mobile */}
          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-4 transition-opacity duration-500"
            key={currentPage}
          >
            {currentPhotos.map((photo) => (
              <div
                key={photo.id}
                className="relative aspect-square bg-jk-sage/10 rounded-jk overflow-hidden cursor-pointer group"
                onClick={() => setSelectedPhoto(photo)}
              >
                <Image
                  src={photo.image_url}
                  alt={photo.caption || 'Gallery photo'}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 33vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-body text-sm">
                      {photo.caption || 'Click to view'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }).map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentPage(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentPage
                    ? 'bg-jk-tomato w-8'
                    : 'bg-jk-sage hover:bg-jk-clay'
                }`}
                aria-label={`Go to page ${index + 1}`}
              />
            ))}
          </div>

          {/* Auto-rotation indicator */}
          <div className="text-center mt-6">
            <p className="text-jk-clay/60 text-sm font-body">
              Photos rotate automatically every 5 seconds
            </p>
          </div>
        </div>
      </div>

      {/* Full-size Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white text-4xl hover:text-jk-tomato transition-colors"
            onClick={() => setSelectedPhoto(null)}
            aria-label="Close"
          >
            ×
          </button>
          <div className="relative max-w-7xl max-h-[90vh] w-full h-full">
            <Image
              src={selectedPhoto.image_url}
              alt={selectedPhoto.caption || 'Gallery photo'}
              fill
              className="object-contain"
              sizes="100vw"
              priority
            />
            {selectedPhoto.caption && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-4 text-center">
                <p className="text-white font-body text-lg">{selectedPhoto.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
