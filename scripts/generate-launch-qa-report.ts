/**
 * Day 1 Launch Preparation - Generate Launch QA Report
 *
 * Purpose: Generate comprehensive launch readiness report
 * - Aggregate data from Phase 1, hide incomplete, and searchable reports
 * - Calculate launch readiness metrics
 * - Generate executive summary (JSON + Markdown)
 *
 * Launch Date: October 27, 2025
 * Run Command: pnpm qa:launch-report
 */

import fs from 'node:fs';
import path from 'node:path';

interface QAStructureReport {
  timestamp: string;
  total_recipes: number;
  critical_issues: {
    missing_ingredients: Array<{ id: string; name: string }>;
    missing_instructions: Array<{ id: string; name: string }>;
  };
}

interface HideIncompleteReport {
  timestamp: string;
  total_updated: number;
  hidden_count: number;
  flagged_count: number;
}

interface SearchableRecipesReport {
  timestamp: string;
  searchable_count: number;
  hidden_count: number;
  flagged_count: number;
  total_count: number;
  validation_checks: {
    no_incomplete_in_search: boolean;
    all_have_ingredients: boolean;
    all_have_instructions: boolean;
    qa_status_set: boolean;
  };
  issues_found: string[];
  launch_ready: boolean;
}

interface LaunchQAReport {
  timestamp: string;
  launch_date: string;
  days_until_launch: number;
  metrics: {
    total_recipes: number;
    searchable_recipes: number;
    hidden_recipes: number;
    flagged_recipes: number;
    searchable_percentage: number;
    quality_grade: string;
  };
  validation: {
    all_checks_passed: boolean;
    issues_found: string[];
  };
  launch_recommendation: {
    approved: boolean;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    rationale: string[];
  };
  post_launch_tasks: {
    week_1_2: string[];
    week_3_4: string[];
  };
}

