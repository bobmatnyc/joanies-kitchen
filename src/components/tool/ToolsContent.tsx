'use client';

import { useState } from 'react';
import { ToolFilters } from './ToolFilters';
import { ToolList } from './ToolList';
import type { SortOption } from '@/app/actions/tools';

// Serialized tool type (dates as strings)
export interface SerializedTool {
  id: string;
  name: string;
  displayName: string;
  category: string;
  type: string | null;
  subtype: string | null;
  isEssential: boolean;
  isSpecialized: boolean;
  alternatives: string | null;
  typicalPriceUsd: string | null;
  description: string | null;
  slug: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount?: number;
  imageUrl?: string | null;
}

interface ToolsContentProps {
  initialTools: SerializedTool[];
  initialTotalCount: number;
}

/**
 * ToolsContent - Client component for interactive tool filtering
 *
 * Handles all client-side state and filtering logic, allowing the parent
 * page to be a Server Component that fetches data on the server.
 */
export function ToolsContent({ initialTools, initialTotalCount }: ToolsContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('usage');

  // Client-side filtering
  const filteredTools = initialTools
    .filter((tool) => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        tool.displayName.toLowerCase().includes(searchLower) ||
        tool.category.toLowerCase().includes(searchLower) ||
        tool.description?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.usageCount || 0) - (a.usageCount || 0);
        case 'category':
          return a.category.localeCompare(b.category) || a.displayName.localeCompare(b.displayName);
        case 'essential':
          if (a.isEssential && !b.isEssential) return -1;
          if (!a.isEssential && b.isEssential) return 1;
          return a.displayName.localeCompare(b.displayName);
        case 'alphabetical':
        default:
          return a.displayName.localeCompare(b.displayName);
      }
    });

  // Convert serialized tools back to Tool type for display
  const displayTools = filteredTools.map((tool) => ({
    ...tool,
    createdAt: new Date(tool.createdAt),
    updatedAt: new Date(tool.updatedAt),
  }));

  return (
    <>
      {/* Filters */}
      <ToolFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        sortBy={sortBy}
        onSortChange={setSortBy}
        totalCount={filteredTools.length}
      />

      {/* Content */}
      <div className="container mx-auto px-4 py-6">
        <ToolList tools={displayTools} />
      </div>
    </>
  );
}
