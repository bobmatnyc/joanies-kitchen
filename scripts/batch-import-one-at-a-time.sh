#!/bin/bash

API_URL="http://localhost:3002/api/batch-import-single"
LOG_FILE="tmp/batch-import-single-$(date +%s).log"
PROGRESS_FILE="tmp/batch-import-progress.txt"

# Create tmp directory if it doesn't exist
mkdir -p tmp

# Initialize progress tracking
echo "0" > "$PROGRESS_FILE"

echo "🚀 Starting single-recipe batch import (121 recipes)" | tee -a "$LOG_FILE"
echo "📝 Progress tracked in: $PROGRESS_FILE" | tee -a "$LOG_FILE"
echo "📋 Full log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

TOTAL_RECIPES=121
SUCCESS_COUNT=0
FAIL_COUNT=0

# Function to import a single recipe
import_recipe() {
  local url=$1
  local chef_name=$2
  local recipe_index=$3

  echo "[$recipe_index/$TOTAL_RECIPES] 👨‍🍳 $chef_name" | tee -a "$LOG_FILE"
  echo "🔗 $url" | tee -a "$LOG_FILE"

  response=$(curl -s -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d "{\"url\": \"$url\", \"chefName\": \"$chef_name\", \"recipeIndex\": $recipe_index, \"totalRecipes\": $TOTAL_RECIPES}" \
    2>&1)

  if echo "$response" | grep -q '"success":true'; then
    recipe_name=$(echo "$response" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
    echo "✅ SUCCESS: $recipe_name" | tee -a "$LOG_FILE"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    echo "❌ FAILED: $error" | tee -a "$LOG_FILE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # Update progress
  echo "$recipe_index" > "$PROGRESS_FILE"
  echo "" | tee -a "$LOG_FILE"

  # Rate limiting: 2 seconds between requests
  sleep 2
}

# Recipe counter
RECIPE_INDEX=0

# Chef: Alton Brown (12 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://altonbrown.com/recipes/meatloaf-reloaded/" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://altonbrown.com/recipes/perfect-cocoa-brownies/" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://altonbrown.com/recipes/semi-instant-pancake-mix/" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://altonbrown.com/recipes/scallion-pancakes/" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/alton-brown/the-chewy-recipe-1909046" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-1939524" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/alton-brown/shepherds-pie-recipe2-1942900" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/alton-brown/who-loves-ya-baby-back-recipe-1937448" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/alton-brown/pan-seared-rib-eye-recipe-2131274" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-recipe-1939165" "Alton Brown" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-reloaded-5518729" "Alton Brown" $RECIPE_INDEX

# Chef: Bren Smith (11 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/bbq-kelp-carrots" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/tamarind-kelp-noodles" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/zucchini-kelp-cake" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/tahini-salad-fried-kelp" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/kelp-butter-wb8n6" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/kelp-orzo-soup-gxs59" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/kelp-scampi" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.greenwave.org/recipes-1/shrimp-kelp-fra-diavolo" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://atlanticseafarms.com/recipes/melissa-clarks-creamy-white-bean-and-seaweed-stew-with-parmesan/" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://atlanticseafarms.com/recipes/melissa-clarks-lemony-pasta-with-kelp-chile-and-anchovies/" "Bren Smith" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://riverheadnewsreview.timesreview.com/2014/07/56138/how-do-you-eat-kelp-here-are-two-recipes/" "Bren Smith" $RECIPE_INDEX

# Chef: Cristina Scarpaleggia (12 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/first-course/soup/best-pappa-al-pomodoro" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-gnudi" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/tuscany/fried-sage-leaves" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/appetizer/chicken-liver-crostini" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/first-course/fresh-pasta/how-to-make-ricotta-ravioli" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/breakfast/italian-croissants" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/tuscany/tuscan-schiacciata-with-walnuts" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/vegetarian/roasted-peppers-appetizer" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/side/cavolo-nero-salad" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/dessert/cookies/almond-and-rice-flour-lemon-cookies" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/dessert/grape-focaccia" "Cristina Scarpaleggia" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-pesto" "Cristina Scarpaleggia" $RECIPE_INDEX

# Chef: Dan Barber (11 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/recipes/9111-dan-barber-s-braised-short-ribs" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/recipes/20792-dan-barber-s-cauliflower-steaks-with-cauliflower-puree" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.jamesbeard.org/stories/waste-less-recipe-dan-barbers-root-vegetable-peel-chips" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.washingtonpost.com/recipes/dan-barbers-scrambled-eggs/" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.today.com/food/stop-wasting-food-money-these-easy-recipes-tips-t116216" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.esquire.com/food-drink/food/recipes/a9989/parsnip-steak-recipe-dan-barber-5806809/" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.williams-sonoma.com/recipe/kale-salad-with-pine-nuts-currants-and-parmesan.html" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.mindful.org/how-to-make-a-carrot-steak-recipe/" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://time.com/2924024/summer-recipes-by-writers/" "Dan Barber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.tastingtable.com/687150/recipe-vegetable-chips-blue-hill-restaurant-dan-barber/" "Dan Barber" $RECIPE_INDEX

# Chef: David Zilber (6 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.highsnobiety.com/p/david-zilber-interview/" "David Zilber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.ethanchlebowski.com/cooking-techniques-recipes/noma-guide-to-lacto-fermented-pickles" "David Zilber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.splendidtable.org/story/2018/10/31/lacto-blueberries" "David Zilber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.vice.com/en/article/coffee-kombucha-recipe/" "David Zilber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.pdxmonthly.com/eat-and-drink/2019/09/make-nomas-umami-bomb-mushrooms-in-your-home-kitchen" "David Zilber" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://xtinenyc.com/food/the-moment/with-rene-redzepi/" "David Zilber" $RECIPE_INDEX

# Chef: Ina Garten (12 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://barefootcontessa.com/recipes/baked-fontina" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://barefootcontessa.com/recipes/chicken-pot-pie" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/garlic-and-herb-roasted-shrimp-3742576" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/roast-chicken-with-radishes-3742076" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/lemon-parmesan-chicken-with-arugula-salad-topping-5176940" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/rigatoni-with-sausage-and-fennel-3753750" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/orecchiette-with-broccoli-rabe-and-sausage-5176922" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/herbed-orzo-with-feta-3753751" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/annas-tomato-tart-3756210" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/salty-oatmeal-chocolate-chunk-cookies-5468289" "Ina Garten" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodnetwork.com/recipes/ina-garten/vanilla-rum-panna-cotta-with-salted-caramel-5190866" "Ina Garten" $RECIPE_INDEX

# Chef: Jeremy Fox (7 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/" "Jeremy Fox" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes" "Jeremy Fox" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://cookbookreview.blog/2018/08/23/lima-bean-and-sorrel-cacio-e-pepe-by-jeremy-fox/comment-page-1/" "Jeremy Fox" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://cookbookreview.blog/2018/08/23/carrot-juice-cavatelli-tops-salsa-and-spiced-pulp-crumble-by-jeremy-fox/" "Jeremy Fox" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://cookbookreview.blog/2018/08/23/carta-da-musica-leaves-things-and-truffled-pecorino-by-jeremy-fox/" "Jeremy Fox" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.7x7.com/chef-jeremy-fox-back-on-top-birdie-g-2653511058/recipe-make-jeremy-fox-s-grilled-asparagus-with-horsey-feta-everything-spice" "Jeremy Fox" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://hotpotato.kitchen/on-vegetables" "Jeremy Fox" $RECIPE_INDEX

# Chef: Kirsten & Christopher Shockey (13 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.thedoctorskitchen.com/recipes/kirsten-shockey-s-be-good-to-your-gut-fennel-chutney" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.makesauerkraut.com/fermented-vegetables-book-review/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/habanero-salsa-zm0z17aszqui/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/green-chile-recipe-zm0z17aszqui/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-kale-tips-and-a-recipe-for-kale-kimchi-zbcz1511/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-garlic-paste-zerz1502znut/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/seasonal-recipes/squash-chutney-recipe-zerz1502znut/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/cubed-spring-radish-kimchi-zbcz1505/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/how-to-ferment-sauerkraut-zerz1502znut/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/fermented-nettle-pesto-zbcz1505/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/fermenting-garlic-scapes-zbcz1506/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.motherearthnews.com/real-food/fermenting/when-life-hands-you-garlic-mustard-ferment-it-zbcz1604" "Kirsten & Christopher Shockey" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.amexessentials.com/kirsten-shockey-spicy-carrot-lime-salad-recipe/" "Kirsten & Christopher Shockey" $RECIPE_INDEX

# Chef: Nancy Silverton (11 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://ooni.com/blogs/recipes/nancy-silvertons-pizza-dough" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://ooni.com/blogs/recipes/nancy-silvertons-fresh-basil-pesto" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://ooni.com/blogs/recipes/nancy-silvertons-passata-di-pomodoro" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/recipes/65914-nancy-silverton-s-marinated-olives-and-fresh-pecorino" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/recipes/82016-genius-chopped-salad-recipe" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.labreabakery.com/recipes/classic-grilled-cheese-marinated-onions-and-whole-grain-mustard" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/recipes/75772-nancy-silverton-s-egg-salad-with-bagna-cauda-toast" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.saveur.com/butterscotch-budino-pudding-recipe/" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.today.com/food/nancy-silverton-cookie-recipe-changed-life-t295295" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/recipes/14500-nancy-silverton-s-whipped-cream" "Nancy Silverton" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.foodgal.com/2017/04/nancy-silvertons-polenta-cake-with-brutti-ma-buoni-topping/" "Nancy Silverton" $RECIPE_INDEX

# Chef: Tamar Adler (7 recipes)
RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/blog/4193-an-everlasting-piece-of-pork-belly-tamar-adler" "Tamar Adler" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://food52.com/recipes/75385-stewed-cauliflower-tomatoes-and-chick-peas-with-lemony-uplift-ala-tamar-adler" "Tamar Adler" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.npr.org/2023/03/20/1164403171/everlasting-meal-tamar-adler-leftovers-cookbook-nut-butter-noodles" "Tamar Adler" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.saveur.com/article/Recipes/Minestrone-1000090697/" "Tamar Adler" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.ediblemanhattan.com/recipes/heres-what-writer-tamar-adler-would-serve-at-an-old-school-summer-picnic/" "Tamar Adler" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/" "Tamar Adler" $RECIPE_INDEX

RECIPE_INDEX=$((RECIPE_INDEX + 1))
import_recipe "https://www.blackseedbagels.com/recipes-by-tamar/" "Tamar Adler" $RECIPE_INDEX

# Summary
echo "" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"
echo "🎉 Batch Import Complete!" | tee -a "$LOG_FILE"
echo "================================" | tee -a "$LOG_FILE"
echo "✅ Success: $SUCCESS_COUNT" | tee -a "$LOG_FILE"
echo "❌ Failed: $FAIL_COUNT" | tee -a "$LOG_FILE"
echo "📊 Total: $TOTAL_RECIPES" | tee -a "$LOG_FILE"
echo "📝 Full log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"
