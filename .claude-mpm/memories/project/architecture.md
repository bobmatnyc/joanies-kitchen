# Recipe Manager - Project Architecture Memory

## Core Stack
- **Framework**: Next.js 15.5.3 (App Router, Server Actions, Turbopack)
- **Language**: TypeScript 5 (strict mode)
- **Authentication**: Clerk (dual-environment: dev + prod on localhost)
- **Database**: Neon PostgreSQL (serverless) + Drizzle ORM 0.44.5
- **AI**: OpenRouter API (primary: Gemini 2.0 Flash)
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Package Manager**: pnpm
- **Dev Port**: 3004

## Key Architectural Decisions

### Dual-Environment Clerk Setup
The application uniquely supports TWO Clerk environments on localhost simultaneously:
- Development environment (pk_test_*, sk_test_*)
- Production environment (pk_live_*, sk_live_*)
- Environment switching via URL parameter (?env=prod) or local storage
- Enables testing production auth flows in development

### Server Actions Over API Routes
- Preferred pattern for mutations and data operations
- Direct database access without API overhead
- Built-in type safety with TypeScript
- Automatic request deduplication

### Database Schema Design
- User-scoped data model (all queries filtered by userId from Clerk)
- Support for public and system recipes (isPublic, isSystemRecipe flags)
- JSON fields for flexible data (ingredients, instructions, tags, images)
- Multi-image support (up to 6 images per recipe)

### AI Integration Pattern
- Server-side only API key management
- OpenRouter supports 200+ LLM models with unified interface
- Primary model: google/gemini-2.0-flash-exp:free
- Fallback models for availability and cost optimization

## Project Structure Conventions
- `/app/api/` - API routes (minimal, prefer server actions)
- `/app/actions/` - Server actions (primary data layer)
- `/components/ui/` - shadcn/ui base components
- `/components/[feature]/` - Feature-specific components
- `/lib/db/` - Database configuration and schema
- `/lib/ai/` - AI integration and utilities
- `/scripts/` - Database and utility scripts

## Critical Files
- `src/middleware.ts` - Clerk auth middleware with dynamic configuration
- `src/lib/db/schema.ts` - Drizzle schema (source of truth)
- `src/app/actions/` - Server actions for all data operations
- `drizzle.config.ts` - Drizzle Kit configuration
- `.env.local` - Environment configuration (gitignored)

## Development Patterns
- Path alias: `@/*` → `./src/*`
- Turbopack for dev server (faster than webpack)
- Drizzle Studio for database management (port 4983)
- Zod schemas generated from Drizzle schemas for validation
