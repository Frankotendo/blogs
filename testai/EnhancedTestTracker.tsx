// ============================================================
// ENHANCED TEST TRACKER - ACCURATE MOVEMENT & LOCATION TESTING
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cCI6InR5cCI6IkpXVCJ9.G_hWSgPstbOi9GgnGprZW1IQVFZSGPQnyC80RROmuw'
);

declare global {
  interface Window {
    L: any;
    io: any;
  }
}

// Enhanced location tracking interfaces
interface TestDriver {
  id: string;
  name: string;
  vehicleType: 'Pragia' | 'Taxi' | 'Shuttle';
  status: 'online' | 'busy' | 'offline';
  currentLocation: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  route: {
    waypoints: Array<{lat: number; lng: number; name: string}>;
    currentIndex: number;
    isLooping: boolean;
  };
  speed: number; // km/h
  heading: number; // degrees
  accuracy: number; // meters
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  drivers: TestDriver[];
  passengerLocation: {lat: number; lng: number};
  duration: number; // seconds
}

// Predefined Accra locations for realistic testing
const ACCRA_LOCATIONS = {
  legon: { lat: 5.6037, lng: -0.1870, name: 'University of Ghana, Legon' },
  mallam: { lat: 5.6148, lng: -0.2059, name: 'Mallam Market' },
  kaneshie: { lat: 5.5670, lng: -0.2440, name: 'Kaneshie Market' },
  tema: { lat: 5.6685, lng: -0.0165, name: 'Tema Community 1' },
  osu: { lat: 5.5530, lng: -0.2100, name: 'Osu Oxford Street' },
  labone: { lat: 5.5600, lng: -0.1850, name: 'Labone' },
  east_legon: { lat: 5.6200, lng: -0.1700, name: 'East Legon' },
  aburi: { lat: 5.5800, lng: -0.0750, name: 'Aburi Gardens' },
  madina: { lat: 5.6800, lng: -0.2200, name: 'Madina Market' },
  achimota: { lat: 5.5900, lng: -0.2300, name: 'Achimota' }
};

// Predefined test scenarios
const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'legon-mallam-commute',
    name: 'Legon to Mallam Commute',
    description: 'Realistic morning commute from university to market',
    drivers: [
      {
        id: 'pragia-001',
        name: 'Kofi Pragia',
        vehicleType: 'Pragia',
        status: 'online',
        currentLocation: ACCRA_LOCATIONS.legon,
        route: {
          waypoints: [ACCRA_LOCATIONS.legon, ACCRA_LOCATIONS.mallam],
          currentIndex: 0,
          isLooping: true
        },
        speed: 25,
        heading: 225,
        accuracy: 5
      },
      {
        id: 'taxi-001',
        name: 'Ama Taxi',
        vehicleType: 'Taxi',
        status: 'online',
        currentLocation: ACCRA_LOCATIONS.labone,
        route: {
          waypoints: [ACCRA_LOCATIONS.labone, ACCRA_LOCATIONS.osu, ACCRA_LOCATIONS.mallam],
          currentIndex: 0,
          isLooping: true
        },
        speed: 35,
        heading: 180,
        accuracy: 3
      }
    ],
    passengerLocation: ACCRA_LOCATIONS.east_legon,
    duration: 300
  },
  {
    id: 'shuttle-campus-route',
    name: 'Campus Shuttle Route',
    description: 'University campus shuttle service',
    drivers: [
      {
        id: 'shuttle-001',
        name: 'Campus Shuttle',
        vehicleType: 'Shuttle',
        status: 'online',
        currentLocation: ACCRA_LOCATIONS.legon,
        route: {
          waypoints: [
            ACCRA_LOCATIONS.legon,
            ACCRA_LOCATIONS.east_legon,
            ACCRA_LOCATIONS.labone,
            ACCRA_LOCATIONS.legon
          ],
          currentIndex: 0,
          isLooping: true
        },
        speed: 20,
        heading: 90,
        accuracy: 8
      }
    ],
    passengerLocation: ACCRA_LOCATIONS.legon,
    duration: 600
  },
  {
    id: 'rush-hour-traffic',
    name: 'Rush Hour Traffic',
    description: 'Multiple vehicles in rush hour conditions',
    drivers: [
      {
        id: 'pragia-002',
        name: 'Express Pragia',
        vehicleType: 'Pragia',
        status: 'online',
        currentLocation: ACCRA_LOCATIONS.kaneshie,
        route: {
          waypoints: [ACCRA_LOCATIONS.kaneshie, ACCRA_LOCATIONS.madina, ACCRA_LOCATIONS.achimota],
          currentIndex: 0,
          isLooping: true
        },
        speed: 15, // Slow due to traffic
        heading: 45,
        accuracy: 5
      },
      {
        id: 'taxi-002',
        name: 'City Taxi',
        vehicleType: 'Taxi',
        status: 'busy',
        currentLocation: ACCRA_LOCATIONS.osu,
        route: {
          waypoints: [ACCRA_LOCATIONS.osu, ACCRA_LOCATIONS.labone, ACCRA_LOCATIONS.legon],
          currentIndex: 0,
          isLooping: true
        },
        speed: 20,
        heading: 270,
        accuracy: 3
      },
      {
        id: 'shuttle-002',
        name: 'Airport Shuttle',
        vehicleType: 'Shuttle',
        status: 'online',
        currentLocation: ACCRA_LOCATIONS.tema,
        route: {
          waypoints: [ACCRA_LOCATIONS.tema, ACCRA_LOCATIONS.achimota, ACCRA_LOCATIONS.legon],
          currentIndex: 0,
          isLooping: true
        },
        speed: 40, // Highway speed
        heading: 315,
        accuracy: 10
      }
    ],
    passengerLocation: ACCRA_LOCATIONS.kaneshie,
    duration: 900
  }
];

