'use client';

import { Loader2, Plus, TrendingUp, Users, Utensils } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { createMealFromTemplate, getMealTemplates } from '@/app/actions/meals';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MealTemplate } from '@/lib/db/schema';
import { parseMealTemplateStructure } from '@/lib/meals/type-guards';

const MEAL_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'brunch', label: 'Brunch' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snack', label: 'Snack' },
  { value: 'dessert', label: 'Dessert' },
  { value: 'party', label: 'Party' },
  { value: 'holiday', label: 'Holiday' },
];

const MEAL_TYPE_COLORS: Record<string, string> = {
  breakfast: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  brunch: 'bg-orange-100 text-orange-800 border-orange-300',
  lunch: 'bg-blue-100 text-blue-800 border-blue-300',
  dinner: 'bg-purple-100 text-purple-800 border-purple-300',
  snack: 'bg-green-100 text-green-800 border-green-300',
  dessert: 'bg-pink-100 text-pink-800 border-pink-300',
  party: 'bg-red-100 text-red-800 border-red-300',
  holiday: 'bg-indigo-100 text-indigo-800 border-indigo-300',
};

export function MealTemplateSelector() {
  const router = useRouter();
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState<MealTemplate | null>(null);
  const [mealName, setMealName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    const result = await getMealTemplates(
      selectedType === 'all' ? undefined : { mealType: selectedType as any }
    );
    if (result.success && result.data) {
      setTemplates(result.data);
    }
    setIsLoading(false);
  }, [selectedType]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleUseTemplate = (template: MealTemplate) => {
    setSelectedTemplate(template);
    setMealName(template.name);
    setDialogOpen(true);
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !mealName.trim()) return;

    setIsCreating(true);
    const result = await createMealFromTemplate({
      templateId: selectedTemplate.id,
      mealName: mealName.trim(),
    });

    if (result.success && result.data) {
      toast.success('Meal created from template!');
      // Use slug for navigation if available
      const mealPath = result.data.slug || result.data.id;
      router.push(`/meals/${mealPath}`);
    } else {
      toast.error(result.error || 'Failed to create meal');
      setIsCreating(false);
    }
  };

  const parseTemplateStructure = (template: MealTemplate) => {
    try {
      const structure = parseMealTemplateStructure(template.template_structure as string);
      return structure.courses || [];
    } catch (error) {
      console.error('Failed to parse template structure:', error);
      return [];
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <Label htmlFor="typeFilter" className="font-ui text-jk-charcoal whitespace-nowrap">
          Filter by Type:
        </Label>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger id="typeFilter" className="w-full sm:w-48 font-body">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value} className="font-body">
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-jk-sage" />
        </div>
      ) : templates.length === 0 ? (
        <Card className="border-dashed border-jk-sage/50">
          <CardContent className="text-center py-12">
            <Utensils className="w-12 h-12 mx-auto mb-4 text-jk-sage" />
            <p className="text-jk-charcoal/60 font-body">No templates found</p>
            <p className="text-sm text-jk-charcoal/50 mt-2 font-body">
              Try selecting a different meal type
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template) => {
            const courses = parseTemplateStructure(template);
            const mealTypeColor =
              MEAL_TYPE_COLORS[template.meal_type || ''] || 'bg-gray-100 text-gray-800';

            return (
              <Card
                key={template.id}
                className="hover:shadow-lg md:hover:-translate-y-1 transition-all duration-200 border-jk-sage"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <CardTitle className="font-heading text-jk-olive text-lg line-clamp-2 flex-1">
                      {template.name}
                    </CardTitle>
                    {template.is_system && (
                      <Badge
                        variant="outline"
                        className="bg-jk-sage/20 text-jk-olive border-jk-sage text-xs"
                      >
                        System
                      </Badge>
                    )}
                  </div>
                  {template.meal_type && (
                    <Badge variant="outline" className={`${mealTypeColor} w-fit text-xs font-ui`}>
                      {template.meal_type}
                    </Badge>
                  )}
                  {template.description && (
                    <CardDescription className="font-body text-jk-charcoal/70 line-clamp-2 mt-2">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Template info */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-jk-charcoal/70">
                      <Users className="w-4 h-4 text-jk-clay" />
                      <span className="font-ui">Serves {template.default_serves}</span>
                    </div>
                    {template.times_used !== null && template.times_used > 0 && (
                      <div className="flex items-center gap-2 text-sm text-jk-charcoal/70">
                        <TrendingUp className="w-4 h-4 text-jk-clay" />
                        <span className="font-ui">Used {template.times_used} times</span>
                      </div>
                    )}
                  </div>

                  {/* Course structure */}
                  {courses.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-jk-olive/70 font-ui">
                        Course Structure:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {courses.map((course: any, index: number) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="text-xs border-jk-sage/50 text-jk-charcoal font-ui"
                          >
                            {course.category}
                            {course.count > 1 && ` (${course.count})`}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Use template button */}
                  <Button
                    onClick={() => handleUseTemplate(template)}
                    className="w-full min-h-[44px] touch-manipulation bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Use Template
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create from template dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-jk-olive">
              Create Meal from Template
            </DialogTitle>
            <DialogDescription className="font-body">
              Give your meal a name. You can customize it after creation.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedTemplate && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-jk-charcoal font-ui">Template:</p>
                <p className="text-sm text-jk-charcoal/70 font-body">{selectedTemplate.name}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mealName" className="font-ui text-jk-charcoal">
                Meal Name
              </Label>
              <Input
                id="mealName"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                placeholder="e.g., My Sunday Dinner"
                className="font-body"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={isCreating}
              className="font-ui"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateFromTemplate}
              disabled={isCreating || !mealName.trim()}
              className="bg-jk-tomato hover:bg-jk-tomato/90 text-white font-ui"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Meal'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
