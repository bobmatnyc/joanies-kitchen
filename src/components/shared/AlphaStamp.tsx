'use client';

/**
 * AlphaStamp - Top Secret style overlay for alpha phase
 *
 * Displays a diagonal "ALPHA - BETA LAUNCH 6/1/26" stamp
 * across the top corner of all pages during alpha testing.
 *
 * Features:
 * - Red "TOP SECRET" style design
 * - 45-degree rotation
 * - Semi-transparent
 * - Non-interactive (pointer-events-none)
 * - Desktop only (hidden on mobile for better UX)
 * - Production only (hidden in development)
 */
export function AlphaStamp() {
  // Only show in production
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 hidden sm:block">
      {/* Top Secret Stamp */}
      <div className="absolute top-8 right-8 rotate-45">
        <div className="border-8 border-red-600 bg-red-600/10 backdrop-blur-sm px-12 py-6 shadow-2xl">
          <div className="border-4 border-red-600 border-dashed px-8 py-4">
            <div className="text-center">
              <div className="text-5xl font-black text-red-600 tracking-widest uppercase drop-shadow-lg">
                ALPHA
              </div>
              <div className="mt-2 text-xl font-bold text-red-700 tracking-wider">
                BETA LAUNCH 6/1/26
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
