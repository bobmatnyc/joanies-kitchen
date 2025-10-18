# Chef Location Map Feature

## Overview

The Chef Location Map feature displays chef locations on an interactive OpenStreetMap, allowing users to explore where chefs are based geographically. Users can toggle between a traditional grid view and an interactive map view on the Discover Chefs page.

## Features

- **Interactive Map**: OpenStreetMap integration with Leaflet and React Leaflet
- **Chef Markers**: Each chef with location data appears as a marker on the map
- **Rich Popups**: Click markers to see chef details including avatar, location, recipe count, and link to chef page
- **Auto-fit Bounds**: Map automatically zooms to show all chef markers
- **View Toggle**: Switch between Grid View (traditional) and Map View
- **Responsive Design**: Map adapts to mobile and desktop screens
- **Theme Integration**: Map popups styled to match Joanie's Kitchen brand colors

## Database Schema

### Location Fields Added to `chefs` Table

```sql
latitude DECIMAL(10, 7)          -- Chef's latitude coordinate
longitude DECIMAL(10, 7)         -- Chef's longitude coordinate
location_city VARCHAR(100)       -- City (e.g., "London")
location_state VARCHAR(50)       -- State/Province (e.g., "CA", null for non-US)
location_country VARCHAR(50)     -- Country (e.g., "United States", "United Kingdom")
```

## Current Chef Locations

| Chef | Location | Coordinates |
|------|----------|-------------|
| Yotam Ottolenghi | London, United Kingdom | 51.5074° N, 0.1278° W |
| Nigella Lawson | London, United Kingdom | 51.5074° N, 0.1278° W |
| Samin Nosrat | Berkeley, CA, United States | 37.8715° N, 122.2730° W |
| Lidia Bastianich | New York, NY, United States | 40.7128° N, 74.0060° W |
| Nancy Silverton | Los Angeles, CA, United States | 34.0522° N, 118.2437° W |
| J. Kenji López-Alt | San Francisco, CA, United States | 37.7749° N, 122.4194° W |
| Madhur Jaffrey | New York, NY, United States | 40.7128° N, 74.0060° W |
| Jacques Pépin | Madison, CT, United States | 41.6032° N, 73.0877° W |
| Alton Brown | Atlanta, GA, United States | 33.7490° N, 84.3880° W |
| Gordon Ramsay | London, United Kingdom | 51.5074° N, 0.1278° W |

## Technical Implementation

### Components

#### `ChefLocationMap.tsx`
- Client-side component using React Leaflet
- Displays OpenStreetMap tiles
- Renders markers for chefs with location data
- Shows popups with chef information
- Auto-fits map bounds to include all markers
- Handles SSR with dynamic import

**Location**: `src/components/discover/ChefLocationMap.tsx`

#### `ChefViewToggle.tsx`
- Client component wrapping grid and map views
- Manages view state (grid/map)
- Provides toggle buttons
- Dynamically imports map to avoid SSR issues

**Location**: `src/components/discover/ChefViewToggle.tsx`

### Server Actions

Updated `getAllChefs()` action to include location fields:

```typescript
// src/app/actions/chefs.ts
{
  latitude: chef.latitude,
  longitude: chef.longitude,
  locationCity: chef.location_city,
  locationState: chef.location_state,
  locationCountry: chef.location_country,
}
```

### Styling

Custom Leaflet styles added to `globals.css`:

```css
/* Leaflet Map Custom Styles - Match Joanie's Kitchen Theme */
.leaflet-popup-content-wrapper {
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  border: 1px solid rgba(91, 96, 73, 0.2);
}

.leaflet-popup-content {
  margin: 0;
  padding: 0;
  font-family: var(--font-body), serif;
  color: var(--jk-charcoal);
}
```

Popup design uses:
- **jk-olive**: Primary text color
- **jk-linen**: Background accents
- **jk-olive/20**: Border colors
- **Parchment aesthetic**: Matching site theme

## Adding New Chef Locations

### Option 1: Manual Database Update

```sql
UPDATE chefs
SET
  latitude = 'XX.XXXXXXX',
  longitude = 'XX.XXXXXXX',
  location_city = 'City Name',
  location_state = 'State/Province',  -- null for non-US
  location_country = 'Country Name',
  updated_at = NOW()
WHERE slug = 'chef-slug';
```

### Option 2: Migration Script

Update and run `scripts/add-chef-locations.ts`:

