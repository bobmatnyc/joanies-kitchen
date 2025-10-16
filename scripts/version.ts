#!/usr/bin/env tsx
/**
 * Version Management Script for Joanie's Kitchen
 *
 * Handles semantic versioning, build tracking, changelog generation,
 * and git integration with conventional commits support.
 *
 * Usage:
 *   pnpm version:patch              # Bump patch version
 *   pnpm version:minor              # Bump minor version
 *   pnpm version:major              # Bump major version
 *   pnpm version:current            # Show current version
 *   pnpm version:auto               # Auto-detect from commits
 *   tsx scripts/version.ts build    # Increment build number
 *
 * Flags:
 *   --commit    Create git commit for version bump
 *   --tag       Create git tag for version
 *   --push      Push commit and tag to remote
 *   --dry-run   Show what would happen without making changes
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Types
interface BuildInfo {
  version: string;
  build: number;
  timestamp: string;
  commit: string;
  branch: string;
  environment: string;
}

interface BuildHistoryEntry {
  version: string;
  build: number;
  timestamp: string;
  commit: string;
  branch: string;
  environment: string;
}

interface ConventionalCommit {
  type: 'feat' | 'fix' | 'docs' | 'style' | 'refactor' | 'test' | 'chore' | 'perf';
  breaking: boolean;
  scope?: string;
  subject: string;
  body?: string;
  hash: string;
}

// Constants
const PROJECT_ROOT = process.cwd();
const PACKAGE_JSON_PATH = join(PROJECT_ROOT, 'package.json');
const BUILD_INFO_PATH = join(PROJECT_ROOT, 'build-info.json');
const BUILD_NUMBER_PATH = join(PROJECT_ROOT, '.build-number');
const BUILD_HISTORY_PATH = join(PROJECT_ROOT, 'build-history.json');
const CHANGELOG_PATH = join(PROJECT_ROOT, 'CHANGELOG.md');
const VERSION_MODULE_PATH = join(PROJECT_ROOT, 'src/lib/version.ts');

// CLI Arguments
const args = process.argv.slice(2);
const command = args[0];
const flags = {
  commit: args.includes('--commit'),
  tag: args.includes('--tag'),
  push: args.includes('--push'),
  dryRun: args.includes('--dry-run'),
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

// Utility Functions
function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message: string) {
  log(`✗ ${message}`, colors.red);
}

function success(message: string) {
  log(`✓ ${message}`, colors.green);
}

function info(message: string) {
  log(`ℹ ${message}`, colors.blue);
}

function exec(command: string, options = {}): string {
  try {
    return execSync(command, { encoding: 'utf-8', ...options }).trim();
  } catch (e) {
    return '';
  }
}

function isGitRepository(): boolean {
  return exec('git rev-parse --is-inside-work-tree') === 'true';
}

function hasUncommittedChanges(): boolean {
  return exec('git status --porcelain').length > 0;
}

function getCurrentBranch(): string {
  return exec('git rev-parse --abbrev-ref HEAD') || 'unknown';
}

function getCurrentCommit(): string {
  return exec('git rev-parse --short HEAD') || 'unknown';
}

function getLastGitTag(): string {
  return exec('git describe --tags --abbrev=0 2>/dev/null') || '';
}

// Version Management
function readPackageJson() {
  const content = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
  return JSON.parse(content);
}

function writePackageJson(pkg: any) {
  writeFileSync(PACKAGE_JSON_PATH, JSON.stringify(pkg, null, 2) + '\n');
}

function parseVersion(version: string): [number, number, number] {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function formatVersion(major: number, minor: number, patch: number): string {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(version: string, type: 'major' | 'minor' | 'patch'): string {
  const [major, minor, patch] = parseVersion(version);

  switch (type) {
    case 'major':
      return formatVersion(major + 1, 0, 0);
    case 'minor':
      return formatVersion(major, minor + 1, 0);
    case 'patch':
      return formatVersion(major, minor, patch + 1);
    default:
      throw new Error(`Invalid bump type: ${type}`);
  }
}

function validateVersion(oldVersion: string, newVersion: string): boolean {
  const [oldMajor, oldMinor, oldPatch] = parseVersion(oldVersion);
  const [newMajor, newMinor, newPatch] = parseVersion(newVersion);

  // Check if version is being downgraded
  if (newMajor < oldMajor) return false;
  if (newMajor === oldMajor && newMinor < oldMinor) return false;
  if (newMajor === oldMajor && newMinor === oldMinor && newPatch <= oldPatch) return false;

  return true;
}

// Build Number Management
function readBuildNumber(): number {
  if (!existsSync(BUILD_NUMBER_PATH)) {
    return 0;
  }
  const content = readFileSync(BUILD_NUMBER_PATH, 'utf-8').trim();
  return parseInt(content) || 0;
}

function writeBuildNumber(buildNumber: number) {
  writeFileSync(BUILD_NUMBER_PATH, buildNumber.toString());
}

function incrementBuildNumber(): number {
  const currentBuild = readBuildNumber();
  const newBuild = currentBuild + 1;
  writeBuildNumber(newBuild);
  return newBuild;
}

// Build Info Management
function readBuildInfo(): BuildInfo | null {
  if (!existsSync(BUILD_INFO_PATH)) {
    return null;
  }
  const content = readFileSync(BUILD_INFO_PATH, 'utf-8');
  return JSON.parse(content);
}

function writeBuildInfo(buildInfo: BuildInfo) {
  writeFileSync(BUILD_INFO_PATH, JSON.stringify(buildInfo, null, 2) + '\n');
}

function createBuildInfo(version: string, buildNumber: number, environment = 'development'): BuildInfo {
  return {
    version,
    build: buildNumber,
    timestamp: new Date().toISOString(),
    commit: getCurrentCommit(),
    branch: getCurrentBranch(),
    environment,
  };
}

// Build History Management
function readBuildHistory(): BuildHistoryEntry[] {
  if (!existsSync(BUILD_HISTORY_PATH)) {
    return [];
  }
  const content = readFileSync(BUILD_HISTORY_PATH, 'utf-8');
  return JSON.parse(content);
}

function writeBuildHistory(history: BuildHistoryEntry[]) {
  writeFileSync(BUILD_HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
}

function addToBuildHistory(buildInfo: BuildInfo) {
  const history = readBuildHistory();
  history.push(buildInfo);

  // Keep only last 100 builds
  if (history.length > 100) {
    history.splice(0, history.length - 100);
  }

  writeBuildHistory(history);
}

// Version Module Generation
function generateVersionModule(version: string, buildNumber: number, timestamp: string) {
  const content = `/**
 * Version Information for Joanie's Kitchen
 *
 * Auto-generated by scripts/version.ts
 * DO NOT EDIT MANUALLY
 */

