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
   - Optionally add the Auth.js (Google) sign-in variables

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
| `AUTH_SECRET` | Auth.js session signing secret | `undefined` (signed-out mode) |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | `undefined` (signed-out mode) |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | `undefined` (signed-out mode) |
| `AUTH_URL` | Canonical site URL (Vercel Production only) | `undefined` |
| `AUTH_ADMIN_EMAILS` | Comma-separated admin emails | `undefined` (no env-based admin) |
| `NODE_ENV` | Node.js environment | `development` |

Sign-in uses Auth.js with Google only. See the [authentication guide](./authentication.md).

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
- Leave the `AUTH_*` variables empty or commented out
- The app runs signed-out: nobody can sign in, and protected and admin routes stay closed
- Suitable for browsing public recipes

#### With Google Sign-In (Auth.js)
1. Create a Google OAuth client (Web application) in [Google Cloud Console](https://console.cloud.google.com/)
2. Copy the client ID to `AUTH_GOOGLE_ID` and the secret to `AUTH_GOOGLE_SECRET`
3. Generate `AUTH_SECRET` with `openssl rand -base64 32`
4. Register the redirect URIs on the OAuth client:
   - `http://localhost:3002/api/auth/callback/google` for development (use your dev port)
   - `https://joanies.kitchen/api/auth/callback/google` for production
5. Seed your user with `pnpm auth:seed-user` (registration is closed)

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

# Add Auth.js (Google) sign-in (if using)
vercel env add AUTH_SECRET production
vercel env add AUTH_GOOGLE_ID production
vercel env add AUTH_GOOGLE_SECRET production
vercel env add AUTH_URL production

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
```

Preview deployments cannot sign in: Google does not accept wildcard redirect URIs.

### 3. Domain Configuration

For custom domains:

1. Add your domain in Vercel dashboard
2. Update `NEXT_PUBLIC_APP_URL` to your custom domain
3. Update `AUTH_URL` and the Google OAuth client's origins and redirect URIs if using authentication

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

### 4. Authentication Security

- Register only the redirect URIs you use on the Google OAuth client
- Use a different `AUTH_SECRET` for each environment (rotating it signs everyone out)
- Keep `AUTH_ADMIN_EMAILS` values out of code, docs and commits

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

#### Authentication Issues
```bash
# Inspect the current session
curl http://localhost:3002/api/auth/session
```

Common solutions:
- Verify `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are all set; if any is missing the app runs signed-out
- Check the redirect URI is registered on the Google OAuth client
- Check the email is seeded in `users` or listed in `AUTH_ADMIN_EMAILS`

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
3. Read the [authentication guide](./authentication.md)
4. Visit [OpenRouter documentation](https://openrouter.ai/docs)

---

**Last Updated:** October 2025
**Version:** 1.0.0
