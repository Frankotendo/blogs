import React, { useState, useEffect } from 'react';
import { MapPin, Navigation, Clock, Route } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw'
);

interface PassengerLocation {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  updated_at: string;
}

interface RouteDirectionsProps {
  driverId: string;
  className?: string;
}

const RouteDirections: React.FC<RouteDirectionsProps> = ({ driverId, className = '' }) => {
  const [passengers, setPassengers] = useState<PassengerLocation[]>([]);
  const [selectedPassenger, setSelectedPassenger] = useState<PassengerLocation | null>(null);
  const [route, setRoute] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch passengers waiting for pickup
  const fetchPassengers = async () => {
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .eq('role', 'passenger')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Filter for recent locations (last 5 minutes)
      const now = new Date();
      const recentPassengers = (data || []).filter((p: PassengerLocation) => {
        const updateTime = new Date(p.updated_at);
        const timeDiff = (now.getTime() - updateTime.getTime()) / 1000;
        return timeDiff < 300; // 5 minutes
      });
      
      setPassengers(recentPassengers);
    } catch (error) {
      console.error('Error fetching passengers:', error);
    }
  };

  // Get route using OpenStreetMap routing (ORS or similar free service)
  const getRoute = async (passenger: PassengerLocation) => {
    setIsLoading(true);
    setSelectedPassenger(passenger);
    
    try {
      // Get driver's current location
      const { data: driverData } = await supabase
        .from('live_locations')
        .select('lat, lng')
        .eq('user_id', driverId)
        .eq('role', 'driver')
        .single();

      if (!driverData) {
        console.error('Driver location not found');
        return;
      }

      // Using OpenRouteService (free tier) for routing
      const response = await fetch(
        `https://api.openrouteservice.org/v2/directions/driving-car?api_key=YOUR_ORS_API_KEY&start=${driverData.lng},${driverData.lat}&end=${passenger.lng},${passenger.lat}`
      );

      if (response.ok) {
        const routeData = await response.json();
        setRoute(routeData);
      } else {
        // Fallback to simple straight line
        setRoute({
          type: 'straight',
          start: [driverData.lat, driverData.lng],
          end: [passenger.lat, passenger.lng]
        });
      }
    } catch (error) {
      console.error('Error getting route:', error);
      // Fallback to simple straight line
      setRoute({
        type: 'straight',
        start: [0, 0], // Will be updated with actual driver location
        end: [passenger.lat, passenger.lng]
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Open Google Maps for navigation
  const openGoogleMapsNavigation = (passenger: PassengerLocation) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${passenger.lat},${passenger.lng}`;
    window.open(url, '_blank');
  };

  // Open Google Maps for route planning
  const openGoogleMapsRoute = (passenger: PassengerLocation) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${passenger.lat},${passenger.lng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  useEffect(() => {
    fetchPassengers();
    const interval = setInterval(fetchPassengers, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`bg-slate-800 rounded-2xl border border-slate-700 shadow-xl ${className}`}>
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 rounded-t-2xl">
        <div className="flex items-center gap-3">
          <Route className="w-5 h-5 text-emerald-500" />
          <h3 className="text-white font-bold text-lg">Passenger Pickup Directions</h3>
        </div>
      </div>

      {/* Passengers List */}
      <div className="p-6 max-h-96 overflow-y-auto">
        {passengers.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">No passengers waiting for pickup</p>
          </div>
        ) : (
          <div className="space-y-3">
            {passengers.map((passenger) => (
              <div
                key={passenger.id}
                className={`bg-slate-700/50 rounded-xl p-4 border border-slate-600 transition-all cursor-pointer hover:bg-slate-700 hover:border-emerald-500 ${
                  selectedPassenger?.id === passenger.id ? 'ring-2 ring-emerald-500' : ''
                }`}
                onClick={() => getRoute(passenger)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                      <MapPin className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Passenger</p>
                      <p className="text-slate-400 text-sm">
                        ID: {passenger.user_id.slice(0, 8)}...
                      </p>
                      <p className="text-slate-500 text-xs">
                        {new Date(passenger.updated_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openGoogleMapsNavigation(passenger);
                      }}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      title="Navigate with Google Maps"
                    >
                      <Navigation className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openGoogleMapsRoute(passenger);
                      }}
                      className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="View route in Google Maps"
                    >
                      <Route className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Route Information */}
                {selectedPassenger?.id === passenger.id && (
                  <div className="mt-4 pt-4 border-t border-slate-600">
                    {isLoading ? (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Calculating route...</span>
                      </div>
                    ) : route ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-emerald-400">
                          <Route className="w-4 h-4" />
                          <span className="text-sm font-medium">Route Available</span>
                        </div>
                        <p className="text-slate-400 text-xs">
                          Click navigation buttons to open Google Maps for turn-by-turn directions
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="bg-slate-900 border-t border-slate-700 px-6 py-3 rounded-b-2xl">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{passengers.length} passengers waiting</span>
          <div className="flex items-center gap-2">
            <Clock className="w-3 h-3" />
            <span>Auto-refresh every 10s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteDirections;
