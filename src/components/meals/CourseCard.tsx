'use client';

import { Clock, Flame, Snowflake, Thermometer, ExternalLink, Info } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MealPlanCourse } from '@/types';

interface CourseCardProps {
  course: MealPlanCourse;
  courseType: 'appetizer' | 'main' | 'side' | 'dessert';
}

export function CourseCard({ course, courseType }: CourseCardProps) {
  const courseLabels = {
    appetizer: 'Appetizer',
    main: 'Main Course',
    side: 'Side Dish',
    dessert: 'Dessert',
  };

  const temperatureIcons = {
    hot: { icon: Flame, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950' },
    cold: { icon: Snowflake, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950' },
    room: { icon: Thermometer, color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-950' },
  };

  const tempInfo = temperatureIcons[course.temperature];
  const TempIcon = tempInfo.icon;

  return (
    <Card className="h-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline">{courseLabels[courseType]}</Badge>
              <div className={`flex items-center gap-1 px-2 py-1 rounded-md ${tempInfo.bg}`}>
                <TempIcon className={`w-3 h-3 ${tempInfo.color}`} />
                <span className={`text-xs font-medium ${tempInfo.color}`}>
                  {course.temperature}
                </span>
              </div>
            </div>
            <CardTitle className="text-xl">{course.name}</CardTitle>
            {course.cuisine_influence && (
              <CardDescription className="mt-1">
                {course.cuisine_influence} influence
              </CardDescription>
            )}
          </div>
          {course.recipe_id && (
            <Link
              href={`/recipes/${course.recipe_id}`}
              className="text-primary hover:text-primary/80 transition-colors"
              title="View full recipe"
            >
              <ExternalLink className="w-5 h-5" />
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-sm text-muted-foreground">{course.description}</p>

        {/* Pairing Rationale */}
        <div className="p-3 bg-primary/5 rounded-lg border border-primary/10">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-primary mb-1">Why This Pairing?</p>
              <p className="text-xs text-muted-foreground">{course.pairing_rationale}</p>
            </div>
          </div>
        </div>

        {/* Key Ingredients */}
        <div>
          <p className="text-xs font-semibold mb-2">Key Ingredients</p>
          <div className="flex flex-wrap gap-1">
            {course.key_ingredients.map((ingredient, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {ingredient}
              </Badge>
            ))}
          </div>
        </div>

        {/* Textures */}
        {course.dominant_textures.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2">Textures</p>
            <div className="flex flex-wrap gap-1">
              {course.dominant_textures.map((texture, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {texture}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Flavors */}
        {course.dominant_flavors && course.dominant_flavors.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2">Dominant Flavors</p>
            <div className="flex flex-wrap gap-1">
              {course.dominant_flavors.map((flavor, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {flavor}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Metadata Row */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{course.prep_time_minutes} min</span>
          </div>
          {course.sweetness_level && (
            <div>
              <span className="font-medium">Sweetness:</span> {course.sweetness_level}
            </div>
          )}
          {course.weight_score !== undefined && (
            <div>
              <span className="font-medium">Weight:</span> {course.weight_score}/10
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
