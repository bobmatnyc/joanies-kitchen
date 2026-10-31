# Environment Variables Quick Reference

> **Authentication is Auth.js with Google (#22).** The app reads `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_ADMIN_EMAILS` and (production only) `AUTH_URL`; see [the authentication guide](../guides/authentication.md). The former Clerk variables are not read by the code.

## Overview

This document provides a quick reference for all environment variables used in the Recipe Manager application.

---

## Required Variables

| Variable | Type | Purpose | Where to Get |
|----------|------|---------|--------------|
| `DATABASE_URL` | Secret | PostgreSQL connection (pooled) | [Neon Console](https://console.neon.tech) → Connection Details → Pooled |
| `AUTH_SECRET` | Secret | Auth.js session signing | `npx auth secret` or `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` | Secret | Google OAuth client ID | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials |
| `AUTH_GOOGLE_SECRET` | Secret | Google OAuth client secret | Same OAuth client |
| `OPENROUTER_API_KEY` | Secret | AI recipe generation | [OpenRouter](https://openrouter.ai) → API Keys |
| `BRAVE_SEARCH_API_KEY` | Secret | Web recipe search | [Brave Search API](https://brave.com/search/api) → API Keys |
| `HUGGINGFACE_API_KEY` | Secret | Semantic search embeddings | [Hugging Face](https://huggingface.co) → Settings → Access Tokens |
| `NEXT_PUBLIC_APP_URL` | Public | Application base URL | Your production domain |

---

## Optional Variables

| Variable | Type | Purpose | Default |
|----------|------|---------|---------|
| `DATABASE_URL_UNPOOLED` | Secret | Direct database connection | N/A |
| `AUTH_URL` | Config | Canonical site URL for Auth.js (set in Vercel Production only) | `https://joanies.kitchen` |
| `AUTH_ADMIN_EMAILS` | Secret | Comma-separated admin emails; grants `users.is_admin` at sign-in | Unset: no env-based admin |

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

### Auth.js Keys

```
AUTH_SECRET=<random string from `openssl rand -base64 32`>
AUTH_GOOGLE_ID=<client id>.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=<google client secret>
AUTH_URL=https://joanies.kitchen                  # Vercel Production only
AUTH_ADMIN_EMAILS=<comma-separated admin emails>  # optional
```

### API Keys

**OpenRouter:**
```
OPENROUTER_API_KEY=sk-or-v1-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Brave Search:**
```
BRAVE_SEARCH_API_KEY=your-brave-search-api-key
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
- Your main domain (e.g., `joanies.kitchen`)

**Variables:**
```bash
DATABASE_URL=postgresql://...                          # Production database
AUTH_SECRET=...                                       # Production-only secret
AUTH_GOOGLE_ID=...                                    # Google OAuth client
AUTH_GOOGLE_SECRET=...
AUTH_URL=https://joanies.kitchen                      # Production only
AUTH_ADMIN_EMAILS=...                                 # Optional
OPENROUTER_API_KEY=sk-or-v1-...                       # Same across environments
BRAVE_SEARCH_API_KEY=your-brave-search-api-key  # Same across environments
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
AUTH_SECRET=...                                       # Not the production secret
# Google does not accept wildcard redirect URIs, so preview deployments cannot sign in.
OPENROUTER_API_KEY=sk-or-v1-...                       # Same as production
BRAVE_SEARCH_API_KEY=your-brave-search-api-key  # Same as production
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
AUTH_SECRET=...                                       # Local-only secret
AUTH_GOOGLE_ID=...                                    # Redirect URI: http://localhost:3002/api/auth/callback/google
AUTH_GOOGLE_SECRET=...
OPENROUTER_API_KEY=sk-or-v1-...                       # Same as production
BRAVE_SEARCH_API_KEY=your-brave-search-api-key  # Same as production
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

### 2. Google OAuth (Auth.js)

**URL:** https://console.cloud.google.com

**Steps:**
1. Open **APIs & Services** → **Credentials**
2. Create an OAuth client ID of type **Web application**
3. Add the redirect URIs `https://joanies.kitchen/api/auth/callback/google` and `http://localhost:3002/api/auth/callback/google`
4. Copy the client ID and secret into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`
5. Generate `AUTH_SECRET` with `openssl rand -base64 32`

Full setup: [the authentication guide](../guides/authentication.md).

**Cost:** Free

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
4. Copy key: `your-brave-search-api-key`

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
# Set AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET for sign-in

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
#    - Authentication (Auth.js with Google)
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

**Error:** Sign-in not working, or every request is signed out

**Solutions:**
1. Verify `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are all set; when any is missing the app runs signed-out
2. Check the redirect URI `<site>/api/auth/callback/google` is registered on the Google OAuth client
3. Check the email is seeded in `users` or listed in `AUTH_ADMIN_EMAILS` (registration is closed; a denied login lands on `/sign-in?error=AccessDenied`)
4. In production, verify `AUTH_URL` is `https://joanies.kitchen`

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
- Requires `AUTH_URL=https://joanies.kitchen`
- Monitor costs and usage closely

---

## Quick Copy-Paste Template

```bash
# Database
DATABASE_URL=
DATABASE_URL_UNPOOLED=

# Authentication
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_URL=
AUTH_ADMIN_EMAILS=

# AI Services
OPENROUTER_API_KEY=
BRAVE_SEARCH_API_KEY=your-brave-search-api-key
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
