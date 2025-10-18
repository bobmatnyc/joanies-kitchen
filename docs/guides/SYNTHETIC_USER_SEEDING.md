# Synthetic User Seeding System Guide

**Purpose**: Comprehensive guide for creating and managing 2000 realistic synthetic users to simulate platform activity

**Location**: `/scripts/seed-users/`

**Version**: 1.0.0

---

## 🎯 Overview

This seeding system creates a thriving, realistic user community with:

- **2000 diverse user profiles** (varied ages, ethnicities, locations)
- **Authentic activity patterns** (ratings, comments, likes, collections, meals)
- **Realistic engagement distribution** (lurkers to power users)
- **Gradual phase-out capability** (as real users join)

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ with pnpm installed
- Database connection configured
- Recipe data populated (for activity generation)

### Installation (5 Easy Steps)

```bash
# Step 1: Run database migration
pnpm seed:users:migrate

# Step 2: Generate 2000 user profiles
pnpm seed:users:generate

# Step 3: Insert profiles into database
pnpm seed:users:insert

# Step 4: Generate realistic activity
pnpm seed:users:activity

# Step 5: Check status
pnpm seed:users:status
```

**Total Time**: ~10-15 minutes

---

## 📊 What Gets Created

### User Profiles (2000)

**Demographics**:
- Ages 18-85 (realistic bell curve)
- Multiple ethnicities (US/Canada demographics)
- 30 US cities + 10 Canadian cities
- Diverse cooking interests and skill levels

**Example Profile**:
```
Maria Rodriguez (@maria_rodriguez)
Location: San Antonio, TX
Bio: "Home cook from San Antonio, TX. Mexican recipes passed
      down from my grandmother. Love sharing family favorites!"
Specialties: Mexican, Tex-Mex, Comfort Food
Cooking Level: Advanced
Activity Level: Regular (20-50 interactions)
```

### User Activity

**Distribution by Type**:
- ~50,000 recipe ratings (4-5 stars mostly)
- ~30,000 comments (thoughtful, varied)
- ~20,000 likes
- ~12,000 favorites
- ~6,000 collections
- ~6,000 meal plans

**Activity Levels**:
- **Lurkers** (20%): 0-5 interactions - browse only
- **Occasional** (40%): 5-15 interactions - periodic engagement
- **Regular** (30%): 20-50 interactions - active users
- **Power Users** (10%): 100-250 interactions - heavy engagement

---

## 🗂️ File Structure

```
scripts/seed-users/
├── README.md                              # Complete documentation
├── 00-migration-synthetic-users.ts        # Database migration
├── 01-generate-profiles.ts                # Generate profiles
├── 02-insert-profiles.ts                  # Insert to database
├── 03-generate-activity.ts                # Generate activity
├── 04-avatar-upload-guide.md              # Avatar instructions
├── 99-cleanup-synthetic-users.ts          # Cleanup script
└── generated-profiles.json                # Generated data (auto)
```

---

## 🎭 User Profile Details

### Diversity Breakdown

**Age Distribution**:
- 18-24: 10% (young adults, students)
- 25-34: 30% (young professionals)
- 35-44: 30% (established cooks)
- 45-59: 20% (experienced cooks)
- 60-85: 10% (expert home cooks)

**Ethnicity Distribution**:
- White/Caucasian: 50%
- Hispanic/Latino: 20%
- Black/African American: 13%
- Asian/Pacific Islander: 10%
- European: 5%
- Middle Eastern: 1.5%
- Indigenous: 0.5%

**Location Split**:
- US Cities: 80% (1600 users)
- Canadian Cities: 20% (400 users)

### Profile Components

Each profile includes:
- ✅ Unique username (based on name)
- ✅ Display name (realistic names)
- ✅ Bio (100-250 characters, authentic)
- ✅ Location (city, state/province)
- ✅ 1-3 cooking specialties
- ✅ Cooking skill level
- ✅ Activity level category
- ✅ Join date (spread over 2 years)
- ✅ Avatar photo path

---

## 💬 Activity Generation

### Rating Distribution

Realistic rating patterns:
- 5 Stars: 50% (excellent recipes)
- 4 Stars: 30% (good recipes)
- 3 Stars: 15% (decent recipes)
- 2 Stars: 3% (needs improvement)
- 1 Star: 2% (poor quality)

### Comment Examples

**Enthusiastic (5★)**:
- "This recipe is amazing! Made it exactly as written and it turned out perfectly. My family loved it!"
- "Absolutely delicious! This is going in my regular rotation."

**With Modifications (4-5★)**:
- "Great recipe! I added a bit of garlic and it was perfect."
- "Made this with honey instead of sugar. Turned out great!"

**Constructive (3★)**:
- "Good recipe overall. A bit too salty for my taste."
- "Decent recipe. Turned out well but not quite what I expected."

