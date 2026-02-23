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
    google?: any;
  }
}

export const LiveTrackingPage: React.FC = () => {
  const search = useMemo(() => new URLSearchParams(window.location.search), []);

  const role = (search.get("role") as LiveRole) || "passenger";
  const tripId = search.get("trip") || "demo-trip-1";
  const userId = search.get("user") || (role === "driver" ? "driver-demo" : "passenger-demo");
  const vehicleType = (search.get("vehicle") as VehicleType) || "Pragia";

  const [selfPosition, setSelfPosition] = useState<GeolocationPosition | null>(null);
  const [otherLocation, setOtherLocation] = useState<LiveLocationRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any | null>(null);
  const selfMarkerRef = useRef<any | null>(null);
  const otherMarkerRef = useRef<any | null>(null);
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
        await sendLocationToSupabase(pos);
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
    if (!tripId) return;

    const channel = supabase
      .channel(`live-tracking:${tripId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "unihub_live_locations",
          filter: `trip_id=eq.${tripId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as LiveLocationRow | null;
          if (!row) return;
          if (row.role === role) return;
          setOtherLocation(row);
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
  }, [role, tripId]);

  useEffect(() => {
    const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

    if (!apiKey) {
      setMapError(
        "Google Maps API key is not configured. Set VITE_GOOGLE_MAPS_API_KEY in your Vercel env for the live map.",
      );
      return;
    }

    if (window.google && window.google.maps && mapContainerRef.current && !mapRef.current) {
      initMap();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[data-source="google-maps-api"]',
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => {
        if (mapContainerRef.current && !mapRef.current) {
          initMap();
        }
      });
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.dataset.source = "google-maps-api";
    script.onload = () => {
      if (mapContainerRef.current && !mapRef.current) {
        initMap();
      }
    };
    script.onerror = () => {
      setMapError("Failed to load Google Maps JavaScript API.");
    };
    document.head.appendChild(script);
    // We intentionally do not remove the script on unmount to avoid races across navigations.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !selfPosition) return;

    const center = {
      lat: selfPosition.coords.latitude,
      lng: selfPosition.coords.longitude,
    };

    if (!selfMarkerRef.current) {
      selfMarkerRef.current = new window.google.maps.Marker({
        position: center,
        map: mapRef.current,
        title: role === "driver" ? "Driver" : "Passenger",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 6,
          fillColor: role === "driver" ? "#2563eb" : "#10b981",
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: "#ffffff",
        },
      });
      mapRef.current.setCenter(center);
    } else {
      selfMarkerRef.current.setPosition(center);
    }
  }, [role, selfPosition]);

  useEffect(() => {
    if (!mapRef.current || !otherLocation) return;

    const pos = {
      lat: otherLocation.latitude,
      lng: otherLocation.longitude,
    };

    if (!otherMarkerRef.current) {
      otherMarkerRef.current = new window.google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: role === "driver" ? "Passenger" : "Driver",
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 5,
          fillColor: role === "driver" ? "#10b981" : "#f97316",
          fillOpacity: 1,
          strokeWeight: 1,
          strokeColor: "#ffffff",
        },
      });
    } else {
      otherMarkerRef.current.setPosition(pos);
    }
  }, [role, otherLocation]);

  const initMap = () => {
    if (!mapContainerRef.current || !window.google?.maps) return;

    const defaultCenter = {
      lat: selfPosition?.coords.latitude ?? 5.6037,
      lng: selfPosition?.coords.longitude ?? -0.187,
    };

    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 16,
      disableDefaultUI: true,
    });
  };

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
              Live Ride Radar
            </h1>
            <p className="text-xs text-slate-400">
              {role === "driver" ? "Driver console" : "Passenger console"} · Trip{" "}
              <span className="font-mono text-emerald-300">{tripId}</span>
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

