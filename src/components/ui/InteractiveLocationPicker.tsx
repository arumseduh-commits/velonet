"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Search,
  MapPin,
  Navigation,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Crosshair,
} from "lucide-react";
import "leaflet/dist/leaflet.css";

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  type?: string;
}

interface InteractiveLocationPickerProps {
  latitude: string;
  longitude: string;
  radiusMeter: string;
  locationName: string;
  onLocationChange: (lat: string, lng: string, name?: string) => void;
  onRadiusChange: (radius: string) => void;
  onLocationNameChange?: (name: string) => void;
}

const QUICK_REGIONS = [
  { name: "Kota Probolinggo", lat: -7.7543, lng: 113.2159, zoom: 15 },
  { name: "Alun-Alun Probolinggo", lat: -7.7523, lng: 113.2173, zoom: 17 },
  { name: "Kraksaan (Kab. Probolinggo)", lat: -7.7583, lng: 113.4326, zoom: 15 },
  { name: "Kota Malang", lat: -7.9797, lng: 112.6304, zoom: 14 },
  { name: "Kota Surabaya", lat: -7.2575, lng: 112.7521, zoom: 14 },
];

const RADIUS_OPTIONS = [
  { label: "25m (Sangat Ketat)", value: "25" },
  { label: "50m (Standar Gedung)", value: "50" },
  { label: "100m (Area Luas)", value: "100" },
  { label: "200m (Kompleks Kampus)", value: "200" },
  { label: "500m (Toleransi Lebar)", value: "500" },
];

