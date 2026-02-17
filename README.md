# Joanie's Kitchen

**From Garden to Table — with Heart and Soil**

An AI-powered seasonal recipe collection and meal planning application celebrating wholesome, authentic cooking. Built with Next.js 15, TypeScript, and Neon PostgreSQL.

**🎯 Go-Live Date: June 1, 2026**

---

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd joanies-kitchen
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Setup database
make db-push

# Start development server
make dev
```

Visit **http://localhost:3002** to see your application!

**📘 See [QUICK_START.md](./QUICK_START.md) for detailed setup instructions**

---

## 📖 Documentation

For comprehensive documentation, see **[docs/](./docs/README.md)**

### 🤖 AI Agent & Developer Documentation

**NEW: Optimized for Claude Code and AI Agents**

- **[CLAUDE.md](./CLAUDE.md)** - AI agent instructions with prioritized, critical project rules
- **[DEVELOPER.md](./DEVELOPER.md)** - Complete technical architecture and patterns
- **[CODE_STRUCTURE.md](./CODE_STRUCTURE.md)** - Project organization and file placement guide
- **[QUICK_START.md](./QUICK_START.md)** - 5-minute setup guide for new developers

### 👨‍💻 Developer Documentation

**[Developer Hub](./docs/developer/README.md)** - Complete technical guide for developers including:
- Architecture overview & tech stack
- API documentation & server actions
- Testing & quality assurance guides
- Deployment & operations
- Troubleshooting & debugging

### Essential Guides

- **[Installation Guide](./docs/getting-started/installation.md)** - Detailed setup instructions
- **[Quick Start Guide](./docs/getting-started/quick-start.md)** - Get running in 5 minutes
- **[Environment Setup](./docs/getting-started/environment-setup.md)** - Configure all features
- **[Deployment Guide](./docs/getting-started/deployment.md)** - Deploy to production

### Key Features

- **[Authentication](./docs/guides/authentication.md)** - Clerk authentication setup
- **[Data Acquisition](./docs/guides/data-acquisition.md)** - Import recipes from external sources
- **[Semantic Search](./docs/guides/semantic-search.md)** - Natural language recipe search
- **[Rating System](./docs/guides/rating-system.md)** - AI and user ratings
- **[Continuous Scraping](./docs/guides/continuous-scraping.md)** - Automated recipe discovery

### Development

- **[API Documentation](./docs/api/overview.md)** - API reference and usage
- **[Project Organization](./docs/reference/project-organization.md)** - File structure standards
- **[Code Quality](./docs/guides/CODE_QUALITY.md)** - Linting, formatting, and testing
- **[Quality Standards](./docs/reference/quality.md)** - Code quality guidelines
- **[Troubleshooting](./docs/troubleshooting/common-issues.md)** - Common problems and solutions
- **[Dev Server Stability](./docs/troubleshooting/DEV_SERVER_STABILITY.md)** - Fix ENOENT errors and crashes

---

## ✨ Features

### Core Functionality
- 🤖 **AI Recipe Generation** - Generate custom recipes from ingredients or descriptions
- 📚 **Recipe Library** - Save, organize, and manage your recipe collection
- 🔍 **Semantic Search** - Natural language search powered by vector embeddings
- ⭐ **Dual Rating System** - AI quality evaluation + community ratings
- 📅 **Meal Planning** - Plan meals for the week with drag-and-drop
- 🛒 **Shopping Lists** - Auto-generate shopping lists from meal plans

### Advanced Features
- 🌐 **Recipe Import** - Import recipes from URLs with AI extraction
- 📊 **Nutritional Information** - Track nutritional data for recipes
- 🎯 **Recipe Discovery** - Automated recipe crawling and curation
- 🔗 **Recipe Sharing** - Share recipes publicly or keep them private
- 📱 **Responsive Design** - Works beautifully on mobile and desktop

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript (Strict mode)
- **Database**: Neon PostgreSQL + pgvector
- **ORM**: Drizzle ORM
- **Authentication**: Clerk
- **UI**: Tailwind CSS v4 + shadcn/ui
- **AI Integration**: OpenRouter API (Claude, GPT, Gemini)
- **Search**: Brave Search API
- **Embeddings**: Hugging Face (sentence-transformers)
- **Testing**: Vitest + React Testing Library
- **Linting/Formatting**: Biome
- **Package Manager**: pnpm

---

## 📋 Environment Variables

### Required

- `DATABASE_URL` - Neon PostgreSQL connection string
- `OPENROUTER_API_KEY` - AI recipe generation
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Authentication (public)
- `CLERK_SECRET_KEY` - Authentication (secret)

### Optional

- `BRAVE_SEARCH_API_KEY` - Recipe discovery
- `HUGGINGFACE_API_KEY` - Semantic search embeddings
- `NEXT_PUBLIC_APP_URL` - Application URL (default: http://localhost:3004)

See [Environment Setup Guide](./docs/getting-started/environment-setup.md) for detailed configuration.

---

## 🎯 Project Structure

```
joanies-kitchen/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── api/         # API routes
│   │   ├── actions/     # Server actions
│   │   └── [pages]/     # Page components
│   ├── components/      # React components
│   │   ├── ui/         # Base UI components (shadcn/ui)
│   │   ├── recipe/     # Recipe components
│   │   ├── meal-plan/  # Meal planning
│   │   └── admin/      # Admin dashboard
│   ├── lib/            # Core utilities
│   │   ├── ai/        # AI/LLM integration
│   │   ├── db/        # Database layer
│   │   └── security/  # Security utilities
│   └── types/         # TypeScript types
├── docs/              # Documentation
├── scripts/           # Utility scripts
└── public/            # Static assets
```

See [Project Organization](./docs/reference/project-organization.md) for complete structure.

---

## 👨‍💼 Admin Access

The application includes an admin dashboard for managing recipes and users.

### Quick Setup (3 Steps)

1. Configure custom session token in Clerk Dashboard
2. Add `isAdmin: "true"` to user's public metadata
3. Sign out and sign back in

### Admin Features

- View recipe statistics and analytics
- Manage all recipes in the system
- Access to `/admin` and `/admin/recipes` routes
- Admin menu item in profile popup

### Documentation

- **[Admin Setup Guide](./docs/guides/admin-setup.md)** (coming soon)
- **Debug endpoint**: `http://localhost:3004/api/debug-session`
- **Validation script**: `node scripts/validate-admin-setup.js`

