# Recipe Moderation System - Implementation Checklist

## Database Migration

### Pre-Migration
- [ ] Review migration script: `/scripts/migrations/add-moderation-fields.ts`
- [ ] Read documentation: `/docs/migrations/RECIPE-MODERATION-FIELDS.md`
- [ ] Backup database (production only)
  ```bash
  pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
  ```

### Test Migration (Development)
- [ ] Run test script to verify safety:
  ```bash
  pnpm tsx scripts/test-moderation-migration.ts
  ```
- [ ] Run migration in development:
  ```bash
  pnpm tsx scripts/migrations/add-moderation-fields.ts
  ```
- [ ] Verify schema changes:
  ```bash
  psql $DATABASE_URL -c "\d recipes"
  ```
- [ ] Verify existing recipes are approved:
  ```bash
  psql $DATABASE_URL -c "SELECT moderation_status, COUNT(*) FROM recipes GROUP BY moderation_status;"
  ```

### Production Migration
- [ ] Schedule maintenance window (optional - non-breaking)
- [ ] Backup production database
- [ ] Run migration:
  ```bash
  pnpm tsx scripts/migrations/add-moderation-fields.ts
  ```
- [ ] Verify migration success
- [ ] Monitor for errors

## Backend Implementation

### Server Actions - Moderation
- [ ] Create `/src/app/actions/moderation.ts`:
  - [ ] `getPendingRecipes()` - Get moderation queue
  - [ ] `approveRecipe(recipeId, moderatorId)` - Approve recipe
  - [ ] `rejectRecipe(recipeId, moderatorId, notes)` - Reject with reason
  - [ ] `flagRecipe(recipeId, moderatorId, notes)` - Flag for review
  - [ ] `getModerationStats()` - Dashboard statistics

### Update Existing Actions
- [ ] Update recipe creation (`/src/app/actions/recipes.ts`):
  ```typescript
  // Set moderation_status based on user role
  const moderationStatus =
    isSystemRecipe ? 'approved' :
    isAdmin(userId) ? 'approved' :
    'pending';
  ```

- [ ] Update all public recipe queries:
  ```typescript
  // Add moderation check
  where(
    and(
      eq(recipes.is_public, true),
      eq(recipes.moderation_status, 'approved')
    )
  )
  ```

### Access Control
- [ ] Create admin middleware (`/src/middleware/admin.ts`)
- [ ] Add role checking utility:
  ```typescript
  export function isAdmin(userId: string): boolean {
    // Check if user has admin role
  }
  ```

## Frontend Implementation

### Admin Moderation Queue
- [ ] Create route: `/app/admin/moderation/page.tsx`
- [ ] Components to create:
  - [ ] `ModerationQueue` - Main queue component
  - [ ] `ModerationCard` - Individual recipe card
  - [ ] `ModerationActions` - Approve/Reject/Flag buttons
  - [ ] `ModerationStats` - Dashboard overview
  - [ ] `RejectDialog` - Modal for rejection notes
  - [ ] `FlagDialog` - Modal for flagging notes

### Features
- [ ] Display pending recipes (oldest first)
- [ ] Show recipe preview with:
  - [ ] Recipe name and image
  - [ ] Ingredients and instructions
  - [ ] Submission date
  - [ ] User info (username)
  - [ ] Submission notes (if provided)
- [ ] Action buttons:
  - [ ] Approve (green button)
  - [ ] Reject (red button with notes dialog)
  - [ ] Flag (yellow button with notes dialog)
- [ ] Pagination for large queues
- [ ] Filter by status (optional)
- [ ] Batch actions (optional, future)

### User Dashboard Updates
- [ ] Show moderation status badge on user's recipes:
  - [ ] 🟡 Pending Review
  - [ ] ✅ Approved
  - [ ] ❌ Rejected (with reason)
  - [ ] 🚩 Flagged
- [ ] Display rejection reason from `moderation_notes`
- [ ] Allow viewing own pending recipes

### Recipe Submission Form
- [ ] Add optional `submission_notes` field:
  ```tsx
  <Textarea
    label="Notes for reviewers (optional)"
    placeholder="Any additional context for the moderation team..."
  />
  ```
- [ ] Show moderation notice:
  ```tsx
  <Alert>
    Your recipe will be reviewed before becoming publicly visible.
  </Alert>
  ```

### Recipe Display
- [ ] Hide pending/rejected recipes from public view
- [ ] Show appropriate message to recipe author:
  - Pending: "Your recipe is under review"
  - Rejected: "Your recipe was not approved: {reason}"
  - Flagged: "Your recipe is under investigation"
- [ ] Allow authors to view their own pending recipes

