import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";

type LiveRole = "driver" | "passenger";

type VehicleType = "Pragia" | "Taxi" | "Shuttle";

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

declare global {
  interface Window {
    L?: any;
  }
}

export const LiveTrackingPage: React.FC = () => {
  const search = useMemo(() => new URLSearchParams(window.location.search), []);

  const role = (search.get("role") as LiveRole) || "passenger";
  const tripId = search.get("trip") || "demo-trip-1";
  const userId = search.get("user") || (role === "driver" ? "driver-demo" : "passenger-demo");
  const vehicleType = (search.get("vehicle") as VehicleType) || "Pragia";
  const browseMode = search.get("browse");
  const isShuttleRadar = browseMode === "shuttles";

  const [selfPosition, setSelfPosition] = useState<GeolocationPosition | null>(null);
  const [otherLocation, setOtherLocation] = useState<LiveLocationRow | null>(null);
  const [shuttleLocations, setShuttleLocations] = useState<
    Record<string, LiveLocationRow>
  >({});
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const selfMarkerRef = useRef<any | null>(null);
  const otherMarkerRef = useRef<any | null>(null);
  const shuttleMarkersRef = useRef<Record<string, any>>({});
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation is not supported on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setSelfPosition(pos);
      },
      (err) => {
        console.error("Initial geolocation error", err);
        setError("Unable to access location. Please enable GPS permissions.");
      },
      { enableHighAccuracy: true },
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        setSelfPosition(pos);
        // In shuttle radar (browse) mode, we don't push passenger positions
        // into the live locations table; it's a read-only radar.
        if (!isShuttleRadar || role === "driver") {
          await sendLocationToSupabase(pos);
        }
      },
      (err) => {
        console.error("Geolocation watch error", err);
        setError("Live location stream interrupted.");
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const channelName = isShuttleRadar
      ? "live-tracking:shuttles"
      : `live-tracking:${tripId}`;

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
          if (isShuttleRadar) {
            if (row.role !== "driver" || row.vehicle_type !== "Shuttle") return;
            setShuttleLocations((prev) => ({
              ...prev,
              [row.user_id || row.id]: row,
            }));
          } else {
            if (row.trip_id !== tripId) return;
            if (row.role === role) return;
            setOtherLocation(row);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // optional: console.log("Subscribed to live tracking channel");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [role, tripId, isShuttleRadar]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!window.L) {
      setMapError("Map engine failed to load. Please check your network.");
      return;
    }

    const defaultCenter = {
      lat: selfPosition?.coords.latitude ?? 5.6037,
      lng: selfPosition?.coords.longitude ?? -0.187,
    };

    const map = window.L.map(mapContainerRef.current, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom: 15,
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
      otherMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfPosition?.coords.latitude, selfPosition?.coords.longitude]);

  useEffect(() => {
    if (!mapRef.current || !selfPosition) return;

    const center = [selfPosition.coords.latitude, selfPosition.coords.longitude];

    if (!selfMarkerRef.current) {
      const color = role === "driver" ? "#2563eb" : "#10b981";
      const icon = window.L.divIcon({
        className: "",
        html: `<div style="width:14px;height:14px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 8px ${color};"></div>`,
        iconSize: [14, 14],
      });
      selfMarkerRef.current = window.L.marker(center, { icon }).addTo(mapRef.current);
      mapRef.current.setView(center, 16);
    } else {
      selfMarkerRef.current.setLatLng(center);
    }
  }, [role, selfPosition]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (isShuttleRadar) {
      const all = Object.values(shuttleLocations);
      all.forEach((row) => {
        const key = row.user_id || row.id;
        const pos: [number, number] = [row.latitude, row.longitude];
        let marker = shuttleMarkersRef.current[key];
        if (!marker) {
          const icon = window.L.divIcon({
            className: "",
            html: `<div style="width:12px;height:12px;border-radius:999px;background:#f97316;border:2px solid #fff;box-shadow:0 0 6px #f97316;"></div>`,
            iconSize: [12, 12],
          });
          marker = window.L.marker(pos, { icon }).addTo(mapRef.current);
          shuttleMarkersRef.current[key] = marker;
        } else {
          marker.setLatLng(pos);
        }
      });
      return;
    }

    if (!otherLocation) return;

    const pos: [number, number] = [otherLocation.latitude, otherLocation.longitude];

    if (!otherMarkerRef.current) {
      const color = role === "driver" ? "#10b981" : "#f97316";
      const icon = window.L.divIcon({
        className: "",
        html: `<div style="width:12px;height:12px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 0 6px ${color};"></div>`,
        iconSize: [12, 12],
      });
      otherMarkerRef.current = window.L.marker(pos, { icon }).addTo(mapRef.current);
    } else {
      otherMarkerRef.current.setLatLng(pos);
    }
  }, [role, otherLocation, isShuttleRadar, shuttleLocations]);

  const sendLocationToSupabase = async (pos: GeolocationPosition) => {
    try {
      const { latitude, longitude, heading, speed } = pos.coords;
      const payload = {
        trip_id: tripId,
        role,
        user_id: userId,
        vehicle_type: vehicleType,
        latitude,
        longitude,
        heading: heading ?? null,
        speed: speed ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from("unihub_live_locations")
        .upsert(payload, { onConflict: "trip_id,role,user_id" });

      if (upsertError) {
        console.error("Supabase upsert error:", upsertError);
      }
    } catch (e) {
      console.error("Failed to send location to Supabase", e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="p-4 border-b border-white/10 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-400/30">
            <i className="fas fa-location-crosshairs text-emerald-400"></i>
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-[0.25em] text-emerald-400">
              {isShuttleRadar ? "Shuttle Radar" : "Live Ride Radar"}
            </h1>
            <p className="text-xs text-slate-400">
              {isShuttleRadar
                ? "View active shuttles on the grid before you request."
                : `${role === "driver" ? "Driver console" : "Passenger console"} · Trip `}
              {!isShuttleRadar && (
                <span className="font-mono text-emerald-300">{tripId}</span>
              )}
            </p>
          </div>
        </div>
        <a
          href="/"
          className="px-3 py-2 rounded-xl bg-white/5 text-[10px] font-black uppercase tracking-widest border border-white/10 hover:bg-white/10"
        >
          Back to Hub
        </a>
      </header>

      <main className="flex-1 grid md:grid-cols-[2fr,1fr]">
        <div className="relative">
          <div ref={mapContainerRef} className="w-full h-[60vh] md:h-full" />
          {mapError && (
            <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-rose-950/90 text-rose-200 p-4 text-xs border border-rose-500/40">
              <p className="font-black uppercase tracking-widest mb-1">Map Disabled</p>
              <p>{mapError}</p>
            </div>
          )}
        </div>
        <aside className="p-4 md:p-6 space-y-4 border-t md:border-t-0 md:border-l border-white/10 bg-slate-950/60 backdrop-blur">
          <div className="glass-bright rounded-3xl p-4 border border-white/10 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">
              Session Context
            </p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="text-slate-500 text-[11px] font-semibold">Role</p>
                <p className="font-mono text-emerald-300">{role}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 text-[11px] font-semibold">User ID</p>
                <p className="font-mono break-all">{userId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 text-[11px] font-semibold">Vehicle</p>
                <p className="font-mono">{vehicleType}</p>
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 text-[11px] font-semibold">Trip ID</p>
                <p className="font-mono break-all">{tripId}</p>
              </div>
            </div>
          </div>

          <div className="glass-bright rounded-3xl p-4 border border-white/10 space-y-3 text-xs">
            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">
              Live Telemetry
            </p>
            {error && (
              <div className="rounded-2xl bg-rose-950/70 border border-rose-500/40 p-3 text-rose-100">
                <p className="font-semibold text-[11px] mb-1">Location Issue</p>
                <p>{error}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-slate-500 text-[11px] font-semibold">You (lat,lng)</p>
                {selfPosition ? (
                  <p className="font-mono text-[11px]">
                    {selfPosition.coords.latitude.toFixed(5)},{" "}
                    {selfPosition.coords.longitude.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-slate-600 text-[11px]">Waiting for GPS lock…</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 text-[11px] font-semibold">
                  Other party (lat,lng)
                </p>
                {otherLocation ? (
                  <p className="font-mono text-[11px]">
                    {otherLocation.latitude.toFixed(5)},{" "}
                    {otherLocation.longitude.toFixed(5)}
                  </p>
                ) : (
                  <p className="text-slate-600 text-[11px]">No remote ping yet…</p>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-slate-500 text-[11px] font-semibold">Last update</p>
                <p className="text-[11px]">
                  {otherLocation
                    ? new Date(otherLocation.updated_at).toLocaleTimeString()
                    : "—"}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Open this same link on another device with{" "}
              <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded-xl">
                role=
                {role === "driver" ? "passenger" : "driver"}
              </span>{" "}
              and a different{" "}
              <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded-xl">user</span>{" "}
              query param to see bi-directional real-time tracking powered by Supabase
              Realtime.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
};

