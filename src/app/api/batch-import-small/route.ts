import { type NextRequest, NextResponse } from 'next/server';
import { convertUrlToRecipe } from '@/app/actions/recipe-crawl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { urls, chefName } = body;

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { success: false, error: 'urls array is required' },
        { status: 400 }
      );
    }

    console.log(
      `[Batch Import Small] Starting import of ${urls.length} URLs for ${chefName || 'Unknown Chef'}`
    );

    const results: any[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      console.log(`[Batch Import Small] [${i + 1}/${urls.length}] Processing: ${url}`);

      try {
        const result = await convertUrlToRecipe(url);

        if (result.success) {
          console.log(`[Batch Import Small] ✅ SUCCESS: ${result.recipe?.name}`);
          successCount++;
          results.push({
            url,
            status: 'success',
            recipe: result.recipe?.name,
          });
        } else {
          console.log(`[Batch Import Small] ❌ FAILED: ${result.error}`);
          failCount++;
          results.push({
            url,
            status: 'failed',
            error: result.error,
          });
        }

        // Rate limiting: 2 seconds between requests
        if (i < urls.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`[Batch Import Small] ❌ ERROR: ${error.message}`);
        failCount++;
        results.push({
          url,
          status: 'error',
          error: error.message,
        });
      }
    }

    console.log(
      `[Batch Import Small] Batch complete! Success: ${successCount}, Failed: ${failCount}`
    );

    return NextResponse.json({
      success: true,
      stats: {
        total: urls.length,
        success: successCount,
        failed: failCount,
      },
      results,
    });
  } catch (error: any) {
    console.error('[Batch Import Small] Fatal error:', error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Use POST to start small batch import',
    example: {
      urls: ['https://example.com/recipe1', 'https://example.com/recipe2'],
      chefName: 'Chef Name',
    },
  });
}
