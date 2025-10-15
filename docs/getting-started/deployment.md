# Deployment Guide

Complete guide for deploying Joanie's Kitchen to production on Vercel.

## Pre-Deployment Checklist

### 1. Code Preparation

- [ ] All code committed to git
- [ ] All changes pushed to main branch
- [ ] Build succeeds locally: `pnpm build`
- [ ] TypeScript compiles without errors: `pnpm tsc --noEmit`
- [ ] No console errors in development
- [ ] All tests passing (if applicable)

### 2. Environment Variables Ready

- [ ] `DATABASE_URL` - Neon PostgreSQL pooled connection
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Production key (pk_live_)
- [ ] `CLERK_SECRET_KEY` - Production key (sk_live_)
- [ ] `OPENROUTER_API_KEY` - API key with sufficient credits
- [ ] `BRAVE_SEARCH_API_KEY` - API key (optional)
- [ ] `HUGGINGFACE_API_KEY` - API token (optional)
- [ ] `NEXT_PUBLIC_APP_URL` - Production domain URL

### 3. Database Setup

- [ ] Neon PostgreSQL project created
- [ ] pgvector extension enabled: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Database migrations applied
- [ ] Database connection tested
- [ ] Connection pooling enabled
- [ ] SSL mode configured (`?sslmode=require`)

### 4. Clerk Authentication Setup

- [ ] Clerk application created
- [ ] Production keys generated (pk_live_, sk_live_)
- [ ] Production domain added to Clerk Dashboard
- [ ] Domain verified and active
- [ ] Sign-in/sign-up flows tested

## Deployment Steps

### Step 1: Vercel Project Setup

1. Navigate to https://vercel.com/new
2. Import GitHub repository
3. Select correct repository
4. Configure framework preset: Next.js
5. Verify root directory: `./`
6. Confirm build command: `pnpm build` or `npm run build`
7. Confirm output directory: `.next`

### Step 2: Environment Variables Configuration

**Access Vercel Dashboard:**
- Go to project Settings
- Navigate to Environment Variables section

**Add Production Variables:**
- `DATABASE_URL` → Production, Preview, Development
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → Production (pk_live_), Preview/Dev (pk_test_)
- `CLERK_SECRET_KEY` → Production (sk_live_), Preview/Dev (sk_test_)
- `OPENROUTER_API_KEY` → Production, Preview, Development
- `NEXT_PUBLIC_APP_URL` → Production only

### Step 3: Clerk Production Configuration

1. Open Clerk Dashboard: https://dashboard.clerk.com
2. Select Recipe Manager application
3. Navigate to Configure → Domains
4. Add production domain (e.g., your-app.vercel.app)
5. Verify domain is active
6. Test authentication flow on production domain

### Step 4: Initial Deployment

1. Click Deploy in Vercel Dashboard
2. Monitor build logs for errors
3. Wait for deployment to complete
4. Note deployment URL
5. Check deployment status: Success

### Step 5: Custom Domain (Optional)

1. Navigate to Settings → Domains
2. Add custom domain
3. Configure DNS records as instructed
4. Wait for DNS propagation (up to 48 hours)
5. Verify SSL certificate issued
6. Test HTTPS access

## Post-Deployment Verification

### 1. Application Health

- [ ] Visit production URL
- [ ] Homepage loads without errors
- [ ] Open browser console (F12)
- [ ] Verify no JavaScript errors
- [ ] Verify no 404/500 errors

### 2. Database Connectivity

- [ ] Navigate to `/recipes`
- [ ] Verify recipes load from database
- [ ] Create a test recipe
- [ ] Verify data persists

### 3. Authentication

- [ ] Test sign-up flow
- [ ] Test sign-in flow
- [ ] Test sign-out flow
- [ ] Verify protected routes work

### 4. AI Features

- [ ] Test recipe generation
- [ ] Verify AI responses
- [ ] Check response times

## Performance Verification

### Page Load Performance

- [ ] Homepage loads in < 3 seconds
- [ ] Recipe pages load in < 2 seconds
- [ ] AI generation completes in < 10 seconds
- [ ] Search results appear in < 1 second

### Lighthouse Scores

Run Lighthouse audit (Chrome DevTools):
- [ ] Performance score > 80
- [ ] Accessibility score > 90
- [ ] Best Practices score > 90
- [ ] SEO score > 80

## Security Verification

### Environment Variables

- [ ] No secrets in client-side code
- [ ] No API keys in browser console
- [ ] All secrets in Vercel Environment Variables

### Authentication

- [ ] Protected routes require authentication
- [ ] Session management works correctly
- [ ] Sign-out clears all session data

### API Security

- [ ] API routes validate authentication
- [ ] CORS configured correctly
- [ ] Input validation on all forms

## Rollback Plan

### If Deployment Fails

1. Note the error message
2. Check Vercel build logs
3. Verify environment variables
4. Test build locally: `pnpm build`
5. Fix issues and redeploy

### If Critical Bug Found

1. Identify the issue
2. Rollback to previous deployment in Vercel
3. Fix bug in development
4. Test thoroughly locally
5. Redeploy after verification

## Troubleshooting

### Common Issues

**Build fails with TypeScript errors**
```bash
# Solution: Run locally and fix
pnpm tsc --noEmit
pnpm build
```

**Environment variable not found**
- Check variable is set in Vercel Dashboard
- Verify correct scope (Production/Preview/Development)
- Trigger new deployment after adding variable

**Clerk authentication fails**
- Verify production domain added in Clerk Dashboard
- Check using correct keys (pk_live_, sk_live_)
- Ensure domain is verified

**Database connection timeout**
- Verify Neon database is active (not paused)
- Check connection string includes `?sslmode=require`
- Verify connection pooling enabled

## Continuous Deployment

### Automatic Deployments

Vercel automatically deploys when you push to your repository:

- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

### Manual Deployments

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls
```

## Monitoring

### Post-Deployment Tasks

- [ ] Monitor error logs for 24 hours
- [ ] Watch for user-reported issues
- [ ] Track API usage and costs
- [ ] Enable Vercel Analytics

### Error Tracking

Consider setting up:
- Sentry for error tracking
- Uptime monitoring
- Performance monitoring

---

**Last Updated:** October 2025
**Version:** 1.0.0
