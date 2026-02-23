import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw'
);

export interface LiveLocation {
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

interface UseLiveTrackingOptions {
  userId: string;
  role: 'driver' | 'passenger';
  vehicleLabel?: string;
  updateInterval?: number;
}

export const useLiveTracking = ({
  userId,
  role,
  vehicleLabel,
  updateInterval = 1000,
}: UseLiveTrackingOptions) => {
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    heading: number;
    speed: number;
  } | null>(null);
  
  const [allLocations, setAllLocations] = useState<LiveLocation[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const channelRef = useRef<any>(null);

  // Calculate heading from two points
  const calculateHeading = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    let heading = Math.atan2(y, x) * 180 / Math.PI;
    return (heading + 360) % 360;
  }, []);

  // Calculate speed from two points and time
  const calculateSpeed = useCallback((
    lat1: number, lng1: number, lat2: number, lng2: number, timeDiff: number
  ): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in meters
    
    return timeDiff > 0 ? (distance / timeDiff) * 3.6 : 0; // Convert to km/h
  }, []);

  // Update location to Supabase
  const updateLocation = useCallback(async (position: GeolocationPosition) => {
    try {
      const { latitude, longitude } = position.coords;
      let heading = 0;
      let speed = 0;

      if (lastPositionRef.current) {
        const timeDiff = (position.timestamp - lastPositionRef.current.timestamp) / 1000; // seconds
        heading = calculateHeading(
          lastPositionRef.current.coords.latitude,
          lastPositionRef.current.coords.longitude,
          latitude,
          longitude
        );
        speed = calculateSpeed(
          lastPositionRef.current.coords.latitude,
          lastPositionRef.current.coords.longitude,
          latitude,
          longitude,
          timeDiff
        );
      }

      setCurrentLocation({ lat: latitude, lng: longitude, heading, speed });

      // Update Supabase
      await supabase
        .from('live_locations')
        .upsert({
          user_id: userId,
          role,
          lat: latitude,
          lng: longitude,
          heading,
          speed,
          vehicle_label: vehicleLabel,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      lastPositionRef.current = position;
    } catch (err) {
      console.error('Error updating location:', err);
      setError('Failed to update location');
    }
  }, [userId, role, vehicleLabel, calculateHeading, calculateSpeed]);

  // Start tracking
  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    // Watch position
    watchIdRef.current = navigator.geolocation.watchPosition(
      updateLocation,
      (err) => {
        console.error('Geolocation error:', err);
        setError(err.message);
        setIsTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    // Set up periodic updates as backup
    updateIntervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        updateLocation(lastPositionRef.current);
      }
    }, updateInterval);
  }, [updateLocation, updateInterval]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    setIsTracking(false);
    
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    // Remove from Supabase
    supabase
      .from('live_locations')
      .delete()
      .eq('user_id', userId);
  }, [userId]);

  // Fetch all locations
  const fetchAllLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Filter out stale locations (older than 2 minutes)
      const now = new Date();
      const freshData = (data || []).filter(location => {
        const updateTime = new Date(location.updated_at);
        const timeDiff = (now.getTime() - updateTime.getTime()) / 1000; // seconds
        return timeDiff < 120; // Only show locations updated in last 2 minutes
      });
      
      setAllLocations(freshData);
    } catch (err) {
      console.error('Error fetching locations:', err);
    }
  }, []);

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('live_locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
        },
        (payload) => {
          fetchAllLocations();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [fetchAllLocations]);

  // Initial fetch
  useEffect(() => {
    fetchAllLocations();
  }, [fetchAllLocations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return {
    currentLocation,
    allLocations,
    isTracking,
    error,
    startTracking,
    stopTracking,
    fetchAllLocations,
  };
};
