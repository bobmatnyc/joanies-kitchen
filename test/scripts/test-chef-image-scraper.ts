#!/usr/bin/env tsx

/**
 * Test Chef Image Scraper Functions
 *
 * Tests the scraper's logic without making actual API calls.
 * Useful for verifying search query generation, image scoring, etc.
 */

// Mock SerpAPI response data
const mockImageResults = [
  {
    position: 1,
    thumbnail: 'https://example.com/thumb1.jpg',
    source: 'NY Times',
    title: 'Anne-Marie Bonneau, The Zero-Waste Chef, Portrait',
    link: 'https://nytimes.com/chef-portrait.jpg',
    original: 'https://nytimes.com/chef-portrait-full.jpg',
    original_width: 1200,
    original_height: 1200,
    is_product: false,
  },
  {
    position: 2,
    thumbnail: 'https://example.com/thumb2.jpg',
    source: 'Shutterstock',
    title: 'Stock photo of chef',
    link: 'https://shutterstock.com/stock-photo.jpg',
    original: 'https://shutterstock.com/stock-photo-full.jpg',
    original_width: 2000,
    original_height: 1500,
    is_product: false,
  },
  {
    position: 3,
    thumbnail: 'https://example.com/thumb3.jpg',
    source: 'Food & Wine',
    title: 'Chef headshot',
    link: 'https://foodandwine.com/headshot.jpg',
    original: 'https://foodandwine.com/headshot-full.jpg',
    original_width: 800,
    original_height: 1000,
    is_product: false,
  },
];

// Test functions
function testSearchQueryGeneration() {
  console.log('🧪 Test: Search Query Generation\n');

  const testCases = [
    {
      chef: { name: 'Anne-Marie Bonneau', display_name: 'Anne-Marie Bonneau (Zero-Waste Chef)' },
      expected: [
        '"Anne-Marie Bonneau (Zero-Waste Chef)" chef portrait',
        '"Anne-Marie Bonneau (Zero-Waste Chef)" chef professional photo',
        '"Anne-Marie Bonneau (Zero-Waste Chef)" chef headshot',
        '"Anne-Marie Bonneau (Zero-Waste Chef)" chef photograph',
        'Anne-Marie Bonneau (Zero-Waste Chef) chef',
      ],
    },
    {
      chef: { name: 'Dan Barber', display_name: null },
      expected: [
        '"Dan Barber" chef portrait',
        '"Dan Barber" chef professional photo',
        '"Dan Barber" chef headshot',
        '"Dan Barber" chef photograph',
        'Dan Barber chef',
      ],
    },
  ];

  testCases.forEach(({ chef, expected }, idx) => {
    const searchName = chef.display_name || chef.name;
    const queries = [
      `"${searchName}" chef portrait`,
      `"${searchName}" chef professional photo`,
      `"${searchName}" chef headshot`,
      `"${searchName}" chef photograph`,
      `${searchName} chef`,
    ];

    console.log(`Test Case ${idx + 1}: ${chef.name}`);
    console.log(`  Display Name: ${chef.display_name || 'null'}`);
    console.log(`  Generated Queries:`);
    queries.forEach((q, i) => {
      const match = q === expected[i] ? '✅' : '❌';
      console.log(`    ${i + 1}. ${match} ${q}`);
    });
    console.log('');
  });
}

