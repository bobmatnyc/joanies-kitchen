import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecipeFormData } from '@/components/recipe/RecipeUploadWizard';

interface DraftData {
  data: RecipeFormData;
  savedAt: string;
  version: number;
  step: string;
}

interface UseRecipeDraftAutoSaveReturn {
  saveDraft: (data: RecipeFormData, step: string) => void;
  loadDraft: () => DraftData | null;
  clearDraft: () => void;
  hasDraft: boolean;
  lastSaved: string | null;
  isSaving: boolean;
  saveError: string | null;
}

const DRAFT_VERSION = 1;
const AUTO_SAVE_INTERVAL = 30000; // 30 seconds
const STORAGE_KEY_PREFIX = 'recipe-draft';

/**
 * Custom hook for auto-saving recipe draft data to localStorage
 *
 * Features:
 * - Auto-saves every 30 seconds (debounced)
 * - Saves immediately on step changes
 * - Handles storage errors gracefully
 * - Supports versioning for future migrations
 *
 * @param userId - User ID for draft isolation (null for anonymous users)
 * @returns Object with draft management functions and state
 */
export function useRecipeDraftAutoSave(userId: string | null): UseRecipeDraftAutoSaveReturn {
  const STORAGE_KEY = `${STORAGE_KEY_PREFIX}-${userId || 'anonymous'}`;

  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastDataRef = useRef<string>('');

  /**
   * Save draft data to localStorage
   */
  const saveDraft = useCallback(
    (data: RecipeFormData, step: string) => {
      try {
        setIsSaving(true);
        setSaveError(null);

        const draftData: DraftData = {
          data,
          savedAt: new Date().toISOString(),
          version: DRAFT_VERSION,
          step,
        };

        // Check if data actually changed to avoid unnecessary saves
        const dataString = JSON.stringify(draftData);
        if (dataString === lastDataRef.current) {
          setIsSaving(false);
          return;
        }

        localStorage.setItem(STORAGE_KEY, dataString);
        lastDataRef.current = dataString;

        setLastSaved(draftData.savedAt);
        setHasDraft(true);
        setIsSaving(false);
      } catch (error) {
        console.error('Failed to save draft:', error);

        // Handle quota exceeded error
        if (error instanceof Error && error.name === 'QuotaExceededError') {
          setSaveError('Storage quota exceeded. Please clear some browser data.');
        } else {
          setSaveError('Failed to save draft. Auto-save disabled.');
        }

        setIsSaving(false);
      }
    },
    [STORAGE_KEY]
  );

  /**
   * Load draft data from localStorage
   */
  const loadDraft = useCallback((): DraftData | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);

      if (!stored) {
        setHasDraft(false);
        return null;
      }

      const parsed = JSON.parse(stored) as DraftData;

      // Validate draft structure
      if (!parsed.data || !parsed.savedAt || !parsed.version) {
        console.warn('Invalid draft data structure, clearing...');
        localStorage.removeItem(STORAGE_KEY);
        setHasDraft(false);
        return null;
      }

      // Handle version migrations if needed
      if (parsed.version !== DRAFT_VERSION) {
        console.warn(`Draft version mismatch: ${parsed.version} vs ${DRAFT_VERSION}`);
        // Could add migration logic here in the future
      }

      setHasDraft(true);
      setLastSaved(parsed.savedAt);
      lastDataRef.current = stored;

      return parsed;
    } catch (error) {
      console.error('Failed to load draft:', error);

      // Clear corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (clearError) {
        console.error('Failed to clear corrupted draft:', clearError);
      }

      setHasDraft(false);
      return null;
    }
  }, [STORAGE_KEY]);

  /**
   * Clear draft data from localStorage
   */
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setHasDraft(false);
      setLastSaved(null);
      lastDataRef.current = '';
      setSaveError(null);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  }, [STORAGE_KEY]);

  /**
   * Check for existing draft on mount
   */
  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setHasDraft(true);
      setLastSaved(draft.savedAt);
    }
  }, [loadDraft]);

  /**
   * Cleanup auto-save timer on unmount
   */
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  return {
    saveDraft,
    loadDraft,
    clearDraft,
    hasDraft,
    lastSaved,
    isSaving,
    saveError,
  };
}

/**
 * Debounced auto-save effect
 * Call this from the component with form data and current step
 */
export function useAutoSaveEffect(
  formData: RecipeFormData,
  currentStep: string,
  saveDraft: (data: RecipeFormData, step: string) => void,
  enabled = true
) {
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for debounced save
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraft(formData, currentStep);
    }, AUTO_SAVE_INTERVAL);

    // Cleanup on unmount or dependency change
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [formData, currentStep, saveDraft, enabled]);
}

/**
 * Format saved timestamp for display
 */
export function formatSavedTime(isoString: string | null): string {
  if (!isoString) return '';

  try {
    const saved = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - saved.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays === 1) return '1 day ago';
    return `${diffDays} days ago`;
  } catch (error) {
    console.error('Failed to format saved time:', error);
    return '';
  }
}
