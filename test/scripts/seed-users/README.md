# Synthetic User Seeding System

**Version**: 1.0.0
**Last Updated**: 2025-10-17

---

## 📋 Overview

This comprehensive seeding system creates **2000 realistic, diverse user profiles** with authentic platform activity to simulate a thriving recipe community. The system generates users with varied demographics, cooking interests, and engagement levels that are indistinguishable from real users.

### Key Features

✅ **Diverse Demographics**: 2000 users across ages 18-85, multiple ethnicities, US/Canada locations
✅ **Realistic Profiles**: Authentic bios, cooking specialties, professions, hobbies
✅ **Authentic Activity**: Ratings, comments, likes, favorites, collections, meal plans
✅ **Activity Levels**: Lurkers, occasional users, regulars, and power users
✅ **Gradual Phase-Out**: System to deactivate/remove synthetic users as real users join
✅ **Complete Cleanup**: Full removal of synthetic data when ready

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ with pnpm
- Database connection configured
- Recipe data already populated (needed for activity generation)

### Installation

```bash
# 1. Run database migration
pnpm tsx scripts/seed-users/00-migration-synthetic-users.ts

# 2. Generate user profiles
pnpm tsx scripts/seed-users/01-generate-profiles.ts

# 3. Insert profiles into database
pnpm tsx scripts/seed-users/02-insert-profiles.ts

# 4. Generate user activity
pnpm tsx scripts/seed-users/03-generate-activity.ts

# 5. (Optional) Upload avatar photos
# See: scripts/seed-users/04-avatar-upload-guide.md
```

**Total Time**: ~10-15 minutes (excluding avatar upload)

---

## 📁 File Structure

```
scripts/seed-users/
├── README.md                              # This file
├── 00-migration-synthetic-users.ts        # Database schema migration
├── 01-generate-profiles.ts                # Generate 2000 user profiles
├── 02-insert-profiles.ts                  # Insert profiles into database
├── 03-generate-activity.ts                # Generate ratings, comments, etc.
├── 04-avatar-upload-guide.md              # Avatar sourcing & upload guide
├── 99-cleanup-synthetic-users.ts          # Deactivate/delete synthetic users
└── generated-profiles.json                # Generated profile data (auto-created)
```

---

## 🎭 User Profile Generation

### Demographics Distribution

The system generates users with realistic demographic distribution:

#### Age Distribution
- **18-24**: 10% (200 users) - Young adults, students, early career
- **25-34**: 30% (600 users) - Young professionals, starting families
- **35-44**: 30% (600 users) - Established professionals, family cooks
- **45-59**: 20% (400 users) - Experienced cooks, empty nesters
- **60-85**: 10% (200 users) - Retirees, expert home cooks

#### Ethnicity/Race Distribution (US/Canada demographics)
- **White/Caucasian**: 50% (1000 users)
- **Hispanic/Latino**: 20% (400 users)
- **Black/African American**: 13% (260 users)
- **Asian/Pacific Islander**: 10% (200 users)
- **European (non-Anglo)**: 5% (100 users)
- **Middle Eastern**: 1.5% (30 users)
- **Indigenous/Native American**: 0.5% (10 users)

#### Location Distribution
- **US Cities**: 80% (1600 users) - 30 major cities
- **Canadian Cities**: 20% (400 users) - 10 major cities

### Profile Components

Each user profile includes:

- **Basic Info**: Unique username, display name, location
- **Bio**: Realistic backstory (100-250 characters)
- **Specialties**: 1-3 cooking cuisines/styles
- **Cooking Level**: Beginner, Intermediate, Advanced, Expert
- **Avatar**: Placeholder path (upload real photos separately)
- **Join Date**: Spread over last 2 years
- **Activity Level**: Lurker, Occasional, Regular, Power

### Example Profiles

