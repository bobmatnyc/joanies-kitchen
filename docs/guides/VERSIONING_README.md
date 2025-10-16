# Version Management System

## Overview

Joanie's Kitchen uses a comprehensive versioning system that combines:

- **Semantic Versioning (SemVer)** - Major.Minor.Patch format
- **Build Tracking** - Incremental build numbers
- **Conventional Commits** - Automated version bump detection
- **Changelog Generation** - Automatic release notes
- **Git Integration** - Automatic tagging and commits

## Quick Start

```bash
# Show current version and build info
pnpm version:current

# Bump version (creates PATCH 0.4.0 → 0.4.1)
pnpm version:patch

# Build with version tracking
pnpm build
```

## Installation

The system is already configured. Files included:

```
✓ scripts/version.ts                 Version management script
✓ src/lib/version.ts                 Version constants (auto-generated)
✓ build-info.json                    Build metadata (tracked in git)
✓ .build-number                      Build counter (gitignored)
✓ build-history.json                 Build history (gitignored)
✓ CHANGELOG.md                       Release notes
✓ docs/guides/VERSIONING_GUIDE.md    Complete documentation
✓ docs/reference/VERSIONING_QUICK_REFERENCE.md  Quick reference
```

## Usage

### Show Current Version

```bash
pnpm version:current
```

Output:
```
Current Version Information
──────────────────────────────────────────────────
Version:        0.4.0
Build:          1
Last Build:     2025-10-16T10:10:56Z
Commit:         fb1eb51
Branch:         main
Environment:    development
──────────────────────────────────────────────────
```

### Bump Version

```bash
# Patch version (0.4.0 → 0.4.1) - for bug fixes
pnpm version:patch

# Minor version (0.4.0 → 0.5.0) - for new features
pnpm version:minor

# Major version (0.4.0 → 1.0.0) - for breaking changes
pnpm version:major
```

### Auto-detect Version Bump

Based on conventional commit messages:

```bash
# Analyzes commits and bumps version automatically
pnpm version:auto
```

The system detects:
- `feat:` commits → **MINOR** bump
- `fix:` commits → **PATCH** bump
- `feat!:` or `BREAKING CHANGE:` → **MAJOR** bump

### Build Tracking

```bash
# Increments build number and builds project
pnpm build

# Or explicitly track build
pnpm tsx scripts/version.ts build
```

### Git Integration

```bash
# Bump version and create git commit
pnpm version:patch --commit

# Bump version, commit, and create git tag
pnpm version:patch --commit --tag

# Bump version, commit, tag, and push to remote
pnpm version:patch --commit --tag --push
```

### Preview Changes (Dry Run)

```bash
# See what would happen without making changes
pnpm version:patch --dry-run
```

## Using Version Info in Your App

### Import version constants

```typescript
import { VERSION, BUILD, BUILD_DATE } from '@/lib/version';
import { getVersionInfo, getVersionString } from '@/lib/version';

// Get version string
console.log(getVersionString());
// Output: "v0.4.0 (build 1)"

// Get version info object
const info = getVersionInfo();
console.log(info);
// Output: { version: "0.4.0", build: 1, buildDate: "2025-10-16T..." }
```

### Display Version in UI

```tsx
import { VersionDisplay } from '@/components/VersionDisplay';

// In footer
<footer>
  <VersionDisplay variant="short" />
  {/* Output: v0.4.0 (build 1) */}
</footer>

// In about page
<VersionDisplay variant="full" />
{/* Output:
    Version: 0.4.0
    Build: 1
    Built: 10/16/2025
*/}
```

## Workflows

### Standard Release Process

```bash
# 1. Make changes and commit using conventional commits
git commit -m "feat: add recipe sharing"
git commit -m "fix: resolve auth issue"

# 2. Bump version with commit and tag
pnpm version:auto --commit --tag

# 3. Push to remote (triggers deployment)
git push && git push --tags

# 4. Build for production
pnpm build:production
```

### Quick Hotfix

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-bug

# 2. Fix the bug and commit
git commit -m "fix: resolve critical security issue"

# 3. Bump patch version with commit and tag
pnpm version:patch --commit --tag

# 4. Push and merge
git push --tags
git checkout main
git merge hotfix/critical-bug
git push
```

### CI/CD Integration

Add to your CI/CD pipeline:

```yaml
# GitHub Actions example
- name: Bump version
  run: pnpm version:auto --commit --tag

- name: Build with version tracking
  run: pnpm build:production

- name: Push tags
  run: git push --tags
```

## Conventional Commits

Follow this format for automatic version bump detection:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Commit Types

| Type | Description | Version Bump |
|------|-------------|--------------|
| `feat` | New feature | MINOR |
| `fix` | Bug fix | PATCH |
| `perf` | Performance improvement | PATCH |
| `refactor` | Code refactoring | PATCH |
| `docs` | Documentation only | PATCH |
| `test` | Test changes | PATCH |
| `chore` | Build/tooling changes | PATCH |
| `style` | Code style/formatting | PATCH |

### Breaking Changes

Mark breaking changes for MAJOR bump:

```bash
# With exclamation mark
git commit -m "feat!: redesign authentication API"

