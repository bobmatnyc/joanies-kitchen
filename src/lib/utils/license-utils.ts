/**
 * Recipe License Utilities
 *
 * Helper functions for working with recipe licenses, including
 * license categorization, attribution text generation, and
 * commercial use validation.
 */

import type { RecipeLicense } from '@/types';

/**
 * License Display Names
 * Human-readable names for each license type
 */
export const LICENSE_DISPLAY_NAMES: Record<RecipeLicense, string> = {
  PUBLIC_DOMAIN: 'Public Domain',
  CC_BY: 'CC BY (Attribution)',
  CC_BY_SA: 'CC BY-SA (Attribution-ShareAlike)',
  CC_BY_NC: 'CC BY-NC (Attribution-NonCommercial)',
  CC_BY_NC_SA: 'CC BY-NC-SA (Attribution-NonCommercial-ShareAlike)',
  EDUCATIONAL_USE: 'Educational Use Only',
  PERSONAL_USE: 'Personal Use Only',
  ALL_RIGHTS_RESERVED: 'All Rights Reserved',
  FAIR_USE: 'Fair Use',
};

/**
 * License Descriptions
 * Detailed explanations of what each license allows
 */
export const LICENSE_DESCRIPTIONS: Record<RecipeLicense, string> = {
  PUBLIC_DOMAIN:
    'No copyright restrictions. Free to use for any purpose without attribution.',
  CC_BY: 'Free to use with attribution. Can be used commercially and modified.',
  CC_BY_SA:
    'Free to use with attribution. Derivative works must use the same license.',
  CC_BY_NC:
    'Free for non-commercial use with attribution. Cannot be used commercially.',
  CC_BY_NC_SA:
    'Free for non-commercial use with attribution. Derivatives must use the same license.',
  EDUCATIONAL_USE: 'Restricted to educational purposes only. Cannot be used commercially.',
  PERSONAL_USE: 'Restricted to personal, non-commercial use only.',
  ALL_RIGHTS_RESERVED: 'Full copyright protection. Requires permission for use.',
  FAIR_USE: 'Used under fair use doctrine for news, commentary, or education.',
};

/**
 * License Categories
 * Groups licenses by common characteristics
 */
export const LICENSE_CATEGORIES = {
  OPEN: ['PUBLIC_DOMAIN', 'CC_BY', 'CC_BY_SA'] as const,
  NON_COMMERCIAL: ['CC_BY_NC', 'CC_BY_NC_SA', 'PERSONAL_USE', 'EDUCATIONAL_USE'] as const,
  RESTRICTED: ['ALL_RIGHTS_RESERVED', 'FAIR_USE'] as const,
  CREATIVE_COMMONS: ['CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_NC_SA'] as const,
} as const;

/**
 * Check if a license allows commercial use
 */
export function canUseCommercially(license: RecipeLicense): boolean {
  return LICENSE_CATEGORIES.OPEN.includes(license as any);
}

/**
 * Check if a license requires attribution
 */
export function requiresAttribution(license: RecipeLicense): boolean {
  return LICENSE_CATEGORIES.CREATIVE_COMMONS.includes(license as any);
}

/**
 * Check if a license allows modifications
 */
export function allowsModifications(license: RecipeLicense): boolean {
  // All licenses except ALL_RIGHTS_RESERVED allow some form of modification
  return license !== 'ALL_RIGHTS_RESERVED';
}

/**
 * Check if a license requires ShareAlike
 */
export function requiresShareAlike(license: RecipeLicense): boolean {
  return license === 'CC_BY_SA' || license === 'CC_BY_NC_SA';
}

/**
 * Get attribution text for a recipe
 */
export function getAttributionText(params: {
  recipeName: string;
  author?: string;
  source?: string;
  license: RecipeLicense;
}): string | null {
  const { recipeName, author, source, license } = params;

  if (!requiresAttribution(license) && license !== 'ALL_RIGHTS_RESERVED') {
    return null;
  }

  const parts: string[] = [];

  // Recipe name
  parts.push(`"${recipeName}"`);

  // Author attribution
  if (author) {
    parts.push(`by ${author}`);
  }

  // Source link
  if (source) {
    parts.push(`(${source})`);
  }

  // License type
  if (requiresAttribution(license)) {
    parts.push(`is licensed under ${LICENSE_DISPLAY_NAMES[license]}`);
  } else if (license === 'ALL_RIGHTS_RESERVED') {
    parts.push('- All Rights Reserved');
  }

  return parts.join(' ');
}

/**
 * Get license badge color for UI
 */
export function getLicenseBadgeColor(license: RecipeLicense): string {
  if (LICENSE_CATEGORIES.OPEN.includes(license as any)) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  }

  if (LICENSE_CATEGORIES.NON_COMMERCIAL.includes(license as any)) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  }

  if (LICENSE_CATEGORIES.RESTRICTED.includes(license as any)) {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
  }

  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

/**
 * Get license icon emoji for UI
 */
export function getLicenseIcon(license: RecipeLicense): string {
  switch (license) {
    case 'PUBLIC_DOMAIN':
      return '🌐';
    case 'CC_BY':
    case 'CC_BY_SA':
    case 'CC_BY_NC':
    case 'CC_BY_NC_SA':
      return '🔓';
    case 'EDUCATIONAL_USE':
      return '📚';
    case 'PERSONAL_USE':
      return '🏠';
    case 'ALL_RIGHTS_RESERVED':
      return '🔒';
    case 'FAIR_USE':
      return '⚖️';
    default:
      return '📄';
  }
}