```typescript
{
  username: "maria_rodriguez",
  display_name: "Maria Rodriguez",
  bio: "Home cook from San Antonio, TX. Mexican recipes passed down from my grandmother. Love sharing family favorites!",
  location: "San Antonio, TX",
  specialties: ["Mexican", "Tex-Mex", "Comfort Food"],
  cooking_level: "advanced",
  activity_level: "regular"
}

{
  username: "chef_kevin",
  display_name: "Kevin Chen",
  bio: "Software Engineer by day, passionate cook by night! Specializing in Chinese and fusion. Always experimenting!",
  location: "San Francisco, CA",
  specialties: ["Chinese", "Fusion", "Asian"],
  cooking_level: "intermediate",
  activity_level: "power"
}
```

---

## 🎬 Activity Generation

### Activity Level Distribution

Users are categorized by engagement level:

| Level | Users | Interactions | Description |
|-------|-------|--------------|-------------|
| **Lurker** | 20% (400) | 0-5 | Browse only, minimal interaction |
| **Occasional** | 40% (800) | 5-15 | Occasional ratings/comments |
| **Regular** | 30% (600) | 20-50 | Active participation |
| **Power** | 10% (200) | 100-250 | Heavy users, multiple activities |

### Activity Types

Activity is distributed realistically across:

- **Ratings** (40%): Rate recipes 1-5 stars
- **Comments** (25%): Leave thoughtful reviews
- **Likes** (15%): Quick appreciation
- **Favorites** (10%): Save recipes
- **Collections** (5%): Organize recipes
- **Meal Plans** (5%): Create weekly meal plans

### Rating Distribution

Ratings follow realistic patterns:

- **5 Stars**: 50% (most popular recipes)
- **4 Stars**: 30% (good recipes)
- **3 Stars**: 15% (decent recipes)
- **2 Stars**: 3% (needs improvement)
- **1 Star**: 2% (rare, poor quality)

### Comment Examples

The system generates varied, authentic comments:

**Enthusiastic**:
- "This recipe is amazing! Made it exactly as written and it turned out perfectly. My family loved it!"
- "Absolutely delicious! This is going in my regular rotation. Thanks for sharing!"

**With Modifications**:
- "Great recipe! I added a bit of garlic and it was perfect."
- "Made this with a few tweaks - used honey instead of sugar. Turned out great!"

**Constructive**:
- "Good recipe overall. A bit too salty for my taste but I'll adjust next time."
- "Pretty good! I think it could use a bit more seasoning."

**Simple Praise**:
- "Perfect! ⭐⭐⭐⭐⭐"
- "So good! Made it twice this week already."

---

## 🖼️ Avatar Photos

### Overview

The system expects 100 unique avatar photos (2000 users ÷ 100 = 20 users per avatar).

### Requirements

- **Format**: JPG
- **Size**: 512x512px (square)
- **File Size**: < 200KB
- **Naming**: `user-001.jpg` through `user-100.jpg`
- **Location**: `public/avatars/synthetic/`

### Photo Sources

