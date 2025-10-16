# Chef Profiles - Quick Reference

**Status**: ✅ Active (9 chefs)
**Last Updated**: 2025-10-16

---

## Quick Commands

```bash
# Verify all chef profiles
npx tsx scripts/verify-chefs.ts

# Create new famous chefs (8 profiles)
npx tsx scripts/init-famous-chefs.ts

# Update verification status
npx tsx scripts/update-chefs-verified.ts

# Check verified status only
npx tsx scripts/check-chef-verified-status.ts
```

---

## All Chef Profiles (9 Total)

| # | Name | Slug | Specialties | Status |
|---|------|------|-------------|--------|
| 1 | Alton Brown | `alton-brown` | Science, American, Technique | ✅ |
| 2 | Gordon Ramsay | `gordon-ramsay` | British, Fine Dining, Technique | ✅ |
| 3 | Ina Garten | `ina-garten` | American, Comfort Food, Entertaining | ✅ |
| 4 | J. Kenji López-Alt | `kenji-lopez-alt` | Asian, Science, Technique | ✅ |
| 5 | Jacques Pépin | `jacques-pepin` | French, Classic Technique, Mastery | ✅ |
| 6 | Madhur Jaffrey | `madhur-jaffrey` | Indian, Asian, Authentic | ✅ |
| 7 | Nigella Lawson | `nigella-lawson` | British, Comfort Food, Baking | ✅ |
| 8 | Samin Nosrat | `samin-nosrat` | Education, Mediterranean, Italian | ✅ |
| 9 | Yotam Ottolenghi | `yotam-ottolenghi` | Mediterranean, Middle Eastern, Vegetarian | ✅ |

---

## Quick URLs (localhost:3004)

### Discovery Page:
- http://localhost:3004/discover/chefs

### Individual Chef Pages:
- http://localhost:3004/chef/alton-brown
- http://localhost:3004/chef/gordon-ramsay
- http://localhost:3004/chef/ina-garten
- http://localhost:3004/chef/jacques-pepin
- http://localhost:3004/chef/kenji-lopez-alt
- http://localhost:3004/chef/madhur-jaffrey
- http://localhost:3004/chef/nigella-lawson
- http://localhost:3004/chef/samin-nosrat
- http://localhost:3004/chef/yotam-ottolenghi

---

## Database Table: `chefs`

```sql
-- Quick query to view all chefs
SELECT name, slug, is_verified, is_active, recipe_count
FROM chefs
ORDER BY name;

-- Chef with most recipes
SELECT name, recipe_count
FROM chefs
ORDER BY recipe_count DESC
LIMIT 1;

-- Count by specialty
SELECT unnest(specialties) as specialty, COUNT(*) as chef_count
FROM chefs
GROUP BY specialty
ORDER BY chef_count DESC;
```

---

## File Locations

### Scripts:
- `/scripts/init-famous-chefs.ts` - Create all 8 chefs
- `/scripts/verify-chefs.ts` - List all chefs
- `/scripts/update-chefs-verified.ts` - Update verification status
- `/scripts/init-kenji-alt.ts` - Create Kenji profile only

### Pages:
- `/src/app/discover/chefs/page.tsx` - Chef discovery/listing
- `/src/app/chef/[slug]/page.tsx` - Individual chef page

### Schema:
- `/src/lib/db/chef-schema.ts` - Database schema definitions

### Documentation:
- `/docs/implementation/FAMOUS_CHEFS_IMPLEMENTATION.md` - Full implementation details
- `/docs/guides/CHEF_SYSTEM_IMPLEMENTATION.md` - Chef system guide (if exists)

---

## Chef Specialties Breakdown

### By Cuisine:
- **American**: Alton Brown, Ina Garten, Kenji López-Alt
- **British**: Gordon Ramsay, Nigella Lawson
- **French**: Gordon Ramsay, Jacques Pépin
- **Asian**: Kenji López-Alt, Madhur Jaffrey
- **Indian**: Madhur Jaffrey
- **Mediterranean**: Samin Nosrat, Yotam Ottolenghi
- **Middle Eastern**: Yotam Ottolenghi

### By Focus:
- **Technique**: Gordon Ramsay, Kenji López-Alt, Jacques Pépin, Samin Nosrat
- **Science**: Alton Brown, Kenji López-Alt
- **Education**: Alton Brown, Samin Nosrat
- **Comfort Food**: Ina Garten, Nigella Lawson
- **Baking**: Ina Garten, Nigella Lawson
- **Fine Dining**: Gordon Ramsay
- **Vegetarian**: Yotam Ottolenghi

---

## Common Tasks

### Add New Chef:
```typescript
// Copy pattern from init-famous-chefs.ts
const newChef = {
  name: "Chef Name",
  slug: "chef-slug",
  displayName: "Display Name",
  bio: "Bio text...",
  website: "https://...",
  socialLinks: { /* ... */ },
  specialties: ["specialty1", "specialty2"],
};

await db.insert(chefs).values({
  ...newChef,
  isVerified: true,
  isActive: true,
  recipeCount: 0,
});
```

### Link Recipe to Chef:
```typescript
import { chefRecipes } from '@/lib/db/chef-schema';

await db.insert(chefRecipes).values({
  chefId: "chef-uuid",
  recipeId: "recipe-id",
  originalUrl: "https://source-url",
  scrapedAt: new Date(),
});
```

### Update Recipe Count:
```typescript
// Automatically handled by trigger or manually:
await db.update(chefs)
  .set({
    recipeCount: sql`(SELECT COUNT(*) FROM chef_recipes WHERE chef_id = ${chefId})`
  })
  .where(eq(chefs.id, chefId));
```

---

## Next Steps

1. **Add Profile Images**: Update `profile_image_url` for each chef
2. **Scrape Recipes**: Use admin panel to start recipe collection
3. **Manual Recipe Linking**: Associate existing recipes with chefs
4. **Test Pages**: Run dev server and verify all URLs work
5. **SEO Optimization**: Add meta tags and structured data to chef pages

---

## Support

For issues or questions:
- Check: `/docs/implementation/FAMOUS_CHEFS_IMPLEMENTATION.md`
- Review: `/src/lib/db/chef-schema.ts`
- Run: `npx tsx scripts/verify-chefs.ts`
