import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwMzAuR_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw'
);

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

interface LiveMapProps {
  userId: string;
  role: 'driver' | 'passenger';
  vehicleLabel?: string;
  center?: [number, number];
  zoom?: number;
  onLocationUpdate?: (location: any) => void;
}

// Custom icons for different roles
const createCustomIcon = (role: 'driver' | 'passenger', label?: string) => {
  const color = role === 'driver' ? '#ef4444' : '#3b82f6'; // Red for drivers, Blue for passengers
  const emoji = role === 'driver' ? '🚌' : '👤';
  
  return L.divIcon({
    html: `
      <div style="
        background: ${color};
        color: white;
        padding: 8px;
        border-radius: 50%;
        border: 2px solid white;
        font-size: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        width: 40px;
        height: 40px;
        position: relative;
      ">
        ${emoji}
        ${label ? `<div style="
          position: absolute;
          bottom: -20px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.8);
          color: white;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          white-space: nowrap;
        ">${label}</div>` : ''}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  });
};

// Component to handle map centering
const MapController = ({ center, zoom, currentLocation }: { 
  center: [number, number]; 
  zoom: number; 
  currentLocation?: LiveLocation | null;
}) => {
  const map = useMap();
  
  useEffect(() => {
    if (currentLocation) {
      map.setView([currentLocation.lat, currentLocation.lng], zoom);
    } else {
      map.setView(center, zoom);
    }
  }, [currentLocation, center, zoom, map]);
  
  return null;
};

const LiveMap: React.FC<LiveMapProps> = ({ 
  userId, 
  role, 
  vehicleLabel, 
  center = [5.6037, -0.1870], // Default to Ghana
  zoom = 13,
  onLocationUpdate 
}) => {
  const [currentLocation, setCurrentLocation] = useState<LiveLocation | null>(null);
  const [allLocations, setAllLocations] = useState<LiveLocation[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<any>(null);

  // Filter locations based on role
  const relevantLocations = allLocations.filter(
    (loc) => loc.user_id !== userId && loc.role !== role
  );

  // Get user's current location
  useEffect(() => {
    const userLocation = allLocations.find(loc => loc.user_id === userId);
    if (userLocation) {
      setCurrentLocation(userLocation);
      onLocationUpdate?.(userLocation);
    }
  }, [allLocations, userId, onLocationUpdate]);

  // Fetch all locations
  const fetchAllLocations = async () => {
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
        const timeDiff = (now.getTime() - updateTime.getTime()) / 1000;
        return timeDiff < 120;
      });
      
      setAllLocations(freshData);
    } catch (err) {
      console.error('Error fetching locations:', err);
      setError('Failed to fetch locations');
    }
  };

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
        () => {
          fetchAllLocations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllLocations();
  }, []);

  // Update user's location
  const updateLocation = async (lat: number, lng: number) => {
    try {
      const { error } = await supabase
        .from('live_locations')
        .upsert({
          user_id: userId,
          role: role,
          lat: lat,
          lng: lng,
          heading: 0,
          speed: 0,
          vehicle_label: vehicleLabel,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setIsTracking(true);
      setError(null);
    } catch (err) {
      console.error('Error updating location:', err);
      setError('Failed to update location');
    }
  };

  // Get user's GPS location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        updateLocation(latitude, longitude);
      },
      (error) => {
        console.error('Error getting location:', error);
        setError('Failed to get your location');
      }
    );
  };

  // Start tracking user's location
  const startTracking = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading, speed } = position.coords;
        updateLocation(latitude, longitude);
      },
      (error) => {
        console.error('Error tracking location:', error);
        setError('Failed to track your location');
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  };

  // Start tracking when component mounts
  useEffect(() => {
    const cleanup = startTracking();
    return cleanup;
  }, [userId, role]);

  return (
    <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden">
      <div className="absolute top-4 left-4 z-[1000] bg-slate-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-white text-sm font-medium">
            {isTracking ? 'Tracking' : 'Not Tracking'}
          </span>
        </div>
        {currentLocation && (
          <div className="text-slate-300 text-xs mt-1">
            Speed: {currentLocation.speed.toFixed(1)} km/h
          </div>
        )}
        {error && (
          <div className="text-red-400 text-xs mt-1">
            {error}
          </div>
        )}
      </div>

      <div className="absolute top-4 right-4 z-[1000] bg-slate-800/90 backdrop-blur-sm p-3 rounded-lg shadow-lg">
        <div className="text-white text-sm">
          <div className="font-bold mb-1">
            {role === 'passenger' ? 'Passenger View' : 'Driver View'}
          </div>
          <div className="text-slate-300 text-xs">
            {role === 'passenger' ? 'Blue: You • Red: Available buses' : 'Red: You • Blue: Passengers'}
          </div>
        </div>
      </div>

      <MapContainer
        center={center}
        zoom={zoom}
        className="w-full h-full"
        ref={mapRef}
        zoomControl={true}
        scrollWheelZoom={true}
        doubleClickZoom={true}
        dragging={true}
        touchZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapController 
          center={center} 
          zoom={zoom} 
          currentLocation={currentLocation} 
        />
        
        {/* Current user location */}
        {currentLocation && (
          <Marker
            position={[currentLocation.lat, currentLocation.lng]}
            icon={createCustomIcon(role, vehicleLabel)}
          >
            <Popup>
              <div className="text-center">
                <div className="font-bold text-sm">
                  {role === 'passenger' ? 'Your Location' : 'Driver Location'}
                </div>
                <div className="text-xs text-slate-600">
                  Speed: {currentLocation.speed.toFixed(1)} km/h
                </div>
                <div className="text-xs text-slate-600">
                  Last updated: {new Date(currentLocation.updated_at).toLocaleTimeString()}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        
        {/* Other relevant locations */}
        {relevantLocations.map((location) => (
          <Marker
            key={location.id}
            position={[location.lat, location.lng]}
            icon={createCustomIcon(location.role, location.vehicle_label)}
          >
            <Popup>
              <div className="text-center">
                <div className="font-bold text-sm capitalize">
                  {location.role}
                </div>
                {location.vehicle_label && (
                  <div className="text-xs text-slate-600">
                    {location.vehicle_label}
                  </div>
                )}
                <div className="text-xs text-slate-600">
                  Speed: {location.speed.toFixed(1)} km/h
                </div>
                <div className="text-xs text-slate-600">
                  Last updated: {new Date(location.updated_at).toLocaleTimeString()}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default LiveMap;
