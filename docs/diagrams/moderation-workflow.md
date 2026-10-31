# Recipe Moderation Workflow Diagrams

## High-Level System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Recipe Moderation System                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│              │         │              │         │              │
│  User Layer  │────────▶│ Admin Layer  │────────▶│ Public Layer │
│              │         │              │         │              │
└──────────────┘         └──────────────┘         └──────────────┘
      │                         │                         │
      │                         │                         │
      ▼                         ▼                         ▼
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Submit       │         │ Moderation   │         │ Approved     │
│ Recipe       │────────▶│ Queue        │────────▶│ Recipes      │
│ (pending)    │         │ (review)     │         │ (visible)    │
└──────────────┘         └──────────────┘         └──────────────┘
```

## Detailed Moderation Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Recipe Lifecycle                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐
│  User        │
│  Creates     │
│  Recipe      │
└──────┬───────┘
       │
       │ ① Submit Recipe
       │
       ▼
┌──────────────────────────────────────────────┐
│ Database: recipes table                      │
│                                               │
│ • moderation_status = 'pending'              │
│ • submission_notes = user's notes            │
│ • is_public = true (but not visible yet)    │
└──────┬───────────────────────────────────────┘
       │
       │ ② Enters Queue
       │
       ▼
┌──────────────────────────────────────────────┐
│ Admin Moderation Queue                       │
│                                               │
│ SELECT * FROM recipes                        │
│ WHERE moderation_status = 'pending'          │
│ ORDER BY created_at ASC                      │
│                                               │
│ Displays:                                     │
│ • Recipe preview (name, image, ingredients)  │
│ • Submission date                             │
│ • User info                                   │
│ • Submission notes                            │
└──────┬───────────────────────────────────────┘
       │
       │ ③ Admin Reviews
       │
       ▼
┌──────────────────────────────────────────────┐
│           Admin Decision Point               │
└───┬──────────────┬────────────┬──────────────┘
    │              │            │
    │ ④a Approve   │ ④b Reject  │ ④c Flag
    │              │            │
    ▼              ▼            ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│Approved │   │Rejected │   │Flagged  │
│         │   │         │   │         │
│status=  │   │status=  │   │status=  │
│approved │   │rejected │   │flagged  │
│         │   │         │   │         │
│moderated│   │moderated│   │moderated│
│_by =    │   │_by =    │   │_by =    │
│admin_id │   │admin_id │   │admin_id │
│         │   │         │   │         │
│moderated│   │moderated│   │moderated│
│_at =    │   │_at =    │   │_at =    │
│NOW()    │   │NOW()    │   │NOW()    │
│         │   │         │   │         │
│notes =  │   │notes =  │   │notes =  │
│null     │   │"reason" │   │"reason" │
└────┬────┘   └────┬────┘   └────┬────┘
     │             │             │
     │             │             │
     ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐
│Visible  │   │Hidden   │   │Hidden/  │
│to       │   │from     │   │Under    │
│Public   │   │Public   │   │Review   │
└─────────┘   └─────────┘   └─────────┘
```

## Database Schema Structure

```
┌──────────────────────────────────────────────────────────────┐
│ recipes table                                                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│ Existing Fields:                                              │
│ • id                   TEXT PRIMARY KEY                       │
│ • user_id              TEXT NOT NULL                          │
│ • name                 TEXT NOT NULL                          │
│ • is_public            BOOLEAN DEFAULT false                 │
│ • ... (other recipe fields)                                   │
│                                                               │
│ ─────────────────────────────────────────────────────────    │
│                                                               │
│ NEW Moderation Fields:                                        │
│ • moderation_status    TEXT NOT NULL DEFAULT 'pending'       │
│                        CHECK (IN ('pending', 'approved',     │
│                                   'rejected', 'flagged'))    │
│ • moderation_notes     TEXT NULL                             │
│ • moderated_by         TEXT NULL (users.id)             │
│ • moderated_at         TIMESTAMP NULL                         │
│ • submission_notes     TEXT NULL                             │
│                                                               │
└──────────────────────────────────────────────────────────────┘

Indexes:
┌──────────────────────────────────────────────────────────────┐
│ idx_recipes_moderation_status                                │
│ • ON (moderation_status)                                     │
│ • Purpose: Fast filtering by status                          │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│ idx_recipes_moderation_pending                               │
│ • ON (moderation_status, created_at DESC)                   │
│ • Purpose: Optimized moderation queue query                  │
└──────────────────────────────────────────────────────────────┘
```