1. Add chef to `chefLocations` array:
```typescript
{
  slug: 'new-chef-slug',
  latitude: 'XX.XXXXXXX',
  longitude: 'XX.XXXXXXX',
  city: 'City Name',
  state: 'State/Province',  // null for non-US
  country: 'Country Name',
}
```

2. Run script:
```bash
npx tsx scripts/add-chef-locations.ts
```

### Option 3: Admin Interface (Future Enhancement)

A future admin panel could include:
- Location picker/geocoding
- Drag-and-drop map markers
- Bulk location import

## Dependencies

```json
{
  "dependencies": {
    "leaflet": "^1.9.4",
    "react-leaflet": "^5.0.0"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.21"
  }
}
```

## Map Configuration

### Tile Provider
- **Provider**: OpenStreetMap
- **Attribution**: © OpenStreetMap contributors
- **URL**: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

### Default Settings
- **Default Zoom**: 4 (continental view)
- **Max Zoom**: 12 (when auto-fitting bounds)
- **Scroll Wheel Zoom**: Enabled
- **Default Center**: New York City (40.7128° N, 74.0060° W)

## Responsive Design

### Desktop
- Map height: 600px
- Full width with border and shadow
- Grid view: 3-column layout
- Legend positioned bottom-right

### Mobile
- Map height: 600px (full viewport consideration)
- Toggle buttons: Full width stacked on small screens
- Popups: Max width 300px
- Grid view: Single column

## Future Enhancements

### Phase 1: Enhanced Markers
- Custom chef avatar markers (circular chef photos)
- Marker clustering for overlapping locations
- Different marker colors by chef specialty

### Phase 2: Interactive Features
- Filter chefs by location/region
- Distance-based search ("Chefs within X miles")
- Route planning between chef locations

### Phase 3: Geographic Analytics
- Heat map of chef concentration
- Regional cuisine distribution
- Integration with recipe map (show recipe origins)

### Phase 4: User Features
- Save favorite locations
- "Near me" chef discovery
- Location-based recipe recommendations

## Testing

### Manual Testing Checklist

- [ ] Map loads without errors
- [ ] All 10 chefs appear as markers
- [ ] Clicking marker shows popup with correct info
- [ ] Popup "View Recipes" link works
- [ ] Toggle switches between grid and map views
- [ ] Map auto-fits to show all markers
- [ ] Responsive on mobile (tested on real device)
- [ ] Popups styled correctly (match theme)
- [ ] No console errors
- [ ] Leaflet CSS loads properly

### Test URLs

- Development: `http://localhost:3002/discover/chefs`
- Production: `https://your-domain.com/discover/chefs`

## Troubleshooting

### Map Not Displaying

**Issue**: White/gray box instead of map

**Solutions**:
1. Check Leaflet CSS is imported:
   ```css
   @import "leaflet/dist/leaflet.css";
   ```
2. Verify dynamic import in `ChefViewToggle.tsx`
3. Check browser console for errors

### Markers Not Appearing

**Issue**: Map loads but no markers

**Solutions**:
1. Verify chef location data in database:
   ```sql
   SELECT name, latitude, longitude FROM chefs WHERE latitude IS NOT NULL;
   ```
2. Check browser console for coordinate parsing errors
3. Verify `getAllChefs()` returns location fields

### Marker Icons Missing

**Issue**: Markers show but icons are broken

**Solution**: Check default icon fix in `ChefLocationMap.tsx`:
```typescript
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});
```

### SSR Errors

**Issue**: "window is not defined" or similar

**Solution**: Ensure map is dynamically imported with `ssr: false`:
```typescript
const ChefLocationMap = dynamic(
  () => import('./ChefLocationMap').then((mod) => mod.ChefLocationMap),
  { ssr: false }
);
```

## Performance Considerations

- Map component dynamically loaded (not in initial bundle)
- Leaflet CSS loaded globally (cached)
- Marker data filtered on client side
- Auto-fit bounds runs once on mount
- No real-time updates (static chef locations)

## Accessibility

### Current Implementation
- Keyboard navigation: Basic Leaflet support
- Screen readers: Limited (map is visual-first)
- Alternative: Grid view remains accessible

### Future Improvements
- Add ARIA labels to markers
- Keyboard shortcuts for map navigation
- Text-based location list alongside map
- High contrast mode support

## Related Documentation

- [Project Organization](../reference/PROJECT_ORGANIZATION.md)
- [Chef System](../reference/CHEF_AVATAR_SYSTEM.md)
- [Discover Page](../../src/app/discover/chefs/page.tsx)

---

**Last Updated**: 2025-10-17
**Feature Version**: 1.0.0
**Maintained By**: Recipe Manager Team
