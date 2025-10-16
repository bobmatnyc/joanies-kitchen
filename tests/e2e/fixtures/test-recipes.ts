/**
 * Test Recipe Fixtures
 *
 * Real recipe slugs to use in UAT tests
 */

export const TEST_RECIPES = {
  carrotCake: {
    slug: 'carrot-cake-with-cream-cheese-frosting',
    id: 'a7d8551b-4e0f-4e9e-8e9e-8e9e8e9e8e9e', // Example UUID
    name: 'Carrot Cake with Cream Cheese Frosting',
  },
  tarragonLobster: {
    slug: 'tarragon-lobster',
    id: '00da8088-7f9c-4c93-99f6-eb3cb91da09d',
    name: 'Tarragon Lobster',
  },
  crabbyBread: {
    slug: 'crabby-bread',
    id: 'b9e5c5e5-4e0f-4e9e-8e9e-8e9e8e9e8e9e',
    name: 'Crabby Bread',
  },
  chocolateChipCookies: {
    slug: 'chocolate-chip-cookies',
    id: 'c1d2e3f4-5e0f-4e9e-8e9e-8e9e8e9e8e9e',
    name: 'Chocolate Chip Cookies',
  },
  spaghettiCarbonara: {
    slug: 'spaghetti-carbonara',
    id: 'd4e5f6g7-6e0f-4e9e-8e9e-8e9e8e9e8e9e',
    name: 'Spaghetti Carbonara',
  },
};

export const RECIPE_PATHS = {
  list: '/',
  top50: '/recipes/top-50',
  shared: '/shared',
  discover: '/discover',
};