export const VERSION = '${version}';
export const BUILD = ${buildNumber};
export const BUILD_DATE = '${timestamp}';

export interface VersionInfo {
  version: string;
  build: number;
  buildDate: string;
}

export function getVersionInfo(): VersionInfo {
  return {
    version: VERSION,
    build: BUILD,
    buildDate: BUILD_DATE,
  };
}

export function getVersionString(): string {
  return \`v\${VERSION} (build \${BUILD})\`;
}

export function getShortVersion(): string {
  return VERSION;
}
`;

  writeFileSync(VERSION_MODULE_PATH, content);
}

// Conventional Commits Parsing
function parseConventionalCommit(message: string, hash: string): ConventionalCommit | null {
  // Pattern: type(scope)?: subject
  const pattern = /^(feat|fix|docs|style|refactor|test|chore|perf)(\([^)]+\))?(!)?:\s*(.+)$/;
  const match = message.match(pattern);

  if (!match) {
    return null;
  }

  const [, type, scopeMatch, breaking, subject] = match;
  const scope = scopeMatch ? scopeMatch.slice(1, -1) : undefined;

  return {
    type: type as ConventionalCommit['type'],
    breaking: breaking === '!' || message.includes('BREAKING CHANGE:'),
    scope,
    subject,
    hash,
  };
}

