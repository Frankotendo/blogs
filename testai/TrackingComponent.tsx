import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    L: any;
    io: any;
  }
}

const TrackingComponent: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [drivers, setDrivers] = useState<any>({});
  const [passengerMarker, setPassengerMarker] = useState<any>(null);
  const [socket, setSocket] = useState<any>(null);
  const [map, setMap] = useState<any>(null);

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
          
          if (passengerMarker) {
            passengerMarker.setLatLng([latitude, longitude]);
          } else {
            const passengerIcon = window.L.divIcon({
              html: '👤',
              iconSize: [30, 30],
              className: 'passenger-marker'
            });
            
            const marker = window.L.marker([latitude, longitude], { icon: passengerIcon })
              .addTo(leafletMap)
              .bindPopup('Your Location');
            
            setPassengerMarker(marker);
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

    // Update drivers on socket "driverLocationUpdate"
    socket.on('driverLocationUpdate', (data: any) => {
      const { driverId, lat, lng, name } = data;
      
      setDrivers(prev => {
        const updatedDrivers = { ...prev };
        
        if (updatedDrivers[driverId]) {
          // Update existing driver position
          updatedDrivers[driverId].setLatLng([lat, lng]);
        } else {
          // Create new driver marker
          const driverIcon = window.L.divIcon({
            html: '🚗',
            iconSize: [30, 30],
            className: 'driver-marker'
          });
          
          const marker = window.L.marker([lat, lng], { icon: driverIcon })
            .addTo(map)
            .bindPopup(name || `Driver ${driverId}`);
          
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
  }, [socket, isMapReady, map]);

  // Fallback function for manual ride assignment
  const assignRide = (driverLat: number, driverLng: number, passengerLat: number, passengerLng: number) => {
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${passengerLat},${passengerLng}&destination=${driverLat},${driverLng}`;
    window.open(directionsUrl, '_blank');
  };

  // Function to simulate driver location updates (for testing)
  const simulateDriver = (driverId: string, lat: number, lng: number, name?: string) => {
    if (!map) return;
    
    setDrivers(prev => {
      const updatedDrivers = { ...prev };
      
      if (updatedDrivers[driverId]) {
        updatedDrivers[driverId].setLatLng([lat, lng]);
      } else {
        const driverIcon = window.L.divIcon({
          html: '🚗',
          iconSize: [30, 30],
          className: 'driver-marker'
        });
        
        const marker = window.L.marker([lat, lng], { icon: driverIcon })
          .addTo(map)
          .bindPopup(name || `Driver ${driverId}`);
        
        updatedDrivers[driverId] = marker;
      }
      
      return updatedDrivers;
    });
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