# Or in commit body
git commit -m "feat: redesign authentication API

BREAKING CHANGE: API now requires authentication tokens"
```

### Examples

```bash
# Good conventional commits
feat: add recipe sharing functionality
fix: resolve session timeout issue
perf: optimize image loading
refactor: simplify authentication logic
docs: update installation guide
test: add recipe CRUD tests
chore: update dependencies
style: format code with prettier

# With scope
feat(recipes): add sharing functionality
fix(auth): resolve session timeout
perf(images): optimize loading

# Breaking change
feat!: complete API redesign
```

## File Structure

```
project-root/
├── scripts/
│   └── version.ts                 # Main version management script
│
├── src/
│   ├── lib/
│   │   └── version.ts             # Version constants (auto-generated)
│   └── components/
│       └── VersionDisplay.tsx     # Version display component
│
├── docs/
│   ├── guides/
│   │   └── VERSIONING_GUIDE.md    # Complete documentation
│   └── reference/
│       └── VERSIONING_QUICK_REFERENCE.md  # Quick reference
│
├── build-info.json                # Current build metadata (committed)
├── .build-number                  # Build counter (gitignored)
├── build-history.json             # Build history (gitignored)
├── CHANGELOG.md                   # Release notes (committed)
└── package.json                   # Version source of truth
```

## Files Explained

### Committed to Git
- **package.json** - Source of truth for version
- **build-info.json** - Current build metadata
- **src/lib/version.ts** - Version constants (auto-generated)
- **CHANGELOG.md** - Release notes

### Gitignored
- **.build-number** - Build counter (local only)
- **build-history.json** - Build history (local only, last 100 builds)

## Changelog

The system automatically generates changelog entries from conventional commits:

```markdown
## [0.4.1] - 2025-10-16

### Added
- Recipe sharing functionality
- Collection management

### Fixed
- Session timeout issue
- Image loading bug

### Changed
- Refactored authentication flow
```

You can manually edit `CHANGELOG.md` after generation to add context.

## Version Decision Tree

```
┌─ Is it a BREAKING CHANGE?
│  ├─ Yes → MAJOR version (1.0.0)
│  └─ No
│     ├─ Is it a NEW FEATURE?
│     │  ├─ Yes → MINOR version (0.5.0)
│     │  └─ No → PATCH version (0.4.1)
```

## Troubleshooting

### Reset Build Number

```bash
echo "0" > .build-number
```

### Fix Uncommitted Changes

```bash
git add .
git commit -m "chore: prepare for version bump"
pnpm version:patch --commit --tag
```

### Manually Set Version

Edit `package.json` then run:

```bash
pnpm tsx scripts/version.ts build
```

### View Commits Since Last Tag

```bash
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

## Best Practices

### ✓ Do This
- Use conventional commit messages
- Bump version before merging to main
- Create git tags for releases
- Let the system generate changelogs
- Push tags to trigger deployment

### ✗ Avoid This
- Manually editing `src/lib/version.ts`
- Skipping version bumps
- Mixing features in patch releases
- Force-pushing tags
- Downgrading versions

## Examples

### Example 1: Feature Release

```bash
# Make changes
git commit -m "feat: add recipe collections"
git commit -m "feat: add collection sharing"

# Auto-detect and bump (MINOR)
pnpm version:auto --commit --tag --push

# Build and deploy
pnpm build:production
```

### Example 2: Bug Fix

```bash
# Fix bug
git commit -m "fix: resolve image upload issue"

# Bump patch version
pnpm version:patch --commit --tag --push

# Build and deploy
pnpm build:production
```

### Example 3: Breaking Change

```bash
# Make breaking change
git commit -m "feat!: redesign recipe API

BREAKING CHANGE: Recipe API now requires authentication"

# Bump major version
pnpm version:major --commit --tag --push

# Build and deploy
pnpm build:production
```

## Resources

- **Complete Guide**: [docs/guides/VERSIONING_GUIDE.md](docs/guides/VERSIONING_GUIDE.md)
- **Quick Reference**: [docs/reference/VERSIONING_QUICK_REFERENCE.md](docs/reference/VERSIONING_QUICK_REFERENCE.md)
- **Semantic Versioning**: https://semver.org/
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Keep a Changelog**: https://keepachangelog.com/

## Support

For issues or questions:

1. Check the [Complete Guide](docs/guides/VERSIONING_GUIDE.md)
2. Check the [Quick Reference](docs/reference/VERSIONING_QUICK_REFERENCE.md)
3. Run `pnpm tsx scripts/version.ts help`

---

**System Version**: 1.0.0
**Last Updated**: 2025-10-16
**Maintained By**: Joanie's Kitchen Team