function getCommitsSinceTag(tag: string): ConventionalCommit[] {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const log = exec(`git log ${range} --format='%H|||%s'`);

  if (!log) {
    return [];
  }

  const commits: ConventionalCommit[] = [];
  const lines = log.split('\n');

  for (const line of lines) {
    const [hash, message] = line.split('|||');
    const commit = parseConventionalCommit(message, hash);
    if (commit) {
      commits.push(commit);
    }
  }

  return commits;
}

function detectBumpType(commits: ConventionalCommit[]): 'major' | 'minor' | 'patch' | null {
  if (commits.length === 0) {
    return null;
  }

  // Check for breaking changes
  if (commits.some(c => c.breaking)) {
    return 'major';
  }

  // Check for features
  if (commits.some(c => c.type === 'feat')) {
    return 'minor';
  }

  // Check for fixes
  if (commits.some(c => c.type === 'fix')) {
    return 'patch';
  }

  // Default to patch for other changes
  return 'patch';
}

// Changelog Generation
function readChangelog(): string {
  if (!existsSync(CHANGELOG_PATH)) {
    return '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\nThe format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),\nand this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).\n\n';
  }
  return readFileSync(CHANGELOG_PATH, 'utf-8');
}

function writeChangelog(content: string) {
  writeFileSync(CHANGELOG_PATH, content);
}

function generateChangelogEntry(version: string, commits: ConventionalCommit[]): string {
  const date = new Date().toISOString().split('T')[0];
  let entry = `## [${version}] - ${date}\n\n`;

  // Group commits by type
  const groups: Record<string, ConventionalCommit[]> = {
    feat: [],
    fix: [],
    perf: [],
    refactor: [],
    docs: [],
    test: [],
    chore: [],
    style: [],
  };

  for (const commit of commits) {
    groups[commit.type].push(commit);
  }

  // Breaking changes first
  const breaking = commits.filter(c => c.breaking);
  if (breaking.length > 0) {
    entry += '### ⚠️ BREAKING CHANGES\n\n';
    for (const commit of breaking) {
      const scope = commit.scope ? `**${commit.scope}**: ` : '';
      entry += `- ${scope}${commit.subject}\n`;
    }
    entry += '\n';
  }

  // Features
  if (groups.feat.length > 0) {
    entry += '### Added\n\n';
    for (const commit of groups.feat) {
      if (!commit.breaking) {
        const scope = commit.scope ? `**${commit.scope}**: ` : '';
        entry += `- ${scope}${commit.subject}\n`;
      }
    }
    entry += '\n';
  }

  // Fixes
  if (groups.fix.length > 0) {
    entry += '### Fixed\n\n';
    for (const commit of groups.fix) {
      const scope = commit.scope ? `**${commit.scope}**: ` : '';
      entry += `- ${scope}${commit.subject}\n`;
    }
    entry += '\n';
  }

  // Performance
  if (groups.perf.length > 0) {
    entry += '### Performance\n\n';
    for (const commit of groups.perf) {
      const scope = commit.scope ? `**${commit.scope}**: ` : '';
      entry += `- ${scope}${commit.subject}\n`;
    }
    entry += '\n';
  }

  // Refactoring
  if (groups.refactor.length > 0) {
    entry += '### Changed\n\n';
    for (const commit of groups.refactor) {
      const scope = commit.scope ? `**${commit.scope}**: ` : '';
      entry += `- ${scope}${commit.subject}\n`;
    }
    entry += '\n';
  }

  return entry;
}

function updateChangelog(version: string, commits: ConventionalCommit[]) {
  const changelog = readChangelog();
  const entry = generateChangelogEntry(version, commits);

  // Insert after the header (after first ## or at the end of header section)
  const lines = changelog.split('\n');
  let insertIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      insertIndex = i;
      break;
    }
  }

  if (insertIndex === 0) {
    // No existing entries, add after header
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim() === '') {
        insertIndex = i + 1;
        break;
      }
    }
  }

  lines.splice(insertIndex, 0, entry);
  writeChangelog(lines.join('\n'));
}

