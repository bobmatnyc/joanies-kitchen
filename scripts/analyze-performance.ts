#!/usr/bin/env tsx
/**
 * Performance Analysis Script for Joanie's Kitchen
 *
 * Analyzes bundle size, image optimization, and provides performance metrics
 *
 * Usage:
 *   tsx scripts/analyze-performance.ts [--full]
 */

import fs from 'node:fs';
import path from 'node:path';

interface ImageAnalysis {
  path: string;
  size: number;
  sizeKB: string;
  optimized: boolean;
  issues: string[];
}

interface BundleAnalysis {
  totalSize: number;
  files: Array<{ path: string; size: number; sizeKB: string }>;
}

interface PerformanceReport {
  images: ImageAnalysis[];
  largeImages: ImageAnalysis[];
  totalImageSize: number;
  recommendations: string[];
}

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`;
}

function analyzeImage(filePath: string): ImageAnalysis {
  const stats = fs.statSync(filePath);
  const size = stats.size;
  const ext = path.extname(filePath).toLowerCase();
  const issues: string[] = [];

  let optimized = true;

  // Check if image is too large
  if (size > 1024 * 1024) {
    // > 1MB
    issues.push(`Large file size (${formatBytes(size)})`);
    optimized = false;
  }

  // Check if PNG is used instead of WebP
  if (ext === '.png' && size > 100 * 1024) {
    issues.push('Consider converting to WebP for better compression');
    optimized = false;
  }

  // Check if JPEG quality might be too high
  if (ext === '.jpg' || ext === '.jpeg') {
    if (size > 500 * 1024) {
      issues.push('JPEG file is large - consider reducing quality to 75-85%');
      optimized = false;
    }
  }

  return {
    path: filePath,
    size,
    sizeKB: formatBytes(size),
    optimized,
    issues,
  };
}

function scanImages(dir: string, results: ImageAnalysis[] = []): ImageAnalysis[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules and .next
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        scanImages(filePath, results);
      }
    } else {
      const ext = path.extname(file).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
        results.push(analyzeImage(filePath));
      }
    }
  }

  return results;
}

function analyzeBundleSize(): BundleAnalysis | null {
  const nextDir = path.join(process.cwd(), '.next');

  if (!fs.existsSync(nextDir)) {
    log('⚠️  No .next directory found. Run `pnpm build` first.', 'yellow');
    return null;
  }

  const staticDir = path.join(nextDir, 'static');
  const files: Array<{ path: string; size: number; sizeKB: string }> = [];
  let totalSize = 0;

  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;

    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        scanDirectory(itemPath);
      } else if (item.endsWith('.js')) {
        const size = stat.size;
        totalSize += size;
        files.push({
          path: itemPath.replace(process.cwd(), ''),
          size,
          sizeKB: formatBytes(size),
        });
      }
    }
  }

  scanDirectory(staticDir);

  return {
    totalSize,
    files: files.sort((a, b) => b.size - a.size).slice(0, 10), // Top 10 largest files
  };
}

function generateReport(images: ImageAnalysis[]): PerformanceReport {
  const largeImages = images.filter((img) => img.size > 500 * 1024); // > 500KB
  const totalImageSize = images.reduce((sum, img) => sum + img.size, 0);
  const recommendations: string[] = [];

  // Generate recommendations
  if (largeImages.length > 0) {
    recommendations.push(
      `🔴 CRITICAL: ${largeImages.length} large images found (>500KB). Convert to WebP and reduce size.`
    );
  }

  const pngImages = images.filter((img) => img.path.endsWith('.png') && img.size > 100 * 1024);
  if (pngImages.length > 0) {
    recommendations.push(
      `🟡 HIGH: ${pngImages.length} PNG images could be converted to WebP for 70-80% size reduction.`
    );
  }

  if (totalImageSize > 10 * 1024 * 1024) {
    recommendations.push(
      `🟡 HIGH: Total image size is ${formatBytes(totalImageSize)}. Optimize images to reduce bandwidth.`
    );
  }

  const unoptimizedImages = images.filter((img) => !img.optimized);
  if (unoptimizedImages.length > 0) {
    recommendations.push(
      `🟢 MEDIUM: ${unoptimizedImages.length} images could be further optimized.`
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ All images are well-optimized!');
  }

  return {
    images,
    largeImages,
    totalImageSize,
    recommendations,
  };
}

async function main() {
  const fullAnalysis = process.argv.includes('--full');

  log("\n🔍 Performance Analysis for Joanie's Kitchen\n", 'bold');
  log('═══════════════════════════════════════════════════\n', 'cyan');

  // Analyze images
  log('📸 Analyzing Images...', 'blue');
  const publicDir = path.join(process.cwd(), 'public');
  const images = scanImages(publicDir);
  const report = generateReport(images);

  log(`\nFound ${images.length} images`, 'cyan');
  log(`Total size: ${formatBytes(report.totalImageSize)}`, 'cyan');

  // Show large images
  if (report.largeImages.length > 0) {
    log('\n🔴 Large Images (>500KB):', 'red');
    report.largeImages.forEach((img) => {
      log(`  ${img.path}: ${img.sizeKB}`, 'yellow');
      img.issues.forEach((issue) => log(`    - ${issue}`, 'yellow'));
    });
  } else {
    log('\n✅ No large images found!', 'green');
  }

  // Show all images in full mode
  if (fullAnalysis) {
    log('\n📋 All Images:', 'blue');
    images
      .sort((a, b) => b.size - a.size)
      .forEach((img) => {
        const status = img.optimized ? '✅' : '⚠️';
        log(`  ${status} ${img.path}: ${img.sizeKB}`, img.optimized ? 'green' : 'yellow');
        if (img.issues.length > 0) {
          img.issues.forEach((issue) => log(`    - ${issue}`, 'yellow'));
        }
      });
  }

  // Analyze bundle size
  log('\n📦 Analyzing JavaScript Bundle...', 'blue');
  const bundle = analyzeBundleSize();

  if (bundle) {
    log(`\nTotal JS size: ${formatBytes(bundle.totalSize)}`, 'cyan');

    if (bundle.totalSize > 500 * 1024) {
      log('⚠️  Bundle size is large. Consider code splitting.', 'yellow');
    } else {
      log('✅ Bundle size is good!', 'green');
    }

    if (fullAnalysis && bundle.files.length > 0) {
      log('\n📄 Top 10 Largest JS Files:', 'blue');
      bundle.files.forEach((file, index) => {
        log(`  ${index + 1}. ${file.path}: ${file.sizeKB}`, 'cyan');
      });
    }
  }

  // Show recommendations
  log('\n💡 Recommendations:', 'bold');
  report.recommendations.forEach((rec) => {
    log(`\n${rec}`, 'cyan');
  });

  // Performance metrics estimation
  log('\n📊 Estimated Performance Impact:', 'bold');
  log('═══════════════════════════════════════════════════', 'cyan');

  const hasLargeImages = report.largeImages.length > 0;
  const hasUnoptimizedPngs = images.some(
    (img) => img.path.endsWith('.png') && img.size > 100 * 1024
  );

  if (hasLargeImages) {
    log('FCP: 2.5-3.5s (BAD) ❌', 'red');
    log('LCP: 3.5-5.5s (BAD) ❌', 'red');
  } else if (hasUnoptimizedPngs) {
    log('FCP: 1.5-2.0s (NEEDS IMPROVEMENT) ⚠️', 'yellow');
    log('LCP: 2.0-3.0s (NEEDS IMPROVEMENT) ⚠️', 'yellow');
  } else {
    log('FCP: 0.8-1.2s (GOOD) ✅', 'green');
    log('LCP: 1.2-2.0s (GOOD) ✅', 'green');
  }

  log('\n💡 Target Metrics:', 'blue');
  log('  FCP: < 1.0s (Excellent)', 'cyan');
  log('  LCP: < 2.0s (Good)', 'cyan');
  log('  TBT: < 200ms', 'cyan');
  log('  CLS: < 0.1', 'cyan');

  log('\n📖 For detailed optimization guide, see:', 'bold');
  log('  docs/guides/PERFORMANCE_OPTIMIZATION.md\n', 'cyan');

  // Exit with error if critical issues found
  const hasCriticalIssues = report.largeImages.length > 0;
  if (hasCriticalIssues) {
    process.exit(1);
  }
}

main().catch((error) => {
  log(`\n❌ Error: ${error.message}`, 'red');
  process.exit(1);
});
