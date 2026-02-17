'use client';

import { Loader2, Plus } from 'lucide-react';
import { useState } from 'react';
import { addInventoryItem } from '@/app/actions/inventory';
import { getIngredientSuggestions } from '@/app/actions/ingredient-search';
import { FieldError } from '@/components/errors/ErrorFallback';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { IngredientSuggestion } from '@/types/ingredient-search';

/**
 * Form validation errors
 */
interface FormErrors {
  ingredient?: string;
  quantity?: string;
  unit?: string;
  storage?: string;
}

/**
 * AddInventoryItemForm Component
 *
 * Form for adding new items to user's inventory
 * Features:
 * - Ingredient autocomplete with debouncing
 * - Storage location selection
 * - Quantity and unit input
 * - Optional expiry date
 * - Optional notes
 * - Toast notifications for success/error
 */
export function AddInventoryItemForm() {
  const { toast } = useToast();

  // Form state
  const [ingredientQuery, setIngredientQuery] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<IngredientSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [storageLocation, setStorageLocation] = useState<
    'fridge' | 'freezer' | 'pantry' | 'other'
  >('fridge');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');

  // Loading states
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Validation errors
  const [errors, setErrors] = useState<FormErrors>({});

  // Debounced autocomplete
  const handleIngredientSearch = async (query: string) => {
    setIngredientQuery(query);
    setSelectedIngredient(null);

    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const result = await getIngredientSuggestions(query, { limit: 10 });
      if (result.success) {
        setSuggestions(result.suggestions);
        setShowSuggestions(true);
      }
    } catch (error) {
      console.error('Ingredient search failed:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Select ingredient from suggestions
  const handleSelectIngredient = (suggestion: IngredientSuggestion) => {
    setSelectedIngredient(suggestion);
    setIngredientQuery(suggestion.displayName);
    setShowSuggestions(false);
  };

  // Validate form fields
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Validate ingredient selection
    if (!selectedIngredient) {
      newErrors.ingredient = 'Please select an ingredient from the suggestions';
    }

    // Validate quantity
    const quantityNum = parseFloat(quantity);
    if (!quantity || isNaN(quantityNum)) {
      newErrors.quantity = 'Please enter a valid quantity';
    } else if (quantityNum <= 0) {
      newErrors.quantity = 'Quantity must be greater than 0';
    } else if (quantityNum > 10000) {
      newErrors.quantity = 'Quantity seems too large. Please check your input';
    }

    // Validate unit
    if (!unit.trim()) {
      newErrors.unit = 'Please enter a unit (e.g., lbs, pieces, cups)';
    } else if (unit.trim().length > 50) {
      newErrors.unit = 'Unit name is too long';
    }

    // Validate storage location
    if (!storageLocation) {
      newErrors.storage = 'Please select a storage location';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Clear field error when user starts typing
  const clearFieldError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!validateForm()) {
      toast({
        title: 'Validation Error',
        description: 'Please fix the errors in the form before submitting.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const result = await addInventoryItem({
        ingredient_id: selectedIngredient!.id,
        storage_location: storageLocation,
        quantity: parseFloat(quantity),
        unit: unit.trim(),
        expiry_date: expiryDate ? new Date(expiryDate) : null,
        notes: notes.trim() || null,
      });

      if (result.success) {
        toast({
          title: 'Success',
          description: `Added ${selectedIngredient!.displayName} to your ${storageLocation}.`,
        });

        // Reset form
        setIngredientQuery('');
        setSelectedIngredient(null);
        setQuantity('1');
        setUnit('');
        setExpiryDate('');
        setNotes('');
        setSuggestions([]);
        setErrors({});
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to add item.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to add inventory item:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Ingredient Autocomplete */}
      <div className="space-y-2">
        <Label htmlFor="ingredient">
          Ingredient <span className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <Input
            id="ingredient"
            type="text"
            value={ingredientQuery}
            onChange={(e) => {
              handleIngredientSearch(e.target.value);
              clearFieldError('ingredient');
            }}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder="Start typing ingredient name..."
            className={`w-full ${errors.ingredient ? 'border-destructive' : ''}`}
            disabled={submitting}
            aria-invalid={!!errors.ingredient}
            aria-describedby={errors.ingredient ? 'ingredient-error' : undefined}
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-jk-sage/20 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {loadingSuggestions && (
                <div className="p-3 text-center text-sm text-jk-charcoal/60">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                </div>
              )}
              {!loadingSuggestions &&
                suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => handleSelectIngredient(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-jk-sage/10 border-b border-jk-sage/10 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-sm text-jk-olive">
                      {suggestion.displayName}
                    </div>
                    {suggestion.category && (
                      <div className="text-xs text-jk-charcoal/60 capitalize">
                        {suggestion.category}
                      </div>
                    )}
                  </button>
                ))}
            </div>
          )}
        </div>
        {errors.ingredient && <FieldError fieldId="ingredient" message={errors.ingredient} />}
      </div>

      {/* Storage Location */}
      <div className="space-y-2">
        <Label htmlFor="storage">
          Storage Location <span className="text-destructive">*</span>
        </Label>
        <Select
          value={storageLocation}
          onValueChange={(v: any) => {
            setStorageLocation(v);
            clearFieldError('storage');
          }}
        >
          <SelectTrigger
            id="storage"
            className={errors.storage ? 'border-destructive' : ''}
            aria-invalid={!!errors.storage}
            aria-describedby={errors.storage ? 'storage-error' : undefined}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="fridge">Fridge</SelectItem>
            <SelectItem value="freezer">Freezer</SelectItem>
            <SelectItem value="pantry">Pantry</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {errors.storage && <FieldError fieldId="storage" message={errors.storage} />}
      </div>

      {/* Quantity and Unit */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="quantity">
            Quantity <span className="text-destructive">*</span>
          </Label>
          <Input
            id="quantity"
            type="number"
            step="0.1"
            min="0.1"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              clearFieldError('quantity');
            }}
            className={errors.quantity ? 'border-destructive' : ''}
            disabled={submitting}
            aria-invalid={!!errors.quantity}
            aria-describedby={errors.quantity ? 'quantity-error' : undefined}
          />
          {errors.quantity && <FieldError fieldId="quantity" message={errors.quantity} />}
        </div>
        <div className="space-y-2">
          <Label htmlFor="unit">
            Unit <span className="text-destructive">*</span>
          </Label>
          <Input
            id="unit"
            type="text"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value);
              clearFieldError('unit');
            }}
            placeholder="lbs, pieces, cups"
            className={errors.unit ? 'border-destructive' : ''}
            disabled={submitting}
            aria-invalid={!!errors.unit}
            aria-describedby={errors.unit ? 'unit-error' : undefined}
          />
          {errors.unit && <FieldError fieldId="unit" message={errors.unit} />}
        </div>
      </div>

      {/* Expiry Date (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="expiry">Expiry Date (Optional)</Label>
        <Input
          id="expiry"
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          disabled={submitting}
        />
      </div>

      {/* Notes (Optional) */}
      <div className="space-y-2">
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Input
          id="notes"
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g., from farmers market"
          disabled={submitting}
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        disabled={
          !selectedIngredient || !unit.trim() || parseFloat(quantity) <= 0 || submitting
        }
        className="w-full gap-2"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Adding...
          </>
        ) : (
          <>
            <Plus className="w-4 h-4" />
            Add to Inventory
          </>
        )}
      </Button>
    </form>
  );
}