// Git Operations
function createGitCommit(version: string) {
  if (hasUncommittedChanges()) {
    info('Staging version files...');
    exec('git add package.json build-info.json src/lib/version.ts CHANGELOG.md');
  }

  const message = `chore: bump version to ${version}`;
  exec(`git commit -m "${message}"`);
  success(`Created commit: ${message}`);
}

function createGitTag(version: string) {
  const tag = `v${version}`;
  const message = `Release ${version}`;
  exec(`git tag -a ${tag} -m "${message}"`);
  success(`Created tag: ${tag}`);
}

function pushToRemote() {
  info('Pushing to remote...');
  exec('git push');
  exec('git push --tags');
  success('Pushed commits and tags to remote');
}

// Main Commands
function showCurrentVersion() {
  const pkg = readPackageJson();
  const buildNumber = readBuildNumber();
  const buildInfo = readBuildInfo();

  log('\n' + colors.bright + 'Current Version Information' + colors.reset);
  log('─'.repeat(50));
  log(`Version:        ${colors.cyan}${pkg.version}${colors.reset}`);
  log(`Build:          ${colors.cyan}${buildNumber}${colors.reset}`);

  if (buildInfo) {
    log(`Last Build:     ${colors.cyan}${buildInfo.timestamp}${colors.reset}`);
    log(`Commit:         ${colors.cyan}${buildInfo.commit}${colors.reset}`);
    log(`Branch:         ${colors.cyan}${buildInfo.branch}${colors.reset}`);
    log(`Environment:    ${colors.cyan}${buildInfo.environment}${colors.reset}`);
  }

  if (isGitRepository()) {
    const lastTag = getLastGitTag();
    if (lastTag) {
      log(`Last Git Tag:   ${colors.cyan}${lastTag}${colors.reset}`);
      const commits = getCommitsSinceTag(lastTag);
      log(`Commits since:  ${colors.cyan}${commits.length}${colors.reset}`);

      if (commits.length > 0) {
        const suggestedBump = detectBumpType(commits);
        if (suggestedBump) {
          const currentVersion = pkg.version;
          const suggestedVersion = bumpVersion(currentVersion, suggestedBump);
          log(`Suggested bump: ${colors.yellow}${suggestedBump} → ${suggestedVersion}${colors.reset}`);
        }
      }
    }
  }

  log('─'.repeat(50) + '\n');
}

function performVersionBump(type: 'major' | 'minor' | 'patch') {
  const pkg = readPackageJson();
  const currentVersion = pkg.version;
  const newVersion = bumpVersion(currentVersion, type);

  if (!validateVersion(currentVersion, newVersion)) {
    error(`Cannot downgrade version from ${currentVersion} to ${newVersion}`);
    process.exit(1);
  }

  log('\n' + colors.bright + 'Version Bump' + colors.reset);
  log('─'.repeat(50));
  log(`Current:  ${colors.cyan}${currentVersion}${colors.reset}`);
  log(`New:      ${colors.green}${newVersion}${colors.reset}`);
  log(`Type:     ${colors.yellow}${type}${colors.reset}`);

  if (flags.dryRun) {
    log('\n' + colors.yellow + '🏃 DRY RUN MODE - No changes will be made' + colors.reset);
    return;
  }

  // Check for uncommitted changes if git operations requested
  if (isGitRepository() && (flags.commit || flags.tag) && hasUncommittedChanges()) {
    error('You have uncommitted changes. Commit or stash them first.');
    process.exit(1);
  }

  log('\n' + colors.bright + 'Updating files...' + colors.reset);

  // Update package.json
  pkg.version = newVersion;
  writePackageJson(pkg);
  success('Updated package.json');

  // Get build number and increment it
  const buildNumber = incrementBuildNumber();
  success(`Incremented build number to ${buildNumber}`);

  // Create build info
  const buildInfo = createBuildInfo(newVersion, buildNumber, 'production');
  writeBuildInfo(buildInfo);
  addToBuildHistory(buildInfo);
  success('Updated build-info.json');

  // Generate version module
  generateVersionModule(newVersion, buildNumber, buildInfo.timestamp);
  success('Generated src/lib/version.ts');

  // Update changelog if git repo
  if (isGitRepository()) {
    const lastTag = getLastGitTag();
    const commits = getCommitsSinceTag(lastTag);

    if (commits.length > 0) {
      updateChangelog(newVersion, commits);
      success(`Updated CHANGELOG.md (${commits.length} commits)`);
    } else {
      info('No conventional commits found, skipping changelog update');
    }
  }

  // Git operations
  if (flags.commit) {
    createGitCommit(newVersion);
  }

  if (flags.tag) {
    createGitTag(newVersion);
  }

  if (flags.push) {
    if (!flags.commit && !flags.tag) {
      error('Cannot push without --commit or --tag');
      process.exit(1);
    }
    pushToRemote();
  }

  log('\n' + colors.green + '✓ Version bump complete!' + colors.reset);
  log('─'.repeat(50) + '\n');
}

