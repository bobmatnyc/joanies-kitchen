'use client';

import { Download, Filter, Plus, Upload } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { exportAllRecipesAsZip } from '@/app/actions/recipe-export';
import MarkdownImporter from '@/components/recipe/MarkdownImporter';
import { RecipeList } from '@/components/recipe/RecipeList';
import { TagFilter } from '@/components/recipe/TagFilter';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

interface RecipePageContentProps {
  recipes: any[];
  availableTags?: string[];
  tagCounts?: Record<string, number>;
  initialSelectedTags?: string[];
}

export default function RecipePageContent({
  recipes,
  availableTags = [],
  tagCounts = {},
  initialSelectedTags = [],
}: RecipePageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialSelectedTags);

  // Update URL when tags change
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedTags.length > 0) {
      params.set('tags', selectedTags.join(','));
    } else {
      params.delete('tags');
    }
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.push(newUrl, { scroll: false });
  }, [selectedTags, pathname, router, searchParams]);

  const handleTagToggle = useCallback((tag: string) => {
    const normalizedTag = tag.toLowerCase();
    setSelectedTags((prev) => {
      const normalizedPrev = prev.map((t) => t.toLowerCase());
      if (normalizedPrev.includes(normalizedTag)) {
        return prev.filter((t) => t.toLowerCase() !== normalizedTag);
      } else {
        return [...prev, tag];
      }
    });
  }, []);

  const handleClearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  const handleImportComplete = (_count: number) => {
    setShowImportDialog(false);
    router.refresh();
  };

  const handleExportAll = async () => {
    try {
      setExporting(true);
      const result = await exportAllRecipesAsZip();

      // Convert base64 to blob and download
      const byteCharacters = atob(result.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: result.mimeType });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${result.count} recipes successfully!`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export recipes');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold">My Recipes</h1>
          <p className="text-muted-foreground mt-2">
            Browse and manage your recipe collection
            {selectedTags.length > 0 && (
              <span className="ml-2 text-sm">
                • Filtered by {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {availableTags.length > 0 && (
            <Button variant="outline" onClick={() => setShowFilterSheet(true)} className="relative">
              <Filter className="w-4 h-4 mr-2" />
              Filter
              {selectedTags.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center">
                  {selectedTags.length}
                </span>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          {recipes.length > 0 && (
            <Button variant="outline" onClick={handleExportAll} disabled={exporting}>
              <Download className="w-4 h-4 mr-2" />
              {exporting ? 'Exporting...' : 'Export All'}
            </Button>
          )}
          <Link href="/recipes/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Recipe
            </Button>
          </Link>
        </div>
      </div>

      {/* Desktop: Inline filter */}
      {availableTags.length > 0 && selectedTags.length > 0 && (
        <div className="hidden lg:block mb-6 p-4 border rounded-lg bg-muted/30">
          <TagFilter
            availableTags={availableTags}
            selectedTags={selectedTags}
            onTagToggle={handleTagToggle}
            onClearAll={handleClearTags}
            tagCounts={tagCounts}
            showCounts={true}
          />
        </div>
      )}

      <RecipeList recipes={recipes} />

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Recipes</DialogTitle>
            <DialogDescription>
              Import recipes from markdown files with YAML frontmatter
            </DialogDescription>
          </DialogHeader>
          <MarkdownImporter onImportComplete={handleImportComplete} />
        </DialogContent>
      </Dialog>

      {/* Filter Sheet (Mobile/Tablet) */}
      <Sheet open={showFilterSheet} onOpenChange={setShowFilterSheet}>
        <SheetContent side="right" className="w-[85%] sm:w-[400px]">
          <SheetHeader>
            <SheetTitle>Filter Recipes</SheetTitle>
            <SheetDescription>
              Select tags to filter your recipes. Choose multiple tags to find recipes that match
              all selections.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            <TagFilter
              availableTags={availableTags}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
              onClearAll={handleClearTags}
              tagCounts={tagCounts}
              showCounts={true}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
