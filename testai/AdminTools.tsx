import React, { useState, useEffect } from 'react';
import { Users, Car, MapPin, Activity, AlertTriangle, TrendingUp, Settings, Eye, EyeOff } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw'
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

interface AdminToolsProps {
  className?: string;
}

const AdminTools: React.FC<AdminToolsProps> = ({ className = '' }) => {
  const [liveLocations, setLiveLocations] = useState<LiveLocation[]>([]);
  const [stats, setStats] = useState({
    totalDrivers: 0,
    totalPassengers: 0,
    activeVehicles: 0,
    averageSpeed: 0,
    lastUpdate: ''
  });
  const [showDetails, setShowDetails] = useState(true);
  const [selectedRole, setSelectedRole] = useState<'all' | 'driver' | 'passenger'>('all');
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Fetch live locations
  const fetchLiveLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('live_locations')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      setLiveLocations(data || []);
      updateStats(data || []);
    } catch (error) {
      console.error('Error fetching live locations:', error);
    }
  };

  // Update statistics
  const updateStats = (locations: LiveLocation[]) => {
    const drivers = locations.filter(loc => loc.role === 'driver');
    const passengers = locations.filter(loc => loc.role === 'passenger');
    const activeVehicles = drivers.filter(driver => driver.speed > 0);
    const averageSpeed = drivers.length > 0 
      ? drivers.reduce((sum, driver) => sum + driver.speed, 0) / drivers.length 
      : 0;

    setStats({
      totalDrivers: drivers.length,
      totalPassengers: passengers.length,
      activeVehicles: activeVehicles.length,
      averageSpeed: Math.round(averageSpeed * 10) / 10,
      lastUpdate: new Date().toLocaleTimeString()
    });
  };

  // Cleanup old locations
  const cleanupOldLocations = async () => {
    try {
      const { error } = await supabase
        .from('live_locations')
        .delete()
        .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

      if (error) throw error;
    } catch (error) {
      console.error('Error cleaning up old locations:', error);
    }
  };

  // Force refresh all locations
  const forceRefresh = async () => {
    await fetchLiveLocations();
  };

  // Set up realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-live-locations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_locations',
        },
        () => {
          fetchLiveLocations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  // Initial fetch and interval
  useEffect(() => {
    fetchLiveLocations();
    
    const interval = setInterval(fetchLiveLocations, refreshInterval);
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Cleanup interval
  useEffect(() => {
    const cleanupInterval = setInterval(cleanupOldLocations, 60000); // Every minute
    return () => clearInterval(cleanupInterval);
  }, []);

  const filteredLocations = selectedRole === 'all' 
    ? liveLocations 
    : liveLocations.filter(loc => loc.role === selectedRole);

  return (
    <div className={`bg-slate-800 rounded-2xl border border-slate-700 shadow-xl ${className}`}>
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 px-6 py-4 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h3 className="text-white font-bold text-lg">Fleet Command Center</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title={showDetails ? 'Hide Details' : 'Show Details'}
            >
              {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={forceRefresh}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Refresh"
            >
              <Activity className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Car className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase">Active Drivers</p>
              <p className="text-white font-bold text-xl">{stats.totalDrivers}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Users className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase">Active Passengers</p>
              <p className="text-white font-bold text-xl">{stats.totalPassengers}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <TrendingUp className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase">Moving Vehicles</p>
              <p className="text-white font-bold text-xl">{stats.activeVehicles}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-700/50 rounded-xl p-4 border border-slate-600">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Activity className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase">Avg Speed</p>
              <p className="text-white font-bold text-xl">{stats.averageSpeed} km/h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      {showDetails && (
        <div className="px-6 pb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-sm">Filter:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedRole('all')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedRole === 'all' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setSelectedRole('driver')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedRole === 'driver' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Drivers
                </button>
                <button
                  onClick={() => setSelectedRole('passenger')}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedRole === 'passenger' 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  Passengers
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <span>Refresh:</span>
              <select 
                value={refreshInterval} 
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-slate-700 text-white rounded px-2 py-1 text-sm border border-slate-600"
              >
                <option value={1000}>1s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Live Locations List */}
      {showDetails && (
        <div className="px-6 pb-6">
          <div className="bg-slate-700/30 rounded-xl border border-slate-600 max-h-96 overflow-y-auto">
            <div className="sticky top-0 bg-slate-700/90 backdrop-blur-sm border-b border-slate-600 px-4 py-2">
              <div className="grid grid-cols-6 gap-4 text-xs font-medium text-slate-400 uppercase">
                <span>Type</span>
                <span>ID</span>
                <span>Label</span>
                <span>Speed</span>
                <span>Heading</span>
                <span>Last Update</span>
              </div>
            </div>
            <div className="divide-y divide-slate-600">
              {filteredLocations.map((location) => (
                <div key={location.id} className="px-4 py-2 hover:bg-slate-700/50 transition-colors">
                  <div className="grid grid-cols-6 gap-4 items-center text-sm">
                    <div className="flex items-center gap-2">
                      {location.role === 'driver' ? (
                        <Car className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Users className="w-4 h-4 text-emerald-400" />
                      )}
                      <span className="text-white font-medium capitalize">{location.role}</span>
                    </div>
                    <span className="text-slate-300 font-mono text-xs">
                      {location.user_id.slice(0, 8)}...
                    </span>
                    <span className="text-slate-300">
                      {location.vehicle_label || 'N/A'}
                    </span>
                    <span className="text-slate-300">
                      {location.speed.toFixed(1)} km/h
                    </span>
                    <span className="text-slate-300">
                      {Math.round(location.heading)}°
                    </span>
                    <span className="text-slate-400 text-xs">
                      {new Date(location.updated_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="bg-slate-900 border-t border-slate-700 px-6 py-3 rounded-b-2xl">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Last updated: {stats.lastUpdate}</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
            <span>Real-time monitoring active</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminTools;