/**
 * Get Creative Commons license URL
 */
export function getCreativeCommonsUrl(license: RecipeLicense): string | null {
  const ccUrls: Partial<Record<RecipeLicense, string>> = {
    CC_BY: 'https://creativecommons.org/licenses/by/4.0/',
    CC_BY_SA: 'https://creativecommons.org/licenses/by-sa/4.0/',
    CC_BY_NC: 'https://creativecommons.org/licenses/by-nc/4.0/',
    CC_BY_NC_SA: 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  };

  return ccUrls[license] || null;
}

/**
 * Check if two licenses are compatible for recipe remixing/combining
 */
export function areLicensesCompatible(
  license1: RecipeLicense,
  license2: RecipeLicense
): boolean {
  // Same license is always compatible
  if (license1 === license2) {
    return true;
  }

  // Public domain is compatible with everything
  if (license1 === 'PUBLIC_DOMAIN' || license2 === 'PUBLIC_DOMAIN') {
    return true;
  }

  // All rights reserved is not compatible with anything except itself and public domain
  if (license1 === 'ALL_RIGHTS_RESERVED' || license2 === 'ALL_RIGHTS_RESERVED') {
    return false;
  }

  // Non-commercial licenses are not compatible with commercial licenses
  const isNonCommercial1 = LICENSE_CATEGORIES.NON_COMMERCIAL.includes(license1 as any);
  const isNonCommercial2 = LICENSE_CATEGORIES.NON_COMMERCIAL.includes(license2 as any);

  if (isNonCommercial1 !== isNonCommercial2) {
    return false;
  }

  // ShareAlike licenses require the result to use the same license
  const requiresSA1 = requiresShareAlike(license1);
  const requiresSA2 = requiresShareAlike(license2);

  if (requiresSA1 && requiresSA2 && license1 !== license2) {
    return false;
  }

  // Otherwise, they're compatible
  return true;
}

/**
 * Get the most restrictive license from a list
 * Used when combining recipes with different licenses
 */
export function getMostRestrictiveLicense(licenses: RecipeLicense[]): RecipeLicense {
  // Priority order (most to least restrictive)
  const priority: RecipeLicense[] = [
    'ALL_RIGHTS_RESERVED',
    'FAIR_USE',
    'EDUCATIONAL_USE',
    'PERSONAL_USE',
    'CC_BY_NC_SA',
    'CC_BY_NC',
    'CC_BY_SA',
    'CC_BY',
    'PUBLIC_DOMAIN',
  ];

  for (const license of priority) {
    if (licenses.includes(license)) {
      return license;
    }
  }

  // Default to most restrictive if somehow nothing matches
  return 'ALL_RIGHTS_RESERVED';
}

/**
 * Validate if a license is appropriate for AI-generated content
 */
export function isValidForAiGenerated(license: RecipeLicense): boolean {
  // AI-generated content typically should be:
  // - Personal use (if user-specific)
  // - Public domain (if fully open)
  // - CC licenses (if sharing openly)
  const validLicenses: RecipeLicense[] = [
    'PUBLIC_DOMAIN',
    'CC_BY',
    'CC_BY_SA',
    'CC_BY_NC',
    'CC_BY_NC_SA',
    'PERSONAL_USE',
  ];

  return validLicenses.includes(license);
}

/**
 * Get recommended license for a recipe based on its characteristics
 */
export function getRecommendedLicense(params: {
  isAiGenerated: boolean;
  isUserCreated: boolean;
  hasExternalSource: boolean;
  isPublic: boolean;
}): RecipeLicense {
  const { isAiGenerated, isUserCreated, hasExternalSource, isPublic } = params;

  // External sources should default to most restrictive
  if (hasExternalSource) {
    return 'ALL_RIGHTS_RESERVED';
  }

  // AI-generated content
  if (isAiGenerated) {
    return isPublic ? 'CC_BY' : 'PERSONAL_USE';
  }

  // User-created content
  if (isUserCreated) {
    return isPublic ? 'CC_BY' : 'PERSONAL_USE';
  }

  // Default to most restrictive
  return 'ALL_RIGHTS_RESERVED';
}

/**
 * Format license for display in recipe cards
 */
export function formatLicenseForDisplay(license: RecipeLicense, compact = false): string {
  if (compact) {
    // Short format for badges
    const shortNames: Record<RecipeLicense, string> = {
      PUBLIC_DOMAIN: 'Public',
      CC_BY: 'CC BY',
      CC_BY_SA: 'CC BY-SA',
      CC_BY_NC: 'CC BY-NC',
      CC_BY_NC_SA: 'CC BY-NC-SA',
      EDUCATIONAL_USE: 'Education',
      PERSONAL_USE: 'Personal',
      ALL_RIGHTS_RESERVED: 'Reserved',
      FAIR_USE: 'Fair Use',
    };
    return shortNames[license];
  }

  return LICENSE_DISPLAY_NAMES[license];
}

/**
 * Get all licenses suitable for filtering
 */
export function getFilterableLicenses(): Array<{
  value: RecipeLicense;
  label: string;
  description: string;
}> {
  return (Object.keys(LICENSE_DISPLAY_NAMES) as RecipeLicense[]).map((license) => ({
    value: license,
    label: LICENSE_DISPLAY_NAMES[license],
    description: LICENSE_DESCRIPTIONS[license],
  }));
}
