import { db } from '@/lib/db/index.js';
import { sql } from 'drizzle-orm';

/**
 * Import 121 recipes for 10 chefs from docs/scraping/recipes-10-24-2025.md
 *
 * Chefs & Recipe Counts:
 * - Alton Brown: 12 recipes
 * - Bren Smith: 11 recipes (ocean farming/kelp)
 * - Giulia Scarpaleggia: 12 recipes (Italian/Tuscan)
 * - Dan Barber: 14 recipes (zero-waste)
 * - David Zilber: 10 recipes (fermentation)
 * - Ina Garten: 12 recipes
 * - Jeremy Fox: 11 recipes (vegetable-forward)
 * - Kirsten & Christopher Shockey: 13 recipes (fermentation)
 * - Nancy Silverton: 12 recipes (bread/Italian)
 * - Tamar Adler: 14 recipes (food waste reduction)
 */

interface RecipeURL {
  chefSlug: string;
  chefName: string;
  recipeName: string;
  url: string;
  notes?: string;
}

const recipeURLs: RecipeURL[] = [
  // Alton Brown (12 recipes)
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Good Eats Roast Thanksgiving Turkey', url: 'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Meatloaf: Reloaded', url: 'https://altonbrown.com/recipes/meatloaf-reloaded/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Perfect Cocoa Brownies From Scratch', url: 'https://altonbrown.com/recipes/perfect-cocoa-brownies/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: '5-Ingredient Semi-Instant Pancake Mix', url: 'https://altonbrown.com/recipes/semi-instant-pancake-mix/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Scallion Pancakes', url: 'https://altonbrown.com/recipes/scallion-pancakes/' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'The Chewy (Chocolate Chip Cookies)', url: 'https://www.foodnetwork.com/recipes/alton-brown/the-chewy-recipe-1909046' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Baked Macaroni and Cheese', url: 'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-1939524' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Shepherd\'s Pie', url: 'https://www.foodnetwork.com/recipes/alton-brown/shepherds-pie-recipe2-1942900' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Who Loves Ya Baby-Back?', url: 'https://www.foodnetwork.com/recipes/alton-brown/who-loves-ya-baby-back-recipe-1937448' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Pan-Seared Rib-Eye', url: 'https://www.foodnetwork.com/recipes/alton-brown/pan-seared-rib-eye-recipe-2131274' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Fried Chicken', url: 'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-recipe-1939165' },
  { chefSlug: 'alton-brown', chefName: 'Alton Brown', recipeName: 'Fried Chicken: Reloaded', url: 'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-reloaded-5518729' },

  // Bren Smith (11 recipes) - Ocean farming/kelp specialist
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Barbecue Kelp and Carrots', url: 'https://www.greenwave.org/recipes-1/bbq-kelp-carrots', notes: 'Sustainable kelp' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Kelp Noodles with Tamarind, Peanuts, and Seared Tofu', url: 'https://www.greenwave.org/recipes-1/tamarind-kelp-noodles', notes: 'Ocean-farmed kelp' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Zucchini and Kelp Cake with Seaweed Aioli', url: 'https://www.greenwave.org/recipes-1/zucchini-kelp-cake', notes: 'Vegan crab cake alternative' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Brown Rice Salad with Tahini Dressing and Fried Kelp', url: 'https://www.greenwave.org/recipes-1/tahini-salad-fried-kelp', notes: 'Fried kelp' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Kelp Butter', url: 'https://www.greenwave.org/recipes-1/kelp-butter-wb8n6', notes: 'Sugar kelp compound butter' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Kelp and Orzo Soup', url: 'https://www.greenwave.org/recipes-1/kelp-orzo-soup-gxs59', notes: 'Ocean-farmed kelp' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Kelp and Cauliflower Scampi', url: 'https://www.greenwave.org/recipes-1/kelp-scampi', notes: 'Vegan kelp noodle scampi' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Shrimp and Kelp Fra Diavolo', url: 'https://www.greenwave.org/recipes-1/shrimp-kelp-fra-diavolo', notes: 'Sustainable kelp with seafood' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Creamy White Bean and Seaweed Stew with Parmesan', url: 'https://atlanticseafarms.com/recipes/melissa-clarks-creamy-white-bean-and-seaweed-stew-with-parmesan/', notes: 'By Melissa Clark' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Lemony Pasta with Kelp, Chile, and Anchovies', url: 'https://atlanticseafarms.com/recipes/melissa-clarks-lemony-pasta-with-kelp-chile-and-anchovies/', notes: 'By Melissa Clark' },
  { chefSlug: 'bren-smith', chefName: 'Bren Smith', recipeName: 'Simple Kelp Salad', url: 'https://riverheadnewsreview.timesreview.com/2014/07/56138/how-do-you-eat-kelp-here-are-two-recipes/', notes: 'Direct from Bren Smith' },

  // Giulia Scarpaleggia (12 recipes) - Note: Database has "Cristina Scarpaleggia"
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Pappa al Pomodoro (Tuscan Tomato Bread Soup)', url: 'https://en.julskitchen.com/first-course/soup/best-pappa-al-pomodoro' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Ricotta and Kale Gnudi', url: 'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-gnudi' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Fried Sage Leaves', url: 'https://en.julskitchen.com/tuscany/fried-sage-leaves' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Chicken Liver Crostini (Crostini Neri)', url: 'https://en.julskitchen.com/appetizer/chicken-liver-crostini' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Ricotta Ravioli', url: 'https://en.julskitchen.com/first-course/fresh-pasta/how-to-make-ricotta-ravioli' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Italian Croissants (Cornetti)', url: 'https://en.julskitchen.com/breakfast/italian-croissants' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Tuscan Schiacciata with Walnuts', url: 'https://en.julskitchen.com/tuscany/tuscan-schiacciata-with-walnuts' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Roasted Peppers Crostini', url: 'https://en.julskitchen.com/vegetarian/roasted-peppers-appetizer' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Cavolo Nero Salad with Walnuts, Orange and Honey', url: 'https://en.julskitchen.com/side/cavolo-nero-salad' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Almond and Rice Flour Lemon Cookies', url: 'https://en.julskitchen.com/dessert/cookies/almond-and-rice-flour-lemon-cookies' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Grape Focaccia (Schiacciata con l\'uva)', url: 'https://en.julskitchen.com/dessert/grape-focaccia' },
  { chefSlug: 'cristina-scarpaleggia', chefName: 'Cristina Scarpaleggia', recipeName: 'Tagliatelle with Tuscan Kale Pesto', url: 'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-pesto' },

  // Dan Barber (14 recipes) - Zero-waste specialist
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Braised Short Ribs', url: 'https://food52.com/recipes/9111-dan-barber-s-braised-short-ribs', notes: 'Whole-ingredient approach' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Cauliflower Steaks with Cauliflower Purée', url: 'https://food52.com/recipes/20792-dan-barber-s-cauliflower-steaks-with-cauliflower-puree', notes: 'Uses entire cauliflower, zero-waste' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Root Vegetable Peel Chips', url: 'https://www.jamesbeard.org/stories/waste-less-recipe-dan-barbers-root-vegetable-peel-chips', notes: 'Food waste reduction, uses peels' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Scrambled Eggs', url: 'https://www.washingtonpost.com/recipes/dan-barbers-scrambled-eggs/', notes: 'Farm-fresh eggs' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Vegetable Pulp Burger', url: 'https://www.today.com/food/stop-wasting-food-money-these-easy-recipes-tips-t116216', notes: 'Zero-waste, uses juice pulp' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Broccoli Stalk Salad', url: 'https://www.today.com/food/stop-wasting-food-money-these-easy-recipes-tips-t116216', notes: 'Uses broccoli stems, waste reduction' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Parsnip Steaks with Brown Butter and Balsamic Sauce', url: 'https://www.esquire.com/food-drink/food/recipes/a9989/parsnip-steak-recipe-dan-barber-5806809/', notes: 'Vegetables as main course' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Mushroom-Hazelnut Stuffing', url: 'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587', notes: 'Farm-fresh' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Spicy Cranberry Sauce', url: 'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587', notes: 'Seasonal ingredients' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Fennel Soup', url: 'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587', notes: 'Uses whole fennel including fronds' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Kale Salad with Pine Nuts, Currants and Parmesan', url: 'https://www.williams-sonoma.com/recipe/kale-salad-with-pine-nuts-currants-and-parmesan.html', notes: 'Farm-to-table vegetable focus' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Carrot Cutlets with Lamb Sauce', url: 'https://www.mindful.org/how-to-make-a-carrot-steak-recipe/', notes: 'Third Plate philosophy, vegetable centerpiece' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Blue Hill Vegetable Juice', url: 'https://time.com/2924024/summer-recipes-by-writers/', notes: 'Celebrates seasonal produce' },
  { chefSlug: 'dan-barber', chefName: 'Dan Barber', recipeName: 'Root Vegetable Peel Chips (wastED)', url: 'https://www.tastingtable.com/687150/recipe-vegetable-chips-blue-hill-restaurant-dan-barber/', notes: 'Zero-waste, from wastED project' },

  // David Zilber (10 recipes) - Fermentation specialist
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Turmeric Sauerkraut', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Lacto-fermentation, 7-day ferment' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Cucumber Pickles', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Lacto-fermentation with dill' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Pickled Peppers (Jalapeños)', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Lacto-fermentation, 5-7 days' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Quick Kimchi', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Lacto-fermentation with Korean chili' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Jasmine and Vanilla Kombucha', url: 'https://www.highsnobiety.com/p/david-zilber-interview/', notes: 'Kombucha fermentation, 6-10 days' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Lacto Fermented Pickles (General Method)', url: 'https://www.ethanchlebowski.com/cooking-techniques-recipes/noma-guide-to-lacto-fermented-pickles', notes: '2% salt brine method' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Lacto-Fermented Blueberries', url: 'https://www.splendidtable.org/story/2018/10/31/lacto-blueberries', notes: 'Lacto-fermentation, 4-5 days' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Coffee Kombucha', url: 'https://www.vice.com/en/article/coffee-kombucha-recipe/', notes: 'Kombucha with coffee, 7-10 days' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Lacto-Fermented Mushrooms', url: 'https://www.pdxmonthly.com/eat-and-drink/2019/09/make-nomas-umami-bomb-mushrooms-in-your-home-kitchen', notes: 'Creates umami mushrooms' },
  { chefSlug: 'david-zilber', chefName: 'David Zilber', recipeName: 'Coffee Kombucha (Detailed Tutorial)', url: 'https://xtinenyc.com/food/the-moment/with-rene-redzepi/', notes: 'Full tutorial with Redzepi' },

  // Ina Garten (12 recipes)
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Baked Fontina', url: 'https://barefootcontessa.com/recipes/baked-fontina' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Chicken Pot Pie', url: 'https://barefootcontessa.com/recipes/chicken-pot-pie' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Garlic and Herb Roasted Shrimp', url: 'https://www.foodnetwork.com/recipes/ina-garten/garlic-and-herb-roasted-shrimp-3742576' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Perfect Roast Chicken', url: 'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Roast Chicken with Radishes', url: 'https://www.foodnetwork.com/recipes/ina-garten/roast-chicken-with-radishes-3742076' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Lemon Parmesan Chicken with Arugula Salad Topping', url: 'https://www.foodnetwork.com/recipes/ina-garten/lemon-parmesan-chicken-with-arugula-salad-topping-5176940' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Rigatoni with Sausage and Fennel', url: 'https://www.foodnetwork.com/recipes/ina-garten/rigatoni-with-sausage-and-fennel-3753750' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Orecchiette with Broccoli Rabe & Sausage', url: 'https://www.foodnetwork.com/recipes/ina-garten/orecchiette-with-broccoli-rabe-and-sausage-5176922' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Herbed Orzo with Feta', url: 'https://www.foodnetwork.com/recipes/ina-garten/herbed-orzo-with-feta-3753751' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Anna\'s Tomato Tart', url: 'https://www.foodnetwork.com/recipes/ina-garten/annas-tomato-tart-3756210' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Salty Oatmeal Chocolate Chunk Cookies', url: 'https://www.foodnetwork.com/recipes/ina-garten/salty-oatmeal-chocolate-chunk-cookies-5468289' },
  { chefSlug: 'ina-garten', chefName: 'Ina Garten', recipeName: 'Vanilla Rum Panna Cotta with Salted Caramel', url: 'https://www.foodnetwork.com/recipes/ina-garten/vanilla-rum-panna-cotta-with-salted-caramel-5190866' },

  // Jeremy Fox (11 recipes) - Vegetable-forward specialist
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Miso Bagna Cauda', url: 'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/', notes: 'Vegetable condiment' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Classic Basil Pesto', url: 'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/', notes: 'Vegetarian' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Strawberry Sofrito', url: 'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/', notes: '6-hour fennel concoction' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Baby Artichoke Salad', url: 'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes', notes: 'Whole-vegetable cooking' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Soba Noodles with Miso Dressing', url: 'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes', notes: 'Sea vegetables' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Roasted Kohlrabi with Sorrel Vichyssoise', url: 'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes', notes: 'Root-to-stalk cooking' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Lima Bean and Sorrel Cacio e Pepe', url: 'https://cookbookreview.blog/2018/08/23/lima-bean-and-sorrel-cacio-e-pepe-by-jeremy-fox/comment-page-1/', notes: 'Beans as main ingredient' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Carrot Juice Cavatelli, Tops Salsa and Spiced Pulp Crumble', url: 'https://cookbookreview.blog/2018/08/23/carrot-juice-cavatelli-tops-salsa-and-spiced-pulp-crumble-by-jeremy-fox/', notes: 'Seed-to-stalk, uses entire carrot' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Carta da Musica, Leaves, Things and Truffled Pecorino', url: 'https://cookbookreview.blog/2018/08/23/carta-da-musica-leaves-things-and-truffled-pecorino-by-jeremy-fox/', notes: 'Seasonal produce focus' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Grilled Asparagus with Horsey Feta & Everything Spice', url: 'https://www.7x7.com/chef-jeremy-fox-back-on-top-birdie-g-2653511058/recipe-make-jeremy-fox-s-grilled-asparagus-with-horsey-feta-everything-spice', notes: 'Vegetable-forward' },
  { chefSlug: 'jeremy-fox', chefName: 'Jeremy Fox', recipeName: 'Fennel Confit, Kumquat, Feta, Chili and Oregano', url: 'https://hotpotato.kitchen/on-vegetables', notes: 'Creative vegetable technique' },

  // Kirsten & Christopher Shockey (13 recipes) - Fermentation specialists
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Be Good To Your Gut Fennel Chutney', url: 'https://www.thedoctorskitchen.com/recipes/kirsten-shockey-s-be-good-to-your-gut-fennel-chutney', notes: 'Fermented chutney' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Garlic Paste', url: 'https://www.makesauerkraut.com/fermented-vegetables-book-review/', notes: 'Lacto-fermented garlic' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Caribbean Habanero Salsa', url: 'https://www.motherearthnews.com/real-food/habanero-salsa-zm0z17aszqui/', notes: 'Fermented hot salsa' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Green Chile Recipe', url: 'https://www.motherearthnews.com/real-food/green-chile-recipe-zm0z17aszqui/', notes: 'Fermented chile base' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Kale Kimchi', url: 'https://www.motherearthnews.com/real-food/fermented-kale-tips-and-a-recipe-for-kale-kimchi-zbcz1511/', notes: 'Kimchi-style kale' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Garlic Scape Paste Recipe', url: 'https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-garlic-paste-zerz1502znut/', notes: 'Lacto-fermented scapes' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Squash Chutney Recipe', url: 'https://www.motherearthnews.com/real-food/seasonal-recipes/squash-chutney-recipe-zerz1502znut/', notes: 'Winter squash ferment' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Cubed Spring Radish Kimchi', url: 'https://www.motherearthnews.com/real-food/cubed-spring-radish-kimchi-zbcz1505/', notes: 'Fermented radish' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'How to Ferment Sauerkraut in a Large Batch', url: 'https://www.motherearthnews.com/real-food/how-to-ferment-sauerkraut-zerz1502znut/', notes: 'Traditional sauerkraut' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Nettle Pesto', url: 'https://www.motherearthnews.com/real-food/fermented-nettle-pesto-zbcz1505/', notes: 'Lacto-fermented pesto' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermenting Garlic Scapes', url: 'https://www.motherearthnews.com/real-food/fermenting-garlic-scapes-zbcz1506/', notes: 'Multiple fermentation methods' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Garlic Mustard Kimchi', url: 'https://www.motherearthnews.com/real-food/fermenting/when-life-hands-you-garlic-mustard-ferment-it-zbcz1604', notes: 'Foraged ferment' },
  { chefSlug: 'kirsten-christopher-shockey', chefName: 'Kirsten and Christopher Shockey', recipeName: 'Fermented Spicy Carrot and Lime Salad', url: 'https://www.amexessentials.com/kirsten-shockey-spicy-carrot-lime-salad-recipe/', notes: 'Fermented carrot salad' },

  // Nancy Silverton (12 recipes) - Bread/Italian specialist
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Pizza Dough', url: 'https://ooni.com/blogs/recipes/nancy-silvertons-pizza-dough' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Fresh Basil Pesto', url: 'https://ooni.com/blogs/recipes/nancy-silvertons-fresh-basil-pesto' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Passata di Pomodoro', url: 'https://ooni.com/blogs/recipes/nancy-silvertons-passata-di-pomodoro' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Marinated Olives and Fresh Pecorino', url: 'https://food52.com/recipes/65914-nancy-silverton-s-marinated-olives-and-fresh-pecorino' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Nancy\'s Chopped Salad', url: 'https://food52.com/recipes/82016-genius-chopped-salad-recipe' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Classic Grilled Cheese with Marinated Onions & Whole-Grain Mustard', url: 'https://www.labreabakery.com/recipes/classic-grilled-cheese-marinated-onions-and-whole-grain-mustard' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Egg Salad With Bagna Cauda Toast', url: 'https://food52.com/recipes/75772-nancy-silverton-s-egg-salad-with-bagna-cauda-toast' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Butterscotch Budino', url: 'https://www.saveur.com/butterscotch-budino-pudding-recipe/' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Dario\'s Olive Oil Cake', url: 'http://ruthreichl.com/2014/02/darios-olive-oil-cake.html/' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Peanut Butter Cookies with Toasted Peanuts', url: 'https://www.today.com/food/nancy-silverton-cookie-recipe-changed-life-t295295' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Crème Fraîche Whipped Cream', url: 'https://food52.com/recipes/14500-nancy-silverton-s-whipped-cream' },
  { chefSlug: 'nancy-silverton', chefName: 'Nancy Silverton', recipeName: 'Polenta Cake with Brutti Ma Buoni Topping', url: 'https://www.foodgal.com/2017/04/nancy-silvertons-polenta-cake-with-brutti-ma-buoni-topping/' },

  // Tamar Adler (14 recipes) - Food waste reduction specialist
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'An Everlasting Piece of Pork Belly', url: 'https://food52.com/blog/4193-an-everlasting-piece-of-pork-belly-tamar-adler', notes: 'Transforms one ingredient into 10+ meals, zero waste' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Stewed Cauliflower, Tomatoes, and Chick Peas with Lemony Uplift', url: 'https://food52.com/recipes/75385-stewed-cauliflower-tomatoes-and-chick-peas-with-lemony-uplift-ala-tamar-adler', notes: 'Resourceful cooking' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Empty Jar Nut Butter Noodles', url: 'https://www.npr.org/2023/03/20/1164403171/everlasting-meal-tamar-adler-leftovers-cookbook-nut-butter-noodles', notes: 'Uses nearly empty jar, zero waste' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Crispy Potato Peels with Scallions and Cheese', url: 'https://www.npr.org/2023/03/20/1164403171/everlasting-meal-tamar-adler-leftovers-cookbook-nut-butter-noodles', notes: 'Uses discarded peels' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Leftover Minestrone', url: 'https://www.saveur.com/article/Recipes/Minestrone-1000090697/', notes: 'Uses whatever aromatics and vegetables on hand' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Pâté d\'Oeuf', url: 'https://www.ediblemanhattan.com/recipes/heres-what-writer-tamar-adler-would-serve-at-an-old-school-summer-picnic/', notes: 'Simple ingredient picnic spread' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Ribollita (Stale Bread Soup)', url: 'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/', notes: 'Uses stale bread, Parmesan rinds' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Herby Bread Dumplings', url: 'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/', notes: 'Fresh or dried bread crumbs' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Naanchos', url: 'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/', notes: 'Repurposes leftover naan' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Bagel Frittata', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Uses cubed leftover bagels' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Fast Ribollita', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: '30-minute version using leftovers' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Lox Rice Bowl', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Uses leftover lox' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Caper Butter', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Uses last capers in jar' },
  { chefSlug: 'tamar-adler', chefName: 'Tamar Adler', recipeName: 'Fān Qié Chăo Dàn (Tomato & Egg Stir-Fry)', url: 'https://www.blackseedbagels.com/recipes-by-tamar/', notes: 'Uses minimal leftover tomatoes' },
];

