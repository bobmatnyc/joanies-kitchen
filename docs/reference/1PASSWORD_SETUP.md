# 1Password Setup for Joanie's Kitchen

## Overview

This guide explains how to store and manage all environment variables and API keys for the Recipe Manager (Joanie's Kitchen) project using 1Password.

---

## Why 1Password?

**Benefits**:
- ✅ Centralized secret management across team
- ✅ Secure sharing of credentials
- ✅ Version history and audit logs
- ✅ CLI integration for local development
- ✅ Automatic secret rotation reminders
- ✅ Role-based access control

---

## Setup Instructions

### 1. Create 1Password Vault

1. **Log in to 1Password**
   - Open 1Password app or web interface
   - Sign in to your team account

2. **Create Project Vault**
   - Click **New Vault**
   - Name: `Joanie's Kitchen - Recipe Manager`
   - Type: **Shared** (for team access)
   - Add team members who need access

### 2. Store Environment Variables

Create separate secure notes for each environment:

#### Development Environment

**Item Name**: `Recipe Manager - Development (.env.local)`

**Fields**:
```
# Application
NEXT_PUBLIC_APP_URL=http://localhost:3002
NODE_ENV=development (DO NOT SET - managed by Next.js)

# Database
DATABASE_URL=postgresql://neon_user:password@ep-name.region.aws.neon.tech/recipe_manager?sslmode=require

# AI Services
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx

# Search & Discovery
BRAVE_SEARCH_API_KEY=BSAxxxxxxxxxxxxx
SERPAPI_KEY=xxxxxxxxxxxxx
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxx

# Authentication (Development)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_DEV=pk_test_xxxxxxxxxxxxx
CLERK_SECRET_KEY_DEV=sk_test_xxxxxxxxxxxxx

# Authentication (Production keys for localhost testing)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD=pk_live_xxxxxxxxxxxxx
CLERK_SECRET_KEY_PROD=sk_live_xxxxxxxxxxxxx

# E2E Testing
TEST_USER_EMAIL=test-user-1@recipe-manager.test
TEST_USER_PASSWORD=SecureTestPassword123!
TEST_USER_2_EMAIL=test-user-2@recipe-manager.test
TEST_USER_2_PASSWORD=SecureTestPassword123!
TEST_ADMIN_EMAIL=test-admin@recipe-manager.test
TEST_ADMIN_PASSWORD=SecureTestPassword123!

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

**Tags**: `development`, `environment`, `recipe-manager`

---

#### Production Environment

**Item Name**: `Recipe Manager - Production (Vercel)`

**Fields**:
```
# Application
NEXT_PUBLIC_APP_URL=https://recipes.help
NODE_ENV=production (Vercel sets this automatically)

# Database (Production)
DATABASE_URL=postgresql://neon_prod_user:password@ep-name.region.aws.neon.tech/recipe_manager_prod?sslmode=require

# AI Services (Production keys)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxx

# Search & Discovery
BRAVE_SEARCH_API_KEY=BSAxxxxxxxxxxxxx
SERPAPI_KEY=xxxxxxxxxxxxx
FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxx

# Authentication (Production)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxxxxxxxxxxx
CLERK_SECRET_KEY=sk_live_xxxxxxxxxxxxx

# Clerk URLs (Production)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Vercel Specific
VERCEL_URL=(set automatically by Vercel)
VERCEL_ENV=(set automatically by Vercel)
```

**Tags**: `production`, `vercel`, `recipe-manager`

---

#### CI/CD Environment (GitHub Actions)

**Item Name**: `Recipe Manager - CI/CD (GitHub Secrets)`

**Fields**:
```
# Testing Database (separate from dev/prod)
DATABASE_URL=postgresql://neon_test_user:password@ep-name.region.aws.neon.tech/recipe_manager_test?sslmode=require

# Clerk (Dev instance for CI)
CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxx

# E2E Test Users (same as dev)
TEST_USER_EMAIL=test-user-1@recipe-manager.test
TEST_USER_PASSWORD=SecureTestPassword123!

# API Keys (dev tier acceptable)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxx
```

**Tags**: `ci`, `github-actions`, `testing`

---

### 3. Store Individual API Keys

Create separate items for each service to track limits, renewal dates, and account info:

#### OpenRouter API

**Item Type**: API Credential
**Item Name**: `OpenRouter - Recipe Manager`

**Fields**:
- **API Key**: `sk-or-v1-xxxxxxxxxxxxx`
- **Account Email**: your-email@example.com
- **Plan**: Free / Paid / Enterprise
- **Rate Limits**: (e.g., "1000 requests/day")
- **Billing Cycle**: Monthly
- **Dashboard URL**: https://openrouter.ai/settings/keys
- **Notes**: Used for AI recipe generation, quality evaluation

**Tags**: `api-key`, `ai`, `openrouter`

---

#### Clerk Authentication

**Item Type**: API Credential
**Item Name**: `Clerk - Recipe Manager Dev`

**Fields**:
- **Publishable Key (Dev)**: `pk_test_xxxxxxxxxxxxx`
- **Secret Key (Dev)**: `sk_test_xxxxxxxxxxxxx`
- **Application ID**: `app_xxxxxxxxxxxxx`
- **Dashboard URL**: https://dashboard.clerk.com/apps/[app-id]
- **Instance Type**: Development
- **Frontend API**: `xxxxx.accounts.dev`

**Tags**: `auth`, `clerk`, `development`

**Item Name**: `Clerk - Recipe Manager Prod`

**Fields**:
- **Publishable Key (Prod)**: `pk_live_xxxxxxxxxxxxx`
- **Secret Key (Prod)**: `sk_live_xxxxxxxxxxxxx`
- **Application ID**: `app_xxxxxxxxxxxxx`
- **Instance Type**: Production
- **Frontend API**: `clerk.recipes.help`

**Tags**: `auth`, `clerk`, `production`

---

#### Neon Database

**Item Type**: Database
**Item Name**: `Neon PostgreSQL - Recipe Manager Dev`

**Fields**:
- **Connection String**: `postgresql://user:password@ep-name.region.aws.neon.tech/recipe_manager?sslmode=require`
- **Host**: `ep-xxxxx.region.aws.neon.tech`
- **Database**: `recipe_manager`
- **User**: `neon_user`
- **Password**: `xxxxxxxxxxxxx`
- **Region**: `us-east-1` (or your region)
- **Dashboard URL**: https://console.neon.tech/app/projects/[project-id]
- **Plan**: Free / Pro

**Tags**: `database`, `neon`, `postgresql`, `development`

**Item Name**: `Neon PostgreSQL - Recipe Manager Prod`

**(Same fields structure for production database)**

**Tags**: `database`, `neon`, `postgresql`, `production`

---

#### Additional API Keys

Create similar items for:

1. **Hugging Face**
   - API Key
   - Dashboard: https://huggingface.co/settings/tokens
   - Usage: Embedding generation for semantic search

2. **Brave Search**
   - API Key
   - Dashboard: https://brave.com/search/api/
   - Usage: Web recipe discovery

3. **SerpAPI**
   - API Key
   - Dashboard: https://serpapi.com/manage-api-key
   - Usage: Google search for recipe crawling

4. **Perplexity AI**
   - API Key
   - Dashboard: https://www.perplexity.ai/settings/api
   - Usage: Weekly recipe discovery

5. **Firecrawl**
   - API Key
   - Dashboard: https://www.firecrawl.dev/
   - Usage: Chef recipe scraping

---

## Using 1Password CLI for Local Development

### Install 1Password CLI

```bash
# macOS (Homebrew)
brew install --cask 1password-cli

# Or download from: https://1password.com/downloads/command-line/
```

### Setup CLI

```bash
# Sign in (one-time setup)
op signin

# Verify connection
op whoami
```

### Load Environment Variables

**Option 1: Manual Copy (Recommended for beginners)**

1. Open 1Password app
2. Find "Recipe Manager - Development (.env.local)"
3. Copy each field to your local `.env.local` file

**Option 2: CLI Integration (Advanced)**

```bash
# Load environment variables from 1Password into current shell
eval $(op inject -i .env.1password)
```

**Create `.env.1password` template:**
```bash
# Recipe Manager Environment Variables (loaded from 1Password)
DATABASE_URL=op://Joanie's Kitchen/Recipe Manager - Development/DATABASE_URL
OPENROUTER_API_KEY=op://Joanie's Kitchen/Recipe Manager - Development/OPENROUTER_API_KEY
CLERK_SECRET_KEY_DEV=op://Joanie's Kitchen/Recipe Manager - Development/CLERK_SECRET_KEY_DEV
# ... (add all variables)
```

**Option 3: Direct Secret References** (Most Secure)

```bash
# Run commands with secrets injected
op run -- pnpm dev

# Build with secrets
op run -- pnpm build
```

---

## Team Access Management

### Add Team Members

1. **Navigate to Vault Settings**
   - Open "Joanie's Kitchen - Recipe Manager" vault
   - Click "Manage Access"

2. **Add Users**
   - Click "Add People"
   - Enter email addresses
   - Set permissions:
     - **Can View**: Read-only access (for contractors, QA)
     - **Can Edit**: Full access (for developers)
     - **Can Manage**: Admin access (for project leads)

3. **Create Access Groups** (Optional)
   - **Developers**: Full access to dev environment
   - **DevOps**: Full access to all environments
   - **QA**: Access to test credentials only

---

## Security Best Practices

### 1. Credential Rotation Schedule

Set reminders in 1Password for rotating credentials:

| Credential | Rotation Frequency | Reminder Date |
|------------|-------------------|---------------|
| Database Passwords | Quarterly | Every 3 months |
| API Keys | Semi-annually | Every 6 months |
| Test User Passwords | Quarterly | Every 3 months |
| Clerk Secret Keys | Annually | Yearly |

### 2. Access Review

**Monthly**:
- Review who has access to vault
- Remove team members who left project
- Audit access logs in 1Password

### 3. Secret Leakage Prevention

**Never**:
- ❌ Commit `.env.local` to git
- ❌ Share credentials via email/Slack
- ❌ Screenshot credentials
- ❌ Store credentials in plain text notes

**Always**:
- ✅ Use 1Password for sharing
- ✅ Use secure notes or vault items
- ✅ Enable 2FA on all service accounts
- ✅ Use different passwords for each service

### 4. Backup Strategy

1Password automatically backs up your vault, but additionally:
- Export emergency kit (encrypted backup)
- Store recovery codes separately
- Document recovery process

---

## Vercel Deployment Setup

### Add Secrets to Vercel from 1Password

1. **Open Vercel Project Dashboard**
   - Navigate to: https://vercel.com/[your-team]/recipe-manager
   - Go to Settings → Environment Variables

2. **Copy from 1Password**
   - Open "Recipe Manager - Production (Vercel)" in 1Password
   - Copy each variable name and value
   - Add to Vercel:
     ```
     Name: DATABASE_URL
     Value: [paste from 1Password]
     Environment: Production, Preview, Development
     ```

3. **Redeploy**
   - After adding all variables, trigger new deployment
   - Verify deployment succeeds

**Pro Tip**: Use 1Password CLI to automate this:
```bash
# Export variables for Vercel CLI
op item get "Recipe Manager - Production" --format=json | jq -r '.fields[] | "\(.label)=\(.value)"' > vercel-env.txt

# Import to Vercel (requires Vercel CLI)
vercel env add < vercel-env.txt
```

---

## GitHub Actions Integration

### Add Secrets to GitHub from 1Password

1. **Navigate to Repository Settings**
   - Go to: https://github.com/bobmatnyc/recipe-manager/settings/secrets/actions

2. **Add Repository Secrets**
   - Open "Recipe Manager - CI/CD (GitHub Secrets)" in 1Password
   - For each credential:
     - Click "New repository secret"
     - Name: `TEST_USER_EMAIL`
     - Value: [paste from 1Password]

3. **Secrets Needed for CI/CD**:
   ```
   DATABASE_URL
   CLERK_SECRET_KEY
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   TEST_USER_EMAIL
   TEST_USER_PASSWORD
   OPENROUTER_API_KEY
   HUGGINGFACE_API_KEY
   ```

---

## Troubleshooting

### Issue: "API key invalid" errors

**Solution**:
1. Check 1Password for latest key
2. Verify key is correctly copied (no extra spaces)
3. Check if key expired or hit rate limit
4. Regenerate key in service dashboard if needed
5. Update 1Password with new key

### Issue: Can't access 1Password vault

**Solution**:
1. Verify you're a member of the vault
2. Check with team admin for access
3. Ensure 1Password app is up to date
4. Try signing out and back in

### Issue: CLI not loading secrets

**Solution**:
1. Re-run `op signin`
2. Verify vault name matches exactly
3. Check item names are correct in templates
4. Ensure you have "Can View" permissions minimum

---

## Migration Checklist

- [ ] Create "Joanie's Kitchen - Recipe Manager" vault in 1Password
- [ ] Add all team members with appropriate permissions
- [ ] Store development environment variables
- [ ] Store production environment variables
- [ ] Store CI/CD environment variables
- [ ] Create individual API key items with metadata
- [ ] Document each service's dashboard URL and renewal dates
- [ ] Set up credential rotation reminders
- [ ] Configure Vercel environment variables from 1Password
- [ ] Configure GitHub Actions secrets from 1Password
- [ ] Test local development using 1Password credentials
- [ ] Document team onboarding process
- [ ] Schedule quarterly access review

---

## Related Documentation

- **Main README**: `/README.md`
- **Environment Setup**: `/docs/guides/ENVIRONMENT_SETUP.md`
- **Authentication Guide**: `/docs/guides/AUTHENTICATION_GUIDE.md`
- **E2E Testing Setup**: `/docs/testing/E2E_TEST_SETUP.md`
- **Deployment Guide**: `/OPS.md`

---

## Emergency Access

### Recovery Process

If you lose access to 1Password:

1. **Use Emergency Kit** (PDF exported during 1Password setup)
2. **Contact 1Password Support**: support@1password.com
3. **Contact Team Owner**: [designated team owner email]
4. **Fallback**: Regenerate all credentials from service dashboards

### Critical Service Dashboards

Keep bookmarked for emergency credential regeneration:

- Neon: https://console.neon.tech
- Clerk: https://dashboard.clerk.com
- OpenRouter: https://openrouter.ai
- Vercel: https://vercel.com
- GitHub: https://github.com/bobmatnyc/recipe-manager

---

**Last Updated**: 2025-10-18
**Version**: 1.0.0
**Maintained By**: Joanie's Kitchen Team
**1Password Vault**: `Joanie's Kitchen - Recipe Manager`
