# Environment Variables Quick Reference

## Overview

This document provides a quick reference for all environment variables used in the Recipe Manager application.

---

## Required Variables

| Variable | Type | Purpose | Where to Get |
|----------|------|---------|--------------|
| `DATABASE_URL` | Secret | PostgreSQL connection (pooled) | [Neon Console](https://console.neon.tech) → Connection Details → Pooled |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public | Clerk authentication (client) | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `CLERK_SECRET_KEY` | Secret | Clerk authentication (server) | [Clerk Dashboard](https://dashboard.clerk.com) → API Keys |
| `OPENROUTER_API_KEY` | Secret | AI recipe generation | [OpenRouter](https://openrouter.ai) → API Keys |
| `BRAVE_SEARCH_API_KEY` | Secret | Web recipe search | [Brave Search API](https://brave.com/search/api) → API Keys |
| `HUGGINGFACE_API_KEY` | Secret | Semantic search embeddings | [Hugging Face](https://huggingface.co) → Settings → Access Tokens |
| `NEXT_PUBLIC_APP_URL` | Public | Application base URL | Your production domain |

---

## Optional Variables

| Variable | Type | Purpose | Default |
|----------|------|---------|---------|
| `DATABASE_URL_UNPOOLED` | Secret | Direct database connection | N/A |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Public | Custom sign-in page | `/sign-in` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Public | Custom sign-up page | `/sign-up` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | Public | Redirect after sign-in | `/` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | Public | Redirect after sign-up | `/` |

---

## Variable Formats

### Database URLs

**Pooled Connection (Primary):**
```
postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/database?sslmode=require
```

**Direct Connection (Migrations):**
```
postgresql://user:password@ep-xxx-xxx.region.aws.neon.tech/database?sslmode=require
```

### Clerk Keys

**Production (Live):**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
CLERK_SECRET_KEY=sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Development (Test):**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
CLERK_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### API Keys

**OpenRouter:**
```
OPENROUTER_API_KEY=sk-or-v1-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Brave Search:**
```
BRAVE_SEARCH_API_KEY=BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T
```

**Hugging Face:**
```
HUGGINGFACE_API_KEY=hf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Vercel Environment Scopes

### Production Scope

Use **production/live keys** for:
- Production deployments
- Your main domain (e.g., `recipes.help`)

**Variables:**
```bash
DATABASE_URL=postgresql://...                          # Production database
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...         # Live Clerk key
CLERK_SECRET_KEY=sk_live_...                          # Live Clerk secret
OPENROUTER_API_KEY=sk-or-v1-...                       # Same across environments
BRAVE_SEARCH_API_KEY=BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T  # Same across environments
HUGGINGFACE_API_KEY=hf_...                            # Same across environments
NEXT_PUBLIC_APP_URL=https://your-domain.com           # Production domain
```

### Preview Scope

Use **test/development keys** for:
- PR preview deployments
- Vercel preview URLs (e.g., `your-app-git-branch.vercel.app`)

**Variables:**
```bash
DATABASE_URL=postgresql://...                          # Can use same or separate database
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...         # Test Clerk key
CLERK_SECRET_KEY=sk_test_...                          # Test Clerk secret
OPENROUTER_API_KEY=sk-or-v1-...                       # Same as production
BRAVE_SEARCH_API_KEY=BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T  # Same as production
HUGGINGFACE_API_KEY=hf_...                            # Same as production
# NEXT_PUBLIC_APP_URL - Leave empty (Vercel auto-generates)
```

### Development Scope

Use **test/development keys** for:
- Local development (`localhost:3004`)
- `vercel dev` command

**Variables:**
```bash
DATABASE_URL=postgresql://...                          # Local or dev database
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...         # Test Clerk key
CLERK_SECRET_KEY=sk_test_...                          # Test Clerk secret
OPENROUTER_API_KEY=sk-or-v1-...                       # Same as production
BRAVE_SEARCH_API_KEY=BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T  # Same as production
HUGGINGFACE_API_KEY=hf_...                            # Same as production
NEXT_PUBLIC_APP_URL=http://localhost:3004             # Local URL
```

---

## API Key Acquisition

### 1. Neon PostgreSQL

**URL:** https://console.neon.tech

**Steps:**
1. Create account
2. Create new project
3. Navigate to **Connection Details**
4. Copy **Pooled connection** string
5. Enable pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

**Cost:** Free tier available (0.5 GiB storage)

---

### 2. Clerk Authentication

**URL:** https://dashboard.clerk.com

**Steps:**
1. Create account
2. Create new application
3. Go to **API Keys**
4. Copy **Publishable Key** and **Secret Key**
5. Note: Get both **test** and **live** keys
6. Configure production domain in **Domains** section

**Cost:** Free tier available (10,000 MAUs)

---

### 3. OpenRouter API

**URL:** https://openrouter.ai

**Steps:**
1. Create account
2. Add credits to account
3. Navigate to **API Keys**
4. Click **Create Key**
5. Copy generated key

**Cost:** Pay-per-use (varies by model)
- Claude Sonnet: ~$3 per 1M tokens
- GPT-4o: ~$5 per 1M tokens

---

### 4. Brave Search API

**URL:** https://brave.com/search/api

**Steps:**
1. Sign up for API access
2. Navigate to **API Keys**
3. Create new API key
4. Copy key: `BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T`

**Cost:** Free tier available (2,000 queries/month)

---

### 5. Hugging Face API

**URL:** https://huggingface.co

**Steps:**
1. Create account
2. Navigate to **Settings** → **Access Tokens**
3. Click **New Token**
4. Select **Read** permissions
5. Copy generated token

**Cost:** Free tier available (rate limits apply)

---

## Security Best Practices

### DO

- ✅ Use environment variables for all secrets
- ✅ Store secrets in Vercel Dashboard, not in code
- ✅ Use different keys for production vs development
- ✅ Rotate API keys quarterly
- ✅ Monitor API usage and set billing alerts
- ✅ Enable 2FA on all service accounts
- ✅ Use `.gitignore` for `.env.local` files

### DON'T

- ❌ Commit API keys to git
- ❌ Share secrets in screenshots or logs
- ❌ Use production keys in development
- ❌ Expose secrets in client-side code
- ❌ Hard-code credentials in source files
- ❌ Share `.env.local` files

---

## Testing Variables

### Local Testing

```bash
# 1. Copy example environment file
cp .env.example .env.local

# 2. Fill in your development values
# Use pk_test_ and sk_test_ keys for Clerk

# 3. Test configuration
pnpm dev

# 4. Verify all integrations work
```

### Production Testing

```bash
# 1. Add all variables in Vercel Dashboard
# 2. Deploy to Vercel
# 3. Test each integration:
#    - Database connectivity
#    - Authentication (Clerk)
#    - AI recipe generation (OpenRouter)
#    - Web search (Brave)
#    - Semantic search (Hugging Face)
```

---

## Troubleshooting

### Variable Not Found

**Error:** `process.env.VARIABLE_NAME is undefined`

**Solutions:**
1. Check variable exists in Vercel Dashboard
2. Verify correct scope selected (Production/Preview/Development)
3. Trigger new deployment after adding variable
4. Check variable name matches exactly (case-sensitive)

### Authentication Fails

**Error:** Clerk authentication not working

**Solutions:**
1. Verify using correct keys (pk_live_ for production, pk_test_ for dev)
2. Check production domain added in Clerk Dashboard
3. Ensure domain is verified and active
4. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is public (has prefix)

### Database Connection Timeout

**Error:** Cannot connect to database

**Solutions:**
1. Verify Neon database is active (not paused)
2. Check connection string includes `?sslmode=require`
3. Verify connection pooling enabled
4. Test connection string locally

### API Key Invalid

**Error:** 401 Unauthorized from API

**Solutions:**
1. Verify API key is correct and active
2. Check account has sufficient credits/quota
3. Test API key directly in service dashboard
4. Ensure no extra spaces in key value

---

## Environment-Specific Notes

### Local Development (.env.local)

- Use test/development keys
- Can use separate development database
- Enable debug logging if needed
- Set `NEXT_PUBLIC_APP_URL=http://localhost:3004`

### Vercel Preview (PR Deployments)

- Automatically uses Preview scope variables
- Good for testing before production
- Can use same database or separate staging database
- Preview URLs auto-generated by Vercel

### Vercel Production

- Uses Production scope variables
- Must use live/production keys
- Requires custom domain for Clerk production
- Monitor costs and usage closely

---

## Quick Copy-Paste Template

```bash
# Database
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# AI Services
OPENROUTER_API_KEY=
BRAVE_SEARCH_API_KEY=BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T
HUGGINGFACE_API_KEY=

# Application
NEXT_PUBLIC_APP_URL=
```

---

## Additional Resources

- [Complete Deployment Guide](./VERCEL_DEPLOYMENT.md)
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)
- [Production Environment Example](../.env.production.example)
- [Local Development Example](../.env.example)

---

**Last Updated:** 2025-10-14
**Version:** 1.0.0
