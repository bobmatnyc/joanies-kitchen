'use client';

import { ShoppingCart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { generateShoppingListFromCollection } from '@/app/actions/meals';
import { Button } from '@/components/ui/button';

interface GenerateShoppingListButtonProps {
  collectionId: string;
  collectionName: string;
  recipeCount: number;
}

export function GenerateShoppingListButton({
  collectionId,
  collectionName,
  recipeCount,
}: GenerateShoppingListButtonProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (recipeCount === 0) {
      toast.error('No recipes in this collection');
      return;
    }

    setIsGenerating(true);

    try {
      const result = await generateShoppingListFromCollection({ mealId: collectionId });

      if (result.success && result.data) {
        toast.success('Shopping list generated!');
        // Navigate to shopping list view (we'll add this route later)
        router.push(`/meals#shopping-list-${result.data.id}`);
      } else {
        toast.error(result.error || 'Failed to generate shopping list');
      }
    } catch (error) {
      console.error('Error generating shopping list:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerate}
      disabled={isGenerating || recipeCount === 0}
      variant="outline"
      className="min-h-[44px] touch-manipulation border-jk-clay text-jk-clay hover:bg-jk-clay/10 font-ui"
    >
      <ShoppingCart className="w-4 h-4 mr-2" />
      {isGenerating ? 'Generating...' : 'Generate Shopping List'}
    </Button>
  );
}
