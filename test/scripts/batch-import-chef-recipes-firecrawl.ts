/**
 * Batch Import Chef Recipes using Firecrawl
 *
 * Enhanced version that uses Firecrawl for reliable web scraping
 * Imports 121 recipes for 10 sustainability-focused chefs
 *
 * Key improvements over basic fetch:
 * - JavaScript-rendered content support
 * - Better image extraction
 * - Cleaner markdown output
 * - More reliable across different recipe sites
 */

import { db } from '@/lib/db/index.js';
import { recipes } from '@/lib/db/schema.js';
import { sql } from 'drizzle-orm';
import { scrapeRecipePage } from './firecrawl-standalone.js';
import { getOpenRouterClient } from '@/lib/ai/openrouter-server.js';
import { generateRecipeEmbedding } from '@/lib/ai/embeddings.js';
import { saveRecipeEmbedding } from '@/lib/db/embeddings.js';
import { evaluateRecipeQuality } from '@/lib/ai/recipe-quality-evaluator.js';
import fs from 'fs/promises';

interface RecipeURL {
  chefSlug: string;
  chefName: string;
  recipeName: string;
  url: string;
  notes?: string;
}

// All 121 recipe URLs (same as original script)
const recipeURLs: RecipeURL[] = [
  // Alton Brown - Scientific Cooking (12 recipes)
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Good Eats Roast Thanksgiving Turkey', url: 'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Meatloaf Reloaded', url: 'https://altonbrown.com/recipes/meatloaf-reloaded/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Perfect Cocoa Brownies', url: 'https://altonbrown.com/recipes/perfect-cocoa-brownies/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Semi-Instant Pancake Mix', url: 'https://altonbrown.com/recipes/semi-instant-pancake-mix/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Scallion Pancakes', url: 'https://altonbrown.com/recipes/scallion-pancakes/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'The Chewy', url: 'https://www.foodnetwork.com/recipes/alton-brown/the-chewy-recipe-1909046' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Baked Macaroni and Cheese', url: 'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-1939524' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: "Shepherd's Pie", url: 'https://www.foodnetwork.com/recipes/alton-brown/shepherds-pie-recipe2-1942900' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Who Loves Ya Baby Back', url: 'https://www.foodnetwork.com/recipes/alton-brown/who-loves-ya-baby-back-recipe-1937448' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Pan-Seared Rib Eye', url: 'https://www.foodnetwork.com/recipes/alton-brown/pan-seared-rib-eye-recipe-2131274' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Fried Chicken', url: 'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-recipe-1939165' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Fried Chicken Reloaded', url: 'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-reloaded-5518729' },

  // Bren Smith - Ocean Farming/Kelp (11 recipes)
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'BBQ Kelp Carrots', url: 'https://www.greenwave.org/recipes-1/bbq-kelp-carrots', notes: 'Sustainable ocean farming' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Tamarind Kelp Noodles', url: 'https://www.greenwave.org/recipes-1/tamarind-kelp-noodles', notes: 'Ocean vegetable innovation' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Zucchini Kelp Cake', url: 'https://www.greenwave.org/recipes-1/zucchini-kelp-cake', notes: 'Baked goods with kelp' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Tahini Salad with Fried Kelp', url: 'https://www.greenwave.org/recipes-1/tahini-salad-fried-kelp', notes: 'Crispy kelp texture' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Kelp Butter', url: 'https://www.greenwave.org/recipes-1/kelp-butter-wb8n6', notes: 'Umami-rich spread' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Kelp Orzo Soup', url: 'https://www.greenwave.org/recipes-1/kelp-orzo-soup-gxs59', notes: 'Mineral-rich broth' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Kelp Scampi', url: 'https://www.greenwave.org/recipes-1/kelp-scampi', notes: 'Garlic and kelp' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Shrimp Kelp Fra Diavolo', url: 'https://www.greenwave.org/recipes-1/shrimp-kelp-fra-diavolo', notes: 'Spicy seafood pasta' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Creamy White Bean and Seaweed Stew', url: 'https://atlanticseafarms.com/recipes/melissa-clarks-creamy-white-bean-and-seaweed-stew-with-parmesan/', notes: 'Melissa Clark collaboration' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Lemony Pasta with Kelp, Chile and Anchovies', url: 'https://atlanticseafarms.com/recipes/melissa-clarks-lemony-pasta-with-kelp-chile-and-anchovies/', notes: 'Mediterranean kelp' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'How Do You Eat Kelp?', url: 'https://riverheadnewsreview.timesreview.com/2014/07/56138/how-do-you-eat-kelp-here-are-two-recipes/', notes: 'Kelp preparation guide' },

  // Cristina Scarpaleggia - Italian/Tuscan (12 recipes)
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Best Pappa al Pomodoro', url: 'https://en.julskitchen.com/first-course/soup/best-pappa-al-pomodoro', notes: 'Tuscan bread soup' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Tuscan Kale Gnudi', url: 'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-gnudi', notes: 'Naked ravioli' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Fried Sage Leaves', url: 'https://en.julskitchen.com/tuscany/fried-sage-leaves', notes: 'Crispy herb snack' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Chicken Liver Crostini', url: 'https://en.julskitchen.com/appetizer/chicken-liver-crostini', notes: 'Tuscan antipasto' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Ricotta Ravioli', url: 'https://en.julskitchen.com/first-course/fresh-pasta/how-to-make-ricotta-ravioli', notes: 'Handmade pasta' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Italian Croissants', url: 'https://en.julskitchen.com/breakfast/italian-croissants', notes: 'Cornetti breakfast' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Tuscan Schiacciata with Walnuts', url: 'https://en.julskitchen.com/tuscany/tuscan-schiacciata-with-walnuts', notes: 'Flatbread with nuts' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Roasted Peppers Appetizer', url: 'https://en.julskitchen.com/vegetarian/roasted-peppers-appetizer', notes: 'Simple vegetable dish' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Cavolo Nero Salad', url: 'https://en.julskitchen.com/side/cavolo-nero-salad', notes: 'Tuscan kale salad' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Almond and Rice Flour Lemon Cookies', url: 'https://en.julskitchen.com/dessert/cookies/almond-and-rice-flour-lemon-cookies', notes: 'Gluten-free cookies' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Grape Focaccia', url: 'https://en.julskitchen.com/dessert/grape-focaccia', notes: 'Sweet harvest bread' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Tuscan Kale Pesto', url: 'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-pesto', notes: 'Dark leafy green pesto' },

  // Dan Barber - Zero Waste (14 recipes)
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Braised Short Ribs', url: 'https://food52.com/recipes/9111-dan-barber-s-braised-short-ribs', notes: 'Whole animal cooking' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Cauliflower Steaks with Cauliflower Puree', url: 'https://food52.com/recipes/20792-dan-barber-s-cauliflower-steaks-with-cauliflower-puree', notes: 'Whole vegetable usage' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Root Vegetable Peel Chips', url: 'https://www.jamesbeard.org/stories/waste-less-recipe-dan-barbers-root-vegetable-peel-chips', notes: 'Use the scraps' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Scrambled Eggs', url: 'https://www.washingtonpost.com/recipes/dan-barbers-scrambled-eggs/', notes: 'Perfect egg technique' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Stop Wasting Food', url: 'https://www.today.com/food/stop-wasting-food-money-these-easy-recipes-tips-t116216', notes: 'Waste reduction tips' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Parsnip Steak', url: 'https://www.esquire.com/food-drink/food/recipes/a9989/parsnip-steak-recipe-dan-barber-5806809/', notes: 'Vegetable-as-protein' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Thanksgiving Favorites', url: 'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587', notes: 'Seasonal cooking' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Kale Salad with Pine Nuts, Currants and Parmesan', url: 'https://www.williams-sonoma.com/recipe/kale-salad-with-pine-nuts-currants-and-parmesan.html', notes: 'Hardy greens' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Carrot Steak', url: 'https://www.mindful.org/how-to-make-a-carrot-steak-recipe/', notes: 'Vegetable centerpiece' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Summer Recipes', url: 'https://time.com/2924024/summer-recipes-by-writers/', notes: 'Seasonal produce' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Vegetable Chips', url: 'https://www.tastingtable.com/687150/recipe-vegetable-chips-blue-hill-restaurant-dan-barber/', notes: 'Scrap transformation' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Braised Vegetable Butts', url: 'https://www.today.com/food/stop-wasting-food-money-these-easy-recipes-tips-t116216', notes: 'Use the ends' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Thanksgiving Root Vegetables', url: 'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587', notes: 'Seasonal roots' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Thanksgiving Gravy from Scraps', url: 'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587', notes: 'Zero-waste cooking' },

  // David Zilber - Fermentation (10 recipes)
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Fermentation Fundamentals', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Interview with techniques' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Noma Guide to Lacto-Fermented Pickles', url: 'https://www.ethanchlebowski.com/cooking-techniques-recipes/noma-guide-to-lacto-fermented-pickles', notes: 'Probiotic preservation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Lacto Blueberries', url: 'https://www.splendidtable.org/story/2018/10/31/lacto-blueberries', notes: 'Fruit fermentation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Coffee Kombucha', url: 'https://www.vice.com/en/article/coffee-kombucha-recipe/', notes: 'Beverage fermentation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Umami Bomb Mushrooms', url: 'https://www.pdxmonthly.com/eat-and-drink/2019/09/make-nomas-umami-bomb-mushrooms-in-your-home-kitchen', notes: 'Fungal fermentation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Noma Fermentation Techniques', url: 'https://xtinenyc.com/food/the-moment/with-rene-redzepi/', notes: 'Advanced fermentation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Lacto-Fermented Vegetables', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Vegetable preservation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Koji Applications', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Mold fermentation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Fermented Hot Sauce', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Spicy fermentation' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Miso Making', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Traditional Japanese fermentation' },

  // Ina Garten - Comfort Food (12 recipes)
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Baked Fontina', url: 'https://barefootcontessa.com/recipes/baked-fontina' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Chicken Pot Pie', url: 'https://barefootcontessa.com/recipes/chicken-pot-pie' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Garlic and Herb Roasted Shrimp', url: 'https://www.foodnetwork.com/recipes/ina-garten/garlic-and-herb-roasted-shrimp-3742576' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Perfect Roast Chicken', url: 'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Roast Chicken with Radishes', url: 'https://www.foodnetwork.com/recipes/ina-garten/roast-chicken-with-radishes-3742076' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Lemon Parmesan Chicken with Arugula Salad Topping', url: 'https://www.foodnetwork.com/recipes/ina-garten/lemon-parmesan-chicken-with-arugula-salad-topping-5176940' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Rigatoni with Sausage and Fennel', url: 'https://www.foodnetwork.com/recipes/ina-garten/rigatoni-with-sausage-and-fennel-3753750' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Orecchiette with Broccoli Rabe and Sausage', url: 'https://www.foodnetwork.com/recipes/ina-garten/orecchiette-with-broccoli-rabe-and-sausage-5176922' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Herbed Orzo with Feta', url: 'https://www.foodnetwork.com/recipes/ina-garten/herbed-orzo-with-feta-3753751' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: "Anna's Tomato Tart", url: 'https://www.foodnetwork.com/recipes/ina-garten/annas-tomato-tart-3756210' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Salty Oatmeal Chocolate Chunk Cookies', url: 'https://www.foodnetwork.com/recipes/ina-garten/salty-oatmeal-chocolate-chunk-cookies-5468289' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Vanilla Rum Panna Cotta with Salted Caramel', url: 'https://www.foodnetwork.com/recipes/ina-garten/vanilla-rum-panna-cotta-with-salted-caramel-5190866' },

  // Jeremy Fox - Vegetable-Forward (11 recipes)
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Grilled Carrots', url: 'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/', notes: 'Vegetable centerpiece' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Roasted Beets', url: 'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/', notes: 'Earth-to-table' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Charred Cauliflower', url: 'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/', notes: 'High-heat vegetables' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Grilled Artichokes', url: 'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes', notes: 'California vegetable' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Roasted Mushrooms', url: 'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes', notes: 'Umami-rich fungi' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Vegetable Ragout', url: 'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes', notes: 'Hearty vegetable stew' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Lima Bean and Sorrel Cacio e Pepe', url: 'https://cookbookreview.blog/2018/08/23/lima-bean-and-sorrel-cacio-e-pepe-by-jeremy-fox/comment-page-1/', notes: 'Vegetable pasta' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Carrot Juice Cavatelli', url: 'https://cookbookreview.blog/2018/08/23/carrot-juice-cavatelli-tops-salsa-and-spiced-pulp-crumble-by-jeremy-fox/', notes: 'Vegetable-infused pasta' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Carta da Musica with Leaves and Truffled Pecorino', url: 'https://cookbookreview.blog/2018/08/23/carta-da-musica-leaves-things-and-truffled-pecorino-by-jeremy-fox/', notes: 'Italian-inspired vegetables' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Grilled Asparagus with Horsey Feta', url: 'https://www.7x7.com/chef-jeremy-fox-back-on-top-birdie-g-2653511058/recipe-make-jeremy-fox-s-grilled-asparagus-with-horsey-feta-everything-spice', notes: 'Spring vegetables' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'On Vegetables Philosophy', url: 'https://hotpotato.kitchen/on-vegetables', notes: 'Vegetable-first approach' },

  // Kirsten & Christopher Shockey - Fermentation (13 recipes)
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fennel Chutney', url: 'https://www.thedoctorskitchen.com/recipes/kirsten-shockey-s-be-good-to-your-gut-fennel-chutney', notes: 'Gut-healthy ferment' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Vegetables', url: 'https://www.makesauerkraut.com/fermented-vegetables-book-review/', notes: 'Comprehensive guide' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Habanero Salsa', url: 'https://www.motherearthnews.com/real-food/habanero-salsa-zm0z17aszqui/', notes: 'Spicy ferment' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Green Chile', url: 'https://www.motherearthnews.com/real-food/green-chile-recipe-zm0z17aszqui/', notes: 'Southwest fermentation' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Kale Kimchi', url: 'https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-kale-tips-and-a-recipe-for-kale-kimchi-zbcz1511/', notes: 'Green leafy kimchi' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Garlic Paste', url: 'https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-garlic-paste-zerz1502znut/', notes: 'Umami flavor base' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Squash Chutney', url: 'https://www.motherearthnews.com/real-food/seasonal-recipes/squash-chutney-recipe-zerz1502znut/', notes: 'Fall preservation' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Cubed Spring Radish Kimchi', url: 'https://www.motherearthnews.com/real-food/cubed-spring-radish-kimchi-zbcz1505/', notes: 'Spring radish ferment' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Sauerkraut', url: 'https://www.motherearthnews.com/real-food/how-to-ferment-sauerkraut-zerz1502znut/', notes: 'Classic fermentation' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Nettle Pesto', url: 'https://www.motherearthnews.com/real-food/fermented-nettle-pesto-zbcz1505/', notes: 'Wild greens ferment' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermenting Garlic Scapes', url: 'https://www.motherearthnews.com/real-food/fermenting-garlic-scapes-zbcz1506/', notes: 'Seasonal scapes' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Garlic Mustard', url: 'https://www.motherearthnews.com/real-food/fermenting/when-life-hands-you-garlic-mustard-ferment-it-zbcz1604', notes: 'Foraged greens' },
  { chefSlug: 'kirsten-and-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Spicy Carrot Lime Salad', url: 'https://www.amexessentials.com/kirsten-shockey-spicy-carrot-lime-salad-recipe/', notes: 'Fresh and fermented' },

  // Nancy Silverton - Bread/Italian (12 recipes)
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Pizza Dough', url: 'https://ooni.com/blogs/recipes/nancy-silvertons-pizza-dough', notes: 'Artisan bread technique' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Fresh Basil Pesto', url: 'https://ooni.com/blogs/recipes/nancy-silvertons-fresh-basil-pesto', notes: 'Classic Italian sauce' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Passata di Pomodoro', url: 'https://ooni.com/blogs/recipes/nancy-silvertons-passata-di-pomodoro', notes: 'Tomato preservation' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Marinated Olives and Fresh Pecorino', url: 'https://food52.com/recipes/65914-nancy-silverton-s-marinated-olives-and-fresh-pecorino', notes: 'Italian appetizer' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Genius Chopped Salad', url: 'https://food52.com/recipes/82016-genius-chopped-salad-recipe', notes: 'California Italian' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Classic Grilled Cheese', url: 'https://www.labreabakery.com/recipes/classic-grilled-cheese-marinated-onions-and-whole-grain-mustard', notes: 'Elevated comfort food' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Egg Salad with Bagna Cauda Toast', url: 'https://food52.com/recipes/75772-nancy-silverton-s-egg-salad-with-bagna-cauda-toast', notes: 'Italian-American fusion' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Butterscotch Budino', url: 'https://www.saveur.com/butterscotch-budino-pudding-recipe/', notes: 'Classic Italian dessert' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Chocolate Chip Cookies', url: 'https://www.today.com/food/nancy-silverton-cookie-recipe-changed-life-t295295', notes: 'Perfect cookie technique' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Whipped Cream', url: 'https://food52.com/recipes/14500-nancy-silverton-s-whipped-cream', notes: 'Simple perfection' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Polenta Cake with Brutti Ma Buoni Topping', url: 'https://www.foodgal.com/2017/04/nancy-silvertons-polenta-cake-with-brutti-ma-buoni-topping/', notes: 'Italian baking' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Focaccia', url: 'https://ooni.com/blogs/recipes/nancy-silvertons-pizza-dough', notes: 'Bread mastery' },

  // Tamar Adler - Food Waste Reduction (14 recipes)
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Everlasting Piece of Pork Belly', url: 'https://food52.com/blog/4193-an-everlasting-piece-of-pork-belly-tamar-adler', notes: 'Use everything' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Stewed Cauliflower, Tomatoes and Chickpeas', url: 'https://food52.com/recipes/75385-stewed-cauliflower-tomatoes-and-chick-peas-with-lemony-uplift-ala-tamar-adler', notes: 'Pantry cooking' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Nut Butter Noodles', url: 'https://www.npr.org/2023/03/20/1164403171/everlasting-meal-tamar-adler-leftovers-cookbook-nut-butter-noodles', notes: 'Leftovers transformed' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Minestrone', url: 'https://www.saveur.com/article/Recipes/Minestrone-1000090697/', notes: 'Scrap soup' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Summer Picnic', url: 'https://www.ediblemanhattan.com/recipes/heres-what-writer-tamar-adler-would-serve-at-an-old-school-summer-picnic/', notes: 'Seasonal cooking' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Bread Soup', url: 'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/', notes: 'Stale bread revival' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Grain Bowl', url: 'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/', notes: 'Leftover grains' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Vegetable Stock', url: 'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/', notes: 'Scrap-based stock' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Cream Cheese Schmear', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Dairy mastery' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Bagel Toppings', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Creative spreads' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Breakfast Recipes', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Morning staples' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Sandwich Fillings', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Leftover transformations' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Salad Dressings', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Simple vinaigrettes' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Quick Pasta Using Leftovers', url: 'https://www.npr.org/2023/03/20/1164403171/everlasting-meal-tamar-adler-leftovers-cookbook-nut-butter-noodles', notes: 'Everlasting meal philosophy' },
];

