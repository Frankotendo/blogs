import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

declare global {
  interface Window {
    L: any;
    io: any;
  }
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cCI6Imt6cCI6InR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6cCI6InR5cCI6IkpXVCJ9.G_hWSgPstbOi9GgnGprZW1IQVFZSGPQnyC80RROmuw'
);

// Vehicle type icons mapping
const VEHICLE_ICONS = {
  'Pragia': '🛺',    // Shared taxi/minibus
  'Taxi': '🚕',      // Regular taxi
  'Shuttle': '🚌'     // Bus/van
};

// Driver status icons
const STATUS_ICONS = {
  'online': '🟢',    // Available
  'busy': '🟡',      // On ride
  'offline': '🔴'     // Not available
};

// Calculate distance between two points
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
};

// Show ETA for each driver
const showETA = (driverLat: number, driverLng: number, passengerLat: number, passengerLng: number) => {
  const distance = calculateDistance(driverLat, driverLng, passengerLat, passengerLng);
  const avgSpeed = 30; // km/h in city traffic
  const etaMinutes = Math.round((distance / avgSpeed) * 60);
  
  return `${distance.toFixed(1)}km away - ~${etaMinutes} min`;
};

// Create vehicle-specific icon
const getVehicleIcon = (vehicleType: string) => {
  return window.L.divIcon({
    html: VEHICLE_ICONS[vehicleType] || '🚗',
    iconSize: [35, 35],
    className: `driver-marker ${vehicleType.toLowerCase()}-marker`
  });
};

// Enhanced driver popup with status and info
const createDriverPopup = (driver: any, passengerLat?: number, passengerLng?: number) => {
  const etaInfo = passengerLat && passengerLng 
    ? `<small>📍 ${showETA(driver.lat, driver.lng, passengerLat, passengerLng)}</small><br>`
    : '';
    
  return `
    <div class="driver-popup" style="font-family: system-ui, sans-serif; max-width: 200px;">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-size: 16px;">${STATUS_ICONS[driver.status] || '🟢'}</span>
        <strong style="color: #333;">${driver.name || `Driver ${driver.driverId}`}</strong>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 18px;">${VEHICLE_ICONS[driver.vehicleType] || '🚗'}</span>
        <span style="color: #666; font-size: 14px;">${driver.vehicleType}</span>
      </div>
      ${etaInfo}
      <small style="color: #888;">ID: ${driver.driverId}</small>
    </div>
  `;
};

const TrackingComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [drivers, setDrivers] = useState<any>({});
  const [passengerMarker, setPassengerMarker] = useState<any>(null);
  const [passengerLocation, setPassengerLocation] = useState<{lat: number, lng: number} | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [map, setMap] = useState<any>(null);
  const driverMarkersRef = useRef<{[key: string]: any}>({});
  const passengerMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Initialize Leaflet map
    const leafletMap = window.L.map(mapRef.current).setView([0, 0], 13);

    // Use OSM tiles
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(leafletMap);

    setMap(leafletMap);
    setIsMapReady(true);

    // Initialize Socket.IO
    let socketInstance: any = null;
    try {
      if (window.io) {
        socketInstance = window.io();
        setSocket(socketInstance);
      }
    } catch (e) {
      console.log('Socket.IO not available, using standalone mode');
    }

    // Show passenger via navigator.geolocation.watchPosition
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setPassengerLocation({ lat: latitude, lng: longitude });
          
          // Update existing marker instead of creating new one
          if (passengerMarkerRef.current) {
            passengerMarkerRef.current.setLatLng([latitude, longitude]);
          } else {
            const passengerIcon = window.L.divIcon({
              html: '👤',
              iconSize: [30, 30],
              className: 'passenger-marker'
            });
            
            const marker = window.L.marker([latitude, longitude], { icon: passengerIcon })
              .addTo(leafletMap)
              .bindPopup('Your Location');
            
            passengerMarkerRef.current = marker;
            leafletMap.setView([latitude, longitude], 15);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0
        }
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
        if (socketInstance) {
          socketInstance.disconnect();
        }
        leafletMap.remove();
      };
    }

    return () => {
      if (socketInstance) {
        socketInstance.disconnect();
      }
      leafletMap.remove();
    };
  }, []);

  useEffect(() => {
    if (!socket || !isMapReady) return;

    // Load real drivers from database
    const loadRealDrivers = async () => {
      try {
        const { data, error } = await supabase
          .from('driver_locations')
          .select(`
            driver_id,
            latitude,
            longitude,
            last_updated
          `)
          .order('last_updated', { ascending: false });

        if (error) {
          console.error('Error loading drivers:', error);
          return;
        }

        // Get driver details
        const driverIds = data?.map(d => d.driver_id) || [];
        const { data: driversData, error: driversError } = await supabase
          .from('unihub_drivers')
          .select('id, name, "vehicleType", status')
          .in('id', driverIds);

        if (driversError) {
          console.error('Error loading driver details:', driversError);
          return;
        }

        // Update map with real driver locations
        data?.forEach(driverLocation => {
          const driverDetails = driversData?.find(d => d.id === driverLocation.driver_id);
          if (driverDetails && map) {
            const driverIcon = getVehicleIcon(driverDetails.vehicleType);
            
            if (driverMarkersRef.current[driverLocation.driver_id]) {
              // Update existing marker
              driverMarkersRef.current[driverLocation.driver_id].setLatLng([driverLocation.latitude, driverLocation.longitude]);
              driverMarkersRef.current[driverLocation.driver_id].setPopupContent(
                createDriverPopup({
                  driverId: driverLocation.driver_id,
                  lat: driverLocation.latitude,
                  lng: driverLocation.longitude,
                  name: driverDetails.name,
                  vehicleType: driverDetails.vehicleType,
                  status: driverDetails.status
                }, passengerLocation?.lat, passengerLocation?.lng)
              );
            } else {
              // Create new marker
              const marker = window.L.marker([driverLocation.latitude, driverLocation.longitude], { icon: driverIcon })
                .addTo(map)
                .bindPopup(createDriverPopup({
                  driverId: driverLocation.driver_id,
                  lat: driverLocation.latitude,
                  lng: driverLocation.longitude,
                  name: driverDetails.name,
                  vehicleType: driverDetails.vehicleType,
                  status: driverDetails.status
                }, passengerLocation?.lat, passengerLocation?.lng));
              
              driverMarkersRef.current[driverLocation.driver_id] = marker;
            }
          }
        });
      } catch (err) {
        console.error('Failed to load drivers:', err);
      }
    };

    loadRealDrivers();
    const interval = setInterval(loadRealDrivers, 5000); // Update every 5 seconds

    return () => {
      clearInterval(interval);
    };
  }, [map, passengerLocation]);

    // Update drivers on socket "driverLocationUpdate"
    socket.on('driverLocationUpdate', (data: any) => {
      const { driverId, lat, lng, name, vehicleType, status } = data;
      
      setDrivers(prev => {
        const updatedDrivers = { ...prev };
        
        if (updatedDrivers[driverId]) {
          // Update existing driver position
          updatedDrivers[driverId].setLatLng([lat, lng]);
          // Update popup with new info
          updatedDrivers[driverId].setPopupContent(
            createDriverPopup({ driverId, lat, lng, name, vehicleType, status }, passengerLocation?.lat, passengerLocation?.lng)
          );
        } else {
          // Create new driver marker with vehicle-specific icon
          const driverIcon = getVehicleIcon(vehicleType || 'Taxi');
          
          const marker = window.L.marker([lat, lng], { icon: driverIcon })
            .addTo(map)
            .bindPopup(createDriverPopup({ driverId, lat, lng, name, vehicleType, status }, passengerLocation?.lat, passengerLocation?.lng));
          
          updatedDrivers[driverId] = marker;
          
          // Center map on driver if it's the first one
          if (Object.keys(updatedDrivers).length === 1) {
            map.setView([lat, lng], 15);
          }
        }
        
        return updatedDrivers;
      });
    });

    // On "rideAssigned" open Google Maps directions
    socket.on('rideAssigned', (data: any) => {
      const { driverLat, driverLng, passengerLat, passengerLng } = data;
      
      // Open Google Maps directions in new tab
      const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${passengerLat},${passengerLng}&destination=${driverLat},${driverLng}`;
      window.open(directionsUrl, '_blank');
    });

    return () => {
      socket.off('driverLocationUpdate');
      socket.off('rideAssigned');
    };
  }, [socket, isMapReady, map, passengerLocation]);

  // Fallback function for manual ride assignment
  const assignRide = (driverLat: number, driverLng: number, passengerLat: number, passengerLng: number) => {
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${passengerLat},${passengerLng}&destination=${driverLat},${driverLng}`;
    window.open(directionsUrl, '_blank');
  };

  // Function to simulate driver location updates (for testing)
  const simulateDriver = (driverId: string, lat: number, lng: number, name?: string, vehicleType?: string, status?: string) => {
    if (!map) return;
    
    const driverIcon = getVehicleIcon(vehicleType || 'Taxi');
    
    if (drivers[driverId]) {
      // Update existing driver
      drivers[driverId].setLatLng([lat, lng]);
      drivers[driverId].setPopupContent(
        createDriverPopup({ driverId, lat, lng, name, vehicleType, status }, passengerLocation?.lat, passengerLocation?.lng)
      );
    } else {
      // Create new driver
      const marker = window.L.marker([lat, lng], { icon: driverIcon })
        .addTo(map)
        .bindPopup(createDriverPopup({ driverId, lat, lng, name, vehicleType, status }, passengerLocation?.lat, passengerLocation?.lng));
      
      setDrivers(prev => ({ ...prev, [driverId]: marker }));
    }
  };

  // Make functions available globally for testing
  useEffect(() => {
    (window as any).assignRide = assignRide;
    (window as any).simulateDriver = simulateDriver;
  }, []);

  return (
    <div className="relative w-full h-screen">
      <div 
        ref={mapRef} 
        id="tracking-map"
        className="w-full h-full"
      />
      
      {/* Testing Controls */}
      <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-md rounded-2xl p-4 space-y-2 text-white">
        <h3 className="text-sm font-bold mb-2">GPS Tracking Test</h3>
        <button
          onClick={() => simulateDriver('driver1', 5.6037, -0.1870, 'Test Driver 1')}
          className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-medium transition-colors"
        >
          Add Driver (Legon)
        </button>
        <button
          onClick={() => simulateDriver('driver2', 5.6148, -0.2059, 'Test Driver 2')}
          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-xs font-medium transition-colors"
        >
          Add Driver (Mallam)
        </button>
        <button
          onClick={() => assignRide(5.6037, -0.1870, 5.6148, -0.2059)}
          className="w-full px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-medium transition-colors"
        >
          Test Directions
        </button>
        <div className="text-xs text-slate-400 pt-2 border-t border-white/10">
          <p>🚗 Drivers: {Object.keys(drivers).length}</p>
          <p>📍 GPS: {passengerMarker ? 'Active' : 'Waiting...'}</p>
          <p>🔌 Socket: {socket ? 'Connected' : 'Offline'}</p>
        </div>
      </div>
    </div>
  );
};

export default TrackingComponent;
