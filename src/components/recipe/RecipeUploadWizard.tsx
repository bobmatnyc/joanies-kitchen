'use client';

import { useUser } from '@clerk/nextjs';
import { ArrowLeft, ArrowRight, Check, Clock, Loader2, Save, Upload, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { createRecipe } from '@/app/actions/recipes';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  formatSavedTime,
  useAutoSaveEffect,
  useRecipeDraftAutoSave,
} from '@/hooks/useRecipeDraftAutoSave';
import { toast } from '@/lib/toast';
import { DraftResumeDialog } from './DraftResumeDialog';
import { RecipeStepBasicInfo } from './RecipeStepBasicInfo';
import { RecipeStepImages } from './RecipeStepImages';
import { RecipeStepIngredients } from './RecipeStepIngredients';
import { RecipeStepInstructions } from './RecipeStepInstructions';
import { RecipeStepReview } from './RecipeStepReview';

interface RecipeUploadWizardProps {
  onComplete?: (recipeId: string) => void;
  onCancel?: () => void;
}

type WizardStep = 'basic' | 'ingredients' | 'instructions' | 'images' | 'review';

export interface RecipeFormData {
  // Basic Info
  name: string;
  description: string;
  cuisine: string;
  difficulty: 'easy' | 'medium' | 'hard';
  prep_time: number;
  cook_time: number;
  servings: number;

  // Ingredients & Instructions
  ingredients: string[];
  instructions: string[];

  // Images
  images: string[];

  // Tags & Settings
  tags: string[];
  isPublic: boolean;
}

const INITIAL_FORM_DATA: RecipeFormData = {
  name: '',
  description: '',
  cuisine: '',
  difficulty: 'medium',
  prep_time: 30,
  cook_time: 30,
  servings: 4,
  ingredients: [''],
  instructions: [''],
  images: [],
  tags: [],
  isPublic: false,
};

