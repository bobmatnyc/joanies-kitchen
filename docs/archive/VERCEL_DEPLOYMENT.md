# Vercel Deployment Guide - Recipe Manager

## Overview

This guide provides step-by-step instructions for deploying the Recipe Manager application to Vercel with all required environment variables and integrations.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables Configuration](#environment-variables-configuration)
3. [Deployment Steps](#deployment-steps)
4. [Post-Deployment Verification](#post-deployment-verification)
5. [Troubleshooting](#troubleshooting)
6. [API Key Management](#api-key-management)

---

## Prerequisites

Before deploying to Vercel, ensure you have:

- [ ] A Vercel account (https://vercel.com)
- [ ] GitHub repository connected to Vercel
- [ ] Neon PostgreSQL database set up
- [ ] Clerk account with production keys configured
- [ ] All required API keys obtained (see [API Key Management](#api-key-management))

---

## Environment Variables Configuration

### Step 1: Access Vercel Dashboard

1. Navigate to: https://vercel.com/dashboard
2. Select your Recipe Manager project
3. Go to: **Settings** → **Environment Variables**

### Step 2: Add Required Variables

Configure all environment variables with the following scopes:
- ✅ **Production** (for production deployments)
- ✅ **Preview** (for preview deployments from PRs)
- ✅ **Development** (for local development via `vercel dev`)

---

### Database Configuration

#### `DATABASE_URL` (Required)
**Description**: Primary PostgreSQL connection string for Neon database with connection pooling

**Format**:
```
postgresql://user:password@host/database?sslmode=require
```

**How to get**:
1. Go to your Neon dashboard: https://console.neon.tech
2. Select your project
3. Go to **Connection Details**
4. Copy the **Pooled connection** string
5. Ensure it includes `?sslmode=require`

**Scopes**: Production, Preview, Development

---

#### `DATABASE_URL_UNPOOLED` (Optional)
**Description**: Direct PostgreSQL connection for migrations and administrative tasks

**Format**:
```
postgresql://user:password@host/database?sslmode=require
```

**How to get**:
1. In Neon dashboard, go to **Connection Details**
2. Copy the **Direct connection** string
3. Ensure it includes `?sslmode=require`

**Scopes**: Production, Preview, Development

---

### Authentication (Clerk)

#### `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (Required)
**Description**: Clerk publishable key for client-side authentication

**Format**: `pk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

**How to get**:
1. Go to: https://dashboard.clerk.com/
2. Select your Recipe Manager application
3. Navigate to: **API Keys**
4. Copy the **Publishable Key** for **Production**

**Important**:
- Use `pk_live_` keys for Production
- Use `pk_test_` keys for Preview/Development

**Scopes**:
- Production: Use `pk_live_` key
- Preview/Development: Use `pk_test_` key

---

#### `CLERK_SECRET_KEY` (Required)
**Description**: Clerk secret key for server-side authentication

**Format**: `sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

**How to get**:
1. In Clerk Dashboard → **API Keys**
2. Copy the **Secret Key** for **Production**
3. **IMPORTANT**: Never expose this key in client-side code

**Security Note**: This is a sensitive credential. Never commit to git or share publicly.

**Scopes**:
- Production: Use `sk_live_` key
- Preview/Development: Use `sk_test_` key

---

### AI/ML Services

#### `OPENROUTER_API_KEY` (Required)
**Description**: OpenRouter API key for AI-powered recipe features (generation, search, substitutions)

**Format**: `sk-or-v1-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

**How to get**:
1. Create account at: https://openrouter.ai/
2. Navigate to: **API Keys**
3. Click **Create Key**
4. Copy the generated key

**Features enabled**:
- AI recipe generation
- Ingredient substitution suggestions
- Search query enhancement
- Recipe description generation

**Scopes**: Production, Preview, Development

---

#### `BRAVE_SEARCH_API_KEY` (Required)
**Description**: Brave Search API key for web recipe search and discovery

**Format**: `BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T`

**Value**: `BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T`

**How to get**:
1. Go to: https://brave.com/search/api/
2. Sign up for API access
3. Navigate to: **API Keys**
4. Create a new key

**Features enabled**:
- Web recipe search
- Recipe discovery
- Ingredient information lookup
- Cooking technique research

**Scopes**: Production, Preview, Development

---

#### `HUGGINGFACE_API_KEY` (Required)
**Description**: Hugging Face API key for text embeddings and semantic search

**Format**: `hf_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

**How to get**:
1. Create account at: https://huggingface.co/
2. Navigate to: **Settings** → **Access Tokens**
3. Click **New Token**
4. Select **Read** permissions
5. Copy the generated token

**Features enabled**:
- Semantic recipe search
- Vector embeddings for recipes
- Similar recipe recommendations
- Ingredient similarity matching

**Important**: This is required for pgvector semantic search functionality.

**Scopes**: Production, Preview, Development

---

### Application Configuration

#### `NEXT_PUBLIC_APP_URL` (Required)
**Description**: Public URL of your deployed application

**Format**: `https://your-domain.vercel.app`

**Values by environment**:
- **Production**: `https://your-production-domain.com` or `https://your-app.vercel.app`
- **Preview**: Leave empty (Vercel auto-generates preview URLs)
- **Development**: `http://localhost:3004`

**How to configure**:
1. For Production: Use your custom domain or Vercel deployment URL
2. For Preview: Not needed (Vercel handles this)
3. For Development: Use `http://localhost:3004`

**Scopes**: Production (required), Development (optional)

---

#### `NODE_ENV` (Auto-managed by Vercel)
**Description**: Node.js environment mode

**Values**:
- `production` (automatically set by Vercel in production)
- `development` (for local development)

**Important**: Do NOT manually set this in Vercel. Vercel manages it automatically.

---

### Optional Authentication Configuration

#### `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
**Default**: `/sign-in`
**Description**: Custom sign-in page URL

#### `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
**Default**: `/sign-up`
**Description**: Custom sign-up page URL

#### `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
**Default**: `/`
**Description**: Redirect URL after successful sign-in

#### `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`
**Default**: `/`
**Description**: Redirect URL after successful sign-up

**Note**: These are optional. Only set if you want to customize the authentication flow.

---

## Deployment Steps

### Step 1: Prepare Your Repository

1. Ensure all code is committed and pushed to your main branch
2. Verify your `package.json` includes all necessary build scripts:
   ```json
   {
     "scripts": {
       "build": "next build",
       "start": "next start"
     }
   }
   ```

### Step 2: Connect to Vercel

1. Go to: https://vercel.com/new
2. Import your GitHub repository
3. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (or `pnpm build`)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (or `pnpm install`)

### Step 3: Add Environment Variables

Using the Vercel Dashboard (Settings → Environment Variables), add all variables listed above:

**Quick Checklist**:
- [ ] `DATABASE_URL`
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- [ ] `CLERK_SECRET_KEY`
- [ ] `OPENROUTER_API_KEY`
- [ ] `BRAVE_SEARCH_API_KEY`
- [ ] `HUGGINGFACE_API_KEY`
- [ ] `NEXT_PUBLIC_APP_URL`

**Important**:
- Select appropriate scopes (Production, Preview, Development) for each variable
- Use production keys (`pk_live_`, `sk_live_`) for Production environment
- Use test keys (`pk_test_`, `sk_test_`) for Preview/Development environments

### Step 4: Configure Clerk Production Settings

1. Go to Clerk Dashboard: https://dashboard.clerk.com/
2. Select your application
3. Navigate to: **Configure** → **Domains**
4. Add your production domain:
   - If using custom domain: `your-domain.com`
   - If using Vercel domain: `your-app.vercel.app`
5. Ensure the domain is verified and active

### Step 5: Deploy

1. In Vercel Dashboard, click **Deploy**
2. Wait for deployment to complete
3. Vercel will:
   - Install dependencies
   - Run database migrations (if configured)
   - Build the Next.js application
   - Deploy to production

### Step 6: Configure Custom Domain (Optional)

1. In Vercel Dashboard → **Settings** → **Domains**
2. Add your custom domain
3. Configure DNS records as instructed by Vercel
4. Wait for DNS propagation (can take up to 48 hours)

---

## Post-Deployment Verification

After deployment completes, verify all functionality works correctly:

### 1. Application Health Check

- [ ] Visit your production URL
- [ ] Verify homepage loads without errors
- [ ] Check browser console for errors (F12 → Console)
- [ ] Verify no 500/404 errors on main pages

### 2. Database Connectivity

- [ ] Navigate to a recipe page
- [ ] Verify recipes load from database
- [ ] Try creating a new recipe
- [ ] Verify data persists after page refresh

**Test URL**: `https://your-domain.com/recipes`

### 3. Authentication (Clerk)

- [ ] Click "Sign In" button
- [ ] Verify Clerk sign-in modal appears
- [ ] Test Google OAuth sign-in
- [ ] Test email/password sign-in
- [ ] Verify successful authentication redirects correctly
- [ ] Check user profile loads correctly

**Common Issues**:
- If Clerk modal doesn't appear: Check `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is set correctly
- If sign-in fails: Verify production domain is added in Clerk Dashboard
- If redirects fail: Check `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` is correct

### 4. AI Features (OpenRouter)

- [ ] Navigate to recipe generator
- [ ] Enter ingredients or dietary preferences
- [ ] Click "Generate Recipe"
- [ ] Verify AI-generated recipe appears
- [ ] Test ingredient substitution suggestions

**Test URL**: `https://your-domain.com/recipes/generate`

**Common Issues**:
- If generation fails: Check `OPENROUTER_API_KEY` is valid
- If API quota exceeded: Check OpenRouter account balance
- If slow response: Normal for first request (cold start)

### 5. Web Search (Brave Search API)

- [ ] Use recipe search feature
- [ ] Search for a recipe by name
- [ ] Verify web results appear
- [ ] Test importing recipe from URL

**Test URL**: `https://your-domain.com/recipes/search`

**Common Issues**:
- If search returns no results: Verify `BRAVE_SEARCH_API_KEY` is correct
- If API limit reached: Check Brave API usage dashboard

### 6. Semantic Search (Hugging Face + pgvector)

- [ ] Perform semantic search (e.g., "Italian pasta dishes")
- [ ] Verify similar recipes are returned
- [ ] Test ingredient-based similarity search
- [ ] Check recommendation system works

**Test URL**: `https://your-domain.com/recipes?search=italian+pasta`

**Common Issues**:
- If semantic search fails: Verify `HUGGINGFACE_API_KEY` is set
- If vector search returns errors: Check pgvector extension is enabled in database
- If embeddings fail: Verify Hugging Face API quota

### 7. End-to-End User Flow

Complete this full user journey:

1. [ ] Visit homepage (not signed in)
2. [ ] Browse public recipes
3. [ ] Sign in with Clerk
4. [ ] Generate a new recipe with AI
5. [ ] Save recipe to library
6. [ ] Add recipe to meal plan
7. [ ] Generate shopping list
8. [ ] Search for similar recipes (semantic search)
9. [ ] Import recipe from web URL
10. [ ] Sign out

---

## Troubleshooting

### Build Failures

**Issue**: Build fails with TypeScript errors
**Solution**:
```bash
# Run locally to identify issues
pnpm build

# Fix TypeScript errors
pnpm tsc --noEmit
```

---

**Issue**: Build fails with dependency errors
**Solution**:
```bash
# Clear lock file and reinstall
rm pnpm-lock.yaml
pnpm install
```

---

### Runtime Errors

**Issue**: `DATABASE_URL is not defined`
**Solution**:
1. Verify environment variable is set in Vercel Dashboard
2. Check variable scope includes "Production"
3. Trigger new deployment after adding variable

---

**Issue**: Clerk authentication fails
**Solution**:
1. Verify production domain is added in Clerk Dashboard
2. Check `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` matches production key
3. Ensure you're using `pk_live_` key for production
4. Verify `CLERK_SECRET_KEY` is set correctly

---

**Issue**: OpenRouter API returns 401 Unauthorized
**Solution**:
1. Verify `OPENROUTER_API_KEY` is correct
2. Check API key is active in OpenRouter dashboard
3. Ensure account has sufficient credits

---

**Issue**: Semantic search not working
**Solution**:
1. Verify `HUGGINGFACE_API_KEY` is set
2. Check pgvector extension is enabled:
   ```sql
   -- Run in Neon SQL Editor
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Verify embeddings table exists and has data

---

**Issue**: Web search returns no results
**Solution**:
1. Verify `BRAVE_SEARCH_API_KEY` is correct
2. Check Brave API usage limits
3. Test API key directly: https://api.search.brave.com/res/v1/web/search?q=test

---

### Performance Issues

**Issue**: Slow page loads
**Solution**:
1. Check database connection pooling is enabled
2. Verify `DATABASE_URL` uses pooled connection
3. Enable Next.js caching where appropriate
4. Consider implementing CDN for static assets

---

**Issue**: Cold starts causing slow API responses
**Solution**:
1. This is normal for serverless functions
2. Consider Vercel Pro plan for faster cold starts
3. Implement loading states in UI
4. Use React Suspense for better UX

---

### Database Issues

**Issue**: Database connection timeout
**Solution**:
1. Verify Neon database is active
2. Check connection string includes `?sslmode=require`
3. Verify database is not paused (Neon free tier)
4. Check Neon compute is running

---

**Issue**: Migration failures
**Solution**:
```bash
# Run migrations locally first
pnpm db:migrate

# Then push to production
# Migrations run automatically on Vercel build
```

---

## API Key Management

### Security Best Practices

1. **Never commit API keys to git**
   - Always use environment variables
   - Add `.env.local` to `.gitignore`
   - Review commits before pushing

2. **Rotate keys regularly**
   - Set calendar reminders for quarterly key rotation
   - Update keys in Vercel immediately after rotation
   - Test thoroughly after key updates

3. **Use different keys per environment**
   - Production: Live/production keys
   - Preview: Test/development keys
   - Development: Test/development keys

4. **Monitor API usage**
   - Set up billing alerts
   - Monitor usage dashboards
   - Set rate limits where possible

5. **Restrict key permissions**
   - Use minimum required permissions
   - Implement IP allowlisting where available
   - Use domain restrictions for client-side keys

### API Key Checklist

#### Neon PostgreSQL Database
- [ ] Account created: https://console.neon.tech
- [ ] Database provisioned
- [ ] Connection string obtained
- [ ] pgvector extension enabled

#### Clerk Authentication
- [ ] Account created: https://dashboard.clerk.com
- [ ] Application configured
- [ ] Production keys obtained (`pk_live_`, `sk_live_`)
- [ ] Test keys obtained (`pk_test_`, `sk_test_`)
- [ ] Production domain configured
- [ ] Google OAuth configured (if using)

#### OpenRouter API
- [ ] Account created: https://openrouter.ai
- [ ] API key generated
- [ ] Credits added to account
- [ ] Usage limits configured

#### Brave Search API
- [ ] Account created: https://brave.com/search/api
- [ ] API key obtained: `BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T`
- [ ] Usage tier confirmed
- [ ] Rate limits reviewed

#### Hugging Face API
- [ ] Account created: https://huggingface.co
- [ ] Access token generated (Read permissions)
- [ ] Model access confirmed (sentence-transformers)
- [ ] Rate limits reviewed

---

## Environment Variables Quick Reference

| Variable | Type | Required | Environment |
|----------|------|----------|-------------|
| `DATABASE_URL` | Secret | Yes | All |
| `DATABASE_URL_UNPOOLED` | Secret | No | All |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Public | Yes | All |
| `CLERK_SECRET_KEY` | Secret | Yes | All |
| `OPENROUTER_API_KEY` | Secret | Yes | All |
| `BRAVE_SEARCH_API_KEY` | Secret | Yes | All |
| `HUGGINGFACE_API_KEY` | Secret | Yes | All |
| `NEXT_PUBLIC_APP_URL` | Public | Yes | Production |
| `NODE_ENV` | Auto | N/A | Auto-managed |

**Legend**:
- **Public**: Can be exposed to client-side code (prefix: `NEXT_PUBLIC_`)
- **Secret**: Server-side only, never exposed to client
- **Auto**: Automatically managed by Vercel

---

## Additional Resources

### Documentation
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Clerk Production Checklist](https://clerk.com/docs/deployments/production-checklist)
- [Neon PostgreSQL Docs](https://neon.tech/docs)
- [OpenRouter API Docs](https://openrouter.ai/docs)
- [Brave Search API Docs](https://brave.com/search/api/docs)
- [Hugging Face Inference API](https://huggingface.co/docs/api-inference)

### Support Channels
- Vercel Support: https://vercel.com/support
- Clerk Support: https://clerk.com/support
- Neon Support: https://neon.tech/docs/introduction/support
- OpenRouter Discord: https://discord.gg/openrouter

---

## Deployment Checklist

Before marking deployment complete, ensure:

- [ ] All environment variables configured in Vercel
- [ ] Production deployment successful (no build errors)
- [ ] Homepage loads without errors
- [ ] Database connectivity verified
- [ ] Clerk authentication works (sign in/sign up)
- [ ] AI recipe generation works (OpenRouter)
- [ ] Web search works (Brave Search API)
- [ ] Semantic search works (Hugging Face + pgvector)
- [ ] Recipe CRUD operations work
- [ ] Meal planning features work
- [ ] Shopping list generation works
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate active
- [ ] Performance acceptable (< 3s load time)
- [ ] Mobile responsive design verified
- [ ] Browser console shows no errors
- [ ] API rate limits configured
- [ ] Monitoring/analytics set up (optional)

---

## Next Steps

After successful deployment:

1. **Monitor Application Health**
   - Set up Vercel Analytics
   - Configure error tracking (e.g., Sentry)
   - Set up uptime monitoring

2. **Optimize Performance**
   - Enable Next.js Image Optimization
   - Configure CDN caching
   - Implement database query optimization

3. **Set Up CI/CD**
   - Configure automatic deployments from main branch
   - Set up preview deployments for PRs
   - Add automated testing in pipeline

4. **Security Hardening**
   - Enable Vercel Web Application Firewall (WAF)
   - Set up rate limiting
   - Configure CSP headers
   - Enable CORS policies

5. **User Feedback**
   - Set up user feedback mechanism
   - Monitor error rates
   - Track feature usage
   - Gather user testimonials

---

**Last Updated**: 2025-10-14
**Version**: 1.0.0
