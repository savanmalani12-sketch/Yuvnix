import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MapPin,
  Search,
  Navigation,
  Loader2,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import { calculateDistanceMeters } from '@/utils/geo';

// Fix Leaflet's default icon URLs for Vite bundling
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

export interface SelectedLocation {
  address: string;
  city: string;
  lat: number;
  lng: number;
}

export interface NearbyCommunityInfo {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

interface MapAddressPickerProps {
  value?: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
  error?: string;
  existingCommunities?: NearbyCommunityInfo[];
}

// Default center: Knowledge Corridor / Gandhinagar
const DEFAULT_CENTER: [number, number] = [23.1557, 72.6669];
const DEFAULT_ZOOM = 15;

export const MapAddressPicker: React.FC<MapAddressPickerProps> = ({
  value,
  onChange,
  error,
  existingCommunities = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<[number, number]>(
    value ? [value.lat, value.lng] : DEFAULT_CENTER
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(value?.address || '');
  const [resolvedCity, setResolvedCity] = useState<string>(value?.city || 'Gandhinagar');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const nearbyCommunityInMap = React.useMemo(() => {
    if (!existingCommunities || existingCommunities.length === 0) return null;
    let closest: { community: NearbyCommunityInfo; distance: number } | null = null;
    for (const comm of existingCommunities) {
      if (comm.latitude != null && comm.longitude != null) {
        const dist = calculateDistanceMeters(
          currentCoords[0],
          currentCoords[1],
          comm.latitude,
          comm.longitude
        );
        if (dist <= 100) {
          if (!closest || dist < closest.distance) {
            closest = { community: comm, distance: dist };
          }
        }
      }
    }
    return closest;
  }, [currentCoords, existingCommunities]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Reverse geocoding helper using OpenStreetMap Nominatim
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      );
      if (!response.ok) throw new Error('Geocoding service unavailable');
      const data = await response.json();

      const addr = data.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.county ||
        'Gandhinagar';

      const formatted =
        data.display_name ||
        `${addr.road || 'Residence'}, ${addr.suburb || addr.neighbourhood || ''}, ${city}`;

      setResolvedAddress(formatted);
      setResolvedCity(city);
    } catch {
      // Fallback clean representation
      setResolvedAddress(`Pinned Location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      setResolvedCity('Gandhinagar');
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  // Update pin and coordinates
  const updatePosition = useCallback(
    (lat: number, lng: number, fetchAddress = true) => {
      setCurrentCoords([lat, lng]);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo([lat, lng]);
      }
      if (fetchAddress) {
        reverseGeocode(lat, lng);
      }
    },
    [reverseGeocode]
  );

  // Handle opening the map
  const handleOpenModal = () => {
    setIsOpen(true);
    if (value) {
      setCurrentCoords([value.lat, value.lng]);
      setResolvedAddress(value.address);
      setResolvedCity(value.city);
    } else {
      setCurrentCoords(DEFAULT_CENTER);
      reverseGeocode(DEFAULT_CENTER[0], DEFAULT_CENTER[1]);
    }
  };

  // Initialize or re-render map inside modal
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: currentCoords,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker(currentCoords, {
        draggable: true,
      }).addTo(map);

      marker.on('dragend', (e) => {
        const markerPos = e.target.getLatLng();
        updatePosition(markerPos.lat, markerPos.lng, true);
      });

      map.on('click', (e) => {
        updatePosition(e.latlng.lat, e.latlng.lng, true);
      });

      // Render existing communities & their 100m zones
      existingCommunities.forEach((comm) => {
        if (comm.latitude != null && comm.longitude != null) {
          L.circle([comm.latitude, comm.longitude], {
            radius: 100,
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: '4, 4',
          })
            .addTo(map)
            .bindPopup(`<strong>${comm.name}</strong><br/>100m Radius Zone`);

          L.circleMarker([comm.latitude, comm.longitude], {
            radius: 6,
            color: '#f59e0b',
            fillColor: '#d97706',
            fillOpacity: 1,
            weight: 2,
          })
            .addTo(map)
            .bindPopup(`<strong>${comm.name}</strong><br/>Existing Residence`);
        }
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    // Leaflet needs size recalculation after dialog opens
    const timer = setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
      mapInstanceRef.current?.setView(currentCoords, mapInstanceRef.current.getZoom());
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [isOpen, currentCoords, updatePosition]);

  // Clean up map when modal closes
  useEffect(() => {
    if (!isOpen && mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [isOpen]);

  // Search places using Nominatim
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&countrycodes=in&limit=4`
      );
      const data = await response.json();
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: { lat: string; lon: string; display_name: string }) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setSearchResults([]);
    setSearchQuery('');
    updatePosition(lat, lng, true);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lng], 16);
    }
  };

  // GPS Locate me
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;
        updatePosition(latitude, longitude, true);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView([latitude, longitude], 17);
        }
      },
      () => {
        setIsLocating(false);
        alert('Could not access current location. Please allow location permissions or search your area.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Confirm selection
  const handleConfirm = () => {
    onChange({
      address: resolvedAddress || `Pinned Location (${currentCoords[0].toFixed(5)}, ${currentCoords[1].toFixed(5)})`,
      city: resolvedCity || 'Gandhinagar',
      lat: currentCoords[0],
      lng: currentCoords[1],
    });
    setIsOpen(false);
  };

  return (
    <div className="space-y-2">
      {/* Selection Card */}
      {value ? (
        <div className="p-4 rounded-2xl border-2 border-primary/30 bg-primary/5 space-y-3 transition-all">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Verified Map Pin</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Selected on Map
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground leading-snug">
                  {value.address}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-2 font-mono">
                  <span>City: {value.city}</span>
                  <span>•</span>
                  <span>
                    {value.lat.toFixed(4)}°, {value.lng.toFixed(4)}°
                  </span>
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenModal}
              className="font-semibold text-xs shrink-0 gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Change Pin
            </Button>
          </div>
        </div>
      ) : (
        <div
          onClick={handleOpenModal}
          className={`group cursor-pointer p-6 rounded-2xl border-2 border-dashed transition-all text-center space-y-3 bg-muted/20 hover:bg-muted/40 ${
            error
              ? 'border-destructive/60 bg-destructive/5'
              : 'border-border/80 hover:border-primary/60'
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-sm">
            <MapPin className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground flex items-center justify-center gap-1.5">
              <span>Select Residence on Map</span>
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Tap to open the interactive map. Pinpoint your hostel, PG, or society to automatically capture the exact verified location.
            </p>
          </div>
          <div>
            <Button
              type="button"
              size="sm"
              className="font-semibold gap-1.5 shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenModal();
              }}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Open Map & Pick Location</span>
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive font-medium flex items-center gap-1.5 pt-0.5">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{error}</span>
        </p>
      )}

      {/* Map Picker Modal Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 max-h-[92vh] flex flex-col">
          <DialogHeader className="p-4 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Pinpoint Residence Location
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Drag the pin or tap anywhere on the map to set your community&apos;s physical address.
                </DialogDescription>
              </div>
            </div>

            {/* Search & GPS Tool Bar */}
            <div className="pt-2 flex items-center gap-2">
              <form onSubmit={handleSearch} className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search hostel, college, road, or area..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs h-9"
                />
              </form>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSearch}
                disabled={isSearching || !searchQuery.trim()}
                className="h-9 text-xs font-semibold px-3"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleLocateMe}
                disabled={isLocating}
                title="Use current GPS location"
                className="h-9 text-xs font-semibold gap-1 px-3"
              >
                {isLocating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Navigation className="w-3.5 h-3.5 text-primary" />
                    <span className="hidden sm:inline">My Location</span>
                  </>
                )}
              </Button>
            </div>

            {/* Search Suggestions Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 p-1.5 rounded-xl bg-card border border-border shadow-elevated space-y-1">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left p-2 rounded-lg hover:bg-muted text-xs text-foreground truncate flex items-center gap-2 transition-colors"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{res.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </DialogHeader>

          {/* Leaflet Map Canvas */}
          <div className="relative flex-1 min-h-[340px] sm:min-h-[400px] w-full bg-muted/40">
            <div ref={mapContainerRef} className="absolute inset-0 z-0 w-full h-full" />
            <div className="absolute top-3 left-3 z-[400] bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 shadow-card text-[11px] font-medium text-muted-foreground flex items-center gap-1.5 pointer-events-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Tap or drag marker to set address</span>
            </div>
          </div>

          {/* Location Summary & Confirm Footer */}
          <div className="p-4 border-t border-border/60 bg-card space-y-3">
            <div className="p-3 rounded-xl bg-muted/50 border border-border/50 text-xs flex items-start gap-2.5">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                  Detected Address
                </span>
                {isGeocoding ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-0.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Detecting exact address from map pin...</span>
                  </div>
                ) : (
                  <p className="font-semibold text-foreground truncate">
                    {resolvedAddress || 'Address will appear when you tap the map'}
                  </p>
                )}
              </div>
            </div>

            {nearbyCommunityInMap && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">
                    Existing Community Within 100m: &ldquo;{nearbyCommunityInMap.community.name}&rdquo; ({nearbyCommunityInMap.distance}m away)
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-normal">
                    A residence already exists at this location. We recommend joining it to immediately pool groceries and share taxi rides.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="flex-row items-center justify-end gap-2 sm:gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                disabled={isGeocoding || !resolvedAddress}
                className="font-semibold gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Confirm Location</span>
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
