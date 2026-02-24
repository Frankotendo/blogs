import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://kzjgihwxiaeqzopeuzhm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw";

interface LiveLocation {
  id: string;
  user_id: string;
  role: 'driver' | 'passenger';
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  vehicle_label?: string;
  updated_at: string;
}

interface PositionData {
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: number;
}

export const useLiveTracking = (
  userId: string,
  userRole: 'driver' | 'passenger',
  vehicleLabel?: string
) => {
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [userLocation, setUserLocation] = useState<LiveLocation | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabaseRef = useRef(createClient(SUPABASE_URL, SUPABASE_ANON_KEY));
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<PositionData | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Calculate heading from two positions
  const calculateHeading = useCallback((from: [number, number], to: [number, number]): number => {
    const [lat1, lng1] = from;
    const [lat2, lng2] = to;
    
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    return (heading + 360) % 360;
  }, []);

  // Calculate speed from two positions
  const calculateSpeed = useCallback((
    from: PositionData,
    to: [number, number],
    timestamp: number
  ): number => {
    const R = 6371; // Earth's radius in km
    const [lat1, lng1] = [from.lat, from.lng];
    const [lat2, lng2] = to;
    
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    const timeDiff = (timestamp - from.timestamp) / 1000; // Convert to seconds
    return timeDiff > 0 ? (distance / timeDiff) * 3600 : 0; // km/h
  }, []);

  // Update user location in database
  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    try {
      const { latitude, longitude } = position.coords;
      const timestamp = Date.now();
      
      let heading = 0;
      let speed = 0;
      
      if (lastPositionRef.current) {
        heading = calculateHeading(
          [lastPositionRef.current.lat, lastPositionRef.current.lng],
          [latitude, longitude]
        );
        speed = calculateSpeed(lastPositionRef.current, [latitude, longitude], timestamp);
      } else {
        // Use device heading if available
        heading = position.coords.heading || 0;
        speed = position.coords.speed || 0;
      }
      
      const locationData = {
        user_id: userId,
        role: userRole,
        lat: latitude,
        lng: longitude,
        heading,
        speed: speed * 3.6, // Convert m/s to km/h if needed
        vehicle_label: userRole === 'driver' ? vehicleLabel : null,
      };

      const { data, error } = await supabaseRef.current
        .from('live_locations')
        .upsert(locationData, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) throw error;

      lastPositionRef.current = {
        lat: latitude,
        lng: longitude,
        heading,
        speed: speed * 3.6,
        timestamp
      };

      setUserLocation(data);
    } catch (err) {
      console.error('Error updating location:', err);
      setError(err instanceof Error ? err.message : 'Failed to update location');
    }
  }, [userId, userRole, vehicleLabel, calculateHeading, calculateSpeed]);

  // Fetch initial live locations
  const fetchLiveLocations = useCallback(async () => {
    try {
      const { data, error } = await supabaseRef.current
        .from('live_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setLiveLocations(data || []);
    } catch (err) {
      console.error('Error fetching live locations:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch locations');
    }
  }, []);

  // Setup real-time subscription
  const setupRealtimeSubscription = useCallback(() => {
    const channel = supabaseRef.current
      .channel('live_locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations'
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setLiveLocations(prev => {
              const filtered = prev.filter(loc => loc.user_id !== payload.new.user_id);
              return [...filtered, payload.new as LiveLocation];
            });
          } else if (payload.eventType === 'DELETE') {
            setLiveLocations(prev => 
              prev.filter(loc => loc.user_id !== payload.old.user_id)
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, []);

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Initial fetch
    fetchLiveLocations();
    setupRealtimeSubscription();

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      (err) => {
        console.error('Geolocation error:', err);
        setError(err.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    // Throttled updates (every 1 second)
    updateIntervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        updateLocation({
          coords: {
            latitude: lastPositionRef.current.lat,
            longitude: lastPositionRef.current.lng,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: lastPositionRef.current.heading,
            speed: lastPositionRef.current.speed / 3.6 // Convert km/h to m/s
          },
          timestamp: lastPositionRef.current.timestamp
        } as GeolocationPosition);
      }
    }, 1000);
  }, [fetchLiveLocations, setupRealtimeSubscription, updateLocation]);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    setIsTracking(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    if (channelRef.current) {
      await supabaseRef.current.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Remove user's location from database
    try {
      await supabaseRef.current
        .from('live_locations')
        .delete()
        .eq('user_id', userId);
    } catch (err) {
      console.error('Error removing location:', err);
    }
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    liveLocations,
    userLocation,
    isTracking,
    error,
    startTracking,
    stopTracking
  };
};
