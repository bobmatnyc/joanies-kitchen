# Joanie's Kitchen - Quick Start Guide

**Get up and running in 5 minutes**

Last Updated: 2025-11-20

---

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 18+ (20+ recommended)
- **pnpm** package manager (`npm install -g pnpm`)
- **Git**
- **PostgreSQL** database (Neon recommended)

---

## 5-Minute Setup

### Step 1: Clone and Install (2 minutes)

```bash
# Clone repository
git clone <your-repo-url>
cd joanies-kitchen

# Install dependencies with pnpm
pnpm install
```

### Step 2: Configure Environment (2 minutes)

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local with your credentials
# Minimum required:
# - DATABASE_URL
# - OPENROUTER_API_KEY
# - BLOB_READ_WRITE_TOKEN
```

**Quick .env.local Setup**:
```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
OPENROUTER_API_KEY=sk-or-v1-your-key-here
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your-token
NEXT_PUBLIC_APP_URL=http://localhost:3002

# Optional (for authentication)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your-key
CLERK_SECRET_KEY=sk_test_your-key
```

### Step 3: Initialize Database (30 seconds)

```bash
# Push database schema
make db-push

# Or using pnpm
pnpm db:push
```

### Step 4: Start Development Server (30 seconds)

```bash
# Start development server
make dev

# Or using pnpm
pnpm dev
```

Visit **http://localhost:3002** 🎉

---

## What You Can Do Now

### Browse Existing Features

- **Homepage**: http://localhost:3002/
- **Browse Recipes**: http://localhost:3002/recipes
- **Discover Chefs**: http://localhost:3002/discover/chefs
- **Kitchen Tools**: http://localhost:3002/tools
- **Learn**: http://localhost:3002/learn

### Create Your First Recipe (No Auth Required)

1. Go to http://localhost:3002/recipes/new
2. Fill in recipe details
3. Add ingredients and steps
4. Submit!

### Enable Authentication (Optional)

If you want to test authentication features:

1. Create a Clerk account at https://clerk.com
2. Get your development API keys
3. Add to `.env.local`:
   ```bash
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```
4. Restart dev server: `make dev`

---

## Essential Commands

### Development

```bash
make dev              # Start dev server (port 3002)
make dev-stop         # Stop dev server
make dev-clean        # Clean restart (clears cache)
```

### Database

```bash
make db-push          # Push schema changes
make db-studio        # Open Drizzle Studio GUI
```

### Code Quality

```bash
make lint             # Check code quality
make lint-fix         # Auto-fix issues
make format           # Format code
make typecheck        # TypeScript check
make quality          # Run all checks
```

### Testing

```bash
make test             # Run unit tests
make test-e2e         # Run end-to-end tests
```

---

## Common Issues

### Port 3002 Already in Use

```bash
make dev-stop
make dev
```

### ENOENT Errors (File Not Found)

```bash
# Use stable webpack mode instead of Turbopack
make dev-stable
```

### Database Connection Failed

```bash
# Verify DATABASE_URL in .env.local
# Make sure it starts with postgresql://

# Test connection
make db-studio
```

### Dependencies Out of Sync

```bash
# Clean and reinstall
rm -rf node_modules
pnpm install
```

---

## Next Steps

### Learn the Project Structure

- Read [CLAUDE.md](./CLAUDE.md) for AI agent instructions
- Read [DEVELOPER.md](./DEVELOPER.md) for architecture details
- Read [CODE_STRUCTURE.md](./CODE_STRUCTURE.md) for file organization

### Explore Documentation

```bash
# Browse documentation
ls docs/

# Key guides
docs/guides/              # How-to guides
docs/api/                 # API documentation
docs/features/            # Feature specifications
docs/troubleshooting/     # Common issues
```

### Import Sample Recipes

```bash
# Import from TheMealDB (requires THEMEALDB_API_KEY)
pnpm import:themealdb

# Import from Tasty (requires TASTY_API_KEY)
pnpm import:tasty

# See all import options
pnpm run | grep import
```

### Set Up Admin Access

1. Create a user account via the app
2. Get your user ID from Clerk Dashboard
3. In Clerk Dashboard → Users → Select User → Public Metadata
4. Add: `{ "isAdmin": "true" }`
5. Sign out and sign back in
6. Access admin: http://localhost:3002/admin

---

## Development Workflow

### Making Changes

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes, run quality checks
make quality

# 3. Commit changes
git add .
git commit -m "feat: add my feature"

# 4. Push and create PR
git push origin feature/my-feature
```

### Before Committing

```bash
# Run all quality checks
make quality

# Or individually
make lint-fix         # Fix code issues
make format           # Format code
make typecheck        # Check types
make test-run         # Run tests
```

---

## Getting Help

### Documentation

- **CLAUDE.md**: AI agent instructions and critical rules
- **DEVELOPER.md**: Technical architecture details
- **CODE_STRUCTURE.md**: Project organization guide
- **README.md**: Project overview
- **docs/**: Detailed documentation

### Common Commands

```bash
make help             # Show all available commands
pnpm run              # List all npm scripts
```

### Troubleshooting

Check these resources:
- `docs/troubleshooting/common-issues.md`
- `docs/troubleshooting/DEV_SERVER_STABILITY.md`
- GitHub Issues

---

## Quick Reference Card

```
┌─────────────────────────────────────────────┐
│  Joanie's Kitchen - Quick Reference         │
├─────────────────────────────────────────────┤
│  Dev Server:    make dev (port 3002)        │
│  Stop Server:   make dev-stop               │
│  Database GUI:  make db-studio              │
│  Code Quality:  make quality                │
│  Run Tests:     make test                   │
│  Format Code:   make lint-fix               │
│  Build:         pnpm build                  │
├─────────────────────────────────────────────┤
│  Documentation:                             │
│    CLAUDE.md         - AI agent guide       │
│    DEVELOPER.md      - Architecture         │
│    CODE_STRUCTURE.md - File organization    │
│    README.md         - Project overview     │
├─────────────────────────────────────────────┤
│  Get Help:                                  │
│    make help         - Show all commands    │
│    pnpm run          - List npm scripts     │
│    docs/             - Documentation        │
└─────────────────────────────────────────────┘
```

---

## What's Next?

### For Developers

1. **Read CLAUDE.md** - Understand critical project rules
2. **Review DEVELOPER.md** - Learn the architecture
3. **Explore CODE_STRUCTURE.md** - Know where files go
4. **Check the Roadmap** - See what's planned

### For Contributors

1. **Read Contributing Guide** (coming soon)
2. **Join Discussions** - GitHub Discussions
3. **Pick an Issue** - Check GitHub Issues
4. **Submit a PR** - Follow the workflow

### For Deployment

1. **Read Deployment Guide**: `docs/getting-started/deployment.md`
2. **Set up Vercel** - Recommended platform
3. **Configure Production Environment** - See .env.production.example
4. **Deploy** - Push to main branch

---

**You're all set! Start building something amazing! 🚀**

For detailed information, see:
- [CLAUDE.md](./CLAUDE.md)
- [DEVELOPER.md](./DEVELOPER.md)
- [README.md](./README.md)