// Enhanced distance and movement calculations
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateBearing = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
           Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

const interpolatePosition = (
  start: {lat: number; lng: number},
  end: {lat: number; lng: number},
  progress: number
): {lat: number; lng: number} => {
  return {
    lat: start.lat + (end.lat - start.lat) * progress,
    lng: start.lng + (end.lng - start.lng) * progress
  };
};

const EnhancedTestTracker: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [activeScenario, setActiveScenario] = useState<TestScenario | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [testDrivers, setTestDrivers] = useState<TestDriver[]>([]);
  const [driverMarkers, setDriverMarkers] = useState<{[key: string]: any}>({});
  const [passengerMarker, setPassengerMarker] = useState<any>(null);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [socket, setSocket] = useState<any>(null);
  
  const animationFrameRef = useRef<number>();
  const startTimeRef = useRef<number>();

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    const leafletMap = window.L.map(mapRef.current).setView([5.6037, -0.1870], 13);
    
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);

    setMap(leafletMap);
    setIsMapReady(true);

    // Initialize Socket.IO if available
    try {
      if (window.io) {
        const socketInstance = window.io();
        setSocket(socketInstance);
      }
    } catch (e) {
      console.log('Socket.IO not available, using standalone mode');
    }

    return () => {
      if (leafletMap) {
        leafletMap.remove();
      }
    };
  }, []);

  // Create driver icon based on vehicle type
  const createDriverIcon = (vehicleType: string, status: string) => {
    const icons = {
      'Pragia': '🛺',
      'Taxi': '🚕',
      'Shuttle': '🚌'
    };
    
    const statusColors = {
      'online': '#10b981',
      'busy': '#f59e0b',
      'offline': '#ef4444'
    };

    return window.L.divIcon({
      html: `
        <div style="
          background: ${statusColors[status as keyof typeof statusColors] || '#10b981'};
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${icons[vehicleType as keyof typeof icons] || '🚗'}
        </div>
      `,
      iconSize: [40, 40],
      className: 'test-driver-marker'
    });
  };

  // Update driver position on map
  const updateDriverMarker = useCallback((driver: TestDriver) => {
    if (!map) return;

    const icon = createDriverIcon(driver.vehicleType, driver.status);
    const popupContent = `
      <div style="font-family: system-ui, sans-serif; min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">${driver.name}</h4>
        <p style="margin: 4px 0; font-size: 14px;">
          <strong>Type:</strong> ${driver.vehicleType}
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <strong>Status:</strong> <span style="color: ${
            driver.status === 'online' ? '#10b981' : 
            driver.status === 'busy' ? '#f59e0b' : '#ef4444'
          }">${driver.status}</span>
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <strong>Speed:</strong> ${driver.speed} km/h
        </p>
        <p style="margin: 4px 0; font-size: 14px;">
          <strong>Heading:</strong> ${Math.round(driver.heading)}°
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #666;">
          <strong>Accuracy:</strong> ±${driver.accuracy}m
        </p>
        <p style="margin: 4px 0; font-size: 12px; color: #666;">
          <strong>Location:</strong> ${driver.currentLocation.lat.toFixed(6)}, ${driver.currentLocation.lng.toFixed(6)}
        </p>
      </div>
    `;

    if (driverMarkers[driver.id]) {
      // Update existing marker
      driverMarkers[driver.id].setLatLng([driver.currentLocation.lat, driver.currentLocation.lng]);
      driverMarkers[driver.id].setIcon(icon);
      driverMarkers[driver.id].setPopupContent(popupContent);
    } else {
      // Create new marker
      const marker = window.L.marker([driver.currentLocation.lat, driver.currentLocation.lng], { icon })
        .addTo(map)
        .bindPopup(popupContent);
      
      setDriverMarkers(prev => ({ ...prev, [driver.id]: marker }));
    }
  }, [map, driverMarkers]);

  // Start scenario simulation
  const startScenario = (scenario: TestScenario) => {
    setActiveScenario(scenario);
    setTestDrivers(scenario.drivers);
    setIsSimulating(true);
    setSimulationTime(0);
    startTimeRef.current = Date.now();

    // Add passenger marker
    if (map && scenario.passengerLocation) {
      const passengerIcon = window.L.divIcon({
        html: `
          <div style="
            background: #3b82f6;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">
            👤
          </div>
        `,
        iconSize: [30, 30],
        className: 'test-passenger-marker'
      });

      const marker = window.L.marker([scenario.passengerLocation.lat, scenario.passengerLocation.lng], { passengerIcon })
        .addTo(map)
        .bindPopup('Test Passenger Location');
      
      setPassengerMarker(marker);
    }
  };

  // Animation loop for realistic movement
  const animate = useCallback(() => {
    if (!isSimulating || !activeScenario) return;

    const currentTime = Date.now();
    const elapsed = (currentTime - (startTimeRef.current || currentTime)) / 1000; // seconds
    setSimulationTime(elapsed);

    // Update each driver position
    const updatedDrivers = testDrivers.map(driver => {
      const route = driver.route;
      const totalWaypoints = route.waypoints.length;
      
      if (totalWaypoints < 2) return driver;

      // Calculate progress along route
      const routeProgress = (elapsed % activeScenario.duration) / activeScenario.duration;
      const totalDistance = route.waypoints.reduce((acc, waypoint, index) => {
        if (index === 0) return 0;
        return acc + calculateDistance(
          route.waypoints[index - 1].lat,
          route.waypoints[index - 1].lng,
          waypoint.lat,
          waypoint.lng
        );
      }, 0);

      const targetDistance = totalDistance * routeProgress;
      let accumulatedDistance = 0;
      let currentSegmentIndex = 0;
      let segmentProgress = 0;

      // Find current segment
      for (let i = 1; i < totalWaypoints; i++) {
        const segmentDistance = calculateDistance(
          route.waypoints[i - 1].lat,
          route.waypoints[i - 1].lng,
          route.waypoints[i].lat,
          route.waypoints[i].lng
        );
        
        if (accumulatedDistance + segmentDistance >= targetDistance) {
          currentSegmentIndex = i - 1;
          segmentProgress = (targetDistance - accumulatedDistance) / segmentDistance;
          break;
        }
        
        accumulatedDistance += segmentDistance;
      }

      // Interpolate position
      const currentWaypoint = route.waypoints[currentSegmentIndex];
      const nextWaypoint = route.waypoints[Math.min(currentSegmentIndex + 1, totalWaypoints - 1)];
      
      const newPosition = interpolatePosition(currentWaypoint, nextWaypoint, segmentProgress);
      
      // Calculate realistic heading
      const newHeading = calculateBearing(
        currentWaypoint.lat,
        currentWaypoint.lng,
        nextWaypoint.lat,
        nextWaypoint.lng
      );

      // Add some realistic variation
      const speedVariation = (Math.sin(elapsed * 0.5) * 5); // ±5 km/h variation
      const accuracyVariation = Math.random() * 3; // 0-3m GPS variation

      return {
        ...driver,
        currentLocation: {
          ...newPosition,
          timestamp: new Date().toISOString()
        },
        heading: newHeading,
        speed: Math.max(5, driver.speed + speedVariation), // Min 5 km/h
        accuracy: driver.accuracy + accuracyVariation
      };
    });

    setTestDrivers(updatedDrivers);

    // Update markers
    updatedDrivers.forEach(driver => {
      updateDriverMarker(driver);
      
      // Emit to socket if available
      if (socket) {
        socket.emit('driverLocationUpdate', {
          driverId: driver.id,
          lat: driver.currentLocation.lat,
          lng: driver.currentLocation.lng,
          name: driver.name,
          vehicleType: driver.vehicleType,
          status: driver.status,
          speed: driver.speed,
          heading: driver.heading,
          accuracy: driver.accuracy,
          timestamp: driver.currentLocation.timestamp
        });
      }
    });

    // Store test results
    const testResult = {
      timestamp: new Date().toISOString(),
      elapsedTime: elapsed,
      drivers: updatedDrivers.map(d => ({
        id: d.id,
        name: d.name,
        location: d.currentLocation,
        speed: d.speed,
        heading: d.heading,
        accuracy: d.accuracy
      }))
    };

    setTestResults(prev => [...prev.slice(-100), testResult]); // Keep last 100 results

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [isSimulating, activeScenario, testDrivers, updateDriverMarker, socket]);

  // Start/stop animation
  useEffect(() => {
    if (isSimulating) {
      animationFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSimulating, animate]);

  // Stop simulation
  const stopSimulation = () => {
    setIsSimulating(false);
    setSimulationTime(0);
    
    // Clear markers
    Object.values(driverMarkers).forEach(marker => {
      if (map) map.removeLayer(marker);
    });
    setDriverMarkers({});
    
    if (passengerMarker && map) {
      map.removeLayer(passengerMarker);
      setPassengerMarker(null);
    }
  };

  // Export test results
  const exportResults = () => {
    const dataStr = JSON.stringify(testResults, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `test-results-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex">
      {/* Map Container */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />
        
        {/* Simulation Status */}
        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-md rounded-2xl p-4 text-white max-w-sm">
          <h3 className="text-lg font-bold mb-2">Test Simulation</h3>
          {activeScenario && (
            <div className="space-y-2 text-sm">
              <p><strong>Scenario:</strong> {activeScenario.name}</p>
              <p><strong>Time:</strong> {Math.round(simulationTime)}s</p>
              <p><strong>Status:</strong> 
                <span className={`ml-2 px-2 py-1 rounded text-xs ${
                  isSimulating ? 'bg-green-500' : 'bg-gray-500'
                }`}>
                  {isSimulating ? 'Running' : 'Stopped'}
                </span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Control Panel */}
      <div className="w-96 bg-black/90 backdrop-blur-md p-6 text-white overflow-y-auto">
        <h2 className="text-xl font-bold mb-6">Enhanced Test Tracker</h2>
        
        {/* Scenario Selection */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Test Scenarios</h3>
          <div className="space-y-2">
            {TEST_SCENARIOS.map(scenario => (
              <div key={scenario.id} className="p-3 bg-white/5 rounded-lg">
                <h4 className="font-medium">{scenario.name}</h4>
                <p className="text-sm text-gray-400 mb-2">{scenario.description}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => startScenario(scenario)}
                    disabled={isSimulating}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-sm"
                  >
                    Start
                  </button>
                  <button
                    onClick={stopSimulation}
                    disabled={!isSimulating}
                    className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded text-sm"
                  >
                    Stop
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Active Drivers */}
        {testDrivers.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Active Drivers ({testDrivers.length})</h3>
            <div className="space-y-2">
              {testDrivers.map(driver => (
                <div key={driver.id} className="p-3 bg-white/5 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{driver.name}</span>
                    <span className={`px-2 py-1 rounded text-xs ${
                      driver.status === 'online' ? 'bg-green-500' : 
                      driver.status === 'busy' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}>
                      {driver.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    <p>{driver.vehicleType} • {Math.round(driver.speed)} km/h</p>
                    <p>📍 {driver.currentLocation.lat.toFixed(6)}, {driver.currentLocation.lng.toFixed(6)}</p>
                    <p>🧭 {Math.round(driver.heading)}° • ±{driver.accuracy.toFixed(1)}m</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Results */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3">Test Results</h3>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-400">
              {testResults.length} data points collected
            </span>
            <button
              onClick={exportResults}
              disabled={testResults.length === 0}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded text-sm"
            >
              Export JSON
            </button>
          </div>
          <div className="text-sm text-gray-400">
            <p>• Real-time GPS simulation</p>
            <p>• Accurate movement patterns</p>
            <p>• Speed and heading variations</p>
            <p>• Socket.IO integration</p>
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
          <h4 className="font-medium mb-2">How to Use:</h4>
          <ol className="text-sm text-gray-300 space-y-1">
            <li>1. Select a test scenario</li>
            <li>2. Click "Start" to begin simulation</li>
            <li>3. Watch drivers move realistically</li>
            <li>4. Monitor GPS accuracy and speed</li>
            <li>5. Export results for analysis</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default EnhancedTestTracker;
