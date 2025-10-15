# Vercel Deployment Checklist - Recipe Manager

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
- [ ] `DATABASE_URL_UNPOOLED` - Neon PostgreSQL direct connection (optional)
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Production key (pk_live_)
- [ ] `CLERK_SECRET_KEY` - Production key (sk_live_)
- [ ] `OPENROUTER_API_KEY` - API key with sufficient credits
- [ ] `BRAVE_SEARCH_API_KEY` - API key (BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T)
- [ ] `HUGGINGFACE_API_KEY` - API token with Read permissions
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
- [ ] Test keys generated (pk_test_, sk_test_)
- [ ] Production domain added to Clerk Dashboard
- [ ] Domain verified and active
- [ ] Google OAuth configured (optional)
- [ ] Sign-in/sign-up flows tested

### 5. API Services Configuration

**OpenRouter:**
- [ ] Account created with sufficient credits
- [ ] API key generated and tested
- [ ] Model access verified (e.g., Claude, GPT)
- [ ] Usage limits reviewed

**Brave Search:**
- [ ] API key obtained: BSA2IWyjQXpnW3qLL7rykFt8VxOzc8T
- [ ] API quota confirmed
- [ ] Search functionality tested locally

**Hugging Face:**
- [ ] Account created
- [ ] Access token generated (Read permissions)
- [ ] Model access confirmed (sentence-transformers)
- [ ] Embeddings API tested

---

## Deployment Steps

### Step 1: Vercel Project Setup

- [ ] Navigate to https://vercel.com/new
- [ ] Import GitHub repository
- [ ] Select correct repository
- [ ] Configure framework preset: Next.js
- [ ] Verify root directory: `./`
- [ ] Confirm build command: `pnpm build` or `npm run build`
- [ ] Confirm output directory: `.next`

### Step 2: Environment Variables Configuration

**Access Vercel Dashboard:**
- [ ] Go to project Settings
- [ ] Navigate to Environment Variables section

