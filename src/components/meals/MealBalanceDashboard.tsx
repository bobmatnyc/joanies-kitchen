'use client';

import { Activity, Award, Clock, Palette, Thermometer, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { MealPlan } from '@/types';

interface MealBalanceDashboardProps {
  mealPlan: MealPlan;
}

export function MealBalanceDashboard({ mealPlan }: MealBalanceDashboardProps) {
  const { meal_analysis } = mealPlan;

  // Calculate texture variety score (0-100)
  const textureScore = Math.min((meal_analysis.texture_variety_count / 10) * 100, 100);

  // Temperature progression visualization
  const tempProgression = meal_analysis.temperature_progression || [];

  // Macro percentages
  const macros = meal_analysis.estimated_macros;
  const totalMacros = macros.carbs_percent + macros.protein_percent + macros.fat_percent;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Total Prep Time */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Total Time</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{meal_analysis.total_prep_time} min</div>
          <p className="text-xs text-muted-foreground mt-1">From appetizer to dessert</p>
        </CardContent>
      </Card>

      {/* Texture Variety */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Texture Variety</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{meal_analysis.texture_variety_count}</span>
              <span className="text-sm text-muted-foreground">different textures</span>
            </div>
            <Progress value={textureScore} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Cultural Coherence */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Cultural Harmony</CardTitle>
            <Award className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm font-medium">{meal_analysis.cultural_coherence}</div>
          <p className="text-xs text-muted-foreground mt-1">Cuisine alignment across courses</p>
        </CardContent>
      </Card>

      {/* Color Palette */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Color Palette</CardTitle>
            <Palette className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {meal_analysis.color_palette.map((color, idx) => (
              <Badge key={idx} variant="outline" className="text-xs">
                {color}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Visual variety for an appealing presentation
          </p>
        </CardContent>
      </Card>

      {/* Temperature Progression */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Temperature Flow</CardTitle>
            <Thermometer className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tempProgression.length > 0 ? (
              <>
                <div className="flex items-center gap-2">
                  {tempProgression.map((temp, idx) => (
                    <div key={idx} className="flex-1">
                      <div className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-xs w-full ${
                            temp.toLowerCase().includes('hot')
                              ? 'border-orange-500 text-orange-600'
                              : temp.toLowerCase().includes('cold')
                                ? 'border-blue-500 text-blue-600'
                                : 'border-gray-500 text-gray-600'
                          }`}
                        >
                          {temp}
                        </Badge>
                      </div>
                      {idx < tempProgression.length - 1 && (
                        <div className="text-center text-muted-foreground text-xs mt-1">→</div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Progression from course to course
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">No temperature data available</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Macronutrient Balance */}
      <Card className="md:col-span-2 lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Macro Balance</CardTitle>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Carbs */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Carbs</span>
                <span className="font-medium">{macros.carbs_percent}%</span>
              </div>
              <Progress
                value={(macros.carbs_percent / totalMacros) * 100}
                className="h-2 bg-blue-100 dark:bg-blue-950"
              />
            </div>

            {/* Protein */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Protein</span>
                <span className="font-medium">{macros.protein_percent}%</span>
              </div>
              <Progress
                value={(macros.protein_percent / totalMacros) * 100}
                className="h-2 bg-green-100 dark:bg-green-950"
              />
            </div>

            {/* Fat */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Fat</span>
                <span className="font-medium">{macros.fat_percent}%</span>
              </div>
              <Progress
                value={(macros.fat_percent / totalMacros) * 100}
                className="h-2 bg-orange-100 dark:bg-orange-950"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
