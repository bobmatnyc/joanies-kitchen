'use client';

import { Search, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface FridgeInputProps {
  onSearch: (ingredients: string[]) => Promise<void>;
  placeholder?: string;
  className?: string;
}

/**
 * FridgeInput Component - Simplified Version
 *
 * Simple text input for ingredient entry with comma/space parsing
 * User types ingredients, clicks button or presses Enter to search
 *
 * Features:
 * - Simple text input (no autocomplete)
 * - Parse by comma or space
 * - Enter key submission
 * - Loading state during search
 * - Clean, reliable, works everywhere
 *
 * Example: "chicken, rice, carrots" → ["chicken", "rice", "carrots"]
 */
export function FridgeInput({
  onSearch,
  placeholder = "What's in your fridge? (e.g., chicken, rice, carrots)",
  className,
}: FridgeInputProps) {
  const [input, setInput] = useState('');
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!input.trim()) return;

    setSearching(true);
    try {
      // Parse ingredients: split by comma or space, clean up
      const ingredients = input
        .split(/[,\s]+/)
        .map((i) => i.trim())
        .filter((i) => i.length > 0);

      if (ingredients.length > 0) {
        await onSearch(ingredients);
      }
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className={cn('flex gap-2 w-full max-w-3xl mx-auto', className)}>
      <Input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyPress={handleKeyPress}
        placeholder={placeholder}
        disabled={searching}
        className="flex-1 h-12 text-base px-4 text-white placeholder:text-white/60"
      />
      <Button
        onClick={handleSearch}
        disabled={searching || !input.trim()}
        size="lg"
        className="h-12 px-6 gap-2 bg-jk-tomato hover:bg-jk-tomato/90"
      >
        {searching ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="h-4 w-4" />
            Find Recipes
          </>
        )}
      </Button>
    </div>
  );
}
