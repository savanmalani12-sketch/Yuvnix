import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
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
  Layers,
} from 'lucide-react';
import { calculateDistanceMeters } from '@/utils/geo';
import { env } from '@/utils/env';

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

export interface PlaceResultItem {
  placeId?: string;
  name: string;
  secondary?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
}

interface MapAddressPickerProps {
  value?: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
  error?: string;
  existingCommunities?: NearbyCommunityInfo[];
}

// Default center: Knowledge Corridor / Gandhinagar
const DEFAULT_CENTER: [number, number] = [23.1557, 72.6669];
export const COMMUNITY_PROXIMITY_RADIUS_METERS = 15;

// Popular student campus hubs for instant 1-tap navigation
const CAMPUS_SHORTCUTS = [
  { label: 'Hiramani / Nirma (SG Hwy)', coords: [23.1294, 72.5385] as [number, number] },
  { label: 'PDEU / Raysan', coords: [23.1557, 72.6669] as [number, number] },
  { label: 'Infocity / Gandhinagar', coords: [23.1952, 72.6289] as [number, number] },
  { label: 'Vaishnodevi Circle', coords: [23.134, 72.545] as [number, number] },
  { label: 'GIFT City', coords: [23.1593, 72.6842] as [number, number] },
];

type MapStyle = 'streets' | 'satellite';

/**
 * Dedicated Google Maps Tile Canvas rendered strictly when Dialog is mounted.
 * Uses Google Street & Satellite layers for authentic landmarks across India.
 */
interface GoogleMapCanvasProps {
  center: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
  existingCommunities: NearbyCommunityInfo[];
  mapStyle: MapStyle;
  onToggleStyle: () => void;
}

const GoogleMapCanvas: React.FC<GoogleMapCanvasProps> = ({
  center,
  onPositionChange,
  existingCommunities,
  mapStyle,
  onToggleStyle,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize map when DOM element mounts
  useEffect(() => {
    if (!containerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(containerRef.current, {
      center,
      zoom: 16,
      zoomControl: true,
      fadeAnimation: true,
    });

    // Google Maps Tile Layer: 'lyrs=m' is Standard Roadmap, 'lyrs=y' is Hybrid Satellite with labels
    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const tiles = L.tileLayer(tileUrl, {
      attribution: '&copy; Google Maps',
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 21,
    }).addTo(map);

    tileLayerRef.current = tiles;

    const marker = L.marker(center, { draggable: true }).addTo(map);

    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      onPositionChange(pos.lat, pos.lng);
    });

    map.on('click', (e) => {
      marker.setLatLng(e.latlng);
      onPositionChange(e.latlng.lat, e.latlng.lng);
    });

    // Render existing communities and 15m radius circles
    existingCommunities.forEach((comm) => {
      if (comm.latitude != null && comm.longitude != null) {
        L.circle([comm.latitude, comm.longitude], {
          radius: COMMUNITY_PROXIMITY_RADIUS_METERS,
          color: '#f59e0b',
          fillColor: '#f59e0b',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '4, 4',
        })
          .addTo(map)
          .bindPopup(`<strong>${comm.name}</strong><br/>15m Radius Zone`);

        L.circleMarker([comm.latitude, comm.longitude], {
          radius: 7,
          color: '#d97706',
          fillColor: '#f59e0b',
          fillOpacity: 1,
          weight: 2,
        })
          .addTo(map)
          .bindPopup(`<strong>${comm.name}</strong><br/>Existing Residence`);
      }
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Progressive resize calculation to accommodate Dialog open animations
    const t1 = setTimeout(() => map.invalidateSize(), 80);
    const t2 = setTimeout(() => map.invalidateSize(), 250);
    const t3 = setTimeout(() => map.invalidateSize(), 500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
    };
  }, []); // Run once on mount

  // Switch between Street and Satellite layers dynamically
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; Google Maps',
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 21,
    }).addTo(mapRef.current);
  }, [mapStyle]);

  // Smoothly pan when center changes from search or preset chips
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLatLng(center);
      mapRef.current.panTo(center, { animate: true });
    }
  }, [center]);

  return (
    <div className="relative w-full h-[380px] sm:h-[430px] bg-muted/30">
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', minHeight: '380px' }}
        className="w-full h-full"
      />

      {/* Top Left Instruction Badge */}
      <div className="absolute top-3 left-3 z-[500] bg-background/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 shadow-card text-[11px] font-medium text-foreground flex items-center gap-1.5 pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Tap or drag pin to your hostel/PG</span>
      </div>

      {/* Top Right Map Style Switcher (Street / Satellite) */}
      <button
        type="button"
        onClick={onToggleStyle}
        className="absolute top-3 right-3 z-[500] bg-background/95 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-border/80 shadow-card text-xs font-semibold text-foreground flex items-center gap-1.5 hover:bg-muted active:scale-95 transition-all"
      >
        <Layers className="w-3.5 h-3.5 text-primary" />
        <span>{mapStyle === 'streets' ? 'Satellite View' : 'Google Street View'}</span>
      </button>
    </div>
  );
};

