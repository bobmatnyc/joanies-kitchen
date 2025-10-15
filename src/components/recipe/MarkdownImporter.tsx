'use client';

import { useState, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { importRecipeFromMarkdown, importRecipesFromMarkdown, previewMarkdownRecipe } from '@/app/actions/recipe-import';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface MarkdownImporterProps {
  onImportComplete?: (count: number) => void;
}

interface FilePreview {
  name: string;
  content: string;
  recipe?: any;
  error?: string;
}

export default function MarkdownImporter({ onImportComplete }: MarkdownImporterProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<FilePreview[]>([]);
  const [importing, setImporting] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FilePreview | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (fileList: FileList) => {
    const newFiles: FilePreview[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      if (file.type === 'text/markdown' || file.name.endsWith('.md')) {
        const content = await file.text();
        const preview = await previewMarkdownRecipe(content);

        newFiles.push({
          name: file.name,
          content,
          recipe: preview.success ? preview.recipe : undefined,
          error: preview.success ? undefined : preview.error,
        });
      }
    }

    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const fileList = e.dataTransfer.files;
    await processFiles(fileList);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await processFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (files.length === 0) {
      toast.error('Please select at least one markdown file');
      return;
    }

    setImporting(true);

    try {
      if (files.length === 1) {
        // Single file import
        const result = await importRecipeFromMarkdown(files[0].content);
        if (result.success && result.recipe) {
          toast.success('Recipe imported successfully!');
          if (onImportComplete) onImportComplete(1);
          router.push(`/recipes/${result.recipe.id}`);
        } else {
          toast.error(result.error || 'Failed to import recipe');
        }
      } else {
        // Multiple file import
        const result = await importRecipesFromMarkdown(
          files.map(f => ({ name: f.name, content: f.content }))
        );

        if (result.success) {
          toast.success(`Imported ${result.summary.successful} recipe(s) successfully!`);
          if (result.summary.failed > 0) {
            toast.warning(`Failed to import ${result.summary.failed} recipe(s)`);
          }
          if (onImportComplete) onImportComplete(result.summary.successful);
          router.refresh();
        } else {
          toast.error('Failed to import recipes');
        }
      }

      setFiles([]);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('An error occurred during import');
    } finally {
      setImporting(false);
    }
  };

  const viewFileDetails = (file: FilePreview) => {
    setSelectedFile(file);
    setShowDialog(true);
  };

  return (
    <RequireAuth
      featureName="Recipe Importer"
      description="Import recipes from markdown files with YAML frontmatter. Perfect for migrating your existing recipe collection."
      icon={<Upload className="h-12 w-12" />}
    >
      <>
        <Card>
          <CardHeader>
            <CardTitle>Import Recipes from Markdown</CardTitle>
            <CardDescription>
              Upload one or more markdown files to import recipes
            </CardDescription>
          </CardHeader>
        <CardContent>
          {/* Drop Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-8 text-center
              transition-colors cursor-pointer
              ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              hover:border-primary hover:bg-primary/5
            `}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".md,text/markdown"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-lg font-medium mb-2">
              Drop markdown files here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Supports .md files with YAML frontmatter
            </p>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="mt-6 space-y-2">
              <h3 className="font-medium mb-2">Selected Files ({files.length})</h3>
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{file.name}</p>
                      {file.recipe && (
                        <p className="text-xs text-muted-foreground">
                          {file.recipe.title}
                        </p>
                      )}
                    </div>
                    {file.recipe && (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                    {file.error && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        viewFileDetails(file);
                      }}
                    >
                      View
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile(index);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setFiles([])}
                  disabled={importing}
                >
                  Clear All
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || files.length === 0}
                >
                  {importing ? 'Importing...' : `Import ${files.length} Recipe(s)`}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedFile?.name}</DialogTitle>
            <DialogDescription>
              Preview of the parsed recipe data
            </DialogDescription>
          </DialogHeader>

          {selectedFile?.recipe ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{selectedFile.recipe.title}</h3>
                {selectedFile.recipe.description && (
                  <p className="text-sm text-muted-foreground">
                    {selectedFile.recipe.description}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedFile.recipe.prepTime && (
                  <Badge variant="outline">Prep: {selectedFile.recipe.prepTime}min</Badge>
                )}
                {selectedFile.recipe.cookTime && (
                  <Badge variant="outline">Cook: {selectedFile.recipe.cookTime}min</Badge>
                )}
                {selectedFile.recipe.servings && (
                  <Badge variant="outline">Servings: {selectedFile.recipe.servings}</Badge>
                )}
                {selectedFile.recipe.difficulty && (
                  <Badge variant="outline">{selectedFile.recipe.difficulty}</Badge>
                )}
              </div>

              {selectedFile.recipe.ingredients.length > 0 && (
                <div>
                  <h4 className="font-medium mb-1">Ingredients ({selectedFile.recipe.ingredients.length})</h4>
                  <ul className="text-sm space-y-1">
                    {selectedFile.recipe.ingredients.slice(0, 5).map((ing: string, i: number) => (
                      <li key={i}>• {ing}</li>
                    ))}
                    {selectedFile.recipe.ingredients.length > 5 && (
                      <li className="text-muted-foreground">
                        ... and {selectedFile.recipe.ingredients.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {selectedFile.recipe.instructions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-1">Instructions ({selectedFile.recipe.instructions.length} steps)</h4>
                  <ol className="text-sm space-y-1">
                    {selectedFile.recipe.instructions.slice(0, 3).map((inst: string, i: number) => (
                      <li key={i}>{i + 1}. {inst.substring(0, 100)}{inst.length > 100 && '...'}</li>
                    ))}
                    {selectedFile.recipe.instructions.length > 3 && (
                      <li className="text-muted-foreground">
                        ... and {selectedFile.recipe.instructions.length - 3} more steps
                      </li>
                    )}
                  </ol>
                </div>
              )}

              {selectedFile.recipe.tags && selectedFile.recipe.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedFile.recipe.tags.map((tag: string, i: number) => (
                    <Badge key={i} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          ) : selectedFile?.error ? (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
              <p className="font-medium">Error parsing recipe:</p>
              <p className="text-sm mt-1">{selectedFile.error}</p>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </>
    </RequireAuth>
  );
}