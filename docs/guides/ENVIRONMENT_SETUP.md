# Environment Configuration Guide

This guide covers the complete setup of environment variables for the Recipe Manager application, including local development and Vercel production deployment.

## Quick Start

1. **Copy the environment template:**
   ```bash
   cp .env.local.example .env.local
   ```

2. **Edit `.env.local` with your values:**
   - Set `DATABASE_URL` to your PostgreSQL connection string
   - Add your `OPENROUTER_API_KEY` for AI features
   - Optionally add Clerk authentication keys

3. **Run the application:**
   ```bash
   npm run dev
   ```

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI features | `sk-or-v1-xxxxx...` |
| `NEXT_PUBLIC_APP_URL` | Your application's base URL | `http://localhost:3004` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk authentication (public) | `undefined` (auth disabled) |
| `CLERK_SECRET_KEY` | Clerk authentication (private) | `undefined` (auth disabled) |
| `NODE_ENV` | Node.js environment | `development` |

### Clerk Authentication URLs

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in page URL | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up page URL | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Redirect after sign-in | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Redirect after sign-up | `/` |

## Local Development Setup

### 1. Database Setup

#### Option A: Neon DB (Recommended)
1. Sign up at [Neon](https://neon.tech/)
2. Create a new database
3. Copy the connection string to `DATABASE_URL`

#### Option B: Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database: `createdb recipe_manager`
3. Set `DATABASE_URL=postgresql://user:password@localhost:5432/recipe_manager`

### 2. OpenRouter API Setup

1. Sign up at [OpenRouter](https://openrouter.ai/)
2. Generate an API key
3. Add to `.env.local`: `OPENROUTER_API_KEY=sk-or-v1-your-key`

### 3. Authentication Setup (Optional)

#### Without Authentication
- Leave Clerk variables empty or commented out
- All recipes will be public and editable by anyone
- Suitable for personal use or demos

#### With Clerk Authentication
1. Sign up at [Clerk](https://dashboard.clerk.com/)
2. Create a new application
3. Copy the publishable key to `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
4. Copy the secret key to `CLERK_SECRET_KEY`
5. Configure allowed origins in Clerk dashboard:
   - Add `http://localhost:3004` for development
   - Add your production domain for deployment

### 4. Database Migration

After setting up your database:

```bash
# Generate migration files
npm run db:generate

# Apply migrations
npm run db:migrate

# Seed with example recipes (optional)
npm run db:seed:system
```

## Vercel Production Deployment

### 1. Environment Variables Setup

Add all required variables to your Vercel project:

```bash
# Add production database URL
vercel env add DATABASE_URL production
# Enter your production PostgreSQL connection string

# Add OpenRouter API key
vercel env add OPENROUTER_API_KEY production
# Enter your OpenRouter API key

# Add Clerk authentication (if using)
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_SECRET_KEY production

# Set production app URL
vercel env add NEXT_PUBLIC_APP_URL production
# Enter your domain: https://your-app.vercel.app
```

### 2. Preview Environment Setup

Configure preview deployments (optional but recommended):

```bash
# Add variables for preview environment
vercel env add DATABASE_URL preview
vercel env add OPENROUTER_API_KEY preview
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY preview
vercel env add CLERK_SECRET_KEY preview
```

### 3. Domain Configuration

For custom domains:

1. Add your domain in Vercel dashboard
2. Update `NEXT_PUBLIC_APP_URL` to your custom domain
3. Update Clerk allowed origins if using authentication

### 4. Deployment Commands

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls
```

## Security Best Practices

### 1. Environment File Security

- **Never commit `.env.local`** - it contains sensitive data
- Use `.env.example` and `.env.local.example` as templates
- Keep actual credentials out of git history

### 2. API Key Management

- **Rotate API keys regularly**
- Use different keys for development and production
- Monitor API key usage in respective dashboards

### 3. Database Security

- Use connection pooling in production (Neon provides this)
- Enable SSL connections (`sslmode=require`)
- Restrict database access to your application's IP ranges

### 4. Clerk Authentication Security

- Configure allowed origins properly
- Use different Clerk instances for development and production
- Enable MFA for your Clerk admin account

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Test database connection
npm run db:studio
```

If connection fails:
- Verify `DATABASE_URL` format
- Check network connectivity
- Ensure database exists and user has permissions

#### Clerk Authentication Issues
```bash
# Debug Clerk configuration
curl http://localhost:3004/api/debug-clerk
```

Common solutions:
- Verify publishable and secret keys match same Clerk instance
- Check allowed origins in Clerk dashboard
- Ensure redirect URLs are configured correctly

#### OpenRouter API Issues
- Verify API key is correct and active
- Check rate limits in OpenRouter dashboard
- Ensure sufficient credits for API usage

### Environment Variables Not Loading

1. Check file naming: must be `.env.local` (not `.env.local.txt`)
2. Restart Next.js development server after changes
3. Verify variable names match exactly (case-sensitive)
4. Check for trailing spaces or special characters

### Vercel Deployment Issues

```bash
# Check environment variables
vercel env ls

# Pull environment variables locally
vercel env pull .env.vercel.local

# Check build logs
vercel logs
```

## Environment File Structure

```
project-root/
├── .env.example              # Comprehensive template with all variables
├── .env.local.example        # Simple development template
├── .env.local               # Your actual local development file (git-ignored)
├── .vercel/
│   └── .env.development.local # Vercel CLI generated (git-ignored)
└── .gitignore               # Ensures env files are not committed
```

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run db:generate` | Generate database migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:push` | Push schema changes to database |
| `npm run db:studio` | Open database management UI |
| `npm run db:seed:system` | Populate with example recipes |

## Support

For additional help:

1. Check the [Next.js environment variables documentation](https://nextjs.org/docs/app/building-your-application/configuring/environment-variables)
2. Review [Vercel environment variables guide](https://vercel.com/docs/projects/environment-variables)
3. Consult [Clerk authentication setup](https://clerk.com/docs/quickstarts/nextjs)
4. Visit [OpenRouter documentation](https://openrouter.ai/docs)

---

**Last Updated:** September 2025
**Version:** 1.0.0