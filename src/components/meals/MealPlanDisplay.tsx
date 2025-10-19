'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { MealPlan } from '@/types';
import { CourseCard } from './CourseCard';
import { MealBalanceDashboard } from './MealBalanceDashboard';

interface MealPlanDisplayProps {
  mealPlan: MealPlan;
  showAnalysis?: boolean;
}

export function MealPlanDisplay({ mealPlan, showAnalysis = true }: MealPlanDisplayProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Your Curated Meal</CardTitle>
          <CardDescription>
            A perfectly balanced {mealPlan.meal_analysis.total_prep_time}-minute dining experience
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Meal Balance Dashboard */}
      {showAnalysis && <MealBalanceDashboard mealPlan={mealPlan} />}

      {/* Course Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="lg:col-span-2">
          <CourseCard course={mealPlan.appetizer} courseType="appetizer" />
        </div>
        <CourseCard course={mealPlan.main} courseType="main" />
        <CourseCard course={mealPlan.side} courseType="side" />
        <div className="lg:col-span-2">
          <CourseCard course={mealPlan.dessert} courseType="dessert" />
        </div>
      </div>

      {/* Chef's Notes */}
      {mealPlan.meal_analysis.chef_notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Chef&apos;s Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground italic">
              {mealPlan.meal_analysis.chef_notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
