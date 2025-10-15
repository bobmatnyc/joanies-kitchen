# Admin Access Flow Diagram

## Configuration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    CLERK DASHBOARD SETUP                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├──────────────────────────┐
                              │                          │
                              ▼                          ▼
                ┌────────────────────────┐  ┌────────────────────────┐
                │  Custom Session Token  │  │   User Public Metadata │
                │  Configuration         │  │   Configuration        │
                ├────────────────────────┤  ├────────────────────────┤
                │ {                      │  │ {                      │
                │   "metadata":          │  │   "isAdmin": "true"    │
                │   "{{user.public_      │  │ }                      │
                │    metadata}}"         │  │                        │
                │ }                      │  │                        │
                └────────────────────────┘  └────────────────────────┘
                              │                          │
                              └──────────┬───────────────┘
                                         ▼
                              ┌────────────────────────┐
                              │  User Signs Out/In     │
                              │  (Session Refresh)     │
                              └────────────────────────┘
                                         │
                                         ▼
                              ┌────────────────────────┐
                              │  Session Token Now     │
                              │  Contains metadata     │
                              └────────────────────────┘
```

## Runtime Flow - Admin User

```
┌────────────────────────┐
│  User Clicks Profile   │
│  Avatar                │
└────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│  AuthButtons.tsx                                           │
│  ─────────────────────────────────────────────────────────│
│  const { user } = useUser()                                │
│  const isAdmin = user?.publicMetadata?.isAdmin === 'true'  │
└────────────────────────────────────────────────────────────┘
            │
            ├─── isAdmin = true ──────┐
            │                         │
            ▼                         ▼
  ┌────────────────┐        ┌────────────────────────┐
  │  Show regular  │        │  Show "Admin Dashboard"│
  │  menu items    │        │  menu item with Shield │
  │  - Manage      │        │  icon                  │
  │    Account     │        │                        │
  │  - Sign Out    │        │  onClick: router.push  │
  └────────────────┘        │          ('/admin')    │
                            └────────────────────────┘
                                      │
                                      ▼
                            ┌────────────────────────┐
                            │  User Clicks Admin     │
                            │  Dashboard             │
                            └────────────────────────┘
                                      │
                                      ▼
                            ┌────────────────────────┐
                            │  Navigate to /admin    │
                            └────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────┐
│  middleware.ts                                             │
│  ────────────────────────────────────────────────────────  │
│  const { userId, sessionClaims } = await auth()            │
│  const metadata = sessionClaims?.metadata                  │
│  const isAdmin = metadata?.isAdmin === 'true'              │
└────────────────────────────────────────────────────────────┘
            │
            ├─── isAdmin = true ───────┐
            │                          │
            ▼                          ▼
  ┌────────────────┐        ┌────────────────────────┐
  │  Redirect to   │        │  Allow access          │
  │  home page     │        │  Return NextResponse   │
  │                │        │  .next()               │
  └────────────────┘        └────────────────────────┘
                                      │
                                      ▼
                            ┌────────────────────────┐
                            │  Admin Dashboard Page  │
                            │  Loads Successfully    │
                            └────────────────────────┘
```

## Runtime Flow - Non-Admin User

```
┌────────────────────────┐
│  User Clicks Profile   │
│  Avatar                │
└────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│  AuthButtons.tsx                                           │
│  ─────────────────────────────────────────────────────────│
│  const { user } = useUser()                                │
│  const isAdmin = user?.publicMetadata?.isAdmin === 'true'  │
└────────────────────────────────────────────────────────────┘
            │
            ├─── isAdmin = false ─────┐
            │                         │
            ▼                         ▼
  ┌────────────────┐        ┌────────────────────────┐
  │  Show regular  │        │  Admin Dashboard menu  │
  │  menu items    │        │  item NOT rendered     │
  │  - Manage      │        │                        │
  │    Account     │        │  User cannot see it    │
  │  - Sign Out    │        └────────────────────────┘
  └────────────────┘

If user tries to access /admin directly (URL):

                            ┌────────────────────────┐
                            │  User navigates to     │
                            │  /admin directly       │
                            └────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────┐
│  middleware.ts                                             │
│  ────────────────────────────────────────────────────────  │
│  const { userId, sessionClaims } = await auth()            │
│  const metadata = sessionClaims?.metadata                  │
│  const isAdmin = metadata?.isAdmin === 'true'              │
└────────────────────────────────────────────────────────────┘
            │
            ├─── isAdmin = false ─────┐
            │                         │
            ▼                         ▼
  ┌────────────────┐        ┌────────────────────────┐
  │  Redirect to   │◀────── │  Access Denied         │
  │  home page     │        │                        │
  │  (status 302)  │        └────────────────────────┘
  └────────────────┘
```

## Runtime Flow - Unauthenticated User

```
                            ┌────────────────────────┐
                            │  User navigates to     │
                            │  /admin (not signed in)│
                            └────────────────────────┘
                                      │
                                      ▼
┌────────────────────────────────────────────────────────────┐
│  middleware.ts                                             │
│  ────────────────────────────────────────────────────────  │
│  const { userId } = await auth()                           │
└────────────────────────────────────────────────────────────┘
            │
            ├─── userId = null ───────┐
            │                         │
            ▼                         ▼
  ┌────────────────────────────┐  ┌──────────────────────┐
  │  Redirect to sign-in page  │  │  Set redirect_url    │
  │  /sign-in?redirect_url=    │◀─│  query parameter     │
  │  /admin                    │  └──────────────────────┘
  └────────────────────────────┘
            │
            ▼
  ┌────────────────────────────┐
  │  After signing in:         │
  │  - If admin: redirect to   │
  │    /admin                  │
  │  - If not admin: redirect  │
  │    to home                 │
  └────────────────────────────┘
