# Quick Start Guide

Get up and running with Joanie's Kitchen in 5 minutes.

## Prerequisites

- Node.js v18+ installed
- pnpm installed (`npm install -g pnpm`)

## 1. Install and Setup (2 minutes)

```bash
# Clone and navigate
git clone <repository-url>
cd recipe-manager

# Install dependencies
pnpm install

# Set up environment
cp .env.local.example .env.local
```

## 2. Configure Essentials (2 minutes)

Edit `.env.local` with your credentials:

```env
# Required: Database
DATABASE_URL=your_postgresql_connection_string

# Required: AI Features
OPENROUTER_API_KEY=your_openrouter_api_key

# Optional: Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
```

> **Don't have API keys yet?**
> - [Neon DB](https://neon.tech/) - Free PostgreSQL database
> - [OpenRouter](https://openrouter.ai/) - AI API ($5 credit for new users)
> - [Clerk](https://clerk.com/) - Authentication (free tier available)

## 3. Initialize Database (1 minute)

```bash
# Push database schema
pnpm db:push

# (Optional) Add example recipes
pnpm db:seed:system
```

## 4. Start Development Server

```bash
pnpm dev
```

Visit **http://localhost:3004** 🎉

## Your First Recipe

### Option 1: Generate with AI

1. Click "Generate Recipe" in the navigation
2. Enter ingredients (e.g., "chicken, rice, broccoli")
3. Click "Generate"
4. Save to your collection

### Option 2: Create Manually

1. Click "My Recipes"
2. Click "New Recipe"
3. Fill in the form
4. Save

### Option 3: Import from URL

1. Click "Import Recipe"
2. Paste a recipe URL (e.g., from AllRecipes.com)
3. Review and save

## Key Features to Try

### 🤖 AI Recipe Generation
- Generate recipes from ingredients
- Get cooking tips and substitutions
- Create meal variations

### 🔍 Recipe Search
- Search your saved recipes
- Filter by cuisine, difficulty, or tags
- Semantic search (find similar recipes)

### 📅 Meal Planning
- Create weekly meal plans
- Drag and drop recipes to days
- Auto-generate shopping lists

### 🛒 Shopping Lists
- Generate from meal plans
- Organize by category
- Share with others

## Common Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production

# Database
pnpm db:studio        # Open database GUI
pnpm db:push          # Update database schema

# Utilities
pnpm auth:validate    # Test authentication
```

## Quick Troubleshooting

### Port Already in Use
```bash
lsof -ti:3004 | xargs kill -9
pnpm dev
```

### Database Connection Error
- Check `DATABASE_URL` in `.env.local`
- Ensure database exists and is accessible
- Try: `pnpm db:studio` to test connection

### AI Generation Not Working
- Verify `OPENROUTER_API_KEY` is correct
- Check you have credits at [OpenRouter Dashboard](https://openrouter.ai/account)

## Next Steps

1. **[Full Installation Guide](./installation.md)** - Detailed setup instructions
2. **[Environment Setup](./environment-setup.md)** - Configure all features
3. **[Authentication Guide](../guides/authentication.md)** - Enable user accounts
4. **[Data Acquisition](../guides/data-acquisition.md)** - Import recipes at scale

## Need Help?

- 📖 [Full Documentation](../README.md)
- 🐛 [Troubleshooting Guide](../troubleshooting/common-issues.md)
- 💬 Open an issue on GitHub

---

**Last Updated:** October 2025
**Version:** 1.0.0
