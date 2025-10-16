# Versioning Guide for Joanie's Kitchen

## Overview

Joanie's Kitchen uses a comprehensive versioning system that tracks both semantic versions and build numbers. The system integrates with git, supports conventional commits, and automatically generates changelog entries.

## Quick Reference

```bash
# Show current version info
pnpm version:current

# Bump version
pnpm version:patch              # 0.4.0 → 0.4.1
pnpm version:minor              # 0.4.0 → 0.5.0
pnpm version:major              # 0.4.0 → 1.0.0

# Auto-detect bump from commits
pnpm version:auto

# Build tracking
pnpm build:production           # Increments build number + builds
pnpm build                      # Increments build number + builds

# Advanced options
pnpm version:patch --commit     # Create git commit
pnpm version:patch --tag        # Create git tag
pnpm version:patch --push       # Push to remote
pnpm version:patch --dry-run    # Preview changes
```

## Semantic Versioning

We follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features (backward compatible)
- **PATCH** (0.0.1): Bug fixes (backward compatible)

### When to Bump

| Change Type | Version | Example |
|-------------|---------|---------|
| Breaking API change | MAJOR | Removing a prop from a component |
| New feature | MINOR | Adding recipe sharing |
| Bug fix | PATCH | Fixing authentication bug |
| Documentation | PATCH | Updating README |
| Refactoring | PATCH | Code cleanup without behavior change |

## Conventional Commits

The system detects version bumps from conventional commit messages:

```bash
# Format
<type>(<scope>): <subject>

# Examples
feat: add recipe sharing              # → MINOR bump
fix: resolve auth issue               # → PATCH bump
feat!: redesign API                   # → MAJOR bump
feat: add tags BREAKING CHANGE: ...   # → MAJOR bump
```

### Commit Types

- `feat:` New feature → **MINOR** bump
- `fix:` Bug fix → **PATCH** bump
- `perf:` Performance improvement → **PATCH** bump
- `refactor:` Code refactoring → **PATCH** bump
- `docs:` Documentation → **PATCH** bump
- `test:` Tests → **PATCH** bump
- `chore:` Build/tooling → **PATCH** bump
- `style:` Formatting → **PATCH** bump

### Breaking Changes

Mark breaking changes with `!` or `BREAKING CHANGE:`:

```bash
feat!: redesign recipe API
# or
feat: redesign recipe API

BREAKING CHANGE: Recipe API now requires authentication
```

## Build Tracking

Build numbers increment on every build, independent of version:

```bash
# Increment build number (automatic on build)
pnpm build

# Manual build tracking
tsx scripts/version.ts build
```

### Build Information

Build info is tracked in three places:

1. **`build-info.json`** (committed) - Current build metadata
2. **`.build-number`** (gitignored) - Build counter
3. **`build-history.json`** (gitignored) - Last 100 builds
4. **`src/lib/version.ts`** (committed) - Version constants for app

## File Structure

```
project-root/
├── scripts/
│   └── version.ts                 # Version management script
├── src/lib/
│   └── version.ts                 # Version info (auto-generated)
├── build-info.json                # Build metadata (committed)
├── .build-number                  # Build counter (gitignored)
├── build-history.json             # Build history (gitignored)
└── CHANGELOG.md                   # Version changelog (committed)
```

## Using Version Info in Your App

```typescript
import { getVersionInfo, getVersionString } from '@/lib/version';

// Get version object
const info = getVersionInfo();
// { version: "0.4.1", build: 42, buildDate: "2025-10-16T..." }

// Get formatted string
const version = getVersionString();
// "v0.4.1 (build 42)"

// Individual values
import { VERSION, BUILD, BUILD_DATE } from '@/lib/version';
```

### Example: Version Display Component

```tsx
import { getVersionString } from '@/lib/version';

export function Footer() {
  return (
    <footer>
      <p>Joanie's Kitchen {getVersionString()}</p>
    </footer>
  );
}
```

## Workflows

### Standard Release Workflow

```bash
# 1. Check current version
pnpm version:current

# 2. Preview the bump
pnpm version:patch --dry-run

# 3. Bump version with git commit and tag
pnpm version:patch --commit --tag

# 4. Push to remote
git push && git push --tags

# 5. Build and deploy
pnpm build:production
```

### Auto-detect Workflow

```bash
# 1. Make commits following conventional commits
git commit -m "feat: add recipe collections"
git commit -m "fix: resolve image loading"

# 2. Auto-detect bump type and apply
pnpm version:auto --commit --tag

# 3. Push to remote
git push && git push --tags
```

### Quick Patch Workflow

```bash
# One command: bump, commit, tag, and push
pnpm version:patch --commit --tag --push
```

### Build-Only Workflow (CI/CD)

```bash
# Just increment build number (no version change)
pnpm build:production
```

## Changelog

The system auto-generates changelog entries from conventional commits.

### Format

```markdown
## [0.4.1] - 2025-10-16

### ⚠️ BREAKING CHANGES
- **api**: Complete API redesign

### Added
- **recipes**: Recipe sharing functionality
- **collections**: Create recipe collections

### Fixed
- **auth**: Resolve session timeout issue

### Performance
- **images**: Optimize image loading

### Changed
- **ui**: Refactor recipe card component
```

### Manual Changelog Editing

You can manually edit `CHANGELOG.md` after generation:

