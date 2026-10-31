# Recipe Manager - Project Architecture Memory

## Core Stack
- **Framework**: Next.js 15.5.3 (App Router, Server Actions, Turbopack)
- **Language**: TypeScript 5 (strict mode)
- **Authentication**: Auth.js v5 (Google only, JWT sessions, closed registration)
- **Database**: Neon PostgreSQL (serverless) + Drizzle ORM 0.44.5
- **AI**: OpenRouter API (primary: Gemini 2.0 Flash)
- **UI**: Tailwind CSS v4 + shadcn/ui
- **Package Manager**: pnpm
- **Dev Port**: 3004

## Key Architectural Decisions

### Auth.js Setup
- Google is the only provider; sessions are JWTs; the Drizzle adapter stores `users` and `accounts`
- Registration is closed: only seeded emails or `AUTH_ADMIN_EMAILS` can sign in
- Admin comes from `AUTH_ADMIN_EMAILS` plus `users.is_admin`
- Legacy `users.id` values are Clerk-era ids (#22)

### Server Actions Over API Routes
- Preferred pattern for mutations and data operations
- Direct database access without API overhead
- Built-in type safety with TypeScript
- Automatic request deduplication

### Database Schema Design
- User-scoped data model (all queries filtered by userId from the Auth.js session)
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
- `src/middleware.ts` - Auth.js session middleware (rules in `src/lib/auth-routes.ts`)
- `src/lib/db/schema.ts` - Drizzle schema (source of truth)
- `src/app/actions/` - Server actions for all data operations
- `drizzle.config.ts` - Drizzle Kit configuration
- `.env.local` - Environment configuration (gitignored)

## Development Patterns
- Path alias: `@/*` → `./src/*`
- Turbopack for dev server (faster than webpack)
- Drizzle Studio for database management (port 4983)
- Zod schemas generated from Drizzle schemas for validation
