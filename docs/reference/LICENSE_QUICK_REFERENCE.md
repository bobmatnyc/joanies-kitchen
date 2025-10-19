# Recipe License - Quick Reference Card

**Quick lookup for recipe license types and usage**

---

## License Types

### 🌐 PUBLIC_DOMAIN
**No restrictions** - Use freely for any purpose
- ✅ Commercial use
- ✅ Modifications
- ❌ Attribution not required

**Best for**: Historical recipes, expired copyrights, explicitly donated content

---

### 🔓 CC_BY (Creative Commons Attribution)
**Free with credit** - Use freely with attribution
- ✅ Commercial use
- ✅ Modifications
- ✅ Attribution required

**Best for**: Open sharing, blog recipes, community contributions

---

### 🔓 CC_BY_SA (CC Attribution-ShareAlike)
**Free with credit + same license** - Derivatives must share alike
- ✅ Commercial use
- ✅ Modifications
- ✅ Attribution required
- ⚠️ Derivatives must use same license

**Best for**: Open source recipe collections, collaborative cookbooks

---

### 🔓 CC_BY_NC (CC Attribution-NonCommercial)
**Non-commercial with credit** - No commercial use
- ❌ Commercial use prohibited
- ✅ Modifications allowed
- ✅ Attribution required

**Best for**: Personal blogs, hobby chefs, educational sharing

---

### 🔓 CC_BY_NC_SA (CC Attribution-NonCommercial-ShareAlike)
**Non-commercial with credit + same license**
- ❌ Commercial use prohibited
- ✅ Modifications allowed
- ✅ Attribution required
- ⚠️ Derivatives must use same license

**Best for**: Community recipe exchanges, educational resources

---

### 📚 EDUCATIONAL_USE
**Education only** - Restricted to educational purposes
- ❌ Commercial use prohibited
- ⚠️ Modifications may be restricted
- ❌ Attribution may not be required

**Best for**: Classroom materials, cooking courses, culinary schools

---

### 🏠 PERSONAL_USE
**Personal only** - Private, non-commercial use
- ❌ Commercial use prohibited
- ⚠️ Public sharing may be restricted
- ❌ Attribution not required

**Best for**: User-generated recipes, private collections, family recipes

---

### 🔒 ALL_RIGHTS_RESERVED
**Full copyright** - Permission required for use
- ❌ Commercial use prohibited
- ❌ Modifications prohibited
- ❌ Redistribution prohibited

**Best for**: Professional chef recipes, copyrighted cookbooks, restaurant secrets
**Default**: Used when license is unknown or unclear

---

### ⚖️ FAIR_USE
**Limited use** - Fair use doctrine applies
- ⚠️ Context-dependent
- ✅ Commentary/criticism
- ✅ Education
- ✅ News reporting

**Best for**: Reviews, critiques, educational analysis, news articles

---

## Quick Decision Tree

### Creating a Recipe

```
Is it your original creation?
├─ YES → Use PERSONAL_USE or CC_BY (if sharing)
└─ NO → Where did it come from?
    ├─ Public domain source → PUBLIC_DOMAIN
    ├─ Creative Commons source → Match original license
    ├─ Unknown/unclear → ALL_RIGHTS_RESERVED (safest)
    └─ Commercial cookbook → ALL_RIGHTS_RESERVED
```

### Importing a Recipe

```
Check the source website
├─ Has Creative Commons license → Use that license
├─ Says "public domain" → PUBLIC_DOMAIN
├─ Has copyright notice → ALL_RIGHTS_RESERVED
└─ Not specified → ALL_RIGHTS_RESERVED (safest default)
```

### AI-Generated Recipes

```
Who requested it?
├─ User for personal use → PERSONAL_USE
├─ User wanting to share → CC_BY
└─ System/curated → CC_BY or PUBLIC_DOMAIN
```

---

## Common Use Cases

### Can I use this recipe commercially?

✅ **Yes** if license is:
- PUBLIC_DOMAIN
- CC_BY
- CC_BY_SA

❌ **No** if license is:
- CC_BY_NC
- CC_BY_NC_SA
- EDUCATIONAL_USE
- PERSONAL_USE
- ALL_RIGHTS_RESERVED

---

### Do I need to give credit?

✅ **Yes** if license is:
- CC_BY
- CC_BY_SA
- CC_BY_NC
- CC_BY_NC_SA

