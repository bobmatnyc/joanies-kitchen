# Clerk Dashboard Configuration for recipes.help

**Target Domain**: recipes.help
**Environment**: Production
**Keys**: pk_live_*, sk_live_*

---

## Quick Setup Checklist

- [ ] Add recipes.help domain
- [ ] Configure redirect URLs
- [ ] Verify OAuth providers (if using Google)
- [ ] Test authentication flow
- [ ] Enable session management
- [ ] Configure security settings

---

## Step-by-Step Setup

### 1. Access Clerk Dashboard

1. Go to: https://dashboard.clerk.com
2. Log in with your Clerk account
3. Select your **Production** application (the one with pk_live_ keys)

**Important**: Make sure you're in the Production environment, not Development

---

### 2. Add recipes.help Domain

#### Navigation
1. In Clerk Dashboard, click **Settings** (left sidebar)
2. Click **Domains** (under Settings)

#### Add Domain
1. Click **"Add domain"** button
2. Enter domain: `recipes.help`
3. Click **Save**

#### Verify Domain Appears in List
You should see:
```
Primary Domain: recipes.help ✅
Status: Active
```

#### Add Additional Domains (Optional)
If you use subdomains or alternative domains:
- `www.recipes.help`
- `app.recipes.help`

---

### 3. Configure Paths (Redirect URLs)

#### Navigation
1. Click **Paths** (left sidebar under "User & Authentication")

#### Configure Sign-In Path
```
Sign-in URL: /sign-in
```

#### Configure Sign-Up Path
```
Sign-up URL: /sign-up
```

#### Configure Post-Authentication Paths
```
After sign-in URL: /
After sign-up URL: /
```

#### Configure Home URL
```
Home URL: https://recipes.help
```

#### Visual Verification
Your configuration should look like:

```
┌──────────────────────────────────────────────────┐
│ Paths Configuration                              │
├──────────────────────────────────────────────────┤
│ Sign-in URL:           /sign-in                  │
│ Sign-up URL:           /sign-up                  │
│ After sign-in URL:     /                         │
│ After sign-up URL:     /                         │
│ Home URL:              https://recipes.help      │
└──────────────────────────────────────────────────┘
```

Click **Save** after configuring

---

### 4. Verify API Keys

#### Navigation
1. Click **API Keys** (left sidebar)
2. Ensure you're viewing **Production** keys (toggle at top)

#### Verify Publishable Key
```
Publishable Key: pk_live_Y2xlcmsucmVjaXBlcy5oZWxwJA
```

**Check**: Key should start with `pk_live_` (NOT `pk_test_`)

#### Verify Secret Key
```
Secret Key: sk_live_kVahgqoC5y0pGHgfTjyxJoffbzYCh4OGI1AfwpXImg
```

**Check**: Key should start with `sk_live_` (NOT `sk_test_`)

#### Copy Keys to Vercel
These keys should be set in Vercel environment variables:
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` = `pk_live_...`
- `CLERK_SECRET_KEY` = `sk_live_...`

---

### 5. Configure OAuth Providers (Optional)

If you want to enable Google Sign-In:

#### Navigation
1. Click **Social Connections** (left sidebar)
2. Click **Google**

#### Enable Google OAuth
1. Toggle **Enable Google** to ON
2. Enter your Google OAuth credentials:
   - **Client ID**: (from Google Cloud Console)
   - **Client Secret**: (from Google Cloud Console)

#### Configure Scopes (Recommended)
```
Scopes:
- email (required)
- profile (required)
- openid (required)
```

#### Save Configuration
Click **Save**

**Note**: You need to set up Google OAuth in Google Cloud Console first. See: `docs/guides/GOOGLE_OAUTH_SETUP.md`

---

### 6. Session Management

#### Navigation
1. Click **Sessions** (left sidebar)

#### Configure Session Settings
```
Session lifetime: 7 days (recommended)
Inactivity timeout: 30 minutes (recommended)
Multi-session handling: Allow multiple sessions
```

#### Security Settings
```
✅ Require re-authentication for sensitive operations
✅ Enable session token rotation
✅ Lock session to IP address (optional, may cause issues with mobile)
```

Click **Save**

---

### 7. Security Settings

#### Navigation
1. Click **Security** (left sidebar)

#### Password Requirements
```
Minimum length: 8 characters
Require:
✅ At least one uppercase letter
✅ At least one number
✅ At least one special character
```

#### Bot Protection
```
✅ Enable reCAPTCHA on sign-up
✅ Enable reCAPTCHA on sign-in (optional)
```

**Note**: You need to configure reCAPTCHA keys if enabling this feature

#### Attack Protection
```
✅ Enable rate limiting
✅ Block suspicious IPs
✅ Require email verification
```

Click **Save**

---

### 8. Email Settings (Important)

#### Navigation
1. Click **Email & SMS** (left sidebar)
2. Click **Email**

#### Configure From Address
```
From name: Joanie's Kitchen
From email: noreply@recipes.help
```

**Note**: You may need to verify your domain to send emails from `@recipes.help`

#### Email Templates
Review and customize:
- **Email verification** email
- **Password reset** email
- **Welcome** email (optional)

#### Verification
```
✅ Require email verification before sign-in
```

---

### 9. User Profile Settings

#### Navigation
1. Click **User & Authentication** → **Email, Phone, Username**

#### Required Fields
```
✅ Email address (required)
```

#### Optional Fields
```
☐ Phone number
☐ Username
```

#### Customization
```
Name fields:
✅ First name
✅ Last name
```

Click **Save**

---

### 10. Webhooks (Optional but Recommended)

If you want to sync user data to your database:

#### Navigation
1. Click **Webhooks** (left sidebar)
2. Click **Add endpoint**

#### Configure Webhook
```
Endpoint URL: https://recipes.help/api/webhooks/clerk
Events to subscribe:
✅ user.created
✅ user.updated
✅ user.deleted
✅ session.created
✅ session.ended
```

#### Security
```
✅ Enable signing secret
Copy signing secret and save to Vercel environment variables:
CLERK_WEBHOOK_SECRET=whsec_...
```

Click **Save**

---

## Verification Checklist

After configuration, verify everything works:

### 1. Domain Verification
```bash
curl -I https://recipes.help
# Should return: 200 OK
```

### 2. Clerk Widget Loading
1. Visit: https://recipes.help/sign-in
2. Open browser console (F12)
3. Check for errors
4. Verify Clerk widget loads

### 3. Sign-In Flow
1. Click "Sign in"
2. Enter test credentials or use Google OAuth
3. Verify successful authentication
4. Check redirect to homepage (/)

### 4. Sign-Up Flow
1. Visit: https://recipes.help/sign-up
2. Enter new user details
3. Verify email verification (if enabled)
4. Complete sign-up
5. Check redirect to homepage (/)

### 5. Protected Routes
1. Sign out
2. Try accessing: https://recipes.help/recipes
3. Should redirect to /sign-in
4. Sign in
5. Verify access granted

### 6. Session Persistence
1. Sign in
2. Close browser
3. Open browser again
4. Visit: https://recipes.help
5. Verify still signed in (if within session lifetime)

---

## Common Configuration Issues

### Issue: Domain Not Recognized

**Symptoms**: "Invalid host" error

**Solution**:
1. Verify `recipes.help` is added in **Domains** section
2. Check you're using **Production** keys (pk_live_*, sk_live_*)
3. Ensure domain is marked as "Active"
4. Wait 5 minutes for DNS propagation

---

### Issue: Redirect Loops

**Symptoms**: Infinite redirects between / and /sign-in

**Solution**:
1. Check **Paths** configuration:
   - After sign-in URL: `/` (not `/sign-in`)
   - After sign-up URL: `/` (not `/sign-up`)
2. Verify middleware is not blocking authenticated routes
3. Check for conflicting redirects in Next.js middleware

---

### Issue: OAuth Not Working

**Symptoms**: Google sign-in button doesn't appear or fails

**Solution**:
1. Verify Google OAuth is enabled in **Social Connections**
2. Check Google Cloud Console:
   - Authorized JavaScript origins: `https://recipes.help`
   - Authorized redirect URIs: `https://clerk.recipes.help/v1/oauth_callback`
