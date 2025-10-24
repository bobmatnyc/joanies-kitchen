'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Filter } from 'lucide-react';

interface Ingredient {
  id: string;
  name: string;
  display_name: string;
  slug: string;
  type: string | null;
  subtype: string | null;
  category: string | null;
  image_url: string | null;
  usage_count: number;
  is_common: boolean;
  is_allergen: boolean;
}

interface OntologyType {
  type: string;
  total_count: number;
  subtypes: Array<{
    subtype: string;
    count: number;
  }>;
}

const TYPE_LABELS: Record<string, string> = {
  FRESH_PRODUCE: 'Fresh Produce',
  PROTEINS: 'Proteins',
  DAIRY_EGGS: 'Dairy & Eggs',
  PANTRY_STAPLES: 'Pantry Staples',
  BAKING_SPECIALTY: 'Baking & Specialty',
};

const SUBTYPE_LABELS: Record<string, string> = {
  vegetables_leafy: 'Leafy Vegetables',
  vegetables_root: 'Root Vegetables',
  vegetables_nightshade: 'Nightshades',
  vegetables_cruciferous: 'Cruciferous',
  vegetables_allium: 'Alliums',
  meat_beef: 'Beef',
  meat_pork: 'Pork',
  meat_lamb: 'Lamb',
  poultry_chicken: 'Chicken',
  seafood_fish: 'Fish',
  // Add more as needed
};

export function IngredientBrowser() {
  const [ontology, setOntology] = useState<Record<string, OntologyType>>({});
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Load ontology structure
  useEffect(() => {
    async function loadOntology() {
      try {
        const response = await fetch('/api/ingredients/ontology');
        const data = await response.json();
        setOntology(data.ontology || {});
      } catch (error) {
        console.error('Failed to load ontology:', error);
      }
    }
    loadOntology();
  }, []);

  // Load ingredients based on filters
  useEffect(() => {
    async function loadIngredients() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (searchQuery) params.set('q', searchQuery);
        if (selectedType) params.set('type', selectedType);
        if (selectedSubtype) params.set('subtype', selectedSubtype);
        params.set('limit', '50');

        const response = await fetch(`/api/ingredients/filter?${params}`);
        const data = await response.json();
        setIngredients(data.ingredients || []);
      } catch (error) {
        console.error('Failed to load ingredients:', error);
      } finally {
        setLoading(false);
      }
    }

    loadIngredients();
  }, [searchQuery, selectedType, selectedSubtype]);

  const formatSubtypeName = (subtype: string): string => {
    return SUBTYPE_LABELS[subtype] || subtype.replace(/_/g, ' ');
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="search"
            placeholder="Search ingredients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {(selectedType || selectedSubtype) && (
          <Button
            variant="outline"
            onClick={() => {
              setSelectedType(null);
              setSelectedSubtype(null);
            }}
          >
            Clear Filters
          </Button>
        )}
      </div>

      {/* Active Filters */}
      {(selectedType || selectedSubtype) && (
        <div className="flex gap-2 flex-wrap">
          {selectedType && (
            <Badge variant="secondary" className="px-3 py-1">
              {TYPE_LABELS[selectedType] || selectedType}
            </Badge>
          )}
          {selectedSubtype && (
            <Badge variant="secondary" className="px-3 py-1">
              {formatSubtypeName(selectedSubtype)}
            </Badge>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Ontology Browser */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Categories
              </CardTitle>
              <CardDescription>Browse by type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(ontology).map(([typeKey, typeData]) => (
                <div key={typeKey} className="space-y-1">
                  <Button
                    variant={selectedType === typeKey ? 'default' : 'ghost'}
                    className="w-full justify-between"
                    onClick={() => {
                      setSelectedType(typeKey);
                      setSelectedSubtype(null);
                    }}
                  >
                    <span>{TYPE_LABELS[typeKey] || typeKey}</span>
                    <Badge variant="outline" className="ml-2">
                      {typeData.total_count}
                    </Badge>
                  </Button>

                  {/* Subtypes */}
                  {selectedType === typeKey && typeData.subtypes && (
                    <div className="ml-4 space-y-1">
                      {typeData.subtypes.slice(0, 10).map((st: any) => (
                        <Button
                          key={st.subtype}
                          variant={selectedSubtype === st.subtype ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-between text-xs"
                          onClick={() => setSelectedSubtype(st.subtype)}
                        >
                          <span className="truncate">{formatSubtypeName(st.subtype)}</span>
                          <span className="text-gray-500">{st.count}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Ingredient Grid */}
        <div className="lg:col-span-3">
          {loading ? (
            <div className="text-center py-12">Loading ingredients...</div>
          ) : ingredients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">No ingredients found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {ingredients.map((ingredient) => (
                <Card key={ingredient.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {ingredient.image_url && (
                        <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-gray-100">
                          <img
                            src={ingredient.image_url}
                            alt={ingredient.display_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{ingredient.display_name}</h3>
                        <p className="text-sm text-gray-500 capitalize">
                          {ingredient.subtype?.replace(/_/g, ' ')}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {ingredient.usage_count}x used
                          </Badge>
                          {ingredient.is_common && (
                            <Badge variant="secondary" className="text-xs">
                              Common
                            </Badge>
                          )}
                          {ingredient.is_allergen && (
                            <Badge variant="destructive" className="text-xs">
                              Allergen
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