// Helper functions
function parseTimeToMinutes(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d+)/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  if (timeStr.toLowerCase().includes('hour')) {
    return value * 60;
  }
  return value;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Extract recipe from Firecrawl markdown using AI
async function extractRecipeFromMarkdown(
  markdown: string,
  url: string
): Promise<{ success: boolean; recipe?: any; error?: string }> {
  try {
    const openrouter = getOpenRouterClient();

    const completion = await openrouter.chat.completions.create({
      model: 'anthropic/claude-3-haiku',
      messages: [
        {
          role: 'user',
          content: `Extract the recipe from this Firecrawl markdown. Return ONLY valid JSON with no markdown formatting, code blocks, or extra text.

Markdown Content:
${markdown.substring(0, 30000)}

Required JSON format:
{
  "name": "Recipe name",
  "description": "Brief description",
  "ingredients": ["ingredient 1", "ingredient 2"],
  "instructions": ["step 1", "step 2"],
  "prepTime": "15 minutes",
  "cookTime": "30 minutes",
  "servings": 4,
  "images": ["image_url_1", "image_url_2"],
  "cuisine": "Italian",
  "tags": ["quick", "healthy"],
  "difficulty": "easy",
  "confidenceScore": 0.95,
  "isValid": true
}

Important:
- Return ONLY the JSON object, no markdown code blocks
- Set isValid to true if you found a complete recipe
- Set isValid to false if the page doesn't contain a recipe
- Include as many images as you can find (max 6)
- confidenceScore should be 0-1 (how confident you are this is a valid recipe)`,
        },
      ],
      temperature: 0.1,
    });

    const content = completion.choices[0].message.content || '{}';
    const cleanContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const extracted = JSON.parse(cleanContent);

    if (!extracted.isValid) {
      return {
        success: false,
        error: 'Could not extract valid recipe from markdown',
      };
    }

    return {
      success: true,
      recipe: extracted,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// Main batch import
async function batchImportChefRecipes() {
  console.log('🚀 Firecrawl-Powered Chef Recipe Import');
  console.log('═'.repeat(80));
  console.log(`Total recipes: ${recipeURLs.length}\n`);

  // Fetch chef IDs
  console.log('📋 Fetching chef IDs from database...');
  const chefResults = await db.execute(sql`
    SELECT id, slug FROM chefs WHERE slug IN (
      'alton-brown', 'bren-smith', 'cristina-scarpaleggia', 'dan-barber',
      'david-zilber', 'ina-garten', 'jeremy-fox',
      'kirsten-and-christopher-shockey', 'nancy-silverton', 'tamar-adler'
    )
  `);

  const chefIdMap: Record<string, string> = {};
  for (const row of chefResults.rows as any[]) {
    chefIdMap[row.slug] = row.id;
  }
  console.log(`✅ Mapped ${Object.keys(chefIdMap).length} chef slugs\n`);

  // Check existing recipes
  const existingRecipes = await db.execute(
    sql`SELECT source FROM recipes WHERE source IS NOT NULL`
  );
  const existingUrls = new Set((existingRecipes.rows as any[]).map((r) => r.source));
  console.log(`📊 Already imported: ${existingUrls.size} recipes\n`);
  console.log('═'.repeat(80) + '\n');

  // Statistics
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;
  const errors: string[] = [];

  // Process each recipe
  for (let i = 0; i < recipeURLs.length; i++) {
    const recipeData = recipeURLs[i];
    const chefId = chefIdMap[recipeData.chefSlug];

    if (!chefId) {
      console.error(`❌ Chef not found: ${recipeData.chefSlug}`);
      failCount++;
      errors.push(`Chef not found: ${recipeData.chefSlug}`);
      continue;
    }

    // Skip if already imported
    if (existingUrls.has(recipeData.url)) {
      console.log(
        `[${i + 1}/${recipeURLs.length}] ⏭️  SKIP: ${recipeData.recipeName} (already imported)`
      );
      skipCount++;
      continue;
    }

    console.log(`\n[${i + 1}/${recipeURLs.length}] Processing: ${recipeData.recipeName}`);
    console.log(`  Chef: ${recipeData.chefName}`);
    console.log(`  URL: ${recipeData.url}`);

    try {
      // Step 1: Scrape with Firecrawl
      console.log('  🔥 Scraping with Firecrawl...');
      const scraped = await scrapeRecipePage(recipeData.url);

      if (!scraped.markdown) {
        throw new Error('No markdown content from Firecrawl');
      }
      console.log(`  ✅ Scraped ${scraped.markdown.length} chars`);

      // Step 2: Extract with AI
      console.log('  🤖 Extracting recipe with AI...');
      const extraction = await extractRecipeFromMarkdown(scraped.markdown, recipeData.url);

      if (!extraction.success || !extraction.recipe) {
        throw new Error(extraction.error || 'Extraction failed');
      }
      const recipe = extraction.recipe;
      console.log(`  ✅ Extracted: ${recipe.name}`);

      // Step 3: Evaluate quality
      console.log('  ⭐ Evaluating quality...');
      const qualityEval = await evaluateRecipeQuality({
        name: recipe.name,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
      });
      console.log(`  ⭐ Quality: ${qualityEval.rating}/5 - ${qualityEval.reasoning}`);

      // Step 4: Generate embedding
      console.log('  🔍 Generating embedding...');
      let embeddingResult: { embedding: number[]; embeddingText: string } | null = null;
      try {
        embeddingResult = await generateRecipeEmbedding({
          id: '',
          user_id: 'system',
          chef_id: chefId,
          source_id: null,
          name: recipe.name,
          description: recipe.description || '',
          ingredients: JSON.stringify(recipe.ingredients),
          instructions: JSON.stringify(recipe.instructions),
          cuisine: recipe.cuisine || null,
          tags: JSON.stringify(recipe.tags || []),
          difficulty: recipe.difficulty || null,
          prep_time: null,
          cook_time: null,
          servings: null,
          image_url: null,
          images: null,
          is_ai_generated: false,
          is_public: true,
          is_system_recipe: true,
          nutrition_info: null,
          model_used: null,
          source: null,
          license: 'ALL_RIGHTS_RESERVED',
          created_at: new Date(),
          updated_at: new Date(),
          search_query: null,
          discovery_date: null,
          confidence_score: null,
          validation_model: null,
          embedding_model: null,
          discovery_week: null,
          discovery_year: null,
          published_date: null,
          system_rating: null,
          system_rating_reason: null,
          avg_user_rating: null,
          total_user_ratings: null,
          slug: null,
          is_meal_prep_friendly: false,
          image_flagged_for_regeneration: false,
          image_regeneration_requested_at: null,
          image_regeneration_requested_by: null,
          like_count: 0,
          fork_count: 0,
          collection_count: 0,
          instruction_metadata: null,
          instruction_metadata_version: null,
          instruction_metadata_generated_at: null,
          instruction_metadata_model: null,
          content_flagged_for_cleanup: false,
          ingredients_need_cleanup: false,
          instructions_need_cleanup: false,
          deleted_at: null,
          deleted_by: null,
          weight_score: null,
          richness_score: null,
          acidity_score: null,
          sweetness_level: null,
          dominant_textures: null,
          dominant_flavors: null,
          serving_temperature: null,
          pairing_rationale: null,
          video_url: null,
          resourcefulness_score: null,
          waste_reduction_tags: null,
          scrap_utilization_notes: null,
          environmental_notes: null,
          qa_status: null,
          qa_timestamp: null,
          qa_method: null,
          qa_confidence: null,
          qa_notes: null,
          qa_issues_found: null,
          qa_fixes_applied: null,
        });
        console.log(`  ✅ Embedding generated (${embeddingResult.embedding.length} dims)`);
      } catch (error: any) {
        console.warn(`  ⚠️  Embedding failed: ${error.message}`);
      }

      // Step 5: Save to database
      console.log('  💾 Saving to database...');
      const [savedRecipe] = await db
        .insert(recipes)
        .values({
          user_id: 'system',
          chef_id: chefId,
          name: recipe.name,
          description: recipe.description || '',
          ingredients: JSON.stringify(recipe.ingredients),
          instructions: JSON.stringify(recipe.instructions),
          prep_time: parseTimeToMinutes(recipe.prepTime),
          cook_time: parseTimeToMinutes(recipe.cookTime),
          servings: recipe.servings || null,
          cuisine: recipe.cuisine || null,
          tags: JSON.stringify(recipe.tags || []),
          difficulty: recipe.difficulty || null,
          images: JSON.stringify(recipe.images || []),
          source: recipeData.url,
          discovery_date: new Date(),
          confidence_score: recipe.confidenceScore.toString(),
          validation_model: 'anthropic/claude-3-haiku',
          embedding_model: embeddingResult ? 'sentence-transformers/all-MiniLM-L6-v2' : null,
          is_ai_generated: false,
          is_public: true,
          is_system_recipe: true,
          system_rating: qualityEval.rating.toFixed(1),
          system_rating_reason: qualityEval.reasoning,
          avg_user_rating: null,
          total_user_ratings: 0,
        })
        .returning();

      // Step 6: Save embedding
      if (embeddingResult) {
        try {
          await saveRecipeEmbedding(
            savedRecipe.id,
            embeddingResult.embedding,
            embeddingResult.embeddingText,
            'sentence-transformers/all-MiniLM-L6-v2'
          );
          console.log('  ✅ Embedding saved');
        } catch (error: any) {
          console.warn(`  ⚠️  Embedding save failed: ${error.message}`);
        }
      }

      console.log(`  ✅ SUCCESS: Recipe saved with ID ${savedRecipe.id}`);
      successCount++;

      // Rate limiting
      if (i < recipeURLs.length - 1) {
        await sleep(2000);
      }
    } catch (error: any) {
      console.error(`  ❌ FAILED: ${error.message}`);
      failCount++;
      errors.push(`${recipeData.recipeName}: ${error.message}`);
    }
  }

  // Final report
  console.log('\n' + '═'.repeat(80));
  console.log('📊 IMPORT COMPLETE');
  console.log('═'.repeat(80));
  console.log(`✅ Successful: ${successCount}`);
  console.log(`⏭️  Skipped: ${skipCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Success rate: ${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\n❌ Errors:');
    errors.forEach((error, i) => console.log(`  ${i + 1}. ${error}`));
  }

  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    totalRecipes: recipeURLs.length,
    successCount,
    skipCount,
    failCount,
    successRate: `${((successCount / (successCount + failCount)) * 100).toFixed(1)}%`,
    errors,
  };

  await fs.writeFile('tmp/chef-recipe-firecrawl-import-report.json', JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: tmp/chef-recipe-firecrawl-import-report.json`);

  process.exit(0);
}

// Run
batchImportChefRecipes().catch((error) => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
