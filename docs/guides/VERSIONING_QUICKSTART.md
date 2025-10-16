# Version Management - Quick Start

## 🚀 Get Started in 60 Seconds

### 1. Check Current Version
```bash
pnpm version:current
```

### 2. Make Changes & Commit
```bash
git add .
git commit -m "feat: add awesome feature"
```

### 3. Bump Version
```bash
# Option A: Manual
pnpm version:patch              # For bug fixes
pnpm version:minor              # For new features
pnpm version:major              # For breaking changes

# Option B: Auto-detect
pnpm version:auto               # Detects from commits
```

### 4. Push to Deploy
```bash
git push && git push --tags
```

## 📋 Common Commands

```bash
# Show version
pnpm version:current

# Bump with git
pnpm version:patch --commit --tag --push

# Preview changes
pnpm version:patch --dry-run

# Test system
pnpm version:test

# Build with tracking
pnpm build
```

## ✍️ Conventional Commits

Use this format for automatic version detection:

```bash
feat: add feature        # → MINOR bump (0.4.0 → 0.5.0)
fix: fix bug            # → PATCH bump (0.4.0 → 0.4.1)
feat!: breaking change  # → MAJOR bump (0.4.0 → 1.0.0)
```

## 🎨 Display Version in UI

```tsx
import { VersionDisplay } from '@/components/VersionDisplay';

<footer>
  <VersionDisplay variant="short" />
  {/* Shows: v0.4.0 (build 1) */}
</footer>
```

Or import directly:

```typescript
import { VERSION, BUILD, getVersionString } from '@/lib/version';

console.log(getVersionString());  // "v0.4.0 (build 1)"
```

## 📚 Full Documentation

- **Complete Guide**: [docs/guides/VERSIONING_GUIDE.md](docs/guides/VERSIONING_GUIDE.md)
- **Quick Reference**: [docs/reference/VERSIONING_QUICK_REFERENCE.md](docs/reference/VERSIONING_QUICK_REFERENCE.md)
- **Main README**: [VERSIONING_README.md](VERSIONING_README.md)

## 🎯 Next Steps

1. ✅ System is installed and working
2. Start using conventional commits
3. Bump version before releases
4. Add version display to your app footer

**That's it! You're ready to go!** 🎉

---

For help: `pnpm tsx scripts/version.ts help`