## Testing

### Unit Tests
- [ ] Test moderation server actions
- [ ] Test access control functions
- [ ] Test recipe visibility queries
- [ ] Test moderation status transitions

### Integration Tests
- [ ] Test complete approval workflow
- [ ] Test rejection workflow with notes
- [ ] Test flagging workflow
- [ ] Test that pending recipes are hidden from public
- [ ] Test that approved recipes are visible

### E2E Tests
- [ ] Test admin moderation queue page
- [ ] Test approving a recipe (UI → DB)
- [ ] Test rejecting a recipe (UI → DB)
- [ ] Test user seeing moderation status
- [ ] Test user submission with notes

### Manual Testing Checklist
- [ ] Create test recipe as regular user
- [ ] Verify it appears in moderation queue
- [ ] Verify it's NOT in public listings
- [ ] Approve the recipe
- [ ] Verify it appears in public listings
- [ ] Reject a recipe with notes
- [ ] Verify user sees rejection reason
- [ ] Flag an approved recipe
- [ ] Verify it's hidden from public

## Documentation Updates

### User-Facing Docs
- [ ] Update FAQ with moderation information
- [ ] Create "How Moderation Works" guide
- [ ] Update recipe submission help text

### Developer Docs
- [ ] Document moderation server actions
- [ ] Document access control patterns
- [ ] Update API documentation
- [ ] Add moderation workflow diagram

## Deployment

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Database migration tested in staging
- [ ] Admin users identified and notified

### Deployment Steps
1. [ ] Deploy database migration
2. [ ] Deploy backend code (server actions)
3. [ ] Deploy frontend code (UI updates)
4. [ ] Verify moderation queue accessible
5. [ ] Monitor error logs

### Post-Deployment
- [ ] Verify existing recipes still visible
- [ ] Test creating new recipe (pending status)
- [ ] Test admin moderation actions
- [ ] Monitor moderation queue
- [ ] Gather initial feedback from admins

## Rollback Plan

### If Issues Arise
- [ ] Stop new recipe submissions
- [ ] Document the issue
- [ ] Decide: Fix forward or rollback?

### Rollback Database
```bash
# Rollback migration
pnpm tsx scripts/migrations/add-moderation-fields.ts --rollback

# Or restore from backup
psql $DATABASE_URL < backup_file.sql
```

### Rollback Code
```bash
# Revert to previous deployment
git revert <commit-hash>
git push
```

## Monitoring

### Metrics to Track
- [ ] Pending recipes count
- [ ] Average time in moderation queue
- [ ] Approval rate
- [ ] Rejection rate
- [ ] Flagging rate
- [ ] User complaints/feedback

### Alerts to Set Up
- [ ] Alert if queue exceeds 50 recipes
- [ ] Alert if recipe pending > 48 hours
- [ ] Alert on moderation action errors

## Future Enhancements

### Phase 2 (Optional)
- [ ] Automated content screening (AI)
- [ ] Bulk approve/reject actions
- [ ] Moderation history/audit log
- [ ] Appeal process for rejected recipes
- [ ] Multi-level moderation (junior/senior)
- [ ] Moderation analytics dashboard

## Success Criteria

- [ ] ✅ Migration runs successfully
- [ ] ✅ All existing recipes remain visible
- [ ] ✅ New user recipes default to pending
- [ ] ✅ Admin queue shows pending recipes
- [ ] ✅ Approve/reject/flag actions work
- [ ] ✅ Users can see their moderation status
- [ ] ✅ Rejected recipes show reason
- [ ] ✅ No performance degradation
- [ ] ✅ Zero downtime deployment

## Key Files Reference

### Database
- Schema: `/src/lib/db/schema.ts`
- Migration: `/scripts/migrations/add-moderation-fields.ts`
- Test: `/scripts/test-moderation-migration.ts`

### Documentation
- Detailed: `/docs/migrations/RECIPE-MODERATION-FIELDS.md`
- Quick Ref: `/RECIPE_MODERATION_MIGRATION.md`
- Summary: `/MODERATION_IMPLEMENTATION_SUMMARY.md`
- Checklist: `/MODERATION_CHECKLIST.md` (this file)

### To Create
- Actions: `/src/app/actions/moderation.ts`
- Admin Page: `/src/app/admin/moderation/page.tsx`
- Components: `/src/components/moderation/*`

## Notes

- Migration is backward compatible
- Existing recipes auto-approved
- No breaking changes to current codebase
- Can be deployed without downtime
- Rollback available if needed

---

**Last Updated:** 2025-10-30
**Version:** 1.0.0
**Status:** ✅ Ready for implementation