**Add Production Variables:**
- [ ] `DATABASE_URL` → Production, Preview, Development
- [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` → Production (pk_live_), Preview/Dev (pk_test_)
- [ ] `CLERK_SECRET_KEY` → Production (sk_live_), Preview/Dev (sk_test_)
- [ ] `OPENROUTER_API_KEY` → Production, Preview, Development
- [ ] `BRAVE_SEARCH_API_KEY` → Production, Preview, Development
- [ ] `HUGGINGFACE_API_KEY` → Production, Preview, Development
- [ ] `NEXT_PUBLIC_APP_URL` → Production only

**Verify Scopes:**
- [ ] Production scope selected for production keys
- [ ] Preview scope selected for preview deployments
- [ ] Development scope selected for local development

### Step 3: Clerk Production Configuration

- [ ] Open Clerk Dashboard: https://dashboard.clerk.com
- [ ] Select Recipe Manager application
- [ ] Navigate to Configure → Domains
- [ ] Add production domain (e.g., your-app.vercel.app)
- [ ] Verify domain is active
- [ ] Test authentication flow on production domain

### Step 4: Initial Deployment

- [ ] Click Deploy in Vercel Dashboard
- [ ] Monitor build logs for errors
- [ ] Wait for deployment to complete
- [ ] Note deployment URL
- [ ] Check deployment status: Success

### Step 5: Custom Domain (Optional)

- [ ] Navigate to Settings → Domains
- [ ] Add custom domain
- [ ] Configure DNS records as instructed
- [ ] Wait for DNS propagation (up to 48 hours)
- [ ] Verify SSL certificate issued
- [ ] Test HTTPS access

---

## Post-Deployment Verification

### 1. Application Health

- [ ] Visit production URL
- [ ] Homepage loads without errors
- [ ] Open browser console (F12)
- [ ] Verify no JavaScript errors
- [ ] Verify no 404/500 errors
- [ ] Check network tab for failed requests
- [ ] Verify all assets load correctly

### 2. Database Connectivity

**Recipe Loading:**
- [ ] Navigate to `/recipes`
- [ ] Verify recipes load from database
- [ ] Check loading indicators work
- [ ] Verify pagination works (if applicable)

**Recipe Creation:**
- [ ] Sign in to application
- [ ] Navigate to recipe creation
- [ ] Create a test recipe
- [ ] Submit and verify success
- [ ] Refresh page and verify data persists

**Recipe Search:**
- [ ] Search for recipes by keyword
- [ ] Verify results appear
- [ ] Test filters (if applicable)
- [ ] Verify search performance

### 3. Authentication (Clerk)

**Sign-Up Flow:**
- [ ] Click "Sign Up" button
- [ ] Verify Clerk modal appears
- [ ] Test email/password sign-up
- [ ] Test Google OAuth sign-up (if enabled)
- [ ] Verify email verification (if required)
- [ ] Check redirect after sign-up

**Sign-In Flow:**
- [ ] Click "Sign In" button
- [ ] Test email/password sign-in
- [ ] Test Google OAuth sign-in (if enabled)
- [ ] Verify successful authentication
- [ ] Check user profile loads
- [ ] Verify protected routes work

**Sign-Out Flow:**
- [ ] Click "Sign Out" button
- [ ] Verify session cleared
- [ ] Check redirect to homepage
- [ ] Verify protected routes redirect to sign-in

### 4. AI Features (OpenRouter)

**Recipe Generation:**
- [ ] Navigate to `/recipes/generate` or AI feature
- [ ] Enter test ingredients (e.g., "chicken, rice, vegetables")
- [ ] Click "Generate Recipe"
- [ ] Wait for AI response
- [ ] Verify recipe appears with:
  - [ ] Title
  - [ ] Ingredients list
  - [ ] Instructions
  - [ ] Cooking time
  - [ ] Servings

**Ingredient Substitution:**
- [ ] Open existing recipe
- [ ] Request ingredient substitution
- [ ] Verify AI suggestions appear
- [ ] Test multiple substitutions

**Performance:**
- [ ] Note response time (should be < 10 seconds)
- [ ] Test during cold start (first request)
- [ ] Verify loading indicators work

### 5. Web Search (Brave Search API)

**Recipe Search:**
- [ ] Navigate to recipe search
- [ ] Search for "chocolate chip cookies"
- [ ] Verify web results appear
- [ ] Check result formatting
- [ ] Verify images load (if applicable)

**Recipe Import:**
- [ ] Find recipe URL from search results
- [ ] Click "Import" or use import feature
- [ ] Verify recipe data extracted
- [ ] Check all fields populated correctly

**Error Handling:**
- [ ] Test with invalid URL
- [ ] Verify error message appears
- [ ] Test with non-recipe URL
- [ ] Check graceful degradation

### 6. Semantic Search (Hugging Face + pgvector)

**Similarity Search:**
- [ ] Search for "Italian pasta dishes"
- [ ] Verify similar recipes returned
- [ ] Check relevance of results
- [ ] Test multiple search queries

**Recipe Recommendations:**
- [ ] Open a recipe page
- [ ] Check "Similar Recipes" section
- [ ] Verify recommendations appear
- [ ] Test recommendation accuracy

**Embedding Generation:**
- [ ] Create new recipe
- [ ] Verify embeddings generated
- [ ] Search for newly created recipe
- [ ] Confirm it appears in semantic search

**Performance:**
- [ ] Note search response time
- [ ] Verify results under 3 seconds
- [ ] Test with multiple concurrent searches

### 7. End-to-End User Journey

**Complete User Flow:**
1. [ ] Visit homepage (not signed in)
2. [ ] Browse public recipes
3. [ ] Click "Sign Up"
4. [ ] Complete registration
5. [ ] Sign in successfully
6. [ ] Navigate to AI recipe generator
7. [ ] Generate a new recipe
8. [ ] Save recipe to library
9. [ ] Add recipe to meal plan
10. [ ] Generate shopping list from meal plan
11. [ ] Search for similar recipes (semantic search)
12. [ ] Import recipe from web URL
13. [ ] Edit imported recipe
14. [ ] Share recipe (if applicable)
15. [ ] Sign out
16. [ ] Verify public recipes still accessible

**Mobile Testing:**
- [ ] Repeat key flows on mobile device
- [ ] Verify responsive design
- [ ] Test touch interactions
- [ ] Check mobile menu works

---

## Performance Verification

### Page Load Performance

- [ ] Homepage loads in < 3 seconds
- [ ] Recipe pages load in < 2 seconds
- [ ] AI generation completes in < 10 seconds
- [ ] Search results appear in < 1 second
- [ ] Image loading optimized
- [ ] No layout shifts (CLS)

### Lighthouse Scores

Run Lighthouse audit (Chrome DevTools):
- [ ] Performance score > 80
- [ ] Accessibility score > 90
- [ ] Best Practices score > 90
- [ ] SEO score > 80

### Web Vitals

- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] FID (First Input Delay) < 100ms
- [ ] CLS (Cumulative Layout Shift) < 0.1

---

## Security Verification

### Environment Variables

- [ ] No secrets in client-side code
- [ ] No API keys in browser console
- [ ] No sensitive data in git history
- [ ] All secrets in Vercel Environment Variables

### Authentication

- [ ] Protected routes require authentication
- [ ] Session management works correctly
- [ ] Sign-out clears all session data
- [ ] No authentication bypass possible

### API Security

- [ ] API routes validate authentication
- [ ] Rate limiting in place (if applicable)
- [ ] CORS configured correctly
- [ ] Input validation on all forms

### Headers and Security

- [ ] HTTPS enforced
- [ ] Security headers present
- [ ] CSP (Content Security Policy) configured
- [ ] No mixed content warnings

---

## Error Handling Verification

### User-Facing Errors

- [ ] 404 page displays for missing routes
- [ ] Graceful error messages for API failures
- [ ] Loading states during async operations
- [ ] Toast notifications for user actions

### API Error Handling

- [ ] OpenRouter API errors handled gracefully
- [ ] Brave Search API errors don't crash app
- [ ] Hugging Face API errors show fallback
- [ ] Database connection errors logged

### Monitoring

- [ ] Set up error tracking (Sentry, etc.)
- [ ] Configure uptime monitoring
- [ ] Set up performance monitoring
- [ ] Enable Vercel Analytics

---

## Rollback Plan

### If Deployment Fails

- [ ] Note the error message
- [ ] Check Vercel build logs
- [ ] Verify environment variables
- [ ] Test build locally: `pnpm build`
- [ ] Fix issues and redeploy

### If Critical Bug Found

- [ ] Identify the issue
- [ ] Rollback to previous deployment in Vercel
- [ ] Fix bug in development
- [ ] Test thoroughly locally
- [ ] Redeploy after verification

### Emergency Contacts

- Vercel Support: https://vercel.com/support
- Clerk Support: https://clerk.com/support
- Neon Support: https://neon.tech/docs/introduction/support

---

## Final Sign-Off

### Deployment Complete

- [ ] All verification steps passed
- [ ] No critical errors
- [ ] Performance acceptable
- [ ] User flows work end-to-end
- [ ] Documentation updated
- [ ] Team notified of deployment

### Post-Deployment Tasks

- [ ] Monitor error logs for 24 hours
- [ ] Watch for user-reported issues
- [ ] Track API usage and costs
- [ ] Schedule follow-up performance review
- [ ] Gather user feedback

### Documentation Updates

- [ ] Update README.md with production URL
- [ ] Document any deployment-specific configuration
- [ ] Update API documentation (if applicable)
- [ ] Note any known issues or limitations

---

## Troubleshooting Quick Reference

### Common Issues

**Issue: Build fails with TypeScript errors**
```bash
# Solution: Run locally and fix
pnpm tsc --noEmit
pnpm build
```

**Issue: Environment variable not found**
- Check variable is set in Vercel Dashboard
- Verify correct scope (Production/Preview/Development)
- Trigger new deployment after adding variable

**Issue: Clerk authentication fails**
- Verify production domain added in Clerk Dashboard
- Check using correct keys (pk_live_, sk_live_)
- Ensure domain is verified

**Issue: Database connection timeout**
- Verify Neon database is active (not paused)
- Check connection string includes `?sslmode=require`
- Verify connection pooling enabled

**Issue: OpenRouter API 401 Unauthorized**
- Check API key is valid
- Verify account has credits
- Test key in OpenRouter dashboard

**Issue: Semantic search not working**
- Verify Hugging Face API key is set
- Check pgvector extension enabled in database
- Test embeddings generation locally

---

## Deployment Summary

**Deployment Date:** _______________

**Production URL:** _______________

**Vercel Project ID:** _______________

**Database:** Neon PostgreSQL

**Authentication:** Clerk

**AI Services:**
- OpenRouter (Recipe Generation)
- Brave Search (Web Search)
- Hugging Face (Embeddings)

**Deployment Status:** ⬜ Success ⬜ Failed ⬜ Partial

**Issues Found:** _______________

**Resolution:** _______________

**Deployed By:** _______________

**Verified By:** _______________

---

**Last Updated:** 2025-10-14
**Version:** 1.0.0