export const MapAddressPicker: React.FC<MapAddressPickerProps> = ({
  value,
  onChange,
  error,
  existingCommunities = [],
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [mapStyle, setMapStyle] = useState<MapStyle>('streets');
  const [currentCoords, setCurrentCoords] = useState<[number, number]>(
    value ? [value.lat, value.lng] : DEFAULT_CENTER
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>(value?.address || '');
  const [resolvedCity, setResolvedCity] = useState<string>(value?.city || 'Gandhinagar');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PlaceResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Check 15m radius proximity to existing communities
  const nearbyCommunityInMap = useMemo(() => {
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
        if (dist <= COMMUNITY_PROXIMITY_RADIUS_METERS) {
          if (!closest || dist < closest.distance) {
            closest = { community: comm, distance: dist };
          }
        }
      }
    }
    return closest;
  }, [currentCoords, existingCommunities]);

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
  const handlePositionChange = useCallback(
    (lat: number, lng: number) => {
      setCurrentCoords([lat, lng]);
      reverseGeocode(lat, lng);
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

  // Robust Search with Google Places Autocomplete & Fallback
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const apiKey = env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBYXB4AsyTqTUchbfMeUFMNBOd0qJtv2f0';

      // 1. Google Places API (New) Autocomplete
      if (apiKey) {
        try {
          const googleResp = await fetch(
            'https://places.googleapis.com/v1/places:autocomplete',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
              },
              body: JSON.stringify({
                input: query,
                includedRegionCodes: ['in'],
              }),
            }
          );
          if (googleResp.ok) {
            const googleData = await googleResp.json();
            if (googleData.suggestions && googleData.suggestions.length > 0) {
              const items: PlaceResultItem[] = googleData.suggestions
                .map((s: { placePrediction?: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; text?: { text?: string } } }) => s.placePrediction)
                .filter(Boolean)
                .map((p: { placeId?: string; structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } }; text?: { text?: string } }) => ({
                  placeId: p.placeId,
                  name: p.structuredFormat?.mainText?.text || p.text?.text || '',
                  secondary: p.structuredFormat?.secondaryText?.text || '',
                  formattedAddress: p.text?.text || '',
                }));
              setSearchResults(items);
              setIsSearching(false);
              return;
            }
          }
        } catch (err) {
          console.warn('Google Places API search failed, falling back to OSM:', err);
        }
      }

      // 2. OpenStreetMap Search Fallback
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=in&limit=5`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        setSearchResults(
          data.map((item: { display_name: string; lat: string; lon: string }) => ({
            name: item.display_name.split(',')[0],
            secondary: item.display_name.split(',').slice(1).join(',').trim(),
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            formattedAddress: item.display_name,
          }))
        );
        setIsSearching(false);
        return;
      }

      setSearchResults([]);
      alert(`Could not locate "${query}". Try tapping one of the campus chips below!`);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = async (item: PlaceResultItem) => {
    setSearchResults([]);
    setSearchQuery(item.name);

    if (item.lat && item.lng) {
      handlePositionChange(item.lat, item.lng);
      if (item.formattedAddress) {
        setResolvedAddress(item.formattedAddress);
      }
      return;
    }

    if (item.placeId) {
      const apiKey = env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyBYXB4AsyTqTUchbfMeUFMNBOd0qJtv2f0';
      try {
        const detailsResp = await fetch(
          `https://places.googleapis.com/v1/places/${item.placeId}?fields=id,displayName,formattedAddress,location&key=${apiKey}`
        );
        if (detailsResp.ok) {
          const details = await detailsResp.json();
          const lat = details.location?.latitude;
          const lng = details.location?.longitude;
          const addr = details.formattedAddress || item.name;
          if (lat && lng) {
            handlePositionChange(lat, lng);
            setResolvedAddress(addr);
            return;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch Google Place details:', err);
      }
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
        handlePositionChange(latitude, longitude);
      },
      () => {
        setIsLocating(false);
        alert(
          'Could not access current location. Please allow location permissions or tap a campus chip.'
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Confirm selection
  const handleConfirm = () => {
    onChange({
      address:
        resolvedAddress.trim() ||
        `Pinned Location (${currentCoords[0].toFixed(5)}, ${currentCoords[1].toFixed(5)})`,
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
                    <CheckCircle2 className="w-3 h-3" /> Selected on Google Maps
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
              <span>Select Residence on Google Maps</span>
              <Sparkles className="w-3.5 h-3.5 text-primary" />
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Tap to open the map with street and satellite views. Drop your pin at your exact hostel or PG building.
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
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden gap-0 max-h-[94vh] flex flex-col">
          <DialogHeader className="p-4 pb-3 border-b border-border/60">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Pinpoint Residence on Google Maps
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Drag the pin onto your hostel or society gate. Switch to Satellite view to see building roofs.
                </DialogDescription>
              </div>
            </div>

            {/* Search & GPS Tool Bar */}
            <div className="pt-2 flex items-center gap-2">
              <form onSubmit={handleSearch} className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search landmark, road, or area..."
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

            {/* 1-Tap Campus Shortcuts */}
            <div className="pt-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider shrink-0 mr-1">
                Quick Jump:
              </span>
              {CAMPUS_SHORTCUTS.map((shortcut, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handlePositionChange(shortcut.coords[0], shortcut.coords[1])}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-muted hover:bg-primary/10 hover:text-primary border border-border/80 transition-all active:scale-95"
                >
                  📍 {shortcut.label}
                </button>
              ))}
            </div>

            {/* Search Suggestions Dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-2 p-1.5 rounded-xl bg-card border border-border shadow-elevated space-y-1">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectSearchResult(res)}
                    className="w-full text-left p-2.5 rounded-xl hover:bg-muted text-xs text-foreground flex items-start gap-2.5 transition-colors border border-transparent hover:border-border"
                  >
                    <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-foreground block truncate">
                        {res.name}
                      </span>
                      {res.secondary && (
                        <span className="text-[11px] text-muted-foreground block truncate">
                          {res.secondary}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </DialogHeader>

          {/* Leaflet Map Canvas Component mounted only when Dialog is open */}
          {isOpen && (
            <GoogleMapCanvas
              center={currentCoords}
              onPositionChange={handlePositionChange}
              existingCommunities={existingCommunities}
              mapStyle={mapStyle}
              onToggleStyle={() =>
                setMapStyle((prev) => (prev === 'streets' ? 'satellite' : 'streets'))
              }
            />
          )}

          {/* Location Summary & Confirm Footer with Editable Address Input */}
          <div className="p-4 border-t border-border/60 bg-card space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                  Physical Address (Auto-detected or fine-tune manually)
                </span>
                {isGeocoding && (
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" /> Detecting address...
                  </span>
                )}
              </div>
              <Input
                type="text"
                value={resolvedAddress}
                onChange={(e) => setResolvedAddress(e.target.value)}
                placeholder="Address will populate when you tap the map, or type here"
                className="text-xs h-9 font-medium"
              />
            </div>

            {/* Proximity notice if within 15m */}
            {nearbyCommunityInMap && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-bold block">
                    Existing Community Within 15m: &ldquo;{nearbyCommunityInMap.community.name}&rdquo; ({nearbyCommunityInMap.distance}m away)
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
                disabled={!resolvedAddress.trim()}
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