**Simple Praise (4-5★)**:
- "Perfect! ⭐⭐⭐⭐⭐"
- "So good! Made it twice this week already."

### Activity Focus

Users primarily interact with:
- ✅ Top-rated recipes (system_rating > 4.0)
- ✅ Highly-rated community recipes
- ✅ Recipes matching their specialties
- ✅ Recent popular recipes

---

## 🖼️ Avatar Photos

### Requirements

- **Count**: 100 unique photos (cycles through 2000 users)
- **Format**: JPG, 512x512px, < 200KB
- **Naming**: `user-001.jpg` to `user-100.jpg`
- **Location**: `public/avatars/synthetic/`

### Sourcing Options

**Option 1: AI-Generated (Recommended)**
```bash
# Quick script to download 100 AI faces
mkdir -p public/avatars/synthetic
cd public/avatars/synthetic

for i in {1..100}; do
  num=$(printf "%03d" $i)
  curl -o "user-${num}.jpg" https://thispersondoesnotexist.com/image
  sleep 2
done
```

**Option 2: Stock Photos**
- Unsplash: https://unsplash.com/
- Pexels: https://www.pexels.com/
- Ensure free-to-use license

**Full Guide**: See `scripts/seed-users/04-avatar-upload-guide.md`

---

## 🔄 Phase-Out Strategy

### Why Phase Out?

As real users join, gradually remove synthetic users to:
- Maintain authentic metrics
- Avoid sudden activity drops
- Transition smoothly to real community
- Ensure data accuracy for analytics

### Gradual Deactivation

**Phase 1: Lurkers** (Weeks 1-4)
```bash
# Deactivate 10-20 lurkers per day
pnpm seed:users:deactivate 20 lurker
```

**Phase 2: Occasional** (Weeks 5-12)
```bash
# Deactivate 10-15 occasional users per day
pnpm seed:users:deactivate 15 occasional
```

**Phase 3: Regular** (Weeks 13-24)
```bash
# Deactivate 5-10 regular users per day
pnpm seed:users:deactivate 10 regular
```

**Phase 4: Power Users** (Weeks 25-52)
```bash
# Deactivate 2-5 power users per week
pnpm seed:users:deactivate 5 power
```

### Monitoring

```bash
# Check current synthetic user status
pnpm seed:users:status
```

---

## 🗑️ Complete Cleanup

### When to Clean Up

Delete synthetic users when:
- Platform has 500+ real active users
- Real engagement surpasses synthetic activity
- Preparing for public launch
- Need accurate analytics data

### Cleanup Process

```bash
# Step 1: Deactivate all synthetic users
pnpm seed:users:deactivate 2000

# Step 2: Verify status
pnpm seed:users:status

# Step 3: Delete deactivated users (safe)
pnpm seed:users:delete

# Step 4: Delete ALL (nuclear option)
pnpm seed:users:delete-all
```

### What Gets Deleted

Cleanup removes ALL synthetic user data:
- User profiles
- Recipe ratings and reviews
- Comments
- Likes and favorites
- Collections and collection recipes
- Meals and meal plans
- Recipe views

**Note**: Original recipe data is preserved.

---

## 🛠️ Available Commands

Add these to `package.json` scripts:

```json
{
  "scripts": {
    "seed:users:migrate": "tsx scripts/seed-users/00-migration-synthetic-users.ts",
    "seed:users:generate": "tsx scripts/seed-users/01-generate-profiles.ts",
    "seed:users:insert": "tsx scripts/seed-users/02-insert-profiles.ts",
    "seed:users:activity": "tsx scripts/seed-users/03-generate-activity.ts",
    "seed:users:status": "tsx scripts/seed-users/99-cleanup-synthetic-users.ts status",
    "seed:users:deactivate": "tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate",
    "seed:users:delete": "tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete",
    "seed:users:delete-all": "tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete all"
  }
}
```

---

## 📊 Database Schema

### Migration Fields

```sql
-- Marks synthetic users
is_synthetic_user BOOLEAN DEFAULT FALSE NOT NULL

-- Controls visibility (soft delete)
synthetic_user_active BOOLEAN DEFAULT TRUE

-- Tracks deactivation timestamp
deactivated_at TIMESTAMP WITH TIME ZONE

-- Categorizes engagement level
synthetic_activity_level TEXT
  CHECK (synthetic_activity_level IN ('lurker', 'occasional', 'regular', 'power'))

-- Index for efficient queries
CREATE INDEX idx_user_profiles_synthetic
  ON user_profiles (is_synthetic_user, synthetic_user_active)
```

### Filtering Synthetic Users

