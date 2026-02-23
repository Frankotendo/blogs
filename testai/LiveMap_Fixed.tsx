import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Route, Home, Globe, Maximize2, Minimize2, X, Layers, RefreshCw, Settings } from 'lucide-react';
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

const LiveMap: React.FC<LiveMapProps> = ({ 
  userId, 
  role, 
  vehicleLabel, 
  center = [5.6037, -0.1870], // Default to Ghana
  zoom = 13,
  onLocationUpdate 
}) => {
  const [currentLocation, setCurrentLocation] = useState<any>(null);
  const [allLocations, setAllLocations] = useState<LiveLocation[]>([]);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const mapRef = React.useRef<any>(null);

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

  // Map controls component
  const MapControls: React.FC<{ map: any }> = ({ map }) => {
    const handleReturnToLocation = () => {
      if (currentLocation) {
        map.setView([currentLocation.lat, currentLocation.lng], 15);
      }
    };

    const handleWorldView = () => {
      map.setView([0, 0], 2);
    };

    const handleToggleMaximize = () => {
      setIsMaximized(!isMaximized);
    };

    return (
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        <button
          onClick={handleReturnToLocation}
          className="bg-blue-600 text-white p-2 rounded-lg shadow-lg hover:bg-blue-700 transition-colors"
          title="Return to Current Location"
        >
          <Home className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleWorldView}
          className="bg-gray-600 text-white p-2 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
          title="World View"
        >
          <Globe className="w-4 h-4" />
        </button>
        
        <button
          onClick={handleToggleMaximize}
          className="bg-purple-600 text-white p-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors"
          title={isMaximized ? "Minimize" : "Maximize"}
        >
          {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>
    );
  };

  return (
    <div className={`relative ${isMaximized ? 'fixed inset-0 z-50 bg-black' : 'h-full w-full'}`}>
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Route className="w-5 h-5 text-emerald-500" />
          <h1 className="text-white font-bold text-lg">
            {role === 'passenger' ? 'Passenger Portal' : 'Driver Terminal'}
          </h1>
        </div>
        <button
          onClick={() => setIsMaximized(false)}
          className="text-slate-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Map Container */}
      <div className="relative flex-1">
        {/* Status */}
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

        {/* Instructions */}
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

        {/* Map */}
        <div className="w-full h-full">
          <div id="map" className="w-full h-full"></div>
        </div>
      </div>
    </div>
  );
};

export default LiveMap;
