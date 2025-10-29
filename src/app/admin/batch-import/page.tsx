'use client';

import { useState } from 'react';
import { convertUrlToRecipe } from '@/app/actions/recipe-crawl';

const CHEF_RECIPES = {
  'alton-brown': {
    name: 'Alton Brown',
    urls: [
      'https://altonbrown.com/recipes/good-eats-roast-thanksgiving-turkey/',
      'https://altonbrown.com/recipes/meatloaf-reloaded/',
      'https://altonbrown.com/recipes/perfect-cocoa-brownies/',
      'https://altonbrown.com/recipes/semi-instant-pancake-mix/',
      'https://altonbrown.com/recipes/scallion-pancakes/',
      'https://www.foodnetwork.com/recipes/alton-brown/the-chewy-recipe-1909046',
      'https://www.foodnetwork.com/recipes/alton-brown/baked-macaroni-and-cheese-1939524',
      'https://www.foodnetwork.com/recipes/alton-brown/shepherds-pie-recipe2-1942900',
      'https://www.foodnetwork.com/recipes/alton-brown/who-loves-ya-baby-back-recipe-1937448',
      'https://www.foodnetwork.com/recipes/alton-brown/pan-seared-rib-eye-recipe-2131274',
      'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-recipe-1939165',
      'https://www.foodnetwork.com/recipes/alton-brown/fried-chicken-reloaded-5518729',
    ],
  },
  'bren-smith': {
    name: 'Bren Smith',
    urls: [
      'https://www.greenwave.org/recipes-1/bbq-kelp-carrots',
      'https://www.greenwave.org/recipes-1/tamarind-kelp-noodles',
      'https://www.greenwave.org/recipes-1/zucchini-kelp-cake',
      'https://www.greenwave.org/recipes-1/tahini-salad-fried-kelp',
      'https://www.greenwave.org/recipes-1/kelp-butter-wb8n6',
      'https://www.greenwave.org/recipes-1/kelp-orzo-soup-gxs59',
      'https://www.greenwave.org/recipes-1/kelp-scampi',
      'https://www.greenwave.org/recipes-1/shrimp-kelp-fra-diavolo',
      'https://atlanticseafarms.com/recipes/melissa-clarks-creamy-white-bean-and-seaweed-stew-with-parmesan/',
      'https://atlanticseafarms.com/recipes/melissa-clarks-lemony-pasta-with-kelp-chile-and-anchovies/',
      'https://riverheadnewsreview.timesreview.com/2014/07/56138/how-do-you-eat-kelp-here-are-two-recipes/',
    ],
  },
  'cristina-scarpaleggia': {
    name: 'Cristina Scarpaleggia',
    urls: [
      'https://en.julskitchen.com/first-course/soup/best-pappa-al-pomodoro',
      'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-gnudi',
      'https://en.julskitchen.com/tuscany/fried-sage-leaves',
      'https://en.julskitchen.com/appetizer/chicken-liver-crostini',
      'https://en.julskitchen.com/first-course/fresh-pasta/how-to-make-ricotta-ravioli',
      'https://en.julskitchen.com/breakfast/italian-croissants',
      'https://en.julskitchen.com/tuscany/tuscan-schiacciata-with-walnuts',
      'https://en.julskitchen.com/vegetarian/roasted-peppers-appetizer',
      'https://en.julskitchen.com/side/cavolo-nero-salad',
      'https://en.julskitchen.com/dessert/cookies/almond-and-rice-flour-lemon-cookies',
      'https://en.julskitchen.com/dessert/grape-focaccia',
      'https://en.julskitchen.com/first-course/fresh-pasta/tuscan-kale-pesto',
    ],
  },
  'dan-barber': {
    name: 'Dan Barber',
    urls: [
      'https://food52.com/recipes/9111-dan-barber-s-braised-short-ribs',
      'https://food52.com/recipes/20792-dan-barber-s-cauliflower-steaks-with-cauliflower-puree',
      'https://www.jamesbeard.org/stories/waste-less-recipe-dan-barbers-root-vegetable-peel-chips',
      'https://www.washingtonpost.com/recipes/dan-barbers-scrambled-eggs/',
      'https://www.today.com/food/stop-wasting-food-money-these-easy-recipes-tips-t116216',
      'https://www.esquire.com/food-drink/food/recipes/a9989/parsnip-steak-recipe-dan-barber-5806809/',
      'https://abcnews.go.com/Nightline/Platelist/recipes-thanksgiving-favorites-dan-barber/story?id=6273587',
      'https://www.williams-sonoma.com/recipe/kale-salad-with-pine-nuts-currants-and-parmesan.html',
      'https://www.mindful.org/how-to-make-a-carrot-steak-recipe/',
      'https://time.com/2924024/summer-recipes-by-writers/',
      'https://www.tastingtable.com/687150/recipe-vegetable-chips-blue-hill-restaurant-dan-barber/',
    ],
  },
  'david-zilber': {
    name: 'David Zilber',
    urls: [
      'https://www.highsnobiety.com/p/david-zilber-interview/',
      'https://www.ethanchlebowski.com/cooking-techniques-recipes/noma-guide-to-lacto-fermented-pickles',
      'https://www.splendidtable.org/story/2018/10/31/lacto-blueberries',
      'https://www.vice.com/en/article/coffee-kombucha-recipe/',
      'https://www.pdxmonthly.com/eat-and-drink/2019/09/make-nomas-umami-bomb-mushrooms-in-your-home-kitchen',
      'https://xtinenyc.com/food/the-moment/with-rene-redzepi/',
    ],
  },
  'ina-garten': {
    name: 'Ina Garten',
    urls: [
      'https://barefootcontessa.com/recipes/baked-fontina',
      'https://barefootcontessa.com/recipes/chicken-pot-pie',
      'https://www.foodnetwork.com/recipes/ina-garten/garlic-and-herb-roasted-shrimp-3742576',
      'https://www.foodnetwork.com/recipes/ina-garten/perfect-roast-chicken-recipe-1940592',
      'https://www.foodnetwork.com/recipes/ina-garten/roast-chicken-with-radishes-3742076',
      'https://www.foodnetwork.com/recipes/ina-garten/lemon-parmesan-chicken-with-arugula-salad-topping-5176940',
      'https://www.foodnetwork.com/recipes/ina-garten/rigatoni-with-sausage-and-fennel-3753750',
      'https://www.foodnetwork.com/recipes/ina-garten/orecchiette-with-broccoli-rabe-and-sausage-5176922',
      'https://www.foodnetwork.com/recipes/ina-garten/herbed-orzo-with-feta-3753751',
      'https://www.foodnetwork.com/recipes/ina-garten/annas-tomato-tart-3756210',
      'https://www.foodnetwork.com/recipes/ina-garten/salty-oatmeal-chocolate-chunk-cookies-5468289',
      'https://www.foodnetwork.com/recipes/ina-garten/vanilla-rum-panna-cotta-with-salted-caramel-5190866',
    ],
  },
  'jeremy-fox': {
    name: 'Jeremy Fox',
    urls: [
      'https://thechalkboardmag.com/recipes-from-chef-jeremy-fox-new-cookbook-on-vegetables/',
      'https://www.sunset.com/food-wine/healthy/gourmet-vegetarian-dinner-recipes',
      'https://cookbookreview.blog/2018/08/23/lima-bean-and-sorrel-cacio-e-pepe-by-jeremy-fox/comment-page-1/',
      'https://cookbookreview.blog/2018/08/23/carrot-juice-cavatelli-tops-salsa-and-spiced-pulp-crumble-by-jeremy-fox/',
      'https://cookbookreview.blog/2018/08/23/carta-da-musica-leaves-things-and-truffled-pecorino-by-jeremy-fox/',
      'https://www.7x7.com/chef-jeremy-fox-back-on-top-birdie-g-2653511058/recipe-make-jeremy-fox-s-grilled-asparagus-with-horsey-feta-everything-spice',
      'https://hotpotato.kitchen/on-vegetables',
    ],
  },
  'kirsten-and-christopher-shockey': {
    name: 'Kirsten & Christopher Shockey',
    urls: [
      'https://www.thedoctorskitchen.com/recipes/kirsten-shockey-s-be-good-to-your-gut-fennel-chutney',
      'https://www.makesauerkraut.com/fermented-vegetables-book-review/',
      'https://www.motherearthnews.com/real-food/habanero-salsa-zm0z17aszqui/',
      'https://www.motherearthnews.com/real-food/green-chile-recipe-zm0z17aszqui/',
      'https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-kale-tips-and-a-recipe-for-kale-kimchi-zbcz1511/',
      'https://www.motherearthnews.com/real-food/seasonal-recipes/fermented-garlic-paste-zerz1502znut/',
      'https://www.motherearthnews.com/real-food/seasonal-recipes/squash-chutney-recipe-zerz1502znut/',
      'https://www.motherearthnews.com/real-food/cubed-spring-radish-kimchi-zbcz1505/',
      'https://www.motherearthnews.com/real-food/how-to-ferment-sauerkraut-zerz1502znut/',
      'https://www.motherearthnews.com/real-food/fermented-nettle-pesto-zbcz1505/',
      'https://www.motherearthnews.com/real-food/fermenting-garlic-scapes-zbcz1506/',
      'https://www.motherearthnews.com/real-food/fermenting/when-life-hands-you-garlic-mustard-ferment-it-zbcz1604',
      'https://www.amexessentials.com/kirsten-shockey-spicy-carrot-lime-salad-recipe/',
    ],
  },
  'nancy-silverton': {
    name: 'Nancy Silverton',
    urls: [
      'https://ooni.com/blogs/recipes/nancy-silvertons-pizza-dough',
      'https://ooni.com/blogs/recipes/nancy-silvertons-fresh-basil-pesto',
      'https://ooni.com/blogs/recipes/nancy-silvertons-passata-di-pomodoro',
      'https://food52.com/recipes/65914-nancy-silverton-s-marinated-olives-and-fresh-pecorino',
      'https://food52.com/recipes/82016-genius-chopped-salad-recipe',
      'https://www.labreabakery.com/recipes/classic-grilled-cheese-marinated-onions-and-whole-grain-mustard',
      'https://food52.com/recipes/75772-nancy-silverton-s-egg-salad-with-bagna-cauda-toast',
      'https://www.saveur.com/butterscotch-budino-pudding-recipe/',
      'https://www.today.com/food/nancy-silverton-cookie-recipe-changed-life-t295295',
      'https://food52.com/recipes/14500-nancy-silverton-s-whipped-cream',
      'https://www.foodgal.com/2017/04/nancy-silvertons-polenta-cake-with-brutti-ma-buoni-topping/',
    ],
  },
  'tamar-adler': {
    name: 'Tamar Adler',
    urls: [
      'https://food52.com/blog/4193-an-everlasting-piece-of-pork-belly-tamar-adler',
      'https://food52.com/recipes/75385-stewed-cauliflower-tomatoes-and-chick-peas-with-lemony-uplift-ala-tamar-adler',
      'https://www.npr.org/2023/03/20/1164403171/everlasting-meal-tamar-adler-leftovers-cookbook-nut-butter-noodles',
      'https://www.saveur.com/article/Recipes/Minestrone-1000090697/',
      'https://www.ediblemanhattan.com/recipes/heres-what-writer-tamar-adler-would-serve-at-an-old-school-summer-picnic/',
      'https://newsletter.wordloaf.org/tamar-adlers-the-everlasting-meal/',
      'https://www.blackseedbagels.com/recipes-by-tamar/',
    ],
  },
};