---

## 🧪 Development Commands

```bash
# Development
pnpm dev              # Start dev server (port 3004)
pnpm build            # Build for production
pnpm start            # Start production server

# Database
pnpm db:push          # Push schema changes
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio GUI

# Code Quality
pnpm lint             # Check code quality with Biome
pnpm lint:fix         # Auto-fix linting issues
pnpm format           # Format code with Biome
pnpm format:check     # Check formatting

# Testing
pnpm test             # Run tests in watch mode
pnpm test:run         # Run tests once
pnpm test:ui          # Open Vitest UI
pnpm test:coverage    # Generate coverage report

# Utilities
pnpm auth:validate    # Validate Clerk setup
```

---

## 🚀 Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

See [Deployment Guide](./docs/getting-started/deployment.md) for detailed instructions.

### Other Platforms

The application can be deployed to any platform supporting Next.js:
- Netlify
- AWS Amplify
- Railway
- Self-hosted with Docker

---

## 🔐 Security

- **Authentication**: Clerk-based user authentication
- **Authorization**: Server-side permission checks
- **Input Validation**: Zod schemas for all inputs
- **SQL Injection**: Protected by Drizzle ORM
- **API Keys**: Server-side only (never exposed to client)
- **Rate Limiting**: Consider implementing for production

See [Security Guide](./docs/reference/security.md) (coming soon) for more details.

---

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](./docs/CONTRIBUTING.md) (coming soon).

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

- **Next.js** - The React framework for production
- **Clerk** - Authentication and user management
- **Neon** - Serverless PostgreSQL
- **OpenRouter** - Multi-provider AI API
- **shadcn/ui** - Beautiful UI components
- **Drizzle ORM** - TypeScript ORM

---

## 📞 Support

- **Documentation**: [docs/README.md](./docs/README.md)
- **Troubleshooting**:
  - [Common Issues](./docs/troubleshooting/common-issues.md)
  - [Dev Server Stability](./docs/troubleshooting/DEV_SERVER_STABILITY.md)
- **Issues**: Open an issue on GitHub
- **Discussions**: GitHub Discussions

---

**Built with ❤️ for home cooks everywhere**
