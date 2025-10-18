/**
 * Search Components - Barrel Export
 *
 * Comprehensive search interface components for Recipe Manager
 * Includes semantic search, ingredient search, and filtering
 */

export { IngredientFilter } from './IngredientFilter';
export {
  CompactIngredientMatchBadge,
  DetailedIngredientMatchBadge,
  IngredientMatchBadge,
} from './IngredientMatchBadge';
// Ingredient Search Components (EXISTING)
export { IngredientSearchBar } from './IngredientSearchBar';
export { type SearchMode, SearchModeComparison, SearchModeTooltip } from './SearchModeTooltip';
export { CompactSearchResults, SearchResults } from './SearchResults';
// Semantic Search Components (NEW)
export { SemanticSearchBar } from './SemanticSearchBar';
export {
  CompactSimilarityBadge,
  DetailedSimilarityBadge,
  SimilarityBadge,
} from './SimilarityBadge';
// Vector Search Component (Homepage)
export { VectorSearchBar } from './VectorSearchBar';