export default function InteractiveLocationPicker({
  latitude,
  longitude,
  radiusMeter,
  locationName,
  onLocationChange,
  onRadiusChange,
  onLocationNameChange,
}: InteractiveLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // GPS State
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsAccuracyWarning, setGpsAccuracyWarning] = useState<string | null>(null);

  // Initial Coordinates: Default to Probolinggo if empty
  const initialLat = latitude && !isNaN(parseFloat(latitude)) ? parseFloat(latitude) : -7.7543;
  const initialLng = longitude && !isNaN(parseFloat(longitude)) ? parseFloat(longitude) : 113.2159;
  const currentRadius = parseFloat(radiusMeter) || 50;

  // 1. Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    const initMap = async () => {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      const L = await import("leaflet");
      LRef.current = L;

      if (!isMounted || mapInstanceRef.current) return;

      // Create Custom SVG Marker Icon
      const customIcon = L.divIcon({
        className: "custom-map-pin",
        html: `
          <div style="position: relative; width: 36px; height: 42px; transform: translate(-50%, -100%);">
            <div style="
              width: 36px;
              height: 36px;
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              border: 2.5px solid #ffffff;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 6px 16px rgba(0,0,0,0.45);
            ">
              <div style="width: 10px; height: 10px; background: white; border-radius: 50%; transform: rotate(45deg);"></div>
            </div>
            <div style="
              width: 16px;
              height: 5px;
              background: rgba(0, 0, 0, 0.35);
              border-radius: 50%;
              position: absolute;
              bottom: -2px;
              left: 10px;
              filter: blur(1.5px);
            "></div>
          </div>
        `,
        iconSize: [36, 42],
        iconAnchor: [18, 42],
        popupAnchor: [0, -42],
      });

      // Initialize map instance
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 16,
        zoomControl: true,
      });

      // Add OpenStreetMap Tile Layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Add Marker
      const marker = L.marker([initialLat, initialLng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);

      // Add Radius Circle
      const circle = L.circle([initialLat, initialLng], {
        radius: currentRadius,
        color: "#10b981",
        fillColor: "#10b981",
        fillOpacity: 0.18,
        weight: 2,
        dashArray: "4, 6",
      }).addTo(map);

      mapInstanceRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;

      // Marker Drag Event
      marker.on("dragend", (e: any) => {
        const { lat, lng } = e.target.getLatLng();
        circle.setLatLng([lat, lng]);
        onLocationChange(lat.toFixed(6), lng.toFixed(6));
      });

      // Map Click Event: Click anywhere to move pin
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        onLocationChange(lat.toFixed(6), lng.toFixed(6));
      });

      // Invalidate size after mount
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Sync Map when external lat/lng changes
  useEffect(() => {
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (!isNaN(latNum) && !isNaN(lngNum) && mapInstanceRef.current && markerRef.current && circleRef.current) {
      const currentMarkerPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentMarkerPos.lat - latNum) > 0.00001 ||
        Math.abs(currentMarkerPos.lng - lngNum) > 0.00001
      ) {
        markerRef.current.setLatLng([latNum, lngNum]);
        circleRef.current.setLatLng([latNum, lngNum]);
        mapInstanceRef.current.panTo([latNum, lngNum]);
      }
    }
  }, [latitude, longitude]);

  // 3. Sync Radius Circle when radiusMeter changes
  useEffect(() => {
    const radNum = parseFloat(radiusMeter);
    if (!isNaN(radNum) && circleRef.current) {
      circleRef.current.setRadius(radNum);
    }
  }, [radiusMeter]);

  // 4. Geocoding Search (Nominatim OpenStreetMap)
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      setShowSearchResults(true);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        searchQuery.trim()
      )}&countrycodes=id&limit=6`;

      const res = await fetch(url, {
        headers: {
          "Accept-Language": "id-ID,id,en",
        },
      });
      const data: SearchResult[] = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error("Nominatim search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (isNaN(lat) || isNaN(lng)) return;

    const shortName = result.display_name.split(",")[0] || result.name || "Titik Lokasi";

    onLocationChange(lat.toFixed(6), lng.toFixed(6), shortName);
    if (onLocationNameChange && (!locationName || locationName === "Lainnya")) {
      onLocationNameChange(shortName);
    }

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      circleRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
    }

    setShowSearchResults(false);
    setSearchQuery(shortName);
    setGpsAccuracyWarning(null);
  };

  // 5. Quick Region Preset Selection
  const handleSelectQuickRegion = (region: (typeof QUICK_REGIONS)[0]) => {
    onLocationChange(region.lat.toFixed(6), region.lng.toFixed(6), region.name);
    if (onLocationNameChange && (!locationName || locationName === "Lainnya")) {
      onLocationNameChange(region.name);
    }

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      markerRef.current.setLatLng([region.lat, region.lng]);
      circleRef.current.setLatLng([region.lat, region.lng]);
      mapInstanceRef.current.flyTo([region.lat, region.lng], region.zoom, { duration: 1.2 });
    }
    setGpsAccuracyWarning(null);
  };

  // 6. Browser Geolocation with IP / Desktop Detection
  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser Anda tidak mendukung Geolocation.");
      return;
    }

    setIsLocatingGps(true);
    setGpsAccuracyWarning(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);

        onLocationChange(lat.toFixed(6), lng.toFixed(6));

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          markerRef.current.setLatLng([lat, lng]);
          circleRef.current.setLatLng([lat, lng]);
          mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 1.2 });
        }

        // Detect if accuracy is poor (typical of PC / Laptop Indihome ISP pointing to Surabaya)
        if (accuracy > 500) {
          setGpsAccuracyWarning(
            `Akurasi koordinat: ±${accuracy}m. Perangkat PC/Laptop sering kali mengarahkan ke IP Gateway ISP (seperti Surabaya). Jika lokasi Anda di Probolinggo, silakan gunakan fitur 'Cari Alamat' di atas atau klik langsung pada peta untuk memindahkan pin.`
          );
        } else {
          setGpsAccuracyWarning(null);
        }

        setIsLocatingGps(false);
      },
      (err) => {
        setIsLocatingGps(false);
        alert(`Gagal mengambil GPS: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );
  };

  // 7. Fine-Tuning Nudge Buttons
  const handleNudge = (dLat: number, dLng: number) => {
    const latNum = parseFloat(latitude) || initialLat;
    const lngNum = parseFloat(longitude) || initialLng;
    const newLat = (latNum + dLat).toFixed(6);
    const newLng = (lngNum + dLng).toFixed(6);

    onLocationChange(newLat, newLng);
  };

  return (
    <div className="space-y-3 text-slate-900">
      {/* 1. Search Bar & Instant Geocoder */}
      <div className="relative">
        <form onSubmit={handleSearch} className="relative flex items-center">
          <input
            type="text"
            placeholder="🔍 Cari tempat / alamat (misal: Probolinggo, SMK, Alun-alun)..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!showSearchResults) setShowSearchResults(true);
            }}
            className="w-full pl-9 pr-24 py-2 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors shadow-xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />

          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold transition-all disabled:opacity-40 flex items-center gap-1 cursor-pointer shadow-xs"
          >
            {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cari"}
          </button>
        </form>

        {/* Autocomplete Search Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
            {searchResults.map((item) => (
              <button
                type="button"
                key={item.place_id}
                onClick={() => handleSelectSearchResult(item)}
                className="w-full p-2.5 text-left hover:bg-slate-50 text-slate-800 hover:text-emerald-700 transition-colors flex items-start gap-2 text-xs cursor-pointer"
              >
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="truncate">
                  <p className="font-semibold text-slate-900 truncate">{item.display_name.split(",")[0]}</p>
                  <p className="text-[10px] text-slate-500 truncate">{item.display_name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 2. Quick Region Shortcut Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px]">
        <span className="text-slate-500 shrink-0 font-medium">Pilihan Cepat:</span>
        {QUICK_REGIONS.map((region) => (
          <button
            type="button"
            key={region.name}
            onClick={() => handleSelectQuickRegion(region)}
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 font-medium whitespace-nowrap transition-all cursor-pointer"
          >
            📍 {region.name}
          </button>
        ))}
      </div>

      {/* 3. Interactive Leaflet Map Box */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-md">
        <div ref={mapContainerRef} className="w-full h-56 z-10" />

        {/* Map Top Floating Controls: GPS */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-2">
          <button
            type="button"
            onClick={handleGetGpsLocation}
            disabled={isLocatingGps}
            className="px-2.5 py-1.5 rounded-xl bg-white/95 hover:bg-white border border-slate-200 text-blue-600 hover:text-blue-700 text-[11px] font-bold shadow-md backdrop-blur-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Ambil titik GPS dari perangkat saat ini"
          >
            {isLocatingGps ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                <span>Mencari GPS...</span>
              </>
            ) : (
              <>
                <Crosshair className="w-3.5 h-3.5" />
                <span>GPS Saya</span>
              </>
            )}
          </button>
        </div>

        {/* Map Bottom Helper Overlay */}
        <div className="absolute bottom-2 inset-x-2 z-20 pointer-events-none">
          <div className="bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-200 text-[10px] text-slate-700 flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Klik / Geser pin di peta untuk set titik</span>
            </span>
            <span className="font-mono text-slate-600 font-bold">
              {latitude && longitude ? `${latitude}, ${longitude}` : "Belum diset"}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Desktop/ISP Surabaya Warning Badge (If Triggered) */}
      {gpsAccuracyWarning && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold text-[11px]">Catatan Deteksi Lokasi Browser:</p>
            <p className="text-[11px] text-amber-800/90 leading-relaxed">{gpsAccuracyWarning}</p>
          </div>
        </div>
      )}

      {/* 5. Fine-Tuning Coordinates & Radius Bar */}
      <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            <span>Koordinat & Radius Toleransi Absen</span>
          </span>

          {/* Fine-Tuning Nudge Buttons */}
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-slate-500 mr-1">Geser:</span>
            <button
              type="button"
              onClick={() => handleNudge(0.0001, 0)}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs"
              title="Geser Utara (+Lat)"
            >
              ⬆ U
            </button>
            <button
              type="button"
              onClick={() => handleNudge(-0.0001, 0)}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs"
              title="Geser Selatan (-Lat)"
            >
              ⬇ S
            </button>
            <button
              type="button"
              onClick={() => handleNudge(0, -0.0001)}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs"
              title="Geser Barat (-Lng)"
            >
              ⬅ B
            </button>
            <button
              type="button"
              onClick={() => handleNudge(0, 0.0001)}
              className="px-1.5 py-0.5 rounded bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs"
              title="Geser Timur (+Lng)"
            >
              ➔ T
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
          <div>
            <label className="text-slate-600 block mb-0.5 font-medium">Latitude</label>
            <input
              type="number"
              step="any"
              placeholder="-7.7543"
              value={latitude}
              onChange={(e) => onLocationChange(e.target.value, longitude)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-[11px] focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="text-slate-600 block mb-0.5 font-medium">Longitude</label>
            <input
              type="number"
              step="any"
              placeholder="113.2159"
              value={longitude}
              onChange={(e) => onLocationChange(latitude, e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-[11px] focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="text-slate-600 block mb-0.5 font-medium">Radius Toleransi (Meter)</label>
            <select
              value={radiusMeter}
              onChange={(e) => onRadiusChange(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 text-slate-900 text-[11px] focus:outline-none focus:border-emerald-500 font-semibold"
            >
              {RADIUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
