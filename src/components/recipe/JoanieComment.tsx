'use client';

import { Lightbulb, MessageCircle, PenLine, RefreshCw } from 'lucide-react';
import type { JoanieComment } from '@/lib/db/schema';

interface JoanieCommentProps {
  comment: JoanieComment;
  className?: string;
}

/**
 * JoanieComment - Display component for Joanie's personal notes and observations
 *
 * Design Philosophy:
 * - Authentic personal voice (not formal recipe notes)
 * - Distinct visual style to differentiate from user content
 * - Quote-style formatting with visual emphasis
 * - Icon indicates comment type (story, tip, substitution)
 *
 * Usage:
 * <JoanieComment comment={comment} />
 */
export function JoanieComment({ comment, className = '' }: JoanieCommentProps) {
  // Get icon based on comment type
  const getIcon = () => {
    switch (comment.comment_type) {
      case 'story':
        return <MessageCircle className="h-5 w-5" />;
      case 'tip':
        return <Lightbulb className="h-5 w-5" />;
      case 'substitution':
        return <RefreshCw className="h-5 w-5" />;
      default:
        return <PenLine className="h-5 w-5" />;
    }
  };

  // Get label based on comment type
  const getLabel = () => {
    switch (comment.comment_type) {
      case 'story':
        return "Joanie's Story";
      case 'tip':
        return "Joanie's Tip";
      case 'substitution':
        return 'Joanie on Substitutions';
      default:
        return "From Joanie's Kitchen";
    }
  };

  return (
    <div
      className={`relative my-6 rounded-lg border-l-4 border-amber-500 bg-amber-50 p-6 dark:bg-amber-950/20 dark:border-amber-600 ${className}`}
    >
      {/* Header with icon and label */}
      <div className="mb-3 flex items-center gap-2 text-amber-700 dark:text-amber-400">
        {getIcon()}
        <span className="font-semibold text-sm uppercase tracking-wide">{getLabel()}</span>
      </div>

      {/* Comment text in quote style */}
      <blockquote className="relative">
        {/* Opening quote mark */}
        <span className="absolute -left-2 -top-4 text-6xl text-amber-300/50 dark:text-amber-700/50 font-serif leading-none">
          "
        </span>

        {/* Comment content */}
        <p className="relative text-base leading-relaxed text-gray-800 dark:text-gray-200 italic pl-4">
          {comment.comment_text}
        </p>

        {/* Closing quote mark */}
        <span className="absolute -bottom-8 right-0 text-6xl text-amber-300/50 dark:text-amber-700/50 font-serif leading-none">
          "
        </span>
      </blockquote>

      {/* Signature */}
      <div className="mt-6 text-right">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">— Joanie</p>
      </div>

      {/* Optional: Decorative corner accent */}
      <div className="absolute top-0 right-0 h-12 w-12 overflow-hidden">
        <div className="absolute top-0 right-0 h-0 w-0 border-t-[48px] border-r-[48px] border-t-amber-200/40 border-r-transparent dark:border-t-amber-800/20"></div>
      </div>
    </div>
  );
}

/**
 * Compact version for smaller spaces (e.g., recipe cards)
 */
export function JoanieCommentCompact({ comment, className = '' }: JoanieCommentProps) {
  const getIcon = () => {
    switch (comment.comment_type) {
      case 'story':
        return <MessageCircle className="h-4 w-4" />;
      case 'tip':
        return <Lightbulb className="h-4 w-4" />;
      case 'substitution':
        return <RefreshCw className="h-4 w-4" />;
      default:
        return <PenLine className="h-4 w-4" />;
    }
  };

  return (
    <div
      className={`flex gap-3 rounded-md border-l-2 border-amber-500 bg-amber-50/50 p-3 text-sm dark:bg-amber-950/10 dark:border-amber-600 ${className}`}
    >
      <div className="flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">{getIcon()}</div>
      <div className="flex-1">
        <p className="text-gray-700 dark:text-gray-300 italic line-clamp-3">
          {comment.comment_text}
        </p>
        <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">— Joanie</p>
      </div>
    </div>
  );
}

/**
 * Inline version for minimal space (e.g., ingredient lists)
 */
export function JoanieCommentInline({ comment, className = '' }: JoanieCommentProps) {
  return (
    <div
      className={`inline-flex items-start gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs dark:bg-amber-950/10 dark:border-amber-700 ${className}`}
    >
      <Lightbulb className="h-3 w-3 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
      <span className="text-gray-700 dark:text-gray-300 italic">{comment.comment_text}</span>
    </div>
  );
}