function performBuild() {
  const pkg = readPackageJson();
  const version = pkg.version;
  const buildNumber = incrementBuildNumber();
  const environment = process.env.NODE_ENV || 'development';

  log('\n' + colors.bright + 'Build Tracking' + colors.reset);
  log('─'.repeat(50));
  log(`Version:      ${colors.cyan}${version}${colors.reset}`);
  log(`Build:        ${colors.cyan}${buildNumber}${colors.reset}`);
  log(`Environment:  ${colors.cyan}${environment}${colors.reset}`);

  if (flags.dryRun) {
    log('\n' + colors.yellow + '🏃 DRY RUN MODE - No changes will be made' + colors.reset);
    return;
  }

  const buildInfo = createBuildInfo(version, buildNumber, environment);
  writeBuildInfo(buildInfo);
  addToBuildHistory(buildInfo);
  generateVersionModule(version, buildNumber, buildInfo.timestamp);

  log('─'.repeat(50));
  success('Build tracking updated\n');
}

function performAutoBump() {
  if (!isGitRepository()) {
    error('Not a git repository. Auto-bump requires git.');
    process.exit(1);
  }

  const lastTag = getLastGitTag();
  const commits = getCommitsSinceTag(lastTag);

  if (commits.length === 0) {
    info('No commits since last tag. Nothing to bump.');
    return;
  }

  const bumpType = detectBumpType(commits);

  if (!bumpType) {
    error('Could not detect bump type from commits');
    process.exit(1);
  }

  log('\n' + colors.bright + 'Auto-detected Version Bump' + colors.reset);
  log('─'.repeat(50));
  log(`Analyzed:   ${colors.cyan}${commits.length} commits${colors.reset}`);
  log(`Detected:   ${colors.yellow}${bumpType}${colors.reset}`);
  log('─'.repeat(50) + '\n');

  performVersionBump(bumpType);
}

// Main Entry Point
function main() {
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    log('\n' + colors.bright + 'Joanie\'s Kitchen Version Management' + colors.reset);
    log('─'.repeat(50));
    log('\nUsage:');
    log('  pnpm version:current           Show current version');
    log('  pnpm version:patch             Bump patch version');
    log('  pnpm version:minor             Bump minor version');
    log('  pnpm version:major             Bump major version');
    log('  pnpm version:auto              Auto-detect bump from commits');
    log('  tsx scripts/version.ts build   Track build');
    log('\nFlags:');
    log('  --commit    Create git commit');
    log('  --tag       Create git tag');
    log('  --push      Push to remote');
    log('  --dry-run   Preview changes\n');
    return;
  }

  switch (command) {
    case 'current':
    case 'show':
      showCurrentVersion();
      break;

    case 'patch':
      performVersionBump('patch');
      break;

    case 'minor':
      performVersionBump('minor');
      break;

    case 'major':
      performVersionBump('major');
      break;

    case 'auto':
      performAutoBump();
      break;

    case 'build':
      performBuild();
      break;

    default:
      error(`Unknown command: ${command}`);
      log('Run "tsx scripts/version.ts help" for usage information');
      process.exit(1);
  }
}

// Run
main();
