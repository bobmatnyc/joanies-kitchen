# Version Management Quick Reference

## Commands

```bash
# Show version
pnpm version:current

# Bump version
pnpm version:patch              # 0.4.0 → 0.4.1 (bug fixes)
pnpm version:minor              # 0.4.0 → 0.5.0 (new features)
pnpm version:major              # 0.4.0 → 1.0.0 (breaking changes)
pnpm version:auto               # Auto-detect from commits

# Build tracking
pnpm build                      # Increments build + builds
pnpm build:production           # Same as build

# With git operations
pnpm version:patch --commit     # + git commit
pnpm version:patch --tag        # + git tag
pnpm version:patch --push       # + git push

# Preview changes
pnpm version:patch --dry-run
```

## Files

| File | Purpose | Committed |
|------|---------|-----------|
| `package.json` | Version source of truth | ✓ |
| `build-info.json` | Current build metadata | ✓ |
| `src/lib/version.ts` | Version constants (auto-gen) | ✓ |
| `CHANGELOG.md` | Release notes | ✓ |
| `.build-number` | Build counter | ✗ |
| `build-history.json` | Build history (last 100) | ✗ |

## Conventional Commits

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `feat:` | MINOR | `feat: add sharing` |
| `fix:` | PATCH | `fix: auth bug` |
| `feat!:` | MAJOR | `feat!: new API` |
| `BREAKING CHANGE:` | MAJOR | (in commit body) |
| `perf:` | PATCH | `perf: optimize` |
| `refactor:` | PATCH | `refactor: cleanup` |
| `docs:` | PATCH | `docs: update` |
| `test:` | PATCH | `test: add tests` |
| `chore:` | PATCH | `chore: deps` |

## Using in Code

```typescript
// Import version info
import { VERSION, BUILD, BUILD_DATE, getVersionString } from '@/lib/version';

// Display version
console.log(getVersionString());  // "v0.4.1 (build 42)"

// Individual values
console.log(VERSION);      // "0.4.1"
console.log(BUILD);        // 42
console.log(BUILD_DATE);   // "2025-10-16T11:46:00Z"
```

## Workflows

### Standard Release
```bash
pnpm version:patch --commit --tag --push
pnpm build:production
# Deploy to Vercel/production
```

### Auto-detect Release
```bash
pnpm version:auto --commit --tag --push
pnpm build:production
```

### Hotfix
```bash
git checkout -b hotfix/auth-bug
# Fix the bug
pnpm version:patch --commit --tag
git push && git push --tags
git checkout main
git merge hotfix/auth-bug
```

## Troubleshooting

```bash
# Reset build number
echo "0" > .build-number

# Check git status
git status

# Check uncommitted changes
git diff

# View last tag
git describe --tags --abbrev=0

# View commits since last tag
git log $(git describe --tags --abbrev=0)..HEAD --oneline
```

## Version Decision Tree

```
Is it a breaking change?
├─ Yes → MAJOR (1.0.0)
└─ No
   └─ Is it a new feature?
      ├─ Yes → MINOR (0.5.0)
      └─ No → PATCH (0.4.1)
```

## Best Practices

✓ Use conventional commits
✓ Bump version before merging
✓ Create tags for releases
✓ Let system generate changelog
✓ Push tags to trigger deployment

✗ Don't manually edit version.ts
✗ Don't force-push tags
✗ Don't skip version bumps
✗ Don't mix features in patch releases