❌ **No** if license is:
- PUBLIC_DOMAIN
- PERSONAL_USE
- EDUCATIONAL_USE

---

### Can I modify the recipe?

✅ **Yes, freely** if license is:
- PUBLIC_DOMAIN
- CC_BY
- CC_BY_SA
- CC_BY_NC
- CC_BY_NC_SA

⚠️ **Maybe** if license is:
- PERSONAL_USE
- EDUCATIONAL_USE

❌ **No** if license is:
- ALL_RIGHTS_RESERVED

---

## Code Examples

### Check if commercial use is allowed
```typescript
import { canUseCommercially } from '@/lib/utils/license-utils';

if (canUseCommercially(recipe.license)) {
  // Can sell, use in restaurant, include in paid app
}
```

### Check if attribution is required
```typescript
import { requiresAttribution } from '@/lib/utils/license-utils';

if (requiresAttribution(recipe.license)) {
  const attribution = getAttributionText({
    recipeName: recipe.name,
    author: recipe.author,
    source: recipe.source,
    license: recipe.license,
  });
  // Display attribution text
}
```

### Get recommended license for new recipe
```typescript
import { getRecommendedLicense } from '@/lib/utils/license-utils';

const license = getRecommendedLicense({
  isAiGenerated: true,
  isUserCreated: false,
  hasExternalSource: false,
  isPublic: true,
});
// Returns: 'CC_BY'
```

---

## Database Queries

### Find commercially usable recipes
```typescript
const commercial = await db
  .select()
  .from(recipes)
  .where(inArray(recipes.license, ['PUBLIC_DOMAIN', 'CC_BY', 'CC_BY_SA']));
```

### Find recipes requiring attribution
```typescript
const needsAttribution = await db
  .select()
  .from(recipes)
  .where(inArray(recipes.license, ['CC_BY', 'CC_BY_SA', 'CC_BY_NC', 'CC_BY_NC_SA']));
```

### Find open recipes (public domain + CC)
```typescript
const openRecipes = await db
  .select()
  .from(recipes)
  .where(
    inArray(recipes.license, [
      'PUBLIC_DOMAIN',
      'CC_BY',
      'CC_BY_SA',
      'CC_BY_NC',
      'CC_BY_NC_SA',
    ])
  );
```

---

## Attribution Templates

### CC_BY / CC_BY_SA
```
"[Recipe Name]" by [Author] ([Source URL]) is licensed under CC BY 4.0
```

### CC_BY_NC / CC_BY_NC_SA
```
"[Recipe Name]" by [Author] ([Source URL]) is licensed under CC BY-NC 4.0.
Non-commercial use only.
```

### PUBLIC_DOMAIN
```
"[Recipe Name]" is in the public domain.
```

### ALL_RIGHTS_RESERVED
```
"[Recipe Name]" by [Author] - All rights reserved. Used with permission.
```

---

## Legal Disclaimers

⚠️ **Important Notes**:
- This is not legal advice
- Always verify license from original source
- Recipe facts (ingredients, steps) often can't be copyrighted
- Creative elements (descriptions, photos) can be copyrighted
- When in doubt, use ALL_RIGHTS_RESERVED or seek legal advice

---

## Resources

### Creative Commons
- [Choose a License](https://creativecommons.org/choose/)
- [License Compatibility](https://wiki.creativecommons.org/wiki/Wiki/cc_license_compatibility)
- [CC License Deed](https://creativecommons.org/licenses/)

### Copyright Law
- [U.S. Copyright Office](https://www.copyright.gov/)
- [Fair Use](https://www.copyright.gov/fair-use/)
- [Public Domain](https://www.copyright.gov/help/faq/faq-definitions.html)

### Recipe-Specific
- [Can You Copyright a Recipe?](https://www.copyright.gov/help/faq/faq-protect.html)
- [Recipe Copyright Guide](https://www.nolo.com/legal-encyclopedia/copyright-recipes-30165.html)

---

## Support

For questions about:
- License selection → See `docs/features/RECIPE_LICENSE_ONTOLOGY.md`
- Implementation details → See `RECIPE_LICENSE_IMPLEMENTATION_SUMMARY.md`
- Utility functions → See `src/lib/utils/license-utils.ts`

---

**Last Updated**: 2025-10-19
**Version**: 1.0.0
