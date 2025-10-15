# Installation Guide

Get Joanie's Kitchen up and running on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **pnpm** (v8 or higher) - Install: `npm install -g pnpm`
- **Git** - [Download here](https://git-scm.com/)
- **PostgreSQL** (optional, if not using Neon) - [Download here](https://www.postgresql.org/)

## Quick Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd recipe-manager
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

```bash
# Copy the example environment file
cp .env.local.example .env.local

# Edit .env.local with your credentials
# Required: DATABASE_URL, OPENROUTER_API_KEY
```

### 4. Set Up Database

```bash
# Push database schema
pnpm db:push

# (Optional) Seed with example recipes
pnpm db:seed:system
```

### 5. Run Development Server

```bash
pnpm dev
```

Visit [http://localhost:3004](http://localhost:3004) to see your application!

## Detailed Setup

### Database Setup Options

#### Option A: Neon PostgreSQL (Recommended)

1. Sign up at [Neon](https://neon.tech/)
2. Create a new project
3. Create a database
4. Copy the connection string
5. Add to `.env.local`:
   ```env
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   ```

#### Option B: Local PostgreSQL

1. Install PostgreSQL on your machine
2. Create a database:
   ```bash
   createdb recipe_manager
   ```
3. Add to `.env.local`:
   ```env
   DATABASE_URL=postgresql://localhost:5432/recipe_manager
   ```

### API Keys Setup

#### OpenRouter (Required for AI features)

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Generate an API key
3. Add to `.env.local`:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```

#### Clerk Authentication (Optional)

1. Sign up at [Clerk](https://dashboard.clerk.com/)
2. Create a new application
3. Copy your keys
4. Add to `.env.local`:
   ```env
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

See [Authentication Guide](../guides/authentication.md) for detailed setup.

### Database Initialization

```bash
# Generate migration files
pnpm db:generate

# Push schema to database
pnpm db:push

# Open Drizzle Studio (database GUI)
pnpm db:studio
```

### Seeding Test Data

```bash
# Seed with system recipes
pnpm db:seed:system
```

## Development Workflow

### Available Scripts

```bash
# Development
pnpm dev              # Start dev server (port 3004)
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:push          # Push schema changes
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open database GUI

# Authentication
pnpm auth:validate    # Validate Clerk setup

# Code Quality
pnpm lint             # Run linter
pnpm type-check       # TypeScript checks
```

### Project Structure

```
recipe-manager/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   ├── lib/              # Utilities and core logic
│   └── types/            # TypeScript types
├── public/               # Static assets
├── scripts/              # Utility scripts
├── docs/                 # Documentation
└── drizzle/              # Database migrations
```

## Troubleshooting

### Port Already in Use

If port 3004 is already in use:

```bash
# Kill the process using the port
lsof -ti:3004 | xargs kill -9

# Or change the port in package.json
```

### Database Connection Issues

```bash
# Test database connection
pnpm db:studio

# If it fails, check:
# 1. DATABASE_URL is correct
# 2. Database exists
# 3. Network connectivity
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
pnpm build
```

## Next Steps

1. **[Quick Start](./quick-start.md)** - Get familiar with basic features
2. **[Environment Setup](./environment-setup.md)** - Detailed environment configuration
3. **[Authentication Guide](../guides/authentication.md)** - Set up user authentication
4. **[Data Acquisition](../guides/data-acquisition.md)** - Import recipes from external sources

## Getting Help

- Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
- Review the [Documentation](../README.md)
- Open an issue on GitHub

---

**Last Updated:** October 2025
**Version:** 1.0.0
