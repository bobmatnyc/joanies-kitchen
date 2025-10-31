'use client';

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  Loader2,
  Search,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  type CrawlRecipeResult,
  type CrawlStats,
  crawlAndStoreRecipes,
  crawlWeeklyRecipes,
} from '@/app/actions/recipe-crawl';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toErrorMessage } from '@/lib/utils/error-handling';
import { formatWeekInfo, getWeekInfo } from '@/lib/week-utils';

interface CrawlResult {
  success: boolean;
  stats: CrawlStats;
  recipes: CrawlRecipeResult[];
  weekInfo?: {
    year: number;
    week: number;
    startDate: string;
    endDate: string;
  };
}

type ProgressStep = 'idle' | 'discovering' | 'extracting' | 'validating' | 'storing' | 'complete';

interface RecipeProgress {
  name: string;
  url: string;
  status: 'pending' | 'extracting' | 'validating' | 'storing' | 'stored' | 'failed';
  error?: string;
}

interface ProgressState {
  currentStep: ProgressStep;
  discovered: number;
  extracting: { current: number; total: number };
  validating: { current: number; total: number };
  storing: { current: number; total: number };
  recipes: RecipeProgress[];
  overallProgress: number;
}

// Progress Step Component
function ProgressStepIndicator({
  step,
  label,
  status,
  count,
  icon: Icon,
}: {
  step: string;
  label: string;
  status: 'complete' | 'active' | 'pending';
  count?: string;
  icon: any;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
        status === 'active'
          ? 'bg-blue-50 border-blue-300 shadow-sm'
          : status === 'complete'
            ? 'bg-green-50 border-green-300'
            : 'bg-gray-50 border-gray-200'
      }`}
    >
      <div className="flex-shrink-0">
        {status === 'complete' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
        {status === 'active' && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
        {status === 'pending' && <Clock className="w-5 h-5 text-gray-400" />}
      </div>

      <div className="flex-1 min-w-0">
        <div
          className={`font-medium ${status === 'active' ? 'text-blue-900' : status === 'complete' ? 'text-green-900' : 'text-gray-500'}`}
        >
          {label}
        </div>
        {count && (
          <div
            className={`text-sm ${status === 'active' ? 'text-blue-700' : status === 'complete' ? 'text-green-700' : 'text-gray-500'}`}
          >
            {count}
          </div>
        )}
      </div>

      <Icon
        className={`w-5 h-5 ${status === 'active' ? 'text-blue-600' : status === 'complete' ? 'text-green-600' : 'text-gray-400'}`}
      />
    </div>
  );
}

// Recipe Progress List Component
function RecipeProgressList({ recipes }: { recipes: RecipeProgress[] }) {
  if (recipes.length === 0) return null;

  return (
    <div className="space-y-2 mt-4">
      <h3 className="font-medium text-sm text-gray-700">Recipes:</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {recipes.map((recipe, index) => (
          <div
            key={index}
            className={`flex items-start gap-3 text-sm p-3 rounded-lg border transition-all ${
              recipe.status === 'stored'
                ? 'bg-green-50 border-green-200'
                : recipe.status === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : recipe.status === 'pending'
                    ? 'bg-gray-50 border-gray-200'
                    : 'bg-blue-50 border-blue-200'
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {recipe.status === 'stored' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              {recipe.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
              {['extracting', 'validating', 'storing'].includes(recipe.status) && (
                <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              )}
              {recipe.status === 'pending' && <Clock className="w-4 h-4 text-gray-400" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{recipe.name || `Recipe ${index + 1}`}</div>
              <div className="text-xs text-gray-500 truncate mt-0.5">{recipe.url}</div>
              {recipe.status !== 'pending' && recipe.status !== 'stored' && (
                <div className="text-xs mt-1 text-blue-600 capitalize">{recipe.status}...</div>
              )}
              {recipe.error && (
                <div className="text-xs text-red-600 mt-1 bg-red-100 px-2 py-1 rounded">
                  {recipe.error}
                </div>
              )}
            </div>

            <div className="text-xs text-gray-500 flex-shrink-0">{index + 1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecipeCrawlPanel() {
  // Weekly discovery state
  const [weeksAgo, setWeeksAgo] = useState(0);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [weeklyResults, setWeeklyResults] = useState<CrawlResult | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<ProgressState | null>(null);

  // Legacy search state
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CrawlResult | null>(null);
  const [searchProgress, setSearchProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Weekly discovery handler with progress simulation
  async function handleWeeklyDiscovery() {
    setWeeklyLoading(true);
    setWeeklyResults(null);
    setWeeklyProgress(null);
    setError(null);

    const maxResults = 10;

    try {
      // Initialize progress state
      const initialProgress: ProgressState = {
        currentStep: 'discovering',
        discovered: 0,
        extracting: { current: 0, total: 0 },
        validating: { current: 0, total: 0 },
        storing: { current: 0, total: 0 },
        recipes: [],
        overallProgress: 0,
      };
      setWeeklyProgress(initialProgress);

      // Simulate discovering phase
      await new Promise((resolve) => setTimeout(resolve, 800));
      setWeeklyProgress((prev) =>
        prev
          ? {
              ...prev,
              discovered: maxResults,
              extracting: { current: 0, total: maxResults },
              validating: { current: 0, total: maxResults },
              storing: { current: 0, total: maxResults },
              overallProgress: 10,
              currentStep: 'extracting',
              recipes: Array.from({ length: maxResults }, (_, i) => ({
                name: `Recipe ${i + 1}`,
                url: '',
                status: 'pending',
              })),
            }
          : prev
      );

      // Start the actual crawl
      const crawlPromise = crawlWeeklyRecipes(weeksAgo, {
        maxResults,
        autoApprove: false,
      });

      // Simulate progress while crawling
      const progressInterval = setInterval(() => {
        setWeeklyProgress((prev) => {
          if (!prev || prev.currentStep === 'complete') return prev;

          const newProgress = { ...prev };

          // Simulate extracting progress
          if (
            newProgress.currentStep === 'extracting' &&
            newProgress.extracting.current < newProgress.extracting.total
          ) {
            const nextIndex = newProgress.extracting.current;
            newProgress.extracting.current = Math.min(nextIndex + 1, newProgress.extracting.total);
            newProgress.recipes[nextIndex] = {
              ...newProgress.recipes[nextIndex],
              status: 'extracting',
            };
            newProgress.overallProgress =
              10 + (newProgress.extracting.current / newProgress.extracting.total) * 30;

            if (newProgress.extracting.current === newProgress.extracting.total) {
              newProgress.currentStep = 'validating';
            }
          }
          // Simulate validating progress
          else if (
            newProgress.currentStep === 'validating' &&
            newProgress.validating.current < newProgress.validating.total
          ) {
            const nextIndex = newProgress.validating.current;
            newProgress.validating.current = Math.min(nextIndex + 1, newProgress.validating.total);
            newProgress.recipes[nextIndex] = {
              ...newProgress.recipes[nextIndex],
              status: 'validating',
            };
            newProgress.overallProgress =
              40 + (newProgress.validating.current / newProgress.validating.total) * 30;

            if (newProgress.validating.current === newProgress.validating.total) {
              newProgress.currentStep = 'storing';
            }
          }
          // Simulate storing progress
          else if (
            newProgress.currentStep === 'storing' &&
            newProgress.storing.current < newProgress.storing.total
          ) {
            const nextIndex = newProgress.storing.current;
            newProgress.storing.current = Math.min(nextIndex + 1, newProgress.storing.total);
            newProgress.recipes[nextIndex] = {
              ...newProgress.recipes[nextIndex],
              status: 'storing',
            };
            newProgress.overallProgress =
              70 + (newProgress.storing.current / newProgress.storing.total) * 30;
          }

          return newProgress;
        });
      }, 2200); // Slightly faster than actual 2s rate limit

      // Wait for actual crawl to complete
      const result = await crawlPromise;
      clearInterval(progressInterval);

      // Update with actual results
      if (result.success) {
        setWeeklyProgress((prev) =>
          prev
            ? {
                ...prev,
                currentStep: 'complete',
                extracting: { current: result.stats.converted, total: result.stats.searched },
                validating: { current: result.stats.approved, total: result.stats.searched },
                storing: { current: result.stats.stored, total: result.stats.searched },
                overallProgress: 100,
                recipes: result.recipes.map((r) => ({
                  name: r.name,
                  url: r.url,
                  status: r.status === 'stored' ? 'stored' : 'failed',
                  error: r.reason,
                })),
              }
            : prev
        );
      }

      setWeeklyResults(result);
    } catch (err: unknown) {
      setError(toErrorMessage(err) || 'Failed to discover recipes');
      setWeeklyProgress((prev) => (prev ? { ...prev, currentStep: 'idle' } : prev));
    } finally {
      setWeeklyLoading(false);
    }
  }

  // Legacy search handler with progress simulation
  async function handleCrawl() {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setResults(null);
    setSearchProgress(null);
    setError(null);

    const maxResults = 5;

    try {
      // Initialize progress state
      const initialProgress: ProgressState = {
        currentStep: 'discovering',
        discovered: 0,
        extracting: { current: 0, total: 0 },
        validating: { current: 0, total: 0 },
        storing: { current: 0, total: 0 },
        recipes: [],
        overallProgress: 0,
      };
      setSearchProgress(initialProgress);

      // Simulate discovering phase
      await new Promise((resolve) => setTimeout(resolve, 800));
      setSearchProgress((prev) =>
        prev
          ? {
              ...prev,
              discovered: maxResults,
              extracting: { current: 0, total: maxResults },
              validating: { current: 0, total: maxResults },
              storing: { current: 0, total: maxResults },
              overallProgress: 10,
              currentStep: 'extracting',
              recipes: Array.from({ length: maxResults }, (_, i) => ({
                name: `Recipe ${i + 1}`,
                url: '',
                status: 'pending',
              })),
            }
          : prev
      );

      // Start the actual crawl
      const crawlPromise = crawlAndStoreRecipes(query, {
        maxResults,
        autoApprove: false,
        minConfidence: 0.7,
      });

      // Simulate progress while crawling
      const progressInterval = setInterval(() => {
        setSearchProgress((prev) => {
          if (!prev || prev.currentStep === 'complete') return prev;

          const newProgress = { ...prev };

          // Simulate extracting progress
          if (
            newProgress.currentStep === 'extracting' &&
            newProgress.extracting.current < newProgress.extracting.total
          ) {
            const nextIndex = newProgress.extracting.current;
            newProgress.extracting.current = Math.min(nextIndex + 1, newProgress.extracting.total);
            newProgress.recipes[nextIndex] = {
              ...newProgress.recipes[nextIndex],
              status: 'extracting',
            };
            newProgress.overallProgress =
              10 + (newProgress.extracting.current / newProgress.extracting.total) * 30;

            if (newProgress.extracting.current === newProgress.extracting.total) {
              newProgress.currentStep = 'validating';
            }
          }
          // Simulate validating progress
          else if (
            newProgress.currentStep === 'validating' &&
            newProgress.validating.current < newProgress.validating.total
          ) {
            const nextIndex = newProgress.validating.current;
            newProgress.validating.current = Math.min(nextIndex + 1, newProgress.validating.total);
            newProgress.recipes[nextIndex] = {
              ...newProgress.recipes[nextIndex],
              status: 'validating',
            };
            newProgress.overallProgress =
              40 + (newProgress.validating.current / newProgress.validating.total) * 30;

            if (newProgress.validating.current === newProgress.validating.total) {
              newProgress.currentStep = 'storing';
            }
          }
          // Simulate storing progress
          else if (
            newProgress.currentStep === 'storing' &&
            newProgress.storing.current < newProgress.storing.total
          ) {
            const nextIndex = newProgress.storing.current;
            newProgress.storing.current = Math.min(nextIndex + 1, newProgress.storing.total);
            newProgress.recipes[nextIndex] = {
              ...newProgress.recipes[nextIndex],
              status: 'storing',
            };
            newProgress.overallProgress =
              70 + (newProgress.storing.current / newProgress.storing.total) * 30;
          }

          return newProgress;
        });
      }, 2200); // Slightly faster than actual 2s rate limit

      // Wait for actual crawl to complete
      const result = await crawlPromise;
      clearInterval(progressInterval);

      // Update with actual results
      if (result.success) {
        setSearchProgress((prev) =>
          prev
            ? {
                ...prev,
                currentStep: 'complete',
                extracting: { current: result.stats.converted, total: result.stats.searched },
                validating: { current: result.stats.approved, total: result.stats.searched },
                storing: { current: result.stats.stored, total: result.stats.searched },
                overallProgress: 100,
                recipes: result.recipes.map((r) => ({
                  name: r.name,
                  url: r.url,
                  status: r.status === 'stored' ? 'stored' : 'failed',
                  error: r.reason,
                })),
              }
            : prev
        );
      }

      setResults(result);
    } catch (err: unknown) {
      setError(toErrorMessage(err) || 'Failed to crawl recipes');
      setSearchProgress((prev) => (prev ? { ...prev, currentStep: 'idle' } : prev));
    } finally {
      setLoading(false);
    }
  }

  // Generate week options
  const weekOptions = Array.from({ length: 12 }, (_, i) => {
    const info = getWeekInfo(i);
    return {
      value: i,
      label: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i} Weeks Ago`,
      info: formatWeekInfo(info),
    };
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case 'stored':
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Stored
          </Badge>
        );
      case 'rejected':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Recipe Discovery
          </CardTitle>
          <CardDescription>
            Discover recipes from the web using AI-powered search and extraction.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="weekly" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="weekly">
                <Calendar className="w-4 h-4 mr-2" />
                Weekly Discovery
              </TabsTrigger>
              <TabsTrigger value="search">
                <Search className="w-4 h-4 mr-2" />
                Search & Crawl
              </TabsTrigger>
            </TabsList>

            <TabsContent value="weekly" className="space-y-4 mt-6">
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-2">Select Week</label>
                  <Select value={String(weeksAgo)} onValueChange={(v) => setWeeksAgo(Number(v))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {weekOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          <div className="flex flex-col">
                            <span>{option.label}</span>
                            <span className="text-xs text-muted-foreground">{option.info}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleWeeklyDiscovery} disabled={weeklyLoading} className="px-8">
                  <Calendar className="w-4 h-4 mr-2" />
                  {weeklyLoading ? 'Discovering...' : 'Discover Recipes'}
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {weeklyLoading && weeklyProgress && (
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-lg">Crawling Recipes...</p>
                        <Badge variant="outline" className="bg-white">
                          {Math.round(weeklyProgress.overallProgress)}%
                        </Badge>
                      </div>

                      <Progress value={weeklyProgress.overallProgress} className="h-3" />

                      <div className="grid gap-3 mt-6">
                        <ProgressStepIndicator
                          step="discovering"
                          label="Discovering Recipes"
                          status={
                            weeklyProgress.currentStep === 'discovering'
                              ? 'active'
                              : weeklyProgress.discovered > 0
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            weeklyProgress.discovered > 0
                              ? `${weeklyProgress.discovered} recipes found`
                              : undefined
                          }
                          icon={Search}
                        />

                        <ProgressStepIndicator
                          step="extracting"
                          label="Extracting Recipe Data"
                          status={
                            weeklyProgress.currentStep === 'extracting'
                              ? 'active'
                              : weeklyProgress.currentStep === 'validating' ||
                                  weeklyProgress.currentStep === 'storing' ||
                                  weeklyProgress.currentStep === 'complete'
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            weeklyProgress.extracting.total > 0
                              ? `${weeklyProgress.extracting.current}/${weeklyProgress.extracting.total} completed`
                              : undefined
                          }
                          icon={Globe}
                        />

                        <ProgressStepIndicator
                          step="validating"
                          label="Validating Quality"
                          status={
                            weeklyProgress.currentStep === 'validating'
                              ? 'active'
                              : weeklyProgress.currentStep === 'storing' ||
                                  weeklyProgress.currentStep === 'complete'
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            weeklyProgress.validating.total > 0
                              ? `${weeklyProgress.validating.current}/${weeklyProgress.validating.total} validated`
                              : undefined
                          }
                          icon={CheckCircle2}
                        />

                        <ProgressStepIndicator
                          step="storing"
                          label="Storing to Database"
                          status={
                            weeklyProgress.currentStep === 'storing'
                              ? 'active'
                              : weeklyProgress.currentStep === 'complete'
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            weeklyProgress.storing.total > 0
                              ? `${weeklyProgress.storing.current}/${weeklyProgress.storing.total} stored`
                              : undefined
                          }
                          icon={Database}
                        />
                      </div>

                      <RecipeProgressList recipes={weeklyProgress.recipes} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {weeklyResults && weeklyProgress?.currentStep === 'complete' && (
                <Alert className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <AlertDescription>
                    <div className="space-y-2">
                      <p className="font-semibold text-green-900">Crawl Complete!</p>
                      <div className="text-sm text-green-800">
                        <div className="grid grid-cols-2 gap-2">
                          <span>
                            Discovered: <strong>{weeklyResults.stats.searched}</strong>
                          </span>
                          <span>
                            Successfully stored:{' '}
                            <strong className="text-green-600">{weeklyResults.stats.stored}</strong>
                          </span>
                          <span>
                            Failed:{' '}
                            <strong
                              className={weeklyResults.stats.failed > 0 ? 'text-red-600' : ''}
                            >
                              {weeklyResults.stats.failed}
                            </strong>
                          </span>
                          <span>
                            Rejected:{' '}
                            <strong className="text-yellow-600">
                              {weeklyResults.stats.searched -
                                weeklyResults.stats.stored -
                                weeklyResults.stats.failed}
                            </strong>
                          </span>
                        </div>
                      </div>
                      {weeklyResults.stats.stored > 0 && (
                        <Button
                          variant="link"
                          className="p-0 h-auto text-green-700 hover:text-green-800"
                          asChild
                        >
                          <a href="/recipes">View recipes in your collection →</a>
                        </Button>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {weeklyResults && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        {weeklyResults.weekInfo && formatWeekInfo(weeklyResults.weekInfo)}
                      </CardTitle>
                      <CardDescription>
                        {weeklyResults.weekInfo &&
                          `${weeklyResults.weekInfo.startDate} to ${weeklyResults.weekInfo.endDate}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-5 gap-4">
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Discovered</p>
                          <p className="text-3xl font-bold text-blue-600">
                            {weeklyResults.stats.searched}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Extracted</p>
                          <p className="text-3xl font-bold text-purple-600">
                            {weeklyResults.stats.converted}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Approved</p>
                          <p className="text-3xl font-bold text-orange-600">
                            {weeklyResults.stats.approved}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Stored</p>
                          <p className="text-3xl font-bold text-green-600">
                            {weeklyResults.stats.stored}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-muted-foreground mb-1">Failed</p>
                          <p className="text-3xl font-bold text-red-600">
                            {weeklyResults.stats.failed}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {weeklyResults.recipes.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Recipe Details</CardTitle>
                        <CardDescription>
                          Individual results for each recipe discovered
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {weeklyResults.recipes.map((recipe, index) => (
                            <Card key={index} className="overflow-hidden">
                              <div className="p-4">
                                <div className="flex justify-between items-start gap-4">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start gap-2 mb-1">
                                      <h4 className="font-medium truncate">{recipe.name}</h4>
                                      {getStatusBadge(recipe.status)}
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate mb-2">
                                      {recipe.url}
                                    </p>
                                    {recipe.reason && (
                                      <p className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                                        {recipe.reason}
                                      </p>
                                    )}
                                    {recipe.id && (
                                      <a
                                        href={`/recipes/${recipe.id}`}
                                        className="text-sm text-blue-600 hover:text-blue-800 mt-2 inline-block"
                                      >
                                        View Recipe →
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {weeklyResults.stats.stored > 0 && (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertDescription>
                        Successfully discovered and added {weeklyResults.stats.stored} recipe
                        {weeklyResults.stats.stored !== 1 ? 's' : ''} from this week!
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="search" className="space-y-4 mt-6">
              <div className="flex gap-4">
                <Input
                  placeholder="Search for recipes to crawl (e.g., 'pasta carbonara', 'chocolate cake')"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleCrawl()}
                  disabled={loading}
                  className="flex-1"
                />
                <Button onClick={handleCrawl} disabled={loading || !query.trim()}>
                  <Search className="w-4 h-4 mr-2" />
                  {loading ? 'Crawling...' : 'Search & Crawl'}
                </Button>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {loading && searchProgress && (
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-lg">Crawling Recipes...</p>
                        <Badge variant="outline" className="bg-white">
                          {Math.round(searchProgress.overallProgress)}%
                        </Badge>
                      </div>

                      <Progress value={searchProgress.overallProgress} className="h-3" />

                      <div className="grid gap-3 mt-6">
                        <ProgressStepIndicator
                          step="discovering"
                          label="Searching Recipes"
                          status={
                            searchProgress.currentStep === 'discovering'
                              ? 'active'
                              : searchProgress.discovered > 0
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            searchProgress.discovered > 0
                              ? `${searchProgress.discovered} recipes found`
                              : undefined
                          }
                          icon={Search}
                        />

                        <ProgressStepIndicator
                          step="extracting"
                          label="Extracting Recipe Data"
                          status={
                            searchProgress.currentStep === 'extracting'
                              ? 'active'
                              : searchProgress.currentStep === 'validating' ||
                                  searchProgress.currentStep === 'storing' ||
                                  searchProgress.currentStep === 'complete'
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            searchProgress.extracting.total > 0
                              ? `${searchProgress.extracting.current}/${searchProgress.extracting.total} completed`
                              : undefined
                          }
                          icon={Globe}
                        />

                        <ProgressStepIndicator
                          step="validating"
                          label="Validating Quality"
                          status={
                            searchProgress.currentStep === 'validating'
                              ? 'active'
                              : searchProgress.currentStep === 'storing' ||
                                  searchProgress.currentStep === 'complete'
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            searchProgress.validating.total > 0
                              ? `${searchProgress.validating.current}/${searchProgress.validating.total} validated`
                              : undefined
                          }
                          icon={CheckCircle2}
                        />

                        <ProgressStepIndicator
                          step="storing"
                          label="Storing to Database"
                          status={
                            searchProgress.currentStep === 'storing'
                              ? 'active'
                              : searchProgress.currentStep === 'complete'
                                ? 'complete'
                                : 'pending'
                          }
                          count={
                            searchProgress.storing.total > 0
                              ? `${searchProgress.storing.current}/${searchProgress.storing.total} stored`
                              : undefined
                          }
                          icon={Database}
                        />
                      </div>

                      <RecipeProgressList recipes={searchProgress.recipes} />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {results && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Crawl Results</CardTitle>
              <CardDescription>Pipeline completed for query: "{query}"</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Searched</p>
                  <p className="text-3xl font-bold text-blue-600">{results.stats.searched}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Converted</p>
                  <p className="text-3xl font-bold text-purple-600">{results.stats.converted}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Approved</p>
                  <p className="text-3xl font-bold text-orange-600">{results.stats.approved}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Stored</p>
                  <p className="text-3xl font-bold text-green-600">{results.stats.stored}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-1">Failed</p>
                  <p className="text-3xl font-bold text-red-600">{results.stats.failed}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {results.recipes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recipe Details</CardTitle>
                <CardDescription>Individual results for each recipe found</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {results.recipes.map((recipe, index) => (
                    <Card key={index} className="overflow-hidden">
                      <div className="p-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start gap-2 mb-1">
                              <h4 className="font-medium truncate">{recipe.name}</h4>
                              {getStatusBadge(recipe.status)}
                            </div>
                            <p className="text-sm text-muted-foreground truncate mb-2">
                              {recipe.url}
                            </p>
                            {recipe.reason && (
                              <p className="text-sm text-muted-foreground bg-gray-50 p-2 rounded">
                                {recipe.reason}
                              </p>
                            )}
                            {recipe.id && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Recipe ID: {recipe.id}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {results.stats.stored > 0 && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Successfully added {results.stats.stored} recipe
                {results.stats.stored !== 1 ? 's' : ''} to your collection! You can view them in
                your recipe list.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </div>
  );
}