3. Verify Client ID and Secret are correctly entered in Clerk

---

### Issue: Email Verification Not Sending

**Symptoms**: Users don't receive verification emails

**Solution**:
1. Check **Email & SMS** settings
2. Verify email provider is configured
3. Check spam folder
4. Verify domain is authorized to send emails
5. Consider using Clerk's default email provider initially

---

## Advanced Configuration

### Custom Branding

#### Navigation
1. Click **Customization** → **Theme**

#### Customize Appearance
```
Primary color: #your-brand-color
Logo: Upload your logo (SVG or PNG)
Favicon: Upload favicon
Font: Your brand font
```

### Multi-Factor Authentication (MFA)

#### Navigation
1. Click **User & Authentication** → **Multi-factor**

#### Enable MFA
```
✅ Enable SMS-based MFA
✅ Enable Authenticator app (TOTP)
Optional: Require MFA for all users
```

### Custom User Metadata

#### Navigation
1. Click **User & Authentication** → **Metadata**

#### Add Custom Fields
```
Example:
- dietaryPreferences (string)
- favoriteRecipes (array)
- notificationSettings (object)
```

---

## Monitoring and Analytics

### View User Activity

#### Navigation
1. Click **Users** (left sidebar)
2. View list of all registered users

#### User Details
Click on any user to view:
- Sign-in history
- Sessions
- Devices
- Metadata
- Activity logs

### Monitor Authentication Events

#### Navigation
1. Click **Logs** (left sidebar)

#### Filter Logs
```
Filter by:
- Event type (sign-in, sign-up, etc.)
- User ID
- Date range
- Status (success, failure)
```

---

## Support and Resources

### Clerk Documentation
- **Domains**: https://clerk.com/docs/deployments/domains
- **Paths**: https://clerk.com/docs/references/nextjs/custom-paths
- **OAuth**: https://clerk.com/docs/authentication/social-connections/oauth
- **Webhooks**: https://clerk.com/docs/integrations/webhooks

### Get Help
- **Clerk Support**: https://clerk.com/support
- **Community**: https://discord.com/invite/clerk
- **Documentation**: https://clerk.com/docs

---

## Summary

After completing this setup, your Clerk configuration should:

✅ Recognize `recipes.help` as a valid domain
✅ Use production keys (pk_live_*, sk_live_*)
✅ Redirect correctly after authentication
✅ Support optional OAuth providers
✅ Send email verifications (if enabled)
✅ Enforce security policies
✅ Track user sessions properly

**Next Steps**:
1. Complete Clerk configuration using this guide
2. Run environment variable fix: `./scripts/fix-vercel-clerk-env-automated.sh`
3. Deploy to production: `vercel --prod`
4. Test authentication: https://recipes.help/sign-in

---

**Last Updated**: 2025-10-15
**For**: recipes.help production deployment
**Environment**: Production (pk_live_*, sk_live_*)