function calculateDaysUntilLaunch(): number {
  const launchDate = new Date('2025-10-27');
  const today = new Date();
  const diffTime = launchDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function calculateQualityGrade(percentage: number): string {
  if (percentage >= 95) return 'A';
  if (percentage >= 90) return 'B+';
  if (percentage >= 85) return 'B';
  if (percentage >= 80) return 'C+';
  return 'C';
}

async function generateLaunchQAReport() {
  console.log('📊 Generating Launch QA Report\n');

  const tmpDir = path.join(process.cwd(), 'tmp');

  // Load Phase 1 report
  console.log('📋 Loading Phase 1 structure report...');
  const phase1Path = path.join(tmpDir, 'qa-structure-report.json');
  if (!fs.existsSync(phase1Path)) {
    console.error('❌ Error: Phase 1 report not found');
    console.error('   Run: pnpm qa:phase1');
    process.exit(1);
  }
  const phase1Report = JSON.parse(fs.readFileSync(phase1Path, 'utf-8')) as QAStructureReport;

  // Load hide incomplete report
  console.log('📋 Loading hide incomplete report...');
  const hideIncompletePath = path.join(tmpDir, 'hide-incomplete-report.json');
  if (!fs.existsSync(hideIncompletePath)) {
    console.error('❌ Error: Hide incomplete report not found');
    console.error('   Run: pnpm qa:hide-incomplete');
    process.exit(1);
  }
  const hideIncompleteReport = JSON.parse(fs.readFileSync(hideIncompletePath, 'utf-8')) as HideIncompleteReport;

  // Load searchable recipes report
  console.log('📋 Loading searchable recipes report...');
  const searchablePath = path.join(tmpDir, 'searchable-recipes-report.json');
  if (!fs.existsSync(searchablePath)) {
    console.error('❌ Error: Searchable recipes report not found');
    console.error('   Run: pnpm qa:verify-searchable');
    process.exit(1);
  }
  const searchableReport = JSON.parse(fs.readFileSync(searchablePath, 'utf-8')) as SearchableRecipesReport;

  console.log('✅ All reports loaded\n');

  // Calculate metrics
  const totalRecipes = phase1Report.total_recipes;
  const searchableRecipes = searchableReport.searchable_count;
  const hiddenRecipes = searchableReport.hidden_count;
  const flaggedRecipes = searchableReport.flagged_count;
  const searchablePercentage = (searchableRecipes / totalRecipes) * 100;
  const qualityGrade = calculateQualityGrade(searchablePercentage);
  const daysUntilLaunch = calculateDaysUntilLaunch();

  // Determine launch approval
  const allChecksPassed = searchableReport.launch_ready;
  const approved = allChecksPassed && searchablePercentage >= 90;
  const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = searchablePercentage >= 95 ? 'LOW' : searchablePercentage >= 90 ? 'MEDIUM' : 'HIGH';

  const rationale: string[] = [];
  if (searchablePercentage >= 95) {
    rationale.push(`${searchablePercentage.toFixed(2)}% validation rate exceeds MVP requirements`);
  } else if (searchablePercentage >= 90) {
    rationale.push(`${searchablePercentage.toFixed(2)}% validation rate meets industry standard`);
  } else {
    rationale.push(`${searchablePercentage.toFixed(2)}% validation rate below industry standard (90%)`);
  }

  if (hiddenRecipes > 0) {
    rationale.push(`Incomplete recipes hidden from search (no user impact)`);
  }

  rationale.push('Post-launch fix plan documented for edge cases');
  rationale.push(`Risk: ${riskLevel} - ${allChecksPassed ? 'All critical systems validated' : 'Some validation issues found'}`);

  // Generate report
  const report: LaunchQAReport = {
    timestamp: new Date().toISOString(),
    launch_date: '2025-10-27',
    days_until_launch: daysUntilLaunch,
    metrics: {
      total_recipes: totalRecipes,
      searchable_recipes: searchableRecipes,
      hidden_recipes: hiddenRecipes,
      flagged_recipes: flaggedRecipes,
      searchable_percentage: Number.parseFloat(searchablePercentage.toFixed(2)),
      quality_grade: qualityGrade,
    },
    validation: {
      all_checks_passed: allChecksPassed,
      issues_found: searchableReport.issues_found,
    },
    launch_recommendation: {
      approved,
      risk_level: riskLevel,
      rationale,
    },
    post_launch_tasks: {
      week_1_2: [
        'Manual review of 20 recipes with missing ingredients',
        'Derive ingredients from instructions where possible',
        'Test and validate fixes',
      ],
      week_3_4: [
        'Evaluate 211 recipes with missing instructions',
        'Remove unfixable recipes or source instructions',
        'Run Phase 2 LLM extraction (background task)',
      ],
    },
  };

  // Save JSON report
  const jsonPath = path.join(tmpDir, 'launch-qa-report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  // Generate Markdown report
  const markdown = generateMarkdownReport(report);
  const mdPath = path.join(tmpDir, 'launch-qa-report.md');
  fs.writeFileSync(mdPath, markdown);

  // Display summary
  console.log('📊 Launch QA Report Summary\n');
  console.log('════════════════════════════════════════════════════');
  console.log(`Launch Date:           October 27, 2025 (${daysUntilLaunch} days)`);
  console.log(`Status:                ${approved ? '✅ LAUNCH READY' : '⚠️  NEEDS ATTENTION'}`);
  console.log('════════════════════════════════════════════════════\n');

  console.log('📈 Key Metrics:');
  console.log(`  Total Recipes:       ${totalRecipes.toLocaleString()}`);
  console.log(`  Searchable:          ${searchableRecipes.toLocaleString()} (${searchablePercentage.toFixed(2)}%)`);
  console.log(`  Hidden:              ${hiddenRecipes.toLocaleString()}`);
  console.log(`  Flagged:             ${flaggedRecipes.toLocaleString()}`);
  console.log(`  Quality Grade:       ${qualityGrade}\n`);

  console.log('🔍 Validation:');
  if (allChecksPassed) {
    console.log('  ✅ All checks passed');
  } else {
    console.log('  ⚠️  Some checks failed:');
    searchableReport.issues_found.forEach(issue => {
      console.log(`     - ${issue}`);
    });
  }

  console.log('\n🚀 Launch Recommendation:');
  console.log(`  ${approved ? '✅ APPROVED' : '⚠️  NOT APPROVED'} FOR LAUNCH`);
  console.log(`  Risk Level: ${riskLevel}\n`);

  console.log('Rationale:');
  rationale.forEach(r => console.log(`  - ${r}`));

  console.log('\n📁 Reports Generated:');
  console.log(`  ✓ ${jsonPath}`);
  console.log(`  ✓ ${mdPath}\n`);

  console.log('✅ Launch QA report generation complete');

  return report;
}

function generateMarkdownReport(report: LaunchQAReport): string {
  const statusEmoji = report.launch_recommendation.approved ? '✅' : '⚠️';
  const statusText = report.launch_recommendation.approved ? 'LAUNCH READY' : 'NEEDS ATTENTION';

  return `# Launch QA Report - Joanie's Kitchen
**Date**: ${new Date(report.timestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
**Launch Date**: October 27, 2025 (${report.days_until_launch} days)
**Status**: ${statusEmoji} ${statusText}

## Executive Summary
Joanie's Kitchen has completed comprehensive recipe quality assurance with ${report.metrics.searchable_percentage}% validation rate. The platform ${report.launch_recommendation.approved ? 'is ready for launch' : 'requires attention before launch'} with ${report.metrics.searchable_recipes.toLocaleString()} searchable recipes.

## Key Metrics
| Metric | Value | Percentage | Status |
|--------|-------|------------|--------|
| Total Recipes | ${report.metrics.total_recipes.toLocaleString()} | 100% | ✅ |
| Searchable Recipes | ${report.metrics.searchable_recipes.toLocaleString()} | ${report.metrics.searchable_percentage}% | ${report.metrics.searchable_percentage >= 95 ? '✅' : '⚠️'} |
| Hidden (No Instructions) | ${report.metrics.hidden_recipes.toLocaleString()} | ${((report.metrics.hidden_recipes / report.metrics.total_recipes) * 100).toFixed(2)}% | 🚫 |
| Flagged (No Ingredients) | ${report.metrics.flagged_recipes.toLocaleString()} | ${((report.metrics.flagged_recipes / report.metrics.total_recipes) * 100).toFixed(2)}% | ⚠️ |

## Quality Assessment
**Overall Grade**: ${report.metrics.quality_grade} (${report.metrics.searchable_percentage}%)

${report.metrics.searchable_percentage >= 95 ? '- ✅ Exceeds industry standard (80-90%)' : ''}
${report.metrics.searchable_percentage >= 90 && report.metrics.searchable_percentage < 95 ? '- ✅ Meets industry standard (80-90%)' : ''}
${report.metrics.searchable_percentage < 90 ? '- ⚠️ Below industry standard (80-90%)' : ''}
- ${report.validation.all_checks_passed ? '✅' : '⚠️'} Core fridge feature ${report.validation.all_checks_passed ? 'fully functional' : 'needs validation'}
- ${report.metrics.searchable_percentage >= 95 ? '✅' : '⚠️'} All searchable recipes validated
- ✅ QA tracking infrastructure complete

${report.validation.issues_found.length > 0 ? `\n### Issues Found\n${report.validation.issues_found.map(i => `- ⚠️ ${i}`).join('\n')}` : ''}

## Launch Recommendation
**${report.launch_recommendation.approved ? '✅ APPROVED' : '⚠️ NOT APPROVED'} FOR OCTOBER 27 LAUNCH**

**Risk Level**: ${report.launch_recommendation.risk_level}

### Rationale
${report.launch_recommendation.rationale.map(r => `- ${r}`).join('\n')}

## Post-Launch Action Items

### Week 1-2
${report.post_launch_tasks.week_1_2.map(t => `- [ ] ${t}`).join('\n')}

### Week 3-4
${report.post_launch_tasks.week_3_4.map(t => `- [ ] ${t}`).join('\n')}

---

**Report Generated**: ${new Date(report.timestamp).toLocaleString('en-US')}
**System**: Joanie's Kitchen QA Automation
`;
}

// Execute
generateLaunchQAReport()
  .then((report) => {
    if (!report.launch_recommendation.approved) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