## Recipe Visibility Decision Tree

```
                    ┌─────────────────┐
                    │  Recipe Query   │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ is_public = ?   │
                    └────┬───────┬────┘
                         │       │
                  false  │       │  true
                         │       │
                         ▼       ▼
                    ┌────────┐  ┌──────────────────┐
                    │ HIDDEN │  │ moderation_      │
                    │        │  │ status = ?       │
                    └────────┘  └────┬────────┬────┘
                                     │        │
                              pending│        │approved
                              rejected│       │
                              flagged │       │
                                     │        │
                                     ▼        ▼
                                ┌────────┐ ┌────────┐
                                │ HIDDEN │ │VISIBLE │
                                │        │ │        │
                                └────────┘ └────────┘

SQL Query:
WHERE is_public = true AND moderation_status = 'approved'
```

## User Experience Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Journey                                │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ User         │
│ Dashboard    │
└──────┬───────┘
       │
       │ Click "Create Recipe"
       │
       ▼
┌──────────────────────────────────┐
│ Recipe Creation Form              │
│                                   │
│ • Name, ingredients, instructions│
│ • Optional: submission_notes     │
│                                   │
│ ┌─────────────────────────────┐  │
│ │ ℹ️ Your recipe will be      │  │
│ │   reviewed before becoming  │  │
│ │   publicly visible          │  │
│ └─────────────────────────────┘  │
│                                   │
│ [ Submit Recipe ]                │
└──────┬────────────────────────────┘
       │
       │ ① Recipe submitted
       │
       ▼
┌──────────────────────────────────┐
│ User Dashboard                    │
│                                   │
│ My Recipes:                       │
│                                   │
│ 🟡 Chocolate Cake                │
│    Status: Pending Review         │
│    Submitted: 2 hours ago         │
│                                   │
└───────────────────────────────────┘
       │
       │ ② Admin reviews and approves
       │
       ▼
┌──────────────────────────────────┐
│ User Dashboard                    │
│                                   │
│ My Recipes:                       │
│                                   │
│ ✅ Chocolate Cake                │
│    Status: Approved               │
│    Now visible to public!         │
│                                   │
└───────────────────────────────────┘

Alternative Path (Rejection):
       │
       │ ②b Admin rejects
       │
       ▼
┌──────────────────────────────────┐
│ User Dashboard                    │
│                                   │
│ My Recipes:                       │
│                                   │
│ ❌ Chocolate Cake                │
│    Status: Not Approved           │
│                                   │
│    Reason: Recipe appears to be   │
│    plagiarized from another       │
│    source. Please submit only     │
│    original recipes.              │
│                                   │
│    [ Edit & Resubmit ]           │
│                                   │
└───────────────────────────────────┘
```

## Admin Moderation Queue Interface

```
┌─────────────────────────────────────────────────────────────────┐
│ Admin - Recipe Moderation Queue                         [Admin] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ 📊 Queue Statistics                                             │
│ ┌─────────────┬─────────────┬─────────────┬─────────────┐      │
│ │ Pending: 12 │ Approved: 45│ Rejected: 3 │ Flagged: 1  │      │
│ └─────────────┴─────────────┴─────────────┴─────────────┘      │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ Filter: [Pending ▼] Sort: [Oldest First ▼]               │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 1. Chocolate Chip Cookies                                  │  │
│ │    👤 User: jane_baker                                     │  │
│ │    📅 Submitted: 2 hours ago                               │  │
│ │    💬 Notes: "My grandma's recipe from 1950"              │  │
│ │                                                             │  │
│ │    [View Full Recipe]                                      │  │
│ │                                                             │  │
│ │    [ ✅ Approve ]  [ ❌ Reject ]  [ 🚩 Flag ]             │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 2. Beef Stew                                                │  │
│ │    👤 User: chef_mike                                      │  │
│ │    📅 Submitted: 5 hours ago                               │  │
│ │    💬 Notes: (none)                                        │  │
│ │                                                             │  │
│ │    [View Full Recipe]                                      │  │
│ │                                                             │  │
│ │    [ ✅ Approve ]  [ ❌ Reject ]  [ 🚩 Flag ]             │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐  │
│ │ 3. Vegan Pizza                                              │  │
│ │    👤 User: healthy_eats                                   │  │
│ │    📅 Submitted: 1 day ago                                 │  │
│ │    💬 Notes: "Plant-based, no oil"                        │  │
│ │                                                             │  │
│ │    [View Full Recipe]                                      │  │
│ │                                                             │  │
│ │    [ ✅ Approve ]  [ ❌ Reject ]  [ 🚩 Flag ]             │  │
│ └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ◄ Previous | Page 1 of 3 | Next ►                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## State Transitions

