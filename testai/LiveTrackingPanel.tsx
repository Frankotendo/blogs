import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

type VehicleType = "Pragia" | "Taxi" | "Shuttle";
type LiveRole = "driver" | "passenger";

interface LiveLocationRow {
  id: string;
  trip_id: string;
  role: LiveRole;
  user_id: string;
  vehicle_type: VehicleType | null;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

type LiveTrackingMode = "passengerRadar" | "driverTrip" | "passengerTrip";

interface LiveTrackingPanelProps {
  mode: LiveTrackingMode;
  tripId?: string;
  vehicleFilter?: VehicleType | "All";
}

declare global {
  interface Window {
    L?: any;
  }
}

// NOTE: This panel is intentionally self-contained and UI-only.
// It never changes routing or app boot logic, so it cannot cause
// a black screen on its own. It is safe to mount from any portal.

export const LiveTrackingPanel: React.FC<LiveTrackingPanelProps> = ({
  mode,
  tripId,
  vehicleFilter = "All",
}) => {
  const isBrowser = typeof window !== "undefined";

  const [error, setError] = useState<string | null>(null);
  const [selfPosition, setSelfPosition] = useState<GeolocationPosition | null>(
    null,
  );
  const [driverLocations, setDriverLocations] = useState<
    Record<string, LiveLocationRow>
  >({});
  const [passengerLocation, setPassengerLocation] =
    useState<LiveLocationRow | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const selfMarkerRef = useRef<any | null>(null);
  const driverMarkersRef = useRef<Record<string, any>>({});
  const passengerMarkerRef = useRef<any | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const isTripMode =
    mode === "driverTrip" || mode === "passengerTrip"; /* per-trip */

  // --- Geolocation for current device (optional but useful for centering) ---
  useEffect(() => {
    if (!isBrowser) return;
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelfPosition(pos);
      },
      (err) => {
        console.warn("Initial geolocation error", err);
        setError("Unable to access location. Check GPS permissions.");
      },
      { enableHighAccuracy: true },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setSelfPosition(pos);
      },
      (err) => {
        console.warn("Geolocation watch error", err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isBrowser]);

  // --- Supabase Realtime subscription ---
  useEffect(() => {
    if (!isBrowser) return;

    const channelName = isTripMode
      ? `live-trip:${tripId ?? "none"}`
      : "live-radar";

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "unihub_live_locations",
        },
        (payload) => {
          const row = (payload.new || payload.old) as LiveLocationRow | null;
          if (!row) return;

          if (isTripMode) {
            if (!tripId || row.trip_id !== tripId) return;
            if (row.role === "driver") {
              setDriverLocations((prev) => ({
                ...prev,
                [row.user_id || row.id]: row,
              }));
            } else if (row.role === "passenger") {
              setPassengerLocation(row);
            }
          } else {
            if (row.role !== "driver") return;
            if (
              vehicleFilter !== "All" &&
              row.vehicle_type !== vehicleFilter
            ) {
              return;
            }
            setDriverLocations((prev) => ({
              ...prev,
              [row.user_id || row.id]: row,
            }));
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isBrowser, isTripMode, tripId, vehicleFilter]);

  // --- Leaflet map initialization ---
  useEffect(() => {
    if (!isBrowser) return;
    if (!mapContainerRef.current) return;
    if (!window.L) {
      setError(
        "Map engine failed to load. Please check your network and reload.",
      );
      return;
    }
    if (mapRef.current) return;

    const centerLat = selfPosition?.coords.latitude ?? 5.6037;
    const centerLng = selfPosition?.coords.longitude ?? -0.187;

    const map = window.L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: false,
    });

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      selfMarkerRef.current = null;
      passengerMarkerRef.current = null;
      driverMarkersRef.current = {};
    };
  }, [isBrowser, selfPosition?.coords.latitude, selfPosition?.coords.longitude]);

  // --- Update self marker when position changes ---
  useEffect(() => {
    if (!mapRef.current || !selfPosition) return;

    const lat = selfPosition.coords.latitude;
    const lng = selfPosition.coords.longitude;
    const center: [number, number] = [lat, lng];

    if (!selfMarkerRef.current) {
      const icon = window.L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:999px;background:#0ea5e9;border:2px solid #fff;box-shadow:0 0 8px #0ea5e9;"></div>`,
        iconSize: [14, 14],
      });
      selfMarkerRef.current = window.L.marker(center, { icon }).addTo(
        mapRef.current,
      );
      mapRef.current.setView(center, 15);
    } else {
      selfMarkerRef.current.setLatLng(center);
    }
  }, [selfPosition]);

  // --- Update driver markers ---
  useEffect(() => {
    if (!mapRef.current) return;

    const allDrivers = Object.values(driverLocations);
    allDrivers.forEach((row) => {
      const key = row.user_id || row.id;
      const latlng: [number, number] = [row.latitude, row.longitude];

      const existing = driverMarkersRef.current[key];
      const color =
        row.vehicle_type === "Taxi"
          ? "#facc15"
          : row.vehicle_type === "Shuttle"
            ? "#f97316"
            : "#22c55e"; // Pragia / default

      if (!existing) {
        const icon = window.L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 6px ${color};"></div>`,
          iconSize: [12, 12],
        });
        const marker = window.L.marker(latlng, { icon }).addTo(mapRef.current);
        driverMarkersRef.current[key] = marker;
      } else {
        existing.setLatLng(latlng);
      }
    });
  }, [driverLocations]);

  // --- Update passenger marker in trip mode ---
  useEffect(() => {
    if (!mapRef.current) return;
    if (!isTripMode) return;
    if (!passengerLocation) return;

    const latlng: [number, number] = [
      passengerLocation.latitude,
      passengerLocation.longitude,
    ];

    if (!passengerMarkerRef.current) {
      const icon = window.L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:999px;background:#ec4899;border:2px solid #fff;box-shadow:0 0 8px #ec4899;"></div>`,
        iconSize: [14, 14],
      });
      passengerMarkerRef.current = window.L.marker(latlng, {
        icon,
      }).addTo(mapRef.current);
    } else {
      passengerMarkerRef.current.setLatLng(latlng);
    }
  }, [isTripMode, passengerLocation]);

  const title = useMemo(() => {
    if (mode === "passengerRadar") return "Live Fleet Radar";
    if (mode === "driverTrip") return "Trip Map · Driver View";
    return "Trip Map · Passenger View";
  }, [mode]);

  const subtitle = useMemo(() => {
    if (mode === "passengerRadar") {
      return "See active partners moving in real time before you request.";
    }
    if (mode === "driverTrip") {
      return "Follow your path to the passenger and destination.";
    }
    return "Watch your driver approach and share your live trip.";
  }, [mode]);

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-slate-900/60 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-400/30">
            <i className="fas fa-location-crosshairs text-emerald-400 text-xs" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-emerald-400">
              {title}
            </p>
            <p className="text-[11px] text-slate-400 line-clamp-1">
              {subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="relative w-full h-[260px] md:h-[320px]">
        <div ref={mapContainerRef} className="absolute inset-0" />
        {error && (
          <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-rose-950/90 text-rose-100 text-[11px] px-3 py-2 border border-rose-500/40">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

