/**
 * Error Fallback Component
 *
 * Generic error display with retry functionality
 * Used for graceful error handling throughout the app
 */

'use client';

import { AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ErrorFallbackProps {
  /** Error title */
  title?: string;
  /** Error message to display */
  message: string;
  /** Optional error details (shown in dev mode) */
  details?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Alternative action button */
  altAction?: {
    label: string;
    onClick: () => void;
  };
  /** Error severity level */
  severity?: 'error' | 'warning' | 'info';
  /** Show error icon */
  showIcon?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * ErrorFallback Component
 *
 * Displays user-friendly error messages with retry functionality
 *
 * @example
 * <ErrorFallback
 *   title="Failed to Load Recipes"
 *   message="We couldn't load the recipes. Please try again."
 *   onRetry={() => refetch()}
 * />
 */
export function ErrorFallback({
  title = 'Something Went Wrong',
  message,
  details,
  onRetry,
  altAction,
  severity = 'error',
  showIcon = true,
  className = '',
}: ErrorFallbackProps) {
  const isDev = process.env.NODE_ENV === 'development';

  const Icon = severity === 'error' ? XCircle : AlertCircle;
  const iconColor =
    severity === 'error'
      ? 'text-destructive'
      : severity === 'warning'
        ? 'text-yellow-500'
        : 'text-blue-500';

  return (
    <div className={`flex items-center justify-center px-4 py-8 ${className}`}>
      <div className="max-w-md text-center space-y-4">
        {showIcon && <Icon className={`w-12 h-12 mx-auto ${iconColor}`} />}

        <div className="space-y-2">
          <h2 className="text-2xl font-heading text-jk-olive">{title}</h2>
          <p className="text-base text-jk-charcoal/70 font-body">{message}</p>
        </div>

        {isDev && details && (
          <details className="text-left bg-gray-100 rounded-lg p-3 text-sm">
            <summary className="cursor-pointer font-medium text-gray-700 mb-2">
              Error Details (Dev Only)
            </summary>
            <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap break-words">
              {details}
            </pre>
          </details>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onRetry && (
            <Button onClick={onRetry} variant="default" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Button>
          )}
          {altAction && (
            <Button onClick={altAction.onClick} variant="outline">
              {altAction.label}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline Error Display
 *
 * Smaller error display for inline errors (e.g., form fields)
 */
export interface InlineErrorProps {
  message: string;
  className?: string;
}

export function InlineError({ message, className = '' }: InlineErrorProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-destructive ${className}`}>
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/**
 * Field Error Display
 *
 * Error display for form fields
 */
export interface FieldErrorProps {
  /** Field name (for accessibility) */
  fieldId: string;
  /** Error message */
  message: string;
  /** Custom className */
  className?: string;
}

export function FieldError({ fieldId, message, className = '' }: FieldErrorProps) {
  return (
    <p id={`${fieldId}-error`} className={`text-sm text-destructive mt-1 ${className}`} role="alert">
      {message}
    </p>
  );
}