export default function BatchImportPage() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);

  async function handleBatchImport() {
    setImporting(true);
    setProgress([]);

    for (const [_chefSlug, data] of Object.entries(CHEF_RECIPES)) {
      setProgress((prev) => [...prev, `Starting ${data.name}...`]);

      for (let i = 0; i < data.urls.length; i++) {
        const url = data.urls[i];
        setProgress((prev) => [...prev, `[${i + 1}/${data.urls.length}] ${url}...`]);

        try {
          const result = await convertUrlToRecipe(url);
          if (result.success) {
            setProgress((prev) => [...prev, `✅ SUCCESS: ${result.recipe?.name}`]);
          } else {
            setProgress((prev) => [...prev, `❌ FAILED: ${result.error}`]);
          }
        } catch (error: any) {
          setProgress((prev) => [...prev, `❌ ERROR: ${error.message}`]);
        }

        // Rate limit: 2 seconds between requests
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    setProgress((prev) => [...prev, '🎉 Batch import complete!']);
    setImporting(false);
  }

  const totalRecipes = Object.values(CHEF_RECIPES).reduce((sum, chef) => sum + chef.urls.length, 0);
  const totalChefs = Object.keys(CHEF_RECIPES).length;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Batch Import Chef Recipes</h1>

      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <h2 className="font-semibold mb-2">Import Summary</h2>
        <p className="text-sm text-gray-700">
          📊 {totalChefs} chefs × {totalRecipes} recipes
        </p>
        <p className="text-sm text-gray-600 mt-1">
          Estimated time: ~{Math.ceil((totalRecipes * 2) / 60)} minutes (2s per recipe)
        </p>
      </div>

      <div className="mb-4">
        <button
          onClick={handleBatchImport}
          disabled={importing}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {importing ? 'Importing...' : 'Start Batch Import'}
        </button>
      </div>

      <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
        {progress.length === 0 && !importing && (
          <div className="text-gray-500">Click "Start Batch Import" to begin...</div>
        )}
        {progress.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
