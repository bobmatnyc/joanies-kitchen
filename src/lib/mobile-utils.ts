/**
 * Mobile Utility Functions
 * Device detection and mobile-specific utilities
 */

/**
 * Check if running on mobile device (client-side only)
 * Uses user agent detection for server-side compatibility
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Check if running on iOS device (client-side only)
 */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Check if running on Android device (client-side only)
 */
export function isAndroid(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

/**
 * Check if device has touch capability
 */
export function hasTouchScreen(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - msMaxTouchPoints is legacy but still used
    navigator.msMaxTouchPoints > 0
  );
}

/**
 * Get safe area insets (for notched devices like iPhone X+)
 * Returns pixel values for top, bottom, left, right insets
 */
export function getSafeAreaInsets() {
  if (typeof window === 'undefined') {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const style = getComputedStyle(document.documentElement);

  // Parse CSS env() values
  const parseInset = (value: string): number => {
    const match = value.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  };

  return {
    top: parseInset(style.getPropertyValue('env(safe-area-inset-top)') || '0'),
    bottom: parseInset(style.getPropertyValue('env(safe-area-inset-bottom)') || '0'),
    left: parseInset(style.getPropertyValue('env(safe-area-inset-left)') || '0'),
    right: parseInset(style.getPropertyValue('env(safe-area-inset-right)') || '0'),
  };
}

/**
 * Get current viewport width
 */
export function getViewportWidth(): number {
  if (typeof window === 'undefined') return 0;
  return window.innerWidth || document.documentElement.clientWidth;
}

/**
 * Get current viewport height
 */
export function getViewportHeight(): number {
  if (typeof window === 'undefined') return 0;
  return window.innerHeight || document.documentElement.clientHeight;
}

/**
 * Check if viewport is mobile size (< 768px)
 */
export function isMobileViewport(): boolean {
  return getViewportWidth() < 768;
}

/**
 * Check if viewport is tablet size (768px - 1024px)
 */
export function isTabletViewport(): boolean {
  const width = getViewportWidth();
  return width >= 768 && width < 1024;
}

/**
 * Check if viewport is desktop size (>= 1024px)
 */
export function isDesktopViewport(): boolean {
  return getViewportWidth() >= 1024;
}

/**
 * Prevent body scroll (useful for modals on mobile)
 */
export function disableBodyScroll(): void {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.width = '100%';
}

/**
 * Re-enable body scroll
 */
export function enableBodyScroll(): void {
  if (typeof document === 'undefined') return;
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.width = '';
}

/**
 * Get device pixel ratio (for retina displays)
 */
export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;
  return window.devicePixelRatio || 1;
}

/**
 * Check if device is in portrait orientation
 */
export function isPortrait(): boolean {
  if (typeof window === 'undefined') return true;
  return window.innerHeight > window.innerWidth;
}

/**
 * Check if device is in landscape orientation
 */
export function isLandscape(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth > window.innerHeight;
}

/**
 * Vibrate device (if supported)
 * @param pattern - Vibration pattern in milliseconds (number or array)
 */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return false;
  return navigator.vibrate(pattern);
}

/**
 * Check if standalone PWA (installed to home screen)
 */
export function isStandalonePWA(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error - webkit specific
    window.navigator.standalone === true
  );
}

/**
 * Breakpoint helpers
 */
export const breakpoints = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Check if current viewport matches a specific breakpoint
 */
export function matchesBreakpoint(breakpoint: keyof typeof breakpoints): boolean {
  return getViewportWidth() >= breakpoints[breakpoint];
}
