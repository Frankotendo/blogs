import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
// NEW CODE START
import '../styles/map.css';
import ErrorBoundary from './ErrorBoundary';
// NEW CODE END

// NEW CODE START
interface DriverLocation {
  id: string;
  lat: number;
  lng: number;
  vehicleType: 'Pragia' | 'Taxi' | 'Shuttle';
  name: string;
  status: 'online' | 'busy' | 'offline';
}

interface RouteData {
  coordinates: [number, number][];
  distance: number;
  duration: number;
}

interface LiveMapProps {
  mode: 'passenger' | 'driver';
  userLocation?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
  onDriverSelect?: (driver: DriverLocation) => void;
  className?: string;
}

const LiveMap: React.FC<LiveMapProps> = ({
  mode,
  userLocation,
  destination,
  onDriverSelect,
  className = ''
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const routeLayerRef = useRef<L.GeoJSON | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const [route, setRoute] = useState<RouteData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Custom icons for different vehicle types
  const getVehicleIcon = useCallback((vehicleType: string, isSelected = false) => {
    const colorMap = {
      'Pragia': '#3b82f6', // blue
      'Taxi': '#f59e0b', // amber  
      'Shuttle': '#10b981' // emerald
    };
    
    const color = colorMap[vehicleType as keyof typeof colorMap] || '#6b7280';
    const size = isSelected ? 40 : 30;
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          width: ${size}px;
          height: ${size}px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
          font-size: ${isSelected ? '12px' : '10px'};
          text-transform: uppercase;
        ">
          ${vehicleType.charAt(0)}
        </div>
      `,
      className: 'custom-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
  }, []);

  // User location icon
  const getUserIcon = useCallback(() => {
    return L.divIcon({
      html: `
        <div style="
          background-color: #ef4444;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>
      `,
      className: 'user-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      // Initialize map centered on user location or default location
      const centerLat = userLocation?.lat || 5.6037; // Default: Kumasi, Ghana
      const centerLng = userLocation?.lng || -0.18696;

      const map = L.map(mapRef.current).setView([centerLat, centerLng], 15);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;

      // Add user location marker if available
      if (userLocation) {
        const userMarker = L.marker([userLocation.lat, userLocation.lng], {
          icon: getUserIcon()
        }).addTo(map);
        userMarkerRef.current = userMarker;
      }

    } catch (err) {
      console.error('Failed to initialize map:', err);
      setError('Failed to load map');
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation, getUserIcon]);

  // Mock driver data service - simulates real-time driver locations
  const fetchDrivers = useCallback(async (): Promise<DriverLocation[]> => {
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Mock driver data around Kumasi, Ghana
      const mockDrivers: DriverLocation[] = [
        {
          id: '1',
          lat: 5.6037 + (Math.random() - 0.5) * 0.02,
          lng: -0.18696 + (Math.random() - 0.5) * 0.02,
          vehicleType: 'Pragia',
          name: 'Kofi Driver',
          status: 'online'
        },
        {
          id: '2', 
          lat: 5.6037 + (Math.random() - 0.5) * 0.02,
          lng: -0.18696 + (Math.random() - 0.5) * 0.02,
          vehicleType: 'Taxi',
          name: 'Ama Driver',
          status: 'online'
        },
        {
          id: '3',
          lat: 5.6037 + (Math.random() - 0.5) * 0.02,
          lng: -0.18696 + (Math.random() - 0.5) * 0.02,
          vehicleType: 'Shuttle',
          name: 'Yaw Driver',
          status: 'busy'
        },
        {
          id: '4',
          lat: 5.6037 + (Math.random() - 0.5) * 0.02,
          lng: -0.18696 + (Math.random() - 0.5) * 0.02,
          vehicleType: 'Pragia',
          name: 'Esi Driver',
          status: 'online'
        },
        {
          id: '5',
          lat: 5.6037 + (Math.random() - 0.5) * 0.02,
          lng: -0.18696 + (Math.random() - 0.5) * 0.02,
          vehicleType: 'Taxi',
          name: 'Kojo Driver',
          status: 'offline'
        }
      ];

      return mockDrivers.filter(driver => driver.status === 'online' || driver.status === 'busy');
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
      return [];
    }
  }, []);

  // Fetch route from OSRM (no API key required)
  const fetchRoute = useCallback(async (from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<RouteData | null> => {
    try {
      setIsLoading(true);
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error('Route request failed');
      
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        return {
          coordinates: route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]]), // Convert to [lat, lng]
          distance: route.distance / 1000, // Convert to km
          duration: route.duration / 60 // Convert to minutes
        };
      }
      
      return null;
    } catch (err) {
      console.error('Failed to fetch route:', err);
      setError('Failed to calculate route');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update driver markers on map
  const updateDriverMarkers = useCallback((driverList: DriverLocation[]) => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => {
      mapInstanceRef.current?.removeLayer(marker);
    });
    markersRef.current.clear();

    // Add new markers
    driverList.forEach(driver => {
      const isSelected = selectedDriver?.id === driver.id;
      const marker = L.marker([driver.lat, driver.lng], {
        icon: getVehicleIcon(driver.vehicleType, isSelected)
      }).addTo(mapInstanceRef.current!);

      // Add popup with driver info
      marker.bindPopup(`
        <div style="min-width: 150px;">
          <strong>${driver.name}</strong><br>
          Type: ${driver.vehicleType}<br>
          Status: ${driver.status}<br>
          <button onclick="window.selectDriver('${driver.id}')" 
                  style="background: #3b82f6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">
            Select Driver
          </button>
        </div>
      `);

      marker.on('click', () => {
        setSelectedDriver(driver);
        onDriverSelect?.(driver);
      });

      markersRef.current.set(driver.id, marker);
    });
  }, [selectedDriver, getVehicleIcon, onDriverSelect]);

  // Draw route on map
  const drawRoute = useCallback((routeData: RouteData) => {
    if (!mapInstanceRef.current) return;

    // Remove existing route
    if (routeLayerRef.current) {
      mapInstanceRef.current.removeLayer(routeLayerRef.current);
    }

    // Add new route
    const routeGeoJSON = {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates: routeData.coordinates
      }
    };

    routeLayerRef.current = L.geoJSON(routeGeoJSON, {
      style: {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7
      }
    }).addTo(mapInstanceRef.current);

    // Fit map to show route
    const bounds = L.latLngBounds(routeData.coordinates);
    mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
  }, []);

  // Poll for driver updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const driverList = await fetchDrivers();
      setDrivers(driverList);
    }, 3000);

    // Initial fetch
    fetchDrivers().then(setDrivers);

    return () => clearInterval(interval);
  }, [fetchDrivers]);

  // Update markers when drivers change
  useEffect(() => {
    updateDriverMarkers(drivers);
  }, [drivers, updateDriverMarkers]);

  // Handle driver selection and route calculation
  useEffect(() => {
    if (selectedDriver && userLocation && mode === 'passenger') {
      fetchRoute(userLocation, {
        lat: selectedDriver.lat,
        lng: selectedDriver.lng
      }).then(routeData => {
        if (routeData) {
          setRoute(routeData);
          drawRoute(routeData);
        }
      });
    }
  }, [selectedDriver, userLocation, mode, fetchRoute, drawRoute]);

  // Handle driver navigation to destination
  useEffect(() => {
    if (mode === 'driver' && userLocation && destination) {
      fetchRoute(userLocation, destination).then(routeData => {
        if (routeData) {
          setRoute(routeData);
          drawRoute(routeData);
        }
      });
    }
  }, [mode, userLocation, destination, fetchRoute, drawRoute]);

  // Make selectDriver available globally for popup buttons
  useEffect(() => {
    (window as any).selectDriver = (driverId: string) => {
      const driver = drivers.find(d => d.id === driverId);
      if (driver) {
        setSelectedDriver(driver);
        onDriverSelect?.(driver);
      }
    };

    return () => {
      delete (window as any).selectDriver;
    };
  }, [drivers, onDriverSelect]);

  if (error) {
    return (
      <div className={`map-error-container ${className}`}>
        <div className="error-icon">
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        <div>
          <strong>Map Unavailable</strong>
          <p>Unable to load map. Please refresh the page.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <div className={`map-error-container ${className}`}>
          <div className="error-icon">
            <i className="fas fa-map-marked-alt"></i>
          </div>
          <div>
            <strong>Map Temporarily Unavailable</strong>
            <p>Navigation services are temporarily down.</p>
          </div>
        </div>
      }
    >
      <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-lg p-2">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Loading...</span>
          </div>
        </div>
      )}
      
      {route && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-lg p-3 max-w-xs">
          <div className="text-sm">
            <div className="font-semibold text-gray-800">Route Info</div>
            <div className="text-gray-600">
              Distance: {route.distance.toFixed(1)} km
            </div>
            <div className="text-gray-600">
              ETA: {route.duration.toFixed(0)} min
            </div>
          </div>
        </div>
      )}

      <div 
        ref={mapRef} 
        className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
        style={{ height: '100%', minHeight: '400px' }}
      />
      </div>
    </ErrorBoundary>
  );
};

export default LiveMap;
// NEW CODE END
