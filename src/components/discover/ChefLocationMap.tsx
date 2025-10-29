'use client';

import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface ChefWithLocation {
  id: string;
  name: string;
  slug: string;
  displayName: string | null;
  profileImageUrl: string | null;
  recipeCount: number | null;
  latitude?: string | null;
  longitude?: string | null;
  locationCity?: string | null;
  locationState?: string | null;
  locationCountry?: string | null;
}

interface ChefLocationMapProps {
  chefs: ChefWithLocation[];
}

// Fix for default marker icons in Leaflet with webpack/Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to auto-fit map bounds to all markers
function AutoFitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [map, positions]);

  return null;
}

export function ChefLocationMap({ chefs }: ChefLocationMapProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter chefs with valid location data
  const chefsWithLocations = chefs.filter(
    (chef) =>
      chef.latitude &&
      chef.longitude &&
      !Number.isNaN(parseFloat(chef.latitude)) &&
      !Number.isNaN(parseFloat(chef.longitude))
  );

  // Extract positions for auto-fit
  const positions = chefsWithLocations.map((chef) => [
    parseFloat(chef.latitude!),
    parseFloat(chef.longitude!),
  ]) as [number, number][];

  // Default center (if no chefs with locations)
  const defaultCenter: [number, number] = [40.7128, -74.006]; // New York City

  if (!mounted) {
    return (
      <div className="w-full h-[600px] bg-jk-linen rounded-lg flex items-center justify-center">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto text-jk-olive/20 mb-4" />
          <p className="text-jk-olive/60">Loading map...</p>
        </div>
      </div>
    );
  }

  if (chefsWithLocations.length === 0) {
    return (
      <div className="w-full h-[600px] bg-jk-linen rounded-lg flex items-center justify-center border border-jk-olive/20">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto text-jk-olive/20 mb-4" />
          <h3 className="text-2xl font-heading text-jk-olive mb-2">No Location Data</h3>
          <p className="text-jk-olive/60">
            Location information is not available for any chefs yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] rounded-lg overflow-hidden border border-jk-olive/20 shadow-lg">
      <MapContainer
        center={positions[0] || defaultCenter}
        zoom={4}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ backgroundColor: '#f8f5f0' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-fit bounds to show all markers */}
        <AutoFitBounds positions={positions} />

        {/* Markers for each chef */}
        {chefsWithLocations.map((chef) => {
          const lat = parseFloat(chef.latitude!);
          const lng = parseFloat(chef.longitude!);

          return (
            <Marker key={chef.id} position={[lat, lng]}>
              <Popup className="chef-popup" maxWidth={300}>
                <div className="p-2">
                  <div className="flex items-start gap-3">
                    {/* Chef Avatar */}
                    {chef.profileImageUrl ? (
                      <img
                        src={chef.profileImageUrl}
                        alt={chef.displayName || chef.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-jk-olive/20"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-jk-olive/10 flex items-center justify-center border-2 border-jk-olive/20">
                        <MapPin className="w-8 h-8 text-jk-olive/40" />
                      </div>
                    )}

                    {/* Chef Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-heading text-lg text-jk-olive mb-1 truncate">
                        {chef.displayName || chef.name}
                      </h3>
                      <p className="text-sm text-jk-olive/60 mb-2">
                        {chef.locationCity}
                        {chef.locationState ? `, ${chef.locationState}` : ''}
                        <br />
                        {chef.locationCountry}
                      </p>
                      <p className="text-xs text-jk-olive/50 mb-3">
                        {chef.recipeCount || 0} recipes
                      </p>
                      <a
                        href={`/chef/${chef.slug}`}
                        className="inline-block px-3 py-1.5 bg-jk-olive text-jk-linen text-sm rounded hover:bg-jk-olive/90 transition-colors"
                      >
                        View Recipes
                      </a>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg border border-jk-olive/20 z-[1000]">
        <div className="flex items-center gap-2 text-sm text-jk-olive">
          <MapPin className="w-4 h-4 text-jk-olive" />
          <span>
            {chefsWithLocations.length} chef{chefsWithLocations.length !== 1 ? 's' : ''} on map
          </span>
        </div>
      </div>
    </div>
  );
}