```

## Debug Flow

```
┌────────────────────────┐
│  User visits:          │
│  /api/debug-session    │
└────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│  debug-session/route.ts                                    │
│  ────────────────────────────────────────────────────────  │
│  const { sessionClaims, userId } = await auth()            │
│  return JSON response with:                                │
│  - userId                                                  │
│  - sessionClaims (full object)                             │
│  - metadata                                                │
│  - publicMetadata                                          │
│  - isAdminFromMetadata                                     │
│  - allKeys (for debugging)                                 │
└────────────────────────────────────────────────────────────┘
            │
            ▼
┌────────────────────────────────────────────────────────────┐
│  Browser displays JSON:                                    │
│  {                                                         │
│    "userId": "user_xxxxxxxxxxxxx",                         │
│    "hasSessionClaims": true,                               │
│    "metadata": {                                           │
│      "isAdmin": "true"                                     │
│    },                                                      │
│    "isAdminFromMetadata": "true",                          │
│    "allKeys": ["userId", "sessionId", "metadata", ...]     │
│  }                                                         │
└────────────────────────────────────────────────────────────┘
            │
            ▼
  ┌────────────────────────────┐
  │  Developer can verify:     │
  │  ✓ Session claims present  │
  │  ✓ Metadata included       │
  │  ✓ isAdmin flag correct    │
  │  ✓ Structure matches       │
  │    middleware expectations │
  └────────────────────────────┘
```

## Data Flow Comparison

### Frontend (AuthButtons.tsx)

```
User Object (from Clerk)
├── publicMetadata
│   └── isAdmin: "true"
│
└── AuthButtons checks:
    user?.publicMetadata?.isAdmin === 'true'

    Result: Show/Hide UI elements
```

### Backend (middleware.ts)

```
Session Token (from Clerk)
├── userId
├── sessionId
├── metadata (from custom session token config)
│   └── isAdmin: "true"
│
└── middleware checks:
    sessionClaims?.metadata?.isAdmin === 'true'

    Result: Allow/Deny access
```

## Why Two Different Paths?

```
┌─────────────────────────────────────────────────────────┐
│  User Object (publicMetadata)                           │
│  ──────────────────────────────────────────────────────│
│  • Accessed on client side                             │
│  • Available immediately when user is loaded           │
│  • Used for UI decisions (show/hide)                   │
│  • Can be manipulated by clever users (browser devtools)│
│  • NOT secure for access control                       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Session Token (metadata from custom claims)            │
│  ──────────────────────────────────────────────────────│
│  • Accessed on server side                             │
│  • Cryptographically signed by Clerk                   │
│  • Used for access control decisions                   │
│  • Cannot be manipulated by users                      │
│  • SECURE for access control                           │
│  • Requires custom session token configuration         │
└─────────────────────────────────────────────────────────┘

Defense in Depth: Both layers work together
├── Frontend: Better UX (hide options user can't use)
└── Backend: Security (enforce access control)
```

## Troubleshooting Flow

```
                    ┌────────────────────────┐
                    │  Admin access not      │
                    │  working?              │
                    └────────────────────────┘
                              │
                              ▼
                    ┌────────────────────────┐
                    │  Visit debug endpoint  │
                    │  /api/debug-session    │
                    └────────────────────────┘
                              │
                ┌─────────────┴──────────────┐
                │                            │
                ▼                            ▼
    ┌─────────────────────┐      ┌─────────────────────┐
    │  hasSessionClaims:  │      │  hasSessionClaims:  │
    │  false              │      │  true               │
    └─────────────────────┘      └─────────────────────┘
                │                            │
                ▼                            ▼
    ┌─────────────────────┐      ┌─────────────────────┐
    │  Not signed in      │      │  Check metadata     │
    │  → Sign in first    │      │  field              │
    └─────────────────────┘      └─────────────────────┘
                                              │
                            ┌─────────────────┴─────────────┐
                            │                               │
                            ▼                               ▼
              ┌──────────────────────┐      ┌──────────────────────┐
              │  metadata: null or   │      │  metadata: {...}     │
              │  undefined           │      │  exists              │
              └──────────────────────┘      └──────────────────────┘
                            │                               │
                            ▼                               ▼
              ┌──────────────────────┐      ┌──────────────────────┐
              │  Custom session      │      │  Check isAdmin       │
              │  token NOT           │      │  field               │
              │  configured          │      └──────────────────────┘
              │                      │                  │
              │  → Configure in      │      ┌───────────┴──────────┐
              │    Clerk Dashboard   │      │                      │
              │    (Step 1)          │      ▼                      ▼
              └──────────────────────┘    ┌─────────┐      ┌─────────┐
                                          │ "true"  │      │ missing │
                                          └─────────┘      └─────────┘
                                               │               │
                                               ▼               ▼
                                          ┌─────────┐    ┌──────────┐
                                          │ Admin   │    │ Set user │
                                          │ access  │    │ metadata │
                                          │ working!│    │ (Step 2) │
                                          └─────────┘    └──────────┘
                                                              │
                                                              ▼
                                                         ┌──────────┐
                                                         │ Sign out │
                                                         │ Sign in  │
                                                         │ (Step 3) │
                                                         └──────────┘
```

## Summary

The admin access system uses a defense-in-depth approach:

1. **Clerk Dashboard Configuration**: Sets up the data source
2. **Session Token**: Carries signed admin flag (secure)
3. **Frontend Check**: Uses publicMetadata (UX optimization)
4. **Backend Check**: Uses session metadata (security enforcement)
5. **Debug Tools**: Help verify configuration and troubleshoot issues

Both checks reference the same underlying data but access it through different paths, ensuring both good UX and strong security.