async function importChefRecipes() {
  console.log('🍽️  Importing 121 Recipes for 10 Chefs\n');

  // Get chef IDs from database
  const chefIds = new Map();
  const chefResults = await db.execute(sql`SELECT id, slug, name FROM chefs`);
  for (const row of chefResults.rows as any[]) {
    chefIds.set(row.slug, row.id);
  }

  console.log(`Found ${chefIds.size} chefs in database\n`);
  console.log('📝 Recipe Import List:\n');
  console.log('─'.repeat(80));

  // Group recipes by chef
  const recipesByChef = new Map<string, RecipeURL[]>();
  for (const recipe of recipeURLs) {
    if (!recipesByChef.has(recipe.chefSlug)) {
      recipesByChef.set(recipe.chefSlug, []);
    }
    recipesByChef.get(recipe.chefSlug)!.push(recipe);
  }

  // Display recipes by chef
  for (const [chefSlug, recipes] of recipesByChef) {
    const chefId = chefIds.get(chefSlug);
    const status = chefId ? '✅' : '❌';
    console.log(`\n${status} ${recipes[0].chefName} (${recipes.length} recipes)`);

    if (!chefId) {
      console.log(`   ⚠️  Chef not found in database with slug: ${chefSlug}`);
      continue;
    }

    for (const recipe of recipes) {
      console.log(`   • ${recipe.recipeName}`);
      if (recipe.notes) {
        console.log(`     ${recipe.notes}`);
      }
    }
  }

  console.log('\n' + '─'.repeat(80));
  console.log(`\n📊 Summary:`);
  console.log(`   Total recipes to import: ${recipeURLs.length}`);
  console.log(`   Chefs covered: ${recipesByChef.size}`);
  console.log(`\n⚠️  IMPORTANT NEXT STEPS:`);
  console.log(`   1. These URLs need to be scraped using the recipe crawl system`);
  console.log(`   2. Use the recipe-crawl server action or batch import tool`);
  console.log(`   3. Recipes will be automatically linked to chefs via chef_id`);
  console.log(`\n💡 To import these recipes:`);
  console.log(`   - Use the recipe import UI at /admin/import`);
  console.log(`   - Or use the batch recipe crawler`);
  console.log(`   - Each URL will be scraped and saved with the appropriate chef_id`);

  process.exit(0);
}

importChefRecipes().catch(console.error);
