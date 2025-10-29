/**
 * Phase 5: QA Reporting Dashboard Data Generator
 *
 * Purpose: Generate comprehensive QA report for review, combining results
 * from all previous phases into executive summary, detailed JSON, and CSV formats.
 *
 * Outputs:
 * 1. Executive Summary (tmp/qa-executive-summary.txt)
 * 2. Detailed JSON Report (tmp/qa-full-report.json)
 * 3. CSV for Manual Review (tmp/qa-manual-review.csv)
 *
 * Usage:
 *   pnpm tsx scripts/qa-generate-report.ts
 */

import fs from 'node:fs';
import path from 'node:path';

interface FullReport {
  qa_run_date: string;
  total_recipes: number;
  statistics: {
    validated: number;
    fixed_automatically: number;
    needs_manual_review: number;
    critical_issues: number;
  };
  by_issue_type: {
    missing_ingredients: number;
    missing_instructions: number;
    ingredient_mismatch: number;
    malformed_json: number;
    empty_strings: number;
  };
  by_confidence: {
    high_0_90_plus: number;
    medium_0_70_to_0_90: number;
    low_below_0_70: number;
  };
  phase_results: {
    phase_1_structure: any;
    phase_2_extraction: any;
    phase_3_derivation: any;
    phase_4_fixes_applied: any;
  };
}

