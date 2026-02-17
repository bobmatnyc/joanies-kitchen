import { toast as sonnerToast } from 'sonner';

/**
 * useToast Hook
 *
 * Wrapper around Sonner toast for consistent API
 * Provides toast notifications with title, description, and variants
 */
export function useToast() {
  return {
    toast: ({
      title,
      description,
      variant,
    }: {
      title: string;
      description?: string;
      variant?: 'default' | 'destructive';
    }) => {
      const message = description ? `${title}: ${description}` : title;

      if (variant === 'destructive') {
        sonnerToast.error(message);
      } else {
        sonnerToast.success(message);
      }
    },
  };
}