1. Run version bump: `pnpm version:patch`
2. Edit `CHANGELOG.md` to add context/details
3. Commit changes: `git commit --amend`

## Git Integration

### Automatic Git Operations

```bash
# Create commit only
pnpm version:patch --commit

# Create commit and tag
pnpm version:patch --commit --tag

# Create commit, tag, and push
pnpm version:patch --commit --tag --push
```

### Git Tag Format

Tags follow the format: `v<version>`

```
v0.4.0
v0.4.1
v1.0.0
```

### Commit Message Format

Version bump commits:

```
chore: bump version to 0.4.1
```

## Edge Cases

### No Git Repository

The system works without git but skips git-related features:

- No commit/tag creation
- No conventional commit parsing
- No changelog generation from commits

### No Commits Since Last Tag

```bash
$ pnpm version:auto
ℹ No commits since last tag. Nothing to bump.
```

### Uncommitted Changes

If you have uncommitted changes and use `--commit`:

```bash
$ pnpm version:patch --commit
✗ You have uncommitted changes. Commit or stash them first.
```

### Downgrade Prevention

The system prevents version downgrades:

```bash
# Current: 0.4.1
$ pnpm version:patch  # ✓ → 0.4.2
$ pnpm version:minor  # ✓ → 0.5.0
# Cannot go back to 0.4.x
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0  # Need full history for changelog

      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install

      # Auto-detect version bump from commits
      - run: pnpm version:auto --commit --tag
        env:
          GIT_AUTHOR_NAME: github-actions
          GIT_AUTHOR_EMAIL: github-actions@github.com

      # Build with version tracking
      - run: pnpm build:production

      # Push tags
      - run: git push --tags
```

### Vercel Integration

Vercel automatically builds when tags are pushed:

```bash
# Local: bump and push
pnpm version:patch --commit --tag --push

# Vercel: automatically deploys v0.4.1
```

### Environment-specific Builds

```bash
# Development build
NODE_ENV=development pnpm build

# Production build
NODE_ENV=production pnpm build:production
```

## Troubleshooting

### Build Number Out of Sync

```bash
# Reset build number
echo "0" > .build-number

# Or manually set
echo "42" > .build-number
```

### Fix Changelog Format

```bash
# Manually edit CHANGELOG.md
vim CHANGELOG.md

# Recommit
git add CHANGELOG.md
git commit --amend
```

### Revert Version Bump

```bash
# Before pushing
git reset --hard HEAD~1
git tag -d v0.4.1

# After pushing (careful!)
git push origin :refs/tags/v0.4.1
git revert HEAD
```

### Force Version

Manually edit `package.json` and run:

```bash
# Update all version files to match package.json
tsx scripts/version.ts build
```

## Best Practices

### 1. Commit Messages

Always use conventional commit format:

```bash
✓ feat: add recipe sharing
✓ fix: resolve auth bug
✗ added new feature
✗ bug fix
```

### 2. Changelog Discipline

- Let the system generate changelog entries
- Manually add context/details after generation
- Group related changes together

### 3. Version Bump Timing

- Bump version **before** merging to main
- Create tags from main branch only
- One version bump per merge

### 4. Build Numbers

- Let CI/CD handle build numbers
- Don't manually edit `.build-number`
- Build numbers are for tracking, not comparison

### 5. Git Tags

- Create tags for all releases
- Never force-push tags
- Use annotated tags (automatic with script)

## Advanced Usage

### Custom Build Info

```typescript
// scripts/version.ts supports environment variable
NODE_ENV=production tsx scripts/version.ts build
```

### Programmatic Access

```typescript
// Read build info at runtime
import buildInfo from '@/build-info.json';

console.log(buildInfo.version);   // "0.4.1"
console.log(buildInfo.build);     // 42
console.log(buildInfo.commit);    // "abc123"
```

### Version Comparison

```typescript
import { VERSION } from '@/lib/version';

function isVersionAtLeast(required: string): boolean {
  const [major, minor, patch] = VERSION.split('.').map(Number);
  const [reqMajor, reqMinor, reqPatch] = required.split('.').map(Number);

  if (major > reqMajor) return true;
  if (major < reqMajor) return false;
  if (minor > reqMinor) return true;
  if (minor < reqMinor) return false;
  return patch >= reqPatch;
}

// Feature flag based on version
if (isVersionAtLeast('0.5.0')) {
  // Enable new feature
}
```

## FAQ

**Q: When should I use auto-bump vs manual bump?**

A: Use `version:auto` when following conventional commits. Use manual bumps when you need explicit control.

**Q: Can I skip changelog generation?**

A: Yes, the changelog is only updated when conventional commits are found. Manual edits are preserved.

**Q: What happens if I edit `src/lib/version.ts`?**

A: Don't edit it manually—it's regenerated on every version bump and build.

**Q: How do I version a hotfix?**

A: Create a hotfix branch, bump patch version, merge to main, and deploy.

**Q: Can I have different versions per environment?**

A: No, version is global. Use build numbers and environment flags instead.

## Resources

- [Semantic Versioning Spec](https://semver.org/)
- [Conventional Commits Spec](https://www.conventionalcommits.org/)
- [Keep a Changelog](https://keepachangelog.com/)
- [Git Tagging](https://git-scm.com/book/en/v2/Git-Basics-Tagging)

---

**Last Updated**: 2025-10-16
**Version System**: 1.0.0