interface ManualReviewRow {
  recipe_id: string;
  recipe_name: string;
  issue_type: string;
  severity: string;
  confidence: string;
  status: string;
  notes: string;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatPercentage(num: number, total: number): string {
  if (total === 0) return '0.00%';
  return `${((num / total) * 100).toFixed(2)}%`;
}

async function generateReport() {
  console.log('📊 Phase 5: Generate Comprehensive QA Report\n');

  const tmpDir = path.join(process.cwd(), 'tmp');

  // Check for required files
  const requiredFiles = ['qa-structure-report.json'];

  const _optionalFiles = [
    'qa-ingredient-extraction-report.json',
    'qa-derived-ingredients.json',
    'qa-apply-fixes-log.json',
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(tmpDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Error: Required file not found: ${file}`);
      console.error('   Please run Phase 1 first: pnpm tsx scripts/qa-recipe-structure.ts');
      process.exit(1);
    }
  }

  // Load all available reports
  const structureReport = JSON.parse(
    fs.readFileSync(path.join(tmpDir, 'qa-structure-report.json'), 'utf-8')
  );

  let extractionReport = null;
  if (fs.existsSync(path.join(tmpDir, 'qa-ingredient-extraction-report.json'))) {
    extractionReport = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'qa-ingredient-extraction-report.json'), 'utf-8')
    );
  }

  let derivationReport = null;
  if (fs.existsSync(path.join(tmpDir, 'qa-derived-ingredients.json'))) {
    derivationReport = JSON.parse(
      fs.readFileSync(path.join(tmpDir, 'qa-derived-ingredients.json'), 'utf-8')
    );
  }

  let fixesLog = null;
  if (fs.existsSync(path.join(tmpDir, 'qa-apply-fixes-log.json'))) {
    fixesLog = JSON.parse(fs.readFileSync(path.join(tmpDir, 'qa-apply-fixes-log.json'), 'utf-8'));
  }

  // Build comprehensive report
  const fullReport: FullReport = {
    qa_run_date: new Date().toISOString(),
    total_recipes: structureReport.total_recipes,
    statistics: {
      validated: structureReport.summary.recipes_ok,
      fixed_automatically: fixesLog ? fixesLog.applied_fixes : 0,
      needs_manual_review:
        structureReport.summary.recipes_flagged - (fixesLog ? fixesLog.applied_fixes : 0),
      critical_issues: structureReport.summary.by_severity.critical,
    },
    by_issue_type: {
      missing_ingredients: structureReport.critical_issues.missing_ingredients.length,
      missing_instructions: structureReport.critical_issues.missing_instructions.length,
      ingredient_mismatch: extractionReport ? extractionReport.statistics.low_matches : 0,
      malformed_json: structureReport.critical_issues.malformed_json.length,
      empty_strings:
        structureReport.warnings.empty_strings_in_ingredients.length +
        structureReport.warnings.empty_strings_in_instructions.length,
    },
    by_confidence: {
      high_0_90_plus: derivationReport ? derivationReport.statistics.high_confidence : 0,
      medium_0_70_to_0_90: derivationReport ? derivationReport.statistics.medium_confidence : 0,
      low_below_0_70: derivationReport ? derivationReport.statistics.low_confidence : 0,
    },
    phase_results: {
      phase_1_structure: structureReport,
      phase_2_extraction: extractionReport,
      phase_3_derivation: derivationReport,
      phase_4_fixes_applied: fixesLog,
    },
  };

  // Generate Executive Summary (text)
  const summaryLines: string[] = [];
  summaryLines.push('═'.repeat(70));
  summaryLines.push('RECIPE QA VALIDATION - EXECUTIVE SUMMARY');
  summaryLines.push('═'.repeat(70));
  summaryLines.push('');
  summaryLines.push(`Generated: ${new Date().toLocaleString()}`);
  summaryLines.push(`Total Recipes Analyzed: ${formatNumber(fullReport.total_recipes)}`);
  summaryLines.push('');
  summaryLines.push('─'.repeat(70));
  summaryLines.push('OVERALL STATISTICS');
  summaryLines.push('─'.repeat(70));
  summaryLines.push(
    `✅ Validated (No Issues):        ${formatNumber(fullReport.statistics.validated)} (${formatPercentage(fullReport.statistics.validated, fullReport.total_recipes)})`
  );
  summaryLines.push(
    `🔧 Fixed Automatically:          ${formatNumber(fullReport.statistics.fixed_automatically)} (${formatPercentage(fullReport.statistics.fixed_automatically, fullReport.total_recipes)})`
  );
  summaryLines.push(
    `⚠️  Needs Manual Review:          ${formatNumber(fullReport.statistics.needs_manual_review)} (${formatPercentage(fullReport.statistics.needs_manual_review, fullReport.total_recipes)})`
  );
  summaryLines.push(
    `🔴 Critical Issues:              ${formatNumber(fullReport.statistics.critical_issues)}`
  );
  summaryLines.push('');
  summaryLines.push('─'.repeat(70));
  summaryLines.push('ISSUES BY TYPE');
  summaryLines.push('─'.repeat(70));
  summaryLines.push(
    `Missing Ingredients:             ${formatNumber(fullReport.by_issue_type.missing_ingredients)}`
  );
  summaryLines.push(
    `Missing Instructions:            ${formatNumber(fullReport.by_issue_type.missing_instructions)}`
  );
  summaryLines.push(
    `Ingredient Mismatch:             ${formatNumber(fullReport.by_issue_type.ingredient_mismatch)}`
  );
  summaryLines.push(
    `Malformed JSON:                  ${formatNumber(fullReport.by_issue_type.malformed_json)}`
  );
  summaryLines.push(
    `Empty Strings in Arrays:         ${formatNumber(fullReport.by_issue_type.empty_strings)}`
  );
  summaryLines.push('');

  if (derivationReport) {
    summaryLines.push('─'.repeat(70));
    summaryLines.push('AUTOMATED DERIVATION CONFIDENCE');
    summaryLines.push('─'.repeat(70));
    summaryLines.push(
      `🟢 High Confidence (≥0.90):     ${formatNumber(fullReport.by_confidence.high_0_90_plus)}`
    );
    summaryLines.push(
      `🟡 Medium Confidence (0.70-0.89): ${formatNumber(fullReport.by_confidence.medium_0_70_to_0_90)}`
    );
    summaryLines.push(
      `🔴 Low Confidence (<0.70):       ${formatNumber(fullReport.by_confidence.low_below_0_70)}`
    );
    summaryLines.push('');
  }

  if (extractionReport) {
    summaryLines.push('─'.repeat(70));
    summaryLines.push('INGREDIENT EXTRACTION ANALYSIS (Phase 2)');
    summaryLines.push('─'.repeat(70));
    summaryLines.push(
      `Perfect Matches (100%):          ${formatNumber(extractionReport.statistics.perfect_matches)}`
    );
    summaryLines.push(
      `High Matches (≥80%):             ${formatNumber(extractionReport.statistics.high_matches)}`
    );
    summaryLines.push(
      `Medium Matches (≥60%):           ${formatNumber(extractionReport.statistics.medium_matches)}`
    );
    summaryLines.push(
      `Low Matches (<60%):              ${formatNumber(extractionReport.statistics.low_matches)}`
    );
    summaryLines.push(
      `Extraction Errors:               ${formatNumber(extractionReport.statistics.extraction_errors)}`
    );
    summaryLines.push('');
  }

  if (fixesLog) {
    summaryLines.push('─'.repeat(70));
    summaryLines.push('FIXES APPLIED (Phase 4)');
    summaryLines.push('─'.repeat(70));
    summaryLines.push(`Mode:                            ${fixesLog.mode.toUpperCase()}`);
    summaryLines.push(`Total Fixes:                     ${formatNumber(fixesLog.total_fixes)}`);
    summaryLines.push(`Applied Successfully:            ${formatNumber(fixesLog.applied_fixes)}`);
    summaryLines.push(`Skipped:                         ${formatNumber(fixesLog.skipped_fixes)}`);
    summaryLines.push(`Errors:                          ${formatNumber(fixesLog.errors)}`);
    summaryLines.push(`Backup Created:                  ${fixesLog.backup_created ? 'Yes' : 'No'}`);
    if (fixesLog.backup_path) {
      summaryLines.push(`Backup Location:                 ${fixesLog.backup_path}`);
    }
    summaryLines.push('');
  }

  summaryLines.push('═'.repeat(70));
  summaryLines.push('RECOMMENDATIONS');
  summaryLines.push('═'.repeat(70));

  if (fullReport.statistics.needs_manual_review > 0) {
    summaryLines.push(
      `\n⚠️  ${formatNumber(fullReport.statistics.needs_manual_review)} recipes require manual review.`
    );
    summaryLines.push('   See tmp/qa-manual-review.csv for detailed list.');
  }

  if (fullReport.by_issue_type.missing_instructions > 0) {
    summaryLines.push(
      `\n🔴 ${formatNumber(fullReport.by_issue_type.missing_instructions)} recipes have missing instructions.`
    );
    summaryLines.push('   These require manual intervention - cannot be auto-fixed.');
  }

  if (fullReport.by_issue_type.malformed_json > 0) {
    summaryLines.push(
      `\n🔴 ${formatNumber(fullReport.by_issue_type.malformed_json)} recipes have malformed JSON.`
    );
    summaryLines.push('   These require manual database repair.');
  }

  if (derivationReport && derivationReport.statistics.high_confidence > 0 && !fixesLog) {
    summaryLines.push(
      `\n💡 ${formatNumber(derivationReport.statistics.high_confidence)} high-confidence fixes available.`
    );
    summaryLines.push('   Run: pnpm tsx scripts/qa-apply-fixes.ts --apply');
  }

  summaryLines.push(`\n${'═'.repeat(70)}`);
  summaryLines.push('END OF REPORT');
  summaryLines.push('═'.repeat(70));

  const summaryText = summaryLines.join('\n');

  // Save executive summary
  const summaryPath = path.join(tmpDir, 'qa-executive-summary.txt');
  fs.writeFileSync(summaryPath, summaryText);

  // Save full JSON report
  const fullReportPath = path.join(tmpDir, 'qa-full-report.json');
  fs.writeFileSync(fullReportPath, JSON.stringify(fullReport, null, 2));

  // Generate CSV for manual review
  const manualReviewRows: ManualReviewRow[] = [];

  // Add all issues from structure report
  for (const issue of structureReport.all_issues) {
    manualReviewRows.push({
      recipe_id: issue.recipe_id,
      recipe_name: issue.recipe_name,
      issue_type: issue.issue_type,
      severity: issue.severity,
      confidence: 'N/A',
      status: 'needs_review',
      notes: issue.details,
    });
  }

  // Add low-confidence derivations if available
  if (derivationReport) {
    const lowConfResults = derivationReport.all_results.filter(
      (r: any) => r.confidence < 0.9 && r.confidence > 0
    );
    for (const result of lowConfResults) {
      manualReviewRows.push({
        recipe_id: result.recipe_id,
        recipe_name: result.recipe_name,
        issue_type: 'low_confidence_derivation',
        severity: 'medium',
        confidence: result.confidence.toFixed(2),
        status: 'needs_review',
        notes: result.validation_notes.join('; '),
      });
    }
  }

  // Create CSV
  const csvLines: string[] = [];
  csvLines.push('Recipe ID,Recipe Name,Issue Type,Severity,Confidence,Status,Notes');

  for (const row of manualReviewRows) {
    const escapeCsv = (str: string) => `"${str.replace(/"/g, '""')}"`;
    csvLines.push(
      [
        row.recipe_id,
        escapeCsv(row.recipe_name),
        row.issue_type,
        row.severity,
        row.confidence,
        row.status,
        escapeCsv(row.notes),
      ].join(',')
    );
  }

  const csvText = csvLines.join('\n');
  const csvPath = path.join(tmpDir, 'qa-manual-review.csv');
  fs.writeFileSync(csvPath, csvText);

  // Print summary to console
  console.log(summaryText);
  console.log(`\n\n📁 Reports Generated:`);
  console.log(`   Executive Summary: ${summaryPath}`);
  console.log(`   Full JSON Report:  ${fullReportPath}`);
  console.log(`   Manual Review CSV: ${csvPath}`);
  console.log('\n✅ Report generation complete\n');

  return fullReport;
}

// Run report generation
generateReport()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error during report generation:', error);
    process.exit(1);
  });
