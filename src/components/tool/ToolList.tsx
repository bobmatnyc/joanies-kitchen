'use client';

import type { KitchenTool } from '@/app/actions/tools';
import { ToolCard } from './ToolCard';
import { Wrench } from 'lucide-react';

interface ToolListProps {
  tools: KitchenTool[];
  className?: string;
}

/**
 * ToolList - Container component for displaying kitchen tools
 *
 * Features:
 * - Grid view layout
 * - Responsive layout (2-5 columns based on screen size)
 * - Empty state handling
 *
 * Design:
 * - Matches IngredientList style
 * - Grid layout for visual browsing
 * - Mobile-first responsive design
 */
export function ToolList({ tools, className = '' }: ToolListProps) {
  if (tools.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <Wrench className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
        <p className="text-lg text-gray-500 dark:text-gray-400 text-center">
          No kitchen tools found
        </p>
        <p className="mt-2 text-sm text-gray-400 dark:text-gray-500 text-center max-w-md">
          Try adjusting your search terms
        </p>
      </div>
    );
  }

  // Grid view (matches ingredients page)
  return (
    <div
      className={`grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${className}`}
    >
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