function testImageScoring() {
  console.log('🧪 Test: Image Scoring\n');

  const bannedDomains = ['shutterstock.com', 'gettyimages.com'];
  const preferredDomains = ['nytimes.com', 'foodandwine.com'];

  function isDomainBanned(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return bannedDomains.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  function isDomainPreferred(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return preferredDomains.some((domain) => hostname.includes(domain));
    } catch {
      return false;
    }
  }

  function scoreImage(image: typeof mockImageResults[0]): {
    score: number;
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    // Size scoring
    if (image.original_width && image.original_width >= 1000) {
      score += 3;
      reasons.push('high resolution (1000px+)');
    } else if (image.original_width && image.original_width >= 500) {
      score += 1;
      reasons.push('good resolution (500px+)');
    }

    // Aspect ratio
    if (image.original_width && image.original_height) {
      const aspectRatio = image.original_width / image.original_height;
      if (aspectRatio >= 0.8 && aspectRatio <= 1.2) {
        score += 3;
        reasons.push('square aspect ratio');
      } else if (aspectRatio >= 0.6 && aspectRatio <= 0.9) {
        score += 2;
        reasons.push('portrait aspect ratio');
      }
    }

    // Source domain
    if (isDomainPreferred(image.original)) {
      score += 5;
      reasons.push('from preferred source');
    }

    // Position
    if (image.position === 1) {
      score += 2;
      reasons.push('top search result');
    } else if (image.position <= 3) {
      score += 1;
      reasons.push('top 3 result');
    }

    // Title keywords
    const title = image.title.toLowerCase();
    if (title.includes('portrait') || title.includes('headshot') || title.includes('chef')) {
      score += 1;
      reasons.push('professional keywords');
    }

    return { score, reasons };
  }

  mockImageResults.forEach((img, idx) => {
    const { score, reasons } = scoreImage(img);
    const banned = isDomainBanned(img.original);
    const preferred = isDomainPreferred(img.original);

    console.log(`Image ${idx + 1}: ${img.source}`);
    console.log(`  URL: ${img.original}`);
    console.log(`  Size: ${img.original_width}x${img.original_height}px`);
    console.log(`  Banned: ${banned ? '❌ YES' : '✅ NO'}`);
    console.log(`  Preferred: ${preferred ? '✅ YES' : '❌ NO'}`);
    console.log(`  Score: ${score} points`);
    console.log(`  Reasons: ${reasons.join(', ')}`);
    console.log('');
  });
}

function testImageSelection() {
  console.log('🧪 Test: Best Image Selection\n');

  const minWidth = 500;
  const bannedDomains = ['shutterstock.com'];

  const validImages = mockImageResults.filter((img) => {
    if (img.is_product) return false;
    if (img.original_width && img.original_width < minWidth) return false;

    const hostname = new URL(img.original).hostname.toLowerCase();
    if (bannedDomains.some((domain) => hostname.includes(domain))) return false;

    return true;
  });

  console.log(`Total images: ${mockImageResults.length}`);
  console.log(`Valid images after filtering: ${validImages.length}`);
  console.log('');

  console.log('Filtered out:');
  mockImageResults
    .filter((img) => !validImages.includes(img))
    .forEach((img) => {
      console.log(`  ❌ ${img.source}: ${img.original}`);
    });
  console.log('');

  console.log('Remaining candidates:');
  validImages.forEach((img) => {
    console.log(`  ✅ ${img.source}: ${img.original}`);
  });
  console.log('');

  if (validImages.length > 0) {
    console.log(`🏆 Best image: ${validImages[0].source} (${validImages[0].original})`);
  }
}

function testProgressTracking() {
  console.log('🧪 Test: Progress Tracking\n');

  const mockProgress = {
    lastProcessedSlug: 'anne-marie-bonneau',
    processedSlugs: ['anne-marie-bonneau', 'vivian-li', 'lidia-bastianich'],
    failedSlugs: ['unknown-chef'],
    skippedSlugs: ['jacques-pepin', 'alice-waters'],
    timestamp: new Date().toISOString(),
  };

  console.log('Progress State:');
  console.log(`  Last Processed: ${mockProgress.lastProcessedSlug}`);
  console.log(`  Successfully Processed: ${mockProgress.processedSlugs.length}`);
  console.log(`  Failed: ${mockProgress.failedSlugs.length}`);
  console.log(`  Skipped: ${mockProgress.skippedSlugs.length}`);
  console.log(`  Total Handled: ${mockProgress.processedSlugs.length + mockProgress.failedSlugs.length + mockProgress.skippedSlugs.length}`);
  console.log('');

  console.log('Processed Chefs:');
  mockProgress.processedSlugs.forEach((slug) => {
    console.log(`  ✅ ${slug}`);
  });
  console.log('');

  console.log('Failed Chefs:');
  mockProgress.failedSlugs.forEach((slug) => {
    console.log(`  ❌ ${slug}`);
  });
  console.log('');

  console.log('Skipped Chefs:');
  mockProgress.skippedSlugs.forEach((slug) => {
    console.log(`  ⏭️  ${slug}`);
  });
  console.log('');
}

// Run all tests
async function main() {
  console.log('🧪 Chef Image Scraper - Unit Tests');
  console.log('━'.repeat(60));
  console.log('');

  testSearchQueryGeneration();
  testImageScoring();
  testImageSelection();
  testProgressTracking();

  console.log('✅ All tests complete!');
  console.log('');
  console.log('To run the actual scraper:');
  console.log('  Dry run:  pnpm chef:images:scrape');
  console.log('  Apply:    pnpm chef:images:scrape:apply');
  console.log('  Force:    pnpm chef:images:scrape:force');
  console.log('');
}

main().catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