**Recommended**: AI-Generated Faces
- [ThisPersonDoesNotExist.com](https://thispersondoesnotexist.com/) - Free, unlimited, photorealistic
- [Generated Photos](https://generated.photos/) - Filterable by demographics

**Alternative**: Stock Photos
- [Unsplash](https://unsplash.com/) - Free, high-quality
- [Pexels](https://www.pexels.com/) - Free stock photos

### Quick Upload Script

```bash
#!/bin/bash
mkdir -p public/avatars/synthetic
cd public/avatars/synthetic

for i in {1..100}; do
  num=$(printf "%03d" $i)
  curl -o "user-${num}.jpg" https://thispersondoesnotexist.com/image
  sleep 2  # Be respectful to server
done
```

**Detailed Instructions**: See `04-avatar-upload-guide.md`

---

## 🔄 Gradual Phase-Out System

### Philosophy

As real users join the platform, synthetic users should be gradually phased out to maintain authenticity while avoiding sudden drop in activity metrics.

### Deactivation Strategy

#### Phase 1: Deactivate Lurkers (Weeks 1-4)
```bash
# Deactivate 10-20 lurkers per day
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 20 lurker
```

#### Phase 2: Deactivate Occasional Users (Weeks 5-12)
```bash
# Deactivate 10-15 occasional users per day
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 15 occasional
```

#### Phase 3: Deactivate Regular Users (Weeks 13-24)
```bash
# Deactivate 5-10 regular users per day
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 10 regular
```

#### Phase 4: Deactivate Power Users (Weeks 25-52)
```bash
# Deactivate 2-5 power users per week
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 5 power
```

### Automated Deactivation (Cron Job)

```bash
# Add to crontab for daily deactivation
0 2 * * * cd /path/to/recipe-manager && pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 10
```

### Monitoring

```bash
# Check current status
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts status
```

Output:
```
📊 SYNTHETIC USER STATISTICS
═══════════════════════════════════════════════════════
Total synthetic users:     2000
  └─ Active:               1847
  └─ Deactivated:          153

Activity Level Distribution:
  └─ Lurkers:              320
  └─ Occasional:           735
  └─ Regular:              552
  └─ Power Users:          240

Associated Data:
  └─ Ratings:              45,230
  └─ Comments:             28,645
  └─ Likes:                17,188
  └─ Favorites:            11,459
  └─ Collections:          5,729
  └─ Meals:                5,729
═══════════════════════════════════════════════════════
```

---

## 🗑️ Complete Cleanup

### When to Clean Up

Delete synthetic users when:
- Platform has sufficient real users (500+ active users)
- Real user engagement surpasses synthetic activity
- Preparing for public launch
- Data accuracy is critical (analytics, reporting)

### Cleanup Process

#### Step 1: Deactivate All Synthetic Users
```bash
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts deactivate 2000
```

#### Step 2: Verify Deactivation
```bash
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts status
```

#### Step 3: Delete Deactivated Users (Safe)
```bash
# Only deletes deactivated users
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete
```

#### Step 4: Delete All (Nuclear Option)
```bash
# Deletes ALL synthetic users (active + deactivated)
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete all
```

### What Gets Deleted

The cleanup script removes:
- ✅ User profiles
- ✅ Recipe ratings
- ✅ Recipe comments
- ✅ Recipe likes
- ✅ Favorites
- ✅ Collections and collection recipes
- ✅ Meals and meal recipes
- ✅ Recipe views

**Note**: Recipe data itself is NOT deleted (in case synthetic users rated real recipes).

---

## 📊 Database Schema

### Migration: Synthetic User Tracking Fields

```sql
-- Identifies synthetic users
ALTER TABLE user_profiles ADD COLUMN is_synthetic_user BOOLEAN DEFAULT FALSE NOT NULL;

-- Controls visibility (soft delete)
ALTER TABLE user_profiles ADD COLUMN synthetic_user_active BOOLEAN DEFAULT TRUE;

-- Tracks deactivation
ALTER TABLE user_profiles ADD COLUMN deactivated_at TIMESTAMP WITH TIME ZONE;

-- Categorizes engagement level
ALTER TABLE user_profiles ADD COLUMN synthetic_activity_level TEXT
  CHECK (synthetic_activity_level IN ('lurker', 'occasional', 'regular', 'power'));

-- Index for efficient filtering
CREATE INDEX idx_user_profiles_synthetic ON user_profiles (is_synthetic_user, synthetic_user_active);
```

### Rollback

```bash
pnpm tsx scripts/seed-users/00-migration-synthetic-users.ts rollback
```

---

## 🧪 Testing & Verification

### Verify Profile Generation

```bash
# Check generated profiles file
cat scripts/seed-users/generated-profiles.json | jq '. | length'
# Should output: 2000

# Check diversity
cat scripts/seed-users/generated-profiles.json | jq '[.[].location] | group_by(.) | map({location: .[0], count: length}) | sort_by(.count) | reverse | .[0:10]'
```

### Verify Database Insertion

```sql
-- Count synthetic users
SELECT COUNT(*) FROM user_profiles WHERE is_synthetic_user = true;
-- Expected: 2000

-- Check activity level distribution
SELECT synthetic_activity_level, COUNT(*)
FROM user_profiles
WHERE is_synthetic_user = true
GROUP BY synthetic_activity_level;

-- Sample profiles
SELECT username, display_name, location, synthetic_activity_level
FROM user_profiles
WHERE is_synthetic_user = true
LIMIT 10;
```

### Verify Activity Generation

```sql
-- Count ratings by synthetic users
SELECT COUNT(*)
FROM recipe_ratings rr
JOIN user_profiles up ON rr.user_id = up.user_id
WHERE up.is_synthetic_user = true;

-- Check rating distribution
SELECT rating, COUNT(*)
FROM recipe_ratings rr
JOIN user_profiles up ON rr.user_id = up.user_id
WHERE up.is_synthetic_user = true
GROUP BY rating
ORDER BY rating DESC;

-- Count comments
SELECT COUNT(*)
FROM recipe_comments rc
JOIN user_profiles up ON rc.user_id = up.user_id
WHERE up.is_synthetic_user = true;
```

---

## ⚠️ Important Considerations

### Legal & Ethical

✅ **DO**:
- Use AI-generated faces (no copyright issues)
- Use stock photos with CC0/free licenses
- Clearly mark synthetic users in database
- Have plan to phase out synthetic data

❌ **DON'T**:
- Use photos scraped from social media
- Use photos of real people without permission
- Misrepresent synthetic users as real
- Keep synthetic data indefinitely without disclosure

### Performance

- Profile generation: ~30 seconds
- Database insertion: ~2-3 minutes (batched)
- Activity generation: ~5-10 minutes (depends on recipe count)
- Cleanup: ~1-2 minutes (cascading deletes)

### Data Integrity

- Synthetic users are clearly marked (`is_synthetic_user = true`)
- Can be filtered out of analytics queries
- Gradual deactivation prevents sudden metric drops
- Complete cleanup removes all traces

---

## 🆘 Troubleshooting

### Issue: Profile generation fails

```bash
# Error: Module not found
# Solution: Ensure running from project root
cd /path/to/recipe-manager
pnpm tsx scripts/seed-users/01-generate-profiles.ts
```

### Issue: Database insertion fails

```bash
# Error: Duplicate username
# Solution: Drop existing synthetic users and re-run migration
pnpm tsx scripts/seed-users/99-cleanup-synthetic-users.ts delete all
pnpm tsx scripts/seed-users/00-migration-synthetic-users.ts rollback
pnpm tsx scripts/seed-users/00-migration-synthetic-users.ts
```

### Issue: Activity generation fails - No recipes found

```bash
# Error: No recipes found!
# Solution: Populate recipes first
# Run your existing recipe seeding scripts
```

### Issue: Avatars not loading

```bash
# Check file exists
ls public/avatars/synthetic/user-001.jpg

# Check permissions
chmod 644 public/avatars/synthetic/*.jpg

# Restart dev server
pnpm dev
```

---

## 📚 Additional Resources

- **Database Schema**: `src/lib/db/user-discovery-schema.ts`
- **User Actions**: `src/app/actions/user-profiles.ts`
- **Avatar Guide**: `scripts/seed-users/04-avatar-upload-guide.md`
- **Project Docs**: `docs/guides/USER_DISCOVERY_FEATURES.md`

---

## 🎯 Success Metrics

After running the complete seeding system, you should have:

- ✅ 2000 diverse user profiles in database
- ✅ ~50,000+ recipe ratings
- ✅ ~30,000+ recipe comments
- ✅ ~20,000+ recipe likes
- ✅ ~12,000+ favorites
- ✅ ~6,000+ collections
- ✅ ~6,000+ meal plans
- ✅ Realistic activity distribution matching user levels
- ✅ Authentic-looking platform engagement

---

## 📝 Changelog

### Version 1.0.0 (2025-10-17)
- Initial release
- 2000 user profile generation
- Comprehensive activity generation
- Gradual phase-out system
- Complete cleanup functionality
- Avatar upload guide

---

**Maintainer**: Recipe Manager Team
**License**: Internal Use Only
**Questions?**: See troubleshooting section above