export function RecipeUploadWizard({ onComplete, onCancel }: RecipeUploadWizardProps) {
  const router = useRouter();
  const { user } = useUser();
  const userId = user?.id || null;

  const [currentStep, setCurrentStep] = useState<WizardStep>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<RecipeFormData>(INITIAL_FORM_DATA);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const hasLoadedDraft = useRef(false);

  // Auto-save hook
  const { saveDraft, loadDraft, clearDraft, hasDraft, lastSaved, isSaving, saveError } =
    useRecipeDraftAutoSave(userId);

  // Auto-save effect (debounced)
  useAutoSaveEffect(formData, currentStep, saveDraft, hasUnsavedChanges && !isSubmitting);

  const stepProgress: Record<WizardStep, number> = {
    basic: 20,
    ingredients: 40,
    instructions: 60,
    images: 80,
    review: 100,
  };

  const stepTitles: Record<WizardStep, string> = {
    basic: 'Basic Information',
    ingredients: 'Ingredients',
    instructions: 'Instructions',
    images: 'Photos',
    review: 'Review & Submit',
  };

  // Load draft on mount (only once)
  useEffect(() => {
    if (!hasLoadedDraft.current) {
      hasLoadedDraft.current = true;
      const draft = loadDraft();
      if (draft && hasDraft) {
        setShowDraftDialog(true);
      }
    }
  }, [hasDraft, loadDraft]);

  // Browser navigation warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && !isSubmitting) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSubmitting]);

  const updateFormData = (updates: Partial<RecipeFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
    setHasUnsavedChanges(true);
  };

  const handleResumeDraft = () => {
    const draft = loadDraft();
    if (draft) {
      setFormData(draft.data);
      setCurrentStep(draft.step as WizardStep);
      setDraftRestored(true);
      setHasUnsavedChanges(true);
      toast.success(`Draft restored from ${formatSavedTime(draft.savedAt)}`);
    }
    setShowDraftDialog(false);
  };

  const handleStartFresh = () => {
    clearDraft();
    setFormData(INITIAL_FORM_DATA);
    setCurrentStep('basic');
    setDraftRestored(false);
    setHasUnsavedChanges(false);
    setShowDraftDialog(false);
    toast.info('Starting with a fresh recipe');
  };

  const handleClearDraft = () => {
    clearDraft();
    setDraftRestored(false);
    toast.info('Draft cleared');
  };

  const validateStep = (step: WizardStep): boolean => {
    switch (step) {
      case 'basic':
        return (
          formData.name.trim().length > 0 &&
          formData.name.length <= 200 &&
          formData.description.trim().length > 0 &&
          formData.description.length <= 1000
        );
      case 'ingredients': {
        const validIngredients = formData.ingredients.filter((i) => i.trim().length > 0);
        return validIngredients.length >= 1;
      }
      case 'instructions': {
        const validInstructions = formData.instructions.filter((i) => i.trim().length > 0);
        return validInstructions.length >= 1;
      }
      case 'images':
        return true; // Images are optional
      case 'review':
        return true; // Just a review step
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      toast.error('Please complete all required fields before continuing');
      return;
    }

    const steps: WizardStep[] = ['basic', 'ingredients', 'instructions', 'images', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];

      // Save immediately on step change
      saveDraft(formData, nextStep);

      setCurrentStep(nextStep);
      // Auto-focus first input on next step
      setTimeout(() => {
        const firstInput = document.querySelector<HTMLInputElement>(
          'input:not([type="hidden"]), textarea'
        );
        firstInput?.focus();
      }, 100);
    }
  };

  const handleBack = () => {
    const steps: WizardStep[] = ['basic', 'ingredients', 'instructions', 'images', 'review'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      const prevStep = steps[currentIndex - 1];

      // Save immediately on step change
      saveDraft(formData, prevStep);

      setCurrentStep(prevStep);
    }
  };

  const handleGoToStep = (step: WizardStep) => {
    // Save immediately on step change
    saveDraft(formData, step);
    setCurrentStep(step);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setHasUnsavedChanges(false); // Prevent navigation warning during submission

    try {
      // Filter out empty ingredients and instructions
      const filteredIngredients = formData.ingredients.filter((i) => i.trim().length > 0);
      const filteredInstructions = formData.instructions.filter((i) => i.trim().length > 0);

      if (filteredIngredients.length === 0) {
        toast.error('Please add at least one ingredient');
        setCurrentStep('ingredients');
        setIsSubmitting(false);
        return;
      }

      if (filteredInstructions.length === 0) {
        toast.error('Please add at least one instruction');
        setCurrentStep('instructions');
        setIsSubmitting(false);
        return;
      }

      // Prepare data for submission
      const recipeData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        cuisine: formData.cuisine.trim() || null,
        difficulty: formData.difficulty,
        prep_time: formData.prep_time || null,
        cook_time: formData.cook_time || null,
        servings: formData.servings || null,
        ingredients: JSON.stringify(filteredIngredients),
        instructions: JSON.stringify(filteredInstructions),
        images: formData.images.length > 0 ? JSON.stringify(formData.images) : null,
        tags: formData.tags.length > 0 ? JSON.stringify(formData.tags) : null,
        is_public: formData.isPublic,
        image_url: formData.images[0] || null, // First image as main image
      };

      // Call existing server action
      const result = await createRecipe(recipeData);

      if (result.success && result.data) {
        // Clear draft on successful submission
        clearDraft();
        setHasUnsavedChanges(false);

        toast.success(
          formData.isPublic
            ? 'Recipe submitted successfully!'
            : 'Recipe saved! It will be reviewed before appearing publicly.'
        );

        // Call completion callback if provided
        if (onComplete) {
          onComplete(result.data.id);
        } else {
          // Redirect to recipe page
          router.push(`/recipes/${result.data.slug || result.data.id}`);
        }
      } else {
        toast.error(result.error || 'Failed to submit recipe');
        setIsSubmitting(false);
        setHasUnsavedChanges(true);
      }
    } catch (error) {
      console.error('Recipe submission error:', error);
      toast.error('An unexpected error occurred. Please try again.');
      setIsSubmitting(false);
      setHasUnsavedChanges(true);
    }
  };

  const steps: WizardStep[] = ['basic', 'ingredients', 'instructions', 'images', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Draft Resume Dialog */}
      {showDraftDialog && hasDraft && (
        <DraftResumeDialog
          open={showDraftDialog}
          draftName={formData.name}
          draftStep={currentStep}
          savedAt={lastSaved || new Date().toISOString()}
          progress={stepProgress[currentStep]}
          onResume={handleResumeDraft}
          onStartFresh={handleStartFresh}
        />
      )}

      {/* Draft Restored Banner */}
      {draftRestored && (
        <Alert className="border-blue-600/50 bg-blue-50 dark:bg-blue-950/20">
          <Save className="h-4 w-4 text-blue-600" />
          <AlertDescription className="flex items-center justify-between gap-2">
            <span className="text-sm text-blue-900 dark:text-blue-200">
              Draft from {lastSaved ? formatSavedTime(lastSaved) : 'earlier'} restored
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearDraft}
              className="h-auto p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
              aria-label="Clear draft banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Storage Error Alert */}
      {saveError && (
        <Alert variant="destructive">
          <AlertDescription className="text-sm">{saveError}</AlertDescription>
        </Alert>
      )}

      {/* Progress Bar with Save Status */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            Step {currentStepIndex + 1} of {steps.length}: {stepTitles[currentStep]}
          </span>
          <div className="flex items-center gap-4">
            {/* Save Status Indicator */}
            {hasUnsavedChanges && (
              <span className="flex items-center gap-1.5 text-xs">
                {isSaving ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                    <span className="text-blue-600">Saving...</span>
                  </>
                ) : lastSaved ? (
                  <>
                    <Clock className="w-3 h-3 text-green-600" />
                    <span className="text-green-600">Saved {formatSavedTime(lastSaved)}</span>
                  </>
                ) : null}
              </span>
            )}
            <span>{stepProgress[currentStep]}% Complete</span>
          </div>
        </div>
        <Progress value={stepProgress[currentStep]} className="h-2" />
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            {stepTitles[currentStep]}
          </CardTitle>
          <CardDescription>
            {currentStep === 'basic' && 'Essential details about your recipe'}
            {currentStep === 'ingredients' && 'List all ingredients needed for the recipe'}
            {currentStep === 'instructions' && 'Step-by-step cooking instructions'}
            {currentStep === 'images' && 'Add photos of your delicious creation (optional)'}
            {currentStep === 'review' && 'Review your recipe before submitting'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 'basic' && (
            <RecipeStepBasicInfo formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 'ingredients' && (
            <RecipeStepIngredients formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 'instructions' && (
            <RecipeStepInstructions formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 'images' && (
            <RecipeStepImages formData={formData} updateFormData={updateFormData} />
          )}
          {currentStep === 'review' && (
            <RecipeStepReview
              formData={formData}
              updateFormData={updateFormData}
              onEditStep={handleGoToStep}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={currentStepIndex === 0 ? onCancel || (() => router.back()) : handleBack}
          disabled={isSubmitting}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {currentStepIndex === 0 ? 'Cancel' : 'Back'}
        </Button>

        {currentStep !== 'review' ? (
          <Button onClick={handleNext} disabled={!validateStep(currentStep)}>
            Next
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Submit Recipe
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
