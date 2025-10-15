# Admin Access - Quick Reference Card

## 3-Step Setup

### 1️⃣ Configure Session Token
**Clerk Dashboard → Sessions → Customize session token**
```json
{ "metadata": "{{user.public_metadata}}" }
```

### 2️⃣ Set User as Admin
**Clerk Dashboard → Users → Select User → Edit Public Metadata**
```json
{ "isAdmin": "true" }
```

### 3️⃣ Refresh Session
**Sign out and sign back in**

---

## Testing URLs

| URL | Purpose |
|-----|---------|
| `http://localhost:3001/api/debug-session` | View session claims |
| `http://localhost:3001/admin` | Admin dashboard |
| `http://localhost:3001/admin/recipes` | Recipe management |

---

## Verification Checklist

### Admin User Should See:
- ✅ "Admin Dashboard" in profile popup (with shield icon)
- ✅ Admin Dashboard page at `/admin`
- ✅ Debug endpoint shows `isAdminFromMetadata: "true"`

### Non-Admin User Should See:
- ✅ NO admin link in profile popup
- ✅ Redirect to home when visiting `/admin`
- ✅ Debug endpoint shows `isAdminFromMetadata: null`

---

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| No admin link in popup | 1. Check user metadata in Clerk<br>2. Sign out/in<br>3. Clear browser cache |
| Redirected from /admin | 1. Configure custom session token<br>2. Sign out/in<br>3. Check debug endpoint |
| Debug shows no metadata | Configure custom session token (Step 1) |

---

## Files Modified

### Updated Files
- `/src/components/auth/AuthButtons.tsx` - Added admin menu item

### New Files
- `/src/app/api/debug-session/route.ts` - Debug endpoint
- `/scripts/validate-admin-setup.js` - Validation script
- `/ADMIN_SETUP_GUIDE.md` - Full documentation
- `/ADMIN_FLOW_DIAGRAM.md` - Visual diagrams
- `/ADMIN_FIX_SUMMARY.md` - Complete fix summary

---

## Quick Commands

```bash
# Run validation script
node scripts/validate-admin-setup.js

# Check modified files
git status

# View changes
git diff src/components/auth/AuthButtons.tsx
```

---

## Expected Debug Response

```json
{
  "userId": "user_xxxxxxxxxxxxx",
  "hasSessionClaims": true,
  "metadata": { "isAdmin": "true" },
  "isAdminFromMetadata": "true"
}
```

---

## Support

- **Full Guide:** See `ADMIN_SETUP_GUIDE.md`
- **Visual Flow:** See `ADMIN_FLOW_DIAGRAM.md`
- **Summary:** See `ADMIN_FIX_SUMMARY.md`
- **Clerk Dashboard:** https://dashboard.clerk.com/
- **Clerk Docs:** https://clerk.com/docs/users/metadata

---

## Security Reminder

⚠️ **Frontend checks = UX only**
🔒 **Backend checks = Security enforcement**
🛡️ **Always validate on both layers**

---

*For detailed explanations, see ADMIN_SETUP_GUIDE.md*
