'use client';

import { AlertTriangle, ChefHat, Clock, Flame, Loader2, UtensilsCrossed } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { generateMealPrepTimeline, type MealPrepTimeline } from '@/app/actions/meal-timeline';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface MealPrepTimelineProps {
  mealId: string;
  mealName: string;
}

const STEP_TYPE_CONFIG = {
  start: { icon: ChefHat, color: 'bg-blue-100 text-blue-800 border-blue-300', label: 'Start' },
  prep: {
    icon: UtensilsCrossed,
    color: 'bg-purple-100 text-purple-800 border-purple-300',
    label: 'Prep',
  },
  cook: { icon: Flame, color: 'bg-orange-100 text-orange-800 border-orange-300', label: 'Cook' },
  rest: { icon: Clock, color: 'bg-gray-100 text-gray-800 border-gray-300', label: 'Rest' },
  serve: { icon: ChefHat, color: 'bg-green-100 text-green-800 border-green-300', label: 'Serve' },
};

const PRIORITY_CONFIG = {
  critical: { color: 'bg-red-100 text-red-800', label: 'Critical' },
  important: { color: 'bg-yellow-100 text-yellow-800', label: 'Important' },
  optional: { color: 'bg-gray-100 text-gray-600', label: 'Optional' },
};

export function MealPrepTimeline({ mealId, mealName }: MealPrepTimelineProps) {
  const [timeline, setTimeline] = useState<MealPrepTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTimeline = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await generateMealPrepTimeline(mealId);

    if (result.success && result.timeline) {
      setTimeline(result.timeline);
    } else {
      setError(result.error || 'Failed to generate timeline');
      toast.error('Failed to generate timeline');
    }

    setIsLoading(false);
  }, [mealId]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-jk-sage" />
            <p className="text-jk-charcoal/60 font-body">Generating cooking timeline...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={loadTimeline} className="mt-4" variant="outline">
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!timeline) return null;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card className="border-jk-clay">
        <CardHeader>
          <CardTitle className="font-heading text-jk-olive text-2xl flex items-center gap-2">
            <Clock className="w-6 h-6 text-jk-clay" />
            Cooking Timeline
          </CardTitle>
          <CardDescription className="font-body">
            Coordinated preparation schedule for {mealName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-jk-charcoal/60 font-ui">Total Time</p>
              <p className="text-lg font-semibold text-jk-olive font-heading">
                {timeline.summary.earliestStart}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-jk-charcoal/60 font-ui">Peak Activity</p>
              <p className="text-lg font-semibold text-jk-olive font-heading">
                {timeline.summary.peakActivity}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-jk-charcoal/60 font-ui">Parallel Tasks</p>
              <p className="text-lg font-semibold text-jk-olive font-heading">
                {timeline.summary.parallelTasks}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-jk-charcoal/60 font-ui">Equipment Conflicts</p>
              <p className="text-lg font-semibold text-jk-olive font-heading">
                {timeline.summary.ovenConflicts + timeline.summary.stoveConflicts}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conflicts */}
      {timeline.conflicts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-heading text-jk-olive">⚠️ Potential Issues</h3>
          {timeline.conflicts.map((conflict, index) => (
            <Alert key={index} variant={conflict.type === 'equipment' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="font-heading">{conflict.message}</AlertTitle>
              {conflict.suggestion && (
                <AlertDescription className="font-body mt-2">
                  <strong>Suggestion:</strong> {conflict.suggestion}
                </AlertDescription>
              )}
            </Alert>
          ))}
        </div>
      )}

      {/* Timeline Steps */}
      <div className="space-y-2">
        <h3 className="text-lg font-heading text-jk-olive">Step-by-Step Timeline</h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-jk-sage/30" />

          {/* Steps */}
          <div className="space-y-4">
            {timeline.steps.map((step) => {
              const stepConfig = STEP_TYPE_CONFIG[step.type];
              const Icon = stepConfig.icon;
              const priorityConfig = PRIORITY_CONFIG[step.priority];

              return (
                <div key={step.id} className="relative pl-16 pr-4">
                  {/* Timeline dot */}
                  <div className="absolute left-6 top-2 w-5 h-5 rounded-full bg-jk-sage border-4 border-white" />

                  {/* Step card */}
                  <Card className="border-jk-sage/30 hover:border-jk-sage transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          {/* Time and badges */}
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className="bg-jk-sage/20 text-jk-olive font-ui font-semibold"
                            >
                              {step.time}
                            </Badge>
                            <Badge variant="outline" className={`${stepConfig.color} font-ui`}>
                              <Icon className="w-3 h-3 mr-1" />
                              {stepConfig.label}
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`${priorityConfig.color} font-ui text-xs`}
                            >
                              {priorityConfig.label}
                            </Badge>
                            {step.equipment && (
                              <Badge
                                variant="outline"
                                className="bg-blue-50 text-blue-700 border-blue-200 font-ui text-xs"
                              >
                                {step.equipment}
                              </Badge>
                            )}
                            {step.canParallelize && (
                              <Badge
                                variant="outline"
                                className="bg-green-50 text-green-700 border-green-200 font-ui text-xs"
                              >
                                Can parallelize
                              </Badge>
                            )}
                          </div>

                          {/* Action */}
                          <div>
                            <p className="font-heading text-jk-olive font-semibold">
                              {step.action}
                            </p>
                            <p className="text-sm text-jk-charcoal/70 font-body">
                              {step.recipeName}
                            </p>
                          </div>

                          {/* Duration */}
                          {step.duration && (
                            <p className="text-xs text-jk-charcoal/60 font-ui">
                              <Clock className="w-3 h-3 inline mr-1" />
                              {step.duration} minutes
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Pro Tips */}
      <Card className="border-jk-sage/50 bg-jk-sage/5">
        <CardHeader>
          <CardTitle className="font-heading text-jk-olive text-lg">💡 Pro Tips</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-jk-charcoal/70 font-body">
            <li>• Read through the entire timeline before starting</li>
            <li>• Set timers for critical steps to stay on track</li>
            <li>• Prep ingredients during cooking time when possible</li>
            <li>• Keep your workspace organized for efficient multitasking</li>
            {timeline.summary.ovenConflicts > 0 && (
              <li>
                • Consider using multiple oven racks or adjusting start times to avoid oven
                conflicts
              </li>
            )}
            {timeline.summary.parallelTasks > 5 && (
              <li>• This meal has many parallel tasks - consider asking for help!</li>
            )}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
