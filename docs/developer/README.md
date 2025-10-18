# Recipe Manager - Developer Documentation Hub

**AI-Powered Recipe Generator & Meal Planning Platform**

Version 0.5.2 (In Development) | Last Updated: October 18, 2025

---

## 📋 Table of Contents

- [Technical Summary](#technical-summary)
- [Quick Start](#quick-start)
- [Architecture Documentation](#architecture-documentation)
- [Getting Started Guides](#getting-started-guides)
- [Feature Implementation Guides](#feature-implementation-guides)
- [Reference Documentation](#reference-documentation)
- [API Documentation](#api-documentation)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Deployment & Operations](#deployment--operations)
- [Troubleshooting](#troubleshooting)
- [Project Status & Roadmap](#project-status--roadmap)

---

## Technical Summary

### Tech Stack Overview

**Core Framework**
- **Next.js 15.5.3** - React framework with App Router, Server Actions, Turbopack
- **TypeScript 5** - Strict mode enabled for type safety
- **React 19** - Latest React with Server Components

**Backend & Database**
- **PostgreSQL** - Neon serverless database (hosted)
- **Drizzle ORM 0.44.5** - Type-safe database queries with migrations
- **Clerk Authentication** - User authentication with dual-environment support

**AI & ML Integration**
- **OpenRouter API** - Multi-LLM support (200+ models)
- **Primary Models**: Gemini 2.0 Flash, GPT-4o, Claude 3.5 Sonnet
- **pgvector** - Semantic recipe search with embeddings

**UI & Styling**
- **Tailwind CSS v4** - Utility-first CSS framework
- **shadcn/ui** - Accessible component library
- **React Hook Form** - Form state management
- **Zod** - Schema validation

**Development Tools**
- **pnpm** - Fast, disk-efficient package manager
- **Biome** - Fast code linter and formatter
- **Playwright** - End-to-end testing
- **Vitest** - Unit testing framework

### Architecture Highlights

1. **Server-First Design**: Extensive use of Server Actions for data mutations, minimizing client-side JavaScript
2. **Dual-Environment Auth**: Supports both development and production Clerk environments on localhost
3. **LLM-Powered Features**: AI recipe generation, semantic search, content extraction
4. **Vector Search**: Semantic recipe discovery using pgvector embeddings
5. **Mobile-First Responsive**: Touch-optimized UI with 44x44px minimum targets
6. **Type-Safe Database**: Drizzle ORM with Zod validation throughout

### Key Metrics

- **Database**: 50,000+ recipes across multiple sources
- **Chef Profiles**: 10 curated celebrity chefs with verified recipes
- **Development Port**: 3002 (configured to avoid conflicts)
- **Performance Target**: Lighthouse score 90+ on mobile
- **Bundle Size Target**: <200KB initial JavaScript

### Project Structure

```
recipe-manager/
├── src/
│   ├── app/                    # Next.js App Router (pages, layouts, API routes)
│   ├── components/             # React components (ui/, recipe/, meals/, admin/)
│   ├── lib/                    # Core utilities (db/, ai/, search/, utils/)
│   ├── types/                  # TypeScript type definitions
│   └── middleware.ts           # Clerk authentication middleware
├── scripts/                    # Data acquisition & database utilities
├── data/                       # Data processing and synthetic user generation
├── docs/                       # Documentation hub
│   ├── developer/             # Developer documentation (YOU ARE HERE)
│   ├── guides/                # Implementation guides
│   ├── reference/             # Quick references
│   ├── api/                   # API documentation
│   └── testing/               # Testing documentation
├── drizzle/                    # Database migrations
└── tests/                      # E2E and integration tests
```

---

## Quick Start

### Prerequisites

- **Node.js**: 18.17+ (20+ recommended)
- **pnpm**: Latest version (`npm install -g pnpm`)
- **PostgreSQL**: Neon account (free tier available)
- **Clerk Account**: For authentication (free tier available)
- **OpenRouter API Key**: For AI features (free tier available)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd recipe-manager

# Install dependencies
pnpm install

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys

# Push database schema
pnpm db:push

# Seed system recipes (optional)
pnpm db:seed:system

# Start development server
pnpm dev
# Open http://localhost:3002
```

### Essential Commands

```bash
# Development
pnpm dev                    # Start dev server (port 3002)
pnpm build                  # Build for production
pnpm start                  # Start production server

# Database
pnpm db:push               # Push schema changes
pnpm db:studio             # Open Drizzle Studio (port 4983)
pnpm db:generate           # Generate migrations
pnpm db:migrate            # Run migrations

# Code Quality
pnpm lint                  # Run Biome linter
pnpm lint:fix              # Fix linting issues
pnpm typecheck             # TypeScript type checking

# Testing
pnpm test                  # Run all tests
pnpm test:e2e              # End-to-end tests (Playwright)
pnpm test:unit             # Unit tests (Vitest)
```

---

## Architecture Documentation

### Core Architecture

- **[Project Organization](../reference/PROJECT_ORGANIZATION.md)** - File structure standards and conventions
- **[Database Schema](../../src/lib/db/schema.ts)** - Drizzle schema definitions (recipes, meals, chefs, users)
- **[Authentication Architecture](../guides/AUTHENTICATION_REQUIREMENTS.md)** - Clerk dual-environment setup
- **[API Routes](../api/)** - REST API documentation
- **[Server Actions](../../src/app/actions/)** - Next.js server action patterns

### AI/ML Integration

- **[OpenRouter Integration](../../src/lib/ai/openrouter-server.ts)** - Multi-LLM API wrapper
- **[Recipe Generation](../../src/lib/ai/recipe-generator.ts)** - AI recipe creation logic
- **[Embeddings System](../guides/EMBEDDINGS_GENERATION_GUIDE.md)** - Semantic search with pgvector
- **[Search & Ranking](../guides/SEARCH_CACHE_GUIDE.md)** - Search cache and ranking algorithms

### Data Architecture

- **[Database Indexes](../reference/PERFORMANCE_INDEXES.md)** - Performance optimization indexes
- **[Migrations](../../drizzle/)** - Database migration history
- **[Data Acquisition](../guides/data-acquisition.md)** - Recipe import pipelines

---

## Getting Started Guides

### Environment Setup

- **[Environment Setup Guide](../guides/ENVIRONMENT_SETUP.md)** - Complete .env.local configuration
- **[Clerk Setup](../guides/CLERK_SETUP_GUIDE.md)** - Authentication configuration step-by-step
- **[Dual Environment Setup](../guides/DUAL_ENVIRONMENT_SETUP.md)** - Dev + production on localhost
- **[Google OAuth Setup](../guides/GOOGLE_OAUTH_SETUP.md)** - OAuth provider configuration
- **[1Password Integration](../reference/1PASSWORD_SETUP.md)** - Secret management

### Development Workflow

- **[Code Quality Guide](../guides/CODE_QUALITY.md)** - Linting, formatting, type checking standards
- **[Git Workflow](../reference/GIT_WORKFLOW.md)** - Branching strategy and commit conventions
- **[Testing Strategy](../testing/)** - Unit, integration, and E2E testing guides

---

## Feature Implementation Guides

### Recipe Management

- **[Recipe CRUD Operations](../guides/RECIPE_CRUD_GUIDE.md)** - Create, read, update, delete recipes
- **[AI Recipe Generation](../guides/AI_RECIPE_GENERATION.md)** - LLM-powered recipe creation
- **[Recipe Import](../guides/RECIPE_IMPORT_GUIDE.md)** - Import from URLs and files
- **[Recipe Export](../guides/RECIPE_EXPORT_GUIDE.md)** - PDF, JSON, Markdown export

### Chef System

- **[Chef System Implementation](../guides/CHEF_SYSTEM_IMPLEMENTATION.md)** - Celebrity chef profiles
- **[Chef System Quick Start](../guides/CHEF_SYSTEM_QUICK_START.md)** - Getting started with chefs
- **[Chef Avatar System](../reference/CHEF_AVATAR_SYSTEM.md)** - Profile image management
- **[Chef Instructions Formatting](../reference/CHEF_INSTRUCTIONS_FORMATTING.md)** - Recipe formatting standards

### Meal Planning

- **[Meal Builder Guide](../guides/MEAL_BUILDER_AI_ENHANCEMENTS.md)** - AI-enhanced meal planning
- **[Automatic Meal Tagging](../guides/AUTOMATIC_MEAL_TAGGING.md)** - Recipe categorization
- **[Meals Validation](../reference/MEALS_VALIDATION_IMPLEMENTATION.md)** - Data validation

### Search & Discovery

- **[Semantic Search Guide](../guides/SEMANTIC_SEARCH_GUIDE.md)** - Vector-based recipe search
- **[Ingredient Search](../guides/INGREDIENT_EXTRACTION_GUIDE.md)** - Search by ingredients
- **[Search Cache](../guides/SEARCH_CACHE_GUIDE.md)** - Performance optimization
- **[Ranking System](../../RANKING_SYSTEM_SUMMARY.md)** - Recipe ranking algorithm

### Admin Features

- **[Admin Dashboard Guide](../guides/admin-dashboard.md)** - Admin interface overview
- **[Admin Setup](../guides/admin-setup.md)** - Admin user configuration
- **[Image Flagging System](../features/ADMIN_IMAGE_FLAGGING_SYSTEM.md)** - Content moderation

### Data Acquisition

- **[Data Acquisition Overview](../guides/data-acquisition.md)** - Recipe import pipeline
- **[Epicurious Import](../guides/data-acquisition-epicurious.md)** - Epicurious dataset (1000 recipes)
- **[Food.com Import](../guides/data-acquisition-foodcom.md)** - Food.com dataset (230,000+ recipes)
- **[OpenRecipes Import](../guides/data-acquisition-openrecipes.md)** - OpenRecipes dataset
- **[Continuous Scraping](../guides/continuous-scraping.md)** - Automated recipe crawling

---

## Reference Documentation

### Quick References

- **[Chef Profiles Quick Reference](../reference/CHEF_PROFILES_QUICK_REFERENCE.md)** - All chef data
- **[Ingredients Schema](../reference/INGREDIENTS_SCHEMA.md)** - Ingredient data structure
- **[Environment Variables](../reference/environment-variables.md)** - All env vars documented
- **[Cleanup Quick Reference](../reference/CLEANUP_QUICK_REFERENCE.md)** - Database cleanup utils
- **[Mobile Parity Quick Start](../reference/MOBILE_PARITY_QUICK_START.md)** - Mobile optimization

### Implementation Summaries

- **[Synthetic User System](../../SYNTHETIC_USER_IMPLEMENTATION_SUMMARY.md)** - AI-generated test users
- **[Embeddings Implementation](../../EMBEDDINGS_IMPLEMENTATION_CHECKLIST.md)** - Semantic search setup
- **[Cache Implementation](../../CACHE_IMPLEMENTATION_SUMMARY.md)** - Search caching
- **[Image Flagging](../../IMAGE_FLAGGING_IMPLEMENTATION_SUMMARY.md)** - Content moderation
- **[ISR Implementation](../reference/ISR_IMPLEMENTATION_SUMMARY.md)** - Incremental Static Regeneration
- **[Pagination](../reference/PAGINATION_IMPLEMENTATION.md)** - Recipe list pagination

### Schema & Database

- **[Database Schema](../../src/lib/db/schema.ts)** - Complete Drizzle schema
- **[Ingredients Schema](../reference/INGREDIENTS_SCHEMA.md)** - Ingredient data model
- **[Meals Schema](../reference/MEALS_VALIDATION_IMPLEMENTATION.md)** - Meal planning schema
- **[Ingredient Queries](../reference/INGREDIENT_QUERIES.sql)** - Common SQL queries

---

## API Documentation

### Server Actions

- **[Recipe Actions](../../src/app/actions/recipes.ts)** - Recipe CRUD operations
- **[AI Recipe Actions](../../src/app/actions/ai-recipes.ts)** - AI generation endpoints
- **[Meal Actions](../../src/app/actions/meals.ts)** - Meal planning operations
- **[Chef Actions](../../src/app/actions/chefs.ts)** - Chef profile management
- **[Search Actions](../../src/app/actions/recipe-search.ts)** - Search functionality

### REST API Routes

- **[Recipe API](../../src/app/api/recipes/)** - Recipe CRUD endpoints
- **[Semantic Search API](../../src/app/api/search/semantic/)** - Vector search
- **[Clerk Config API](../../src/app/api/clerk-config/)** - Auth configuration
- **[Security Audit API](../../src/app/api/security-audit/)** - Security validation

---

## Testing & Quality Assurance

### Testing Documentation

- **[E2E Testing Guide](../testing/E2E_TESTING_GUIDE.md)** - Playwright end-to-end tests
- **[Unit Testing Guide](../testing/UNIT_TESTING_GUIDE.md)** - Vitest unit tests
- **[Meals Test Summary](../testing/MEALS_TEST_SUMMARY.md)** - Meal planning tests
- **[Test Fixtures](../../tests/e2e/fixtures/)** - Reusable test data

### Quality Standards

- **[Code Quality Guide](../guides/CODE_QUALITY.md)** - Linting and formatting
- **[Type Safety Standards](../../tsconfig.json)** - TypeScript configuration
- **[Performance Benchmarks](../performance/)** - Performance testing
- **[Accessibility Standards](../guides/ACCESSIBILITY_GUIDE.md)** - A11y requirements

---

## Deployment & Operations

### Deployment Guides

- **[Vercel Deployment](../guides/VERCEL_DEPLOYMENT.md)** - Deploy to Vercel
- **[Environment Configuration](../guides/ENVIRONMENT_SETUP.md)** - Production env setup
- **[Database Migrations](../guides/DATABASE_MIGRATIONS.md)** - Schema updates in production

### Operations

- **[Monitoring & Logging](../guides/MONITORING_GUIDE.md)** - Application monitoring
- **[Performance Optimization](../performance/)** - Performance tuning
- **[Security Best Practices](../guides/SECURITY_GUIDE.md)** - Security hardening

---

## Troubleshooting

### Common Issues

- **[Authentication Issues](../troubleshooting/AUTH_TROUBLESHOOTING.md)** - Clerk auth problems
- **[Database Connection](../troubleshooting/DATABASE_TROUBLESHOOTING.md)** - Neon connection issues
- **[Build Errors](../troubleshooting/BUILD_TROUBLESHOOTING.md)** - Build and deployment errors
- **[AI Integration Issues](../troubleshooting/AI_TROUBLESHOOTING.md)** - OpenRouter problems

### Fix Reports

- **[Vercel Deployment Fix](../fixes/VERCEL_DEPLOYMENT_FIX_REPORT.md)** - Deployment issues resolved
- **[Hydration Fixes](../fixes/HYDRATION_AND_TYPE_FIXES.md)** - React hydration errors
- **[Similar Recipes Fix](../fixes/SIMILAR_RECIPES_FIX_REPORT.md)** - Similar recipe algorithm
- **[Invalid Time Value Fix](../INVALID_TIME_VALUE_FIX.md)** - Date parsing issues

---

## Project Status & Roadmap

### Current Version: 0.5.2 (In Development)

**Focus**: Synthetic User Creation for Social Features Testing

**Completed**:
- ✅ Persona generation script (5 archetypes, 56.3% diversity)
- ✅ Recipe generation per persona (95-100% alignment)
- ✅ LLM integration with cost optimization

**In Progress**:
- 🔄 User activity generation (collections, favorites, views)
- 🔄 Database seeding scripts
- 🔄 Full-scale generation (50 users, 500 recipes)

### Roadmap Documentation

- **[Full Roadmap](../../ROADMAP.md)** - Complete version history and future plans
- **[Version 0.5.2 Details](../../ROADMAP.md#version-052-synthetic-user-creation)** - Current sprint
- **[Version 0.6.0 Preview](../../ROADMAP.md#version-060-social-features)** - Social features (comments, follows, sharing)
- **[Version 1.0 Goals](../../ROADMAP.md#version-10-production-ready)** - Production release (July 2025)

### Recent Deliverables

- **[Chef Content Deliverables](../../DELIVERABLES.md)** - Chef system completion report
- **[Synthetic User Seeding](../../SYNTHETIC_USER_SEEDING_DELIVERABLES.md)** - Test data generation
- **[Mobile Parity Phase 1](../../docs/MOBILE_PARITY_PHASE1_COMPLETE.md)** - Mobile optimization

---

## Contributing

### Development Guidelines

1. **Follow Project Organization**: Adhere to [PROJECT_ORGANIZATION.md](../reference/PROJECT_ORGANIZATION.md)
2. **Type Safety**: Use TypeScript strict mode, Zod validation
3. **Testing**: Write tests for all new features
4. **Documentation**: Update docs with code changes
5. **Code Quality**: Run `pnpm lint:fix` before committing

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes, commit frequently
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### Commit Convention

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

---

## Support & Resources

### External Documentation

- **[Next.js Docs](https://nextjs.org/docs)** - Next.js 15 documentation
- **[Clerk Docs](https://clerk.com/docs)** - Authentication guide
- **[Drizzle ORM](https://orm.drizzle.team/docs)** - Database ORM
- **[OpenRouter](https://openrouter.ai/docs)** - AI/LLM API
- **[shadcn/ui](https://ui.shadcn.com)** - Component library
- **[Tailwind CSS](https://tailwindcss.com/docs)** - Styling framework

### Internal Links

- **[Main README](../../README.md)** - Project overview
- **[CLAUDE.md](../../CLAUDE.md)** - AI assistant instructions
- **[CHANGELOG.md](../../CHANGELOG.md)** - Version history

---

**Maintained by**: Recipe Manager Development Team
**Last Updated**: October 18, 2025
**Version**: 0.5.2 (In Development)
**License**: MIT