```sql
-- Exclude from analytics
SELECT COUNT(*) FROM user_profiles
WHERE is_synthetic_user = false;

-- Only active synthetic users
SELECT * FROM user_profiles
WHERE is_synthetic_user = true
  AND synthetic_user_active = true;

-- Get synthetic activity
SELECT rr.*
FROM recipe_ratings rr
JOIN user_profiles up ON rr.user_id = up.user_id
WHERE up.is_synthetic_user = true;
```

---

## ✅ Verification

### Profile Generation

```bash
# Check generated file
cat scripts/seed-users/generated-profiles.json | jq '. | length'
# Expected: 2000

# Check diversity
cat scripts/seed-users/generated-profiles.json | jq '[.[].location] | group_by(.) | map({location: .[0], count: length}) | sort_by(.count) | reverse | .[0:10]'
```

### Database Insertion

```sql
-- Count synthetic users
SELECT COUNT(*) FROM user_profiles WHERE is_synthetic_user = true;
-- Expected: 2000

-- Activity distribution
SELECT synthetic_activity_level, COUNT(*)
FROM user_profiles
WHERE is_synthetic_user = true
GROUP BY synthetic_activity_level;

-- Sample users
SELECT username, display_name, location, bio
FROM user_profiles
WHERE is_synthetic_user = true
LIMIT 5;
```

### Activity Generation

```sql
-- Total ratings
SELECT COUNT(*)
FROM recipe_ratings rr
JOIN user_profiles up ON rr.user_id = up.user_id
WHERE up.is_synthetic_user = true;

-- Rating distribution
SELECT rating, COUNT(*) as count
FROM recipe_ratings rr
JOIN user_profiles up ON rr.user_id = up.user_id
WHERE up.is_synthetic_user = true
GROUP BY rating
ORDER BY rating DESC;

-- Comment count
SELECT COUNT(*)
FROM recipe_comments rc
JOIN user_profiles up ON rc.user_id = up.user_id
WHERE up.is_synthetic_user = true;
```

---

## 🎯 Success Metrics

After completion, you should have:

- ✅ 2000 diverse user profiles
- ✅ ~50,000 recipe ratings (realistic distribution)
- ✅ ~30,000 thoughtful comments
- ✅ ~20,000 likes
- ✅ ~12,000 favorites
- ✅ ~6,000 collections
- ✅ ~6,000 meal plans
- ✅ Authentic-looking community engagement
- ✅ Gradual phase-out system ready

---

## ⚠️ Important Notes

### Legal & Ethical

✅ **DO**:
- Use AI-generated faces (no copyright issues)
- Mark synthetic users clearly in database
- Plan to phase out synthetic data
- Disclose synthetic users if required

❌ **DON'T**:
- Use scraped social media photos
- Misrepresent synthetic users as real
- Keep synthetic data indefinitely
- Use photos without permission

### Performance Tips

- Run during off-peak hours
- Monitor database load during insertion
- Use batching (already implemented)
- Consider indexes before activity generation

### Data Integrity

- All synthetic users marked with `is_synthetic_user = true`
- Can be filtered from analytics queries
- Deactivation preserves data for rollback
- Complete deletion is irreversible

---

## 🆘 Troubleshooting

### Common Issues

**"No recipes found"**
```bash
# Solution: Populate recipes first
# Ensure you have public recipes in database
```

**"Duplicate username"**
```bash
# Solution: Clean up and retry
pnpm seed:users:delete-all
pnpm seed:users:migrate
pnpm seed:users:generate
pnpm seed:users:insert
```

**"Avatars not loading"**
```bash
# Check files exist
ls public/avatars/synthetic/

# Fix permissions
chmod 644 public/avatars/synthetic/*.jpg

# Restart dev server
pnpm dev
```

---

## 📚 Additional Resources

- **Full Documentation**: `scripts/seed-users/README.md`
- **Avatar Guide**: `scripts/seed-users/04-avatar-upload-guide.md`
- **Database Schema**: `src/lib/db/user-discovery-schema.ts`
- **User Actions**: `src/app/actions/user-profiles.ts`

---

## 🎓 Best Practices

### During Development

1. ✅ Test with small batch first (100 users)
2. ✅ Verify each step before proceeding
3. ✅ Monitor database performance
4. ✅ Keep backups before major operations

### During Production

1. ✅ Gradually phase out synthetic users
2. ✅ Monitor real user growth
3. ✅ Track engagement metrics
4. ✅ Plan complete cleanup timeline
5. ✅ Document cleanup decisions

### Data Quality

1. ✅ Regularly check synthetic user status
2. ✅ Filter from analytics when needed
3. ✅ Update phase-out strategy based on real growth
4. ✅ Maintain clean separation in queries

---

**Version**: 1.0.0
**Last Updated**: 2025-10-17
**Maintainer**: Recipe Manager Team