```
┌─────────────────────────────────────────────────────────────────┐
│             Moderation Status State Machine                      │
└─────────────────────────────────────────────────────────────────┘

                            ┌─────────┐
                            │ pending │◄─────┐
                            └────┬────┘      │
                                 │           │
                    ┌────────────┼────────┐  │
                    │            │        │  │
              approve│     reject│   flag │  │
                    │            │        │  │
                    ▼            ▼        ▼  │
            ┌──────────┐  ┌──────────┐ ┌────┴────┐
            │ approved │  │ rejected │ │ flagged │
            └──────────┘  └──────────┘ └─────────┘
                    │                        │
                    │                        │
                    │         flag           │
                    └───────────────────────►┘

Valid Transitions:
• pending → approved (admin approves)
• pending → rejected (admin rejects)
• pending → flagged (admin flags for review)
• approved → flagged (community reports issue)
• flagged → approved (investigation complete, OK)
• flagged → rejected (investigation complete, not OK)
• rejected → pending (user appeals/resubmits - future)
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────────────┐
│                    Query Performance                             │
└─────────────────────────────────────────────────────────────────┘

Query: Get Pending Queue (most common admin query)

SELECT *
FROM recipes
WHERE moderation_status = 'pending'
ORDER BY created_at ASC
LIMIT 20;

Uses Index: idx_recipes_moderation_pending
            (moderation_status, created_at DESC)

Performance:
• Without index: O(n) - full table scan
• With index: O(log n) - index scan
• Expected: <10ms for 100k+ recipes

┌─────────────────────────────────────────────────────────────────┐

Query: Get Public Recipes (most common user query)

SELECT *
FROM recipes
WHERE is_public = true
  AND moderation_status = 'approved'
ORDER BY created_at DESC;

Uses Indexes:
• idx_recipes_moderation_status (moderation_status)
• idx_recipes_public_system (is_public, is_system_recipe)

Performance:
• Bitmap index scan on both indexes
• Expected: <20ms for 100k+ recipes
```

## Security & Access Control

```
┌─────────────────────────────────────────────────────────────────┐
│               Access Control Matrix                              │
├─────────────┬───────────┬────────────┬────────────┬────────────┤
│   Action    │   User    │   Admin    │   System   │  Public    │
├─────────────┼───────────┼────────────┼────────────┼────────────┤
│ Create      │    ✓      │     ✓      │     ✓      │     ✗      │
│ Recipe      │ (pending) │ (approved) │ (approved) │            │
├─────────────┼───────────┼────────────┼────────────┼────────────┤
│ View Own    │    ✓      │     ✓      │     ✓      │     ✗      │
│ Pending     │           │            │            │            │
├─────────────┼───────────┼────────────┼────────────┼────────────┤
│ View        │    ✓      │     ✓      │     ✓      │     ✓      │
│ Approved    │           │            │            │            │
├─────────────┼───────────┼────────────┼────────────┼────────────┤
│ View        │    ✗      │     ✓      │     ✗      │     ✗      │
│ Queue       │           │            │            │            │
├─────────────┼───────────┼────────────┼────────────┼────────────┤
│ Approve/    │    ✗      │     ✓      │     ✗      │     ✗      │
│ Reject/Flag │           │            │            │            │
└─────────────┴───────────┴────────────┴────────────┴────────────┘
```

---

**Legend:**
- 🟡 Pending (awaiting review)
- ✅ Approved (publicly visible)
- ❌ Rejected (not suitable for public)
- 🚩 Flagged (under investigation)
