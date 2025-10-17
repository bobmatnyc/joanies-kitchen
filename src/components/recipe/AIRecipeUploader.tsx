'use client';

import { AlertCircle, CheckCircle2, Link, Loader2, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { uploadRecipeFromUrl, uploadRecipeWithAI } from '@/app/actions/ai-upload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

type UploadMode = 'text' | 'url';

export function AIRecipeUploader() {
  const [mode, setMode] = useState<UploadMode>('text');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  const handleTextUpload = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadRecipeWithAI({
        text,
        images: [], // TODO: Implement image upload to cloud storage
      });

      if (result.success && result.recipe) {
        setSuccess('Recipe parsed successfully! Redirecting...');
        setTimeout(() => {
          router.push(`/recipes/${result.recipe.id}`);
        }, 1000);
      } else {
        setError(result.error || 'Failed to parse recipe');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUrlUpload = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadRecipeFromUrl(url);

      if (result.success && result.recipe) {
        setSuccess('Recipe imported successfully! Redirecting...');
        setTimeout(() => {
          router.push(`/recipes/${result.recipe.id}`);
        }, 1000);
      } else {
        setError(result.error || 'Failed to import recipe from URL');
      }
    } catch (err) {
      console.error('URL upload failed:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Tabs value={mode} onValueChange={(v) => setMode(v as UploadMode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="text">
            <Upload className="w-4 h-4 mr-2" />
            Paste Recipe
          </TabsTrigger>
          <TabsTrigger value="url">
            <Link className="w-4 h-4 mr-2" />
            From URL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text" className="space-y-4 mt-6">
          <div>
            <label className="text-sm font-medium text-jk-olive">Recipe Text</label>
            <Textarea
              placeholder="Paste your recipe here (any format works!)...

Example:
Chocolate Chip Cookies

Ingredients:
- 2 cups flour
- 1 cup butter
- 1 cup sugar
- 2 eggs
- 2 cups chocolate chips

Instructions:
1. Preheat oven to 350°F
2. Mix butter and sugar
3. Add eggs and mix well
4. Add flour gradually
5. Fold in chocolate chips
6. Bake for 12 minutes"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={16}
              className="mt-2 font-mono text-sm"
            />
          </div>

          <Button
            onClick={handleTextUpload}
            disabled={!text.trim() || isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Parsing with AI...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Parse & Create Recipe
              </>
            )}
          </Button>
        </TabsContent>

        <TabsContent value="url" className="space-y-4 mt-6">
          <div>
            <label className="text-sm font-medium text-jk-olive">Recipe URL</label>
            <Input
              type="url"
              placeholder="https://example.com/recipe"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mt-2"
            />
            <p className="text-xs text-jk-olive/60 mt-1">
              Supports most recipe websites (AllRecipes, Food Network, NYT Cooking, etc.)
            </p>
          </div>

          <Button onClick={handleUrlUpload} disabled={!url.trim() || isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Fetching & Parsing...
              </>
            ) : (
              <>
                <Link className="w-4 h-4 mr-2" />
                Import Recipe
              </>
            )}
          </Button>
        </TabsContent>
      </Tabs>

      {/* Success Message */}
      {success && (
        <Alert className="mt-4 border-green-500 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert className="mt-4 border-red-500 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-jk-linen rounded-lg border border-jk-olive/20">
        <p className="text-sm text-jk-olive-dark">
          <strong>AI Powered:</strong> Our AI will parse your recipe and extract ingredients with
          amounts, instructions, cook times, and more! Just paste any recipe text or provide a URL.
        </p>
      </div>
    </div>
  );
}
