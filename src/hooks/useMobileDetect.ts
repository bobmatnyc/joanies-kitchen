'use client';

import { useEffect, useState } from 'react';
import { breakpoints } from '@/lib/mobile-utils';

interface MobileDetectState {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  width: number;
  height: number;
}

/**
 * Hook to detect mobile/tablet/desktop viewport sizes
 * Updates on window resize
 *
 * Usage:
 * ```tsx
 * const { isMobile, isTablet, isDesktop } = useMobileDetect();
 *
 * if (isMobile) {
 *   return <MobileView />;
 * }
 * return <DesktopView />;
 * ```
 */
export function useMobileDetect(): MobileDetectState {
  const [state, setState] = useState<MobileDetectState>({
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    width: 1024, // Default to desktop
    height: 768,
  });

  useEffect(() => {
    const checkDevice = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setState({
        isMobile: width < breakpoints.md,
        isTablet: width >= breakpoints.md && width < breakpoints.lg,
        isDesktop: width >= breakpoints.lg,
        width,
        height,
      });
    };

    // Initial check
    checkDevice();

    // Add resize listener
    window.addEventListener('resize', checkDevice);

    // Cleanup
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return state;
}

/**
 * Hook to detect specific breakpoint
 *
 * Usage:
 * ```tsx
 * const isLargeScreen = useBreakpoint('lg');
 * ```
 */
export function useBreakpoint(breakpoint: keyof typeof breakpoints): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const checkBreakpoint = () => {
      setMatches(window.innerWidth >= breakpoints[breakpoint]);
    };

    checkBreakpoint();
    window.addEventListener('resize', checkBreakpoint);

    return () => window.removeEventListener('resize', checkBreakpoint);
  }, [breakpoint]);

  return matches;
}

/**
 * Hook to detect device orientation
 *
 * Usage:
 * ```tsx
 * const { isPortrait, isLandscape } = useOrientation();
 * ```
 */
export function useOrientation() {
  const [orientation, setOrientation] = useState<{
    isPortrait: boolean;
    isLandscape: boolean;
  }>({
    isPortrait: true,
    isLandscape: false,
  });

  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setOrientation({
        isPortrait,
        isLandscape: !isPortrait,
      });
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return orientation;
}

/**
 * Hook to detect touch device
 *
 * Usage:
 * ```tsx
 * const hasTouch = useTouchDevice();
 * ```
 */
export function useTouchDevice(): boolean {
  const [hasTouch, setHasTouch] = useState(false);

  useEffect(() => {
    setHasTouch(
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0 ||
      // @ts-expect-error - legacy property
      navigator.msMaxTouchPoints > 0
    );
  }, []);

  return hasTouch;
}
