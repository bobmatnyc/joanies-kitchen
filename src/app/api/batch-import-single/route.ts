import { type NextRequest, NextResponse } from 'next/server';
import { convertUrlToRecipe } from '@/app/actions/recipe-crawl';
import { authorizeAdminOrCronSecret } from '@/lib/admin';
import { toErrorMessage } from '@/lib/utils/error-handling';

export async function POST(request: NextRequest) {
  // #13: paid LLM conversion per URL — admin session or CRON_SECRET bearer only, checked before any work.
  const denied = await authorizeAdminOrCronSecret(request);
  if (denied) return denied;

  try {
    const body = await request.json();
    const { url, chefName, recipeIndex, totalRecipes } = body;

    if (!url) {
      return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 });
    }

    const progressLabel = recipeIndex && totalRecipes ? `[${recipeIndex}/${totalRecipes}]` : '';

    console.log(`[Single Import] ${progressLabel} Processing: ${url}`);
    console.log(`[Single Import] Chef: ${chefName || 'Unknown'}`);

    try {
      const result = await convertUrlToRecipe(url);

      if (result.success) {
        console.log(`[Single Import] ✅ SUCCESS: ${result.recipe?.name}`);
        return NextResponse.json({
          success: true,
          recipe: {
            name: result.recipe?.name,
            url: url,
          },
        });
      } else {
        console.log(`[Single Import] ❌ FAILED: ${result.error}`);
        return NextResponse.json({
          success: false,
          error: result.error,
          url: url,
        });
      }
    } catch (error: unknown) {
      const errorMessage = toErrorMessage(error);
      console.error(`[Single Import] ❌ ERROR: ${errorMessage}`);
      return NextResponse.json({
        success: false,
        error: errorMessage,
        url: url,
      });
    }
  } catch (error: unknown) {
    const errorMessage = toErrorMessage(error);
    console.error('[Single Import] Fatal error:', errorMessage);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to import a single recipe',
    example: {
      url: 'https://example.com/recipe',
      chefName: 'Chef Name',
      recipeIndex: 1,
      totalRecipes: 121,
    },
  });
}
