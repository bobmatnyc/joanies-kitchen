# Chef Location Map - Quick Start Guide

## Accessing the Map

1. Navigate to: `http://localhost:3002/discover/chefs`
2. Click the "Map View" button in the view toggle
3. Explore chef locations on the interactive map

## Features at a Glance

### Toggle Between Views
- **Grid View**: Traditional 3-column grid of chef cards
- **Map View**: Interactive OpenStreetMap with chef markers

### Map Interactions
- **Click markers**: View chef details in popup
- **Zoom**: Mouse wheel or pinch gesture
- **Pan**: Click and drag to move map
- **Popup links**: Click "View Recipes" to go to chef page

### Current Locations
- **10 chefs** with location data
- **4 US cities**: New York, San Francisco, Los Angeles, Berkeley, Atlanta, Madison
- **1 UK city**: London

## For Developers

### Adding New Chef Location

Quick method (single chef):
```sql
UPDATE chefs
SET
  latitude = '40.7128',
  longitude = '-74.0060',
  location_city = 'New York',
  location_state = 'NY',
  location_country = 'United States',
  updated_at = NOW()
WHERE slug = 'chef-slug';
```

### Component Structure
```
src/app/discover/chefs/page.tsx
  └─ ChefViewToggle.tsx (client)
      ├─ ChefGrid.tsx (grid view)
      └─ ChefLocationMap.tsx (map view, dynamic import)
```

### Key Files
- Schema: `src/lib/db/chef-schema.ts`
- Migration: `scripts/add-chef-locations.ts`
- Map Component: `src/components/discover/ChefLocationMap.tsx`
- Toggle: `src/components/discover/ChefViewToggle.tsx`
- Styles: `src/app/globals.css` (Leaflet customization)

## Dependencies
- `leaflet`: ^1.9.4
- `react-leaflet`: ^5.0.0
- `@types/leaflet`: ^1.9.21 (dev)

## Troubleshooting

### Map not showing?
1. Check Leaflet CSS is imported in `globals.css`
2. Verify dynamic import in `ChefViewToggle.tsx`
3. Check browser console for errors

### Markers missing?
```sql
-- Verify chef has location data
SELECT name, latitude, longitude FROM chefs WHERE slug = 'chef-slug';
```

### TypeScript errors?
- Run: `pnpm build` to check type errors
- Ensure all Chef interfaces include location fields

## Testing Checklist

✅ Map loads without errors
✅ Toggle switches views
✅ Markers appear for all chefs with locations
✅ Popups show correct data
✅ Links work
✅ Mobile responsive

## Next Steps

1. Test on real mobile devices
2. Consider custom chef avatar markers
3. Add filtering by location/region
4. Implement marker clustering for overlapping locations

---

For complete documentation, see: [CHEF_LOCATION_MAP.md](CHEF_LOCATION_MAP.md)
