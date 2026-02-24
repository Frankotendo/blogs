import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLiveTracking } from '../hooks/useLiveTracking';
import { createCustomIcon, interpolatePosition } from '../utils/mapHelpers';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LiveMapProps {
  userRole: 'driver' | 'passenger';
  userId: string;
  vehicleLabel?: string;
  center?: [number, number];
  zoom?: number;
}

// Component to handle map center updates
const MapController: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  
  return null;
};

// Animated marker component
const AnimatedMarker: React.FC<{
  position: [number, number];
  icon: L.Icon;
  title: string;
  children?: React.ReactNode;
}> = ({ position, icon, title, children }) => {
  const [currentPosition, setCurrentPosition] = useState(position);
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    const animationDuration = 1000; // 1 second
    const steps = 30;
    const stepDuration = animationDuration / steps;
    
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step <= steps) {
        const interpolated = interpolatePosition(currentPosition, position, step / steps);
        setCurrentPosition(interpolated);
      } else {
        clearInterval(interval);
      }
    }, stepDuration);

    return () => clearInterval(interval);
  }, [position]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(currentPosition);
    }
  }, [currentPosition]);

  return (
    <Marker position={currentPosition} icon={icon} ref={markerRef}>
      {children}
    </Marker>
  );
};

export const LiveMap: React.FC<LiveMapProps> = ({
  userRole,
  userId,
  vehicleLabel,
  center = [5.6037, -0.1870], // Default to Accra, Ghana
  zoom = 15
}) => {
  const {
    liveLocations,
    userLocation,
    isTracking,
    error,
    startTracking,
    stopTracking
  } = useLiveTracking(userId, userRole, vehicleLabel);

  const [mapCenter, setMapCenter] = useState<[number, number]>(center);
  const [mapZoom] = useState(zoom);

  useEffect(() => {
    startTracking();
    return () => {
      stopTracking();
    };
  }, [startTracking, stopTracking]);

  useEffect(() => {
    if (userLocation) {
      setMapCenter([userLocation.lat, userLocation.lng]);
    }
  }, [userLocation]);

  // Filter locations based on role
  const otherDrivers = liveLocations.filter(loc => loc.role === 'driver' && loc.user_id !== userId);
  const otherPassengers = liveLocations.filter(loc => loc.role === 'passenger' && loc.user_id !== userId);

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-red-600">
          <p className="font-semibold">Location Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-96 rounded-lg overflow-hidden border border-gray-300">
      {/* Loading indicator */}
      {!isTracking && (
        <div className="absolute top-4 left-4 z-10 bg-white px-3 py-2 rounded-lg shadow-md">
          <p className="text-sm text-gray-600">Initializing location tracking...</p>
        </div>
      )}

      {/* Status indicator */}
      <div className="absolute top-4 right-4 z-10 bg-white px-3 py-2 rounded-lg shadow-md">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${isTracking ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-sm font-medium">
            {isTracking ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="w-full h-full"
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        <MapController center={mapCenter} zoom={mapZoom} />

        {/* User's own location */}
        {userLocation && (
          <AnimatedMarker
            position={[userLocation.lat, userLocation.lng]}
            icon={createCustomIcon(userRole, userLocation.heading)}
            title={userRole === 'driver' ? vehicleLabel || 'Your Vehicle' : 'Your Location'}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">
                  {userRole === 'driver' ? vehicleLabel || 'Your Vehicle' : 'Your Location'}
                </p>
                <p>Speed: {userLocation.speed.toFixed(1)} km/h</p>
                <p>Heading: {userLocation.heading.toFixed(0)}°</p>
                <p>Last updated: {new Date(userLocation.updated_at).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </AnimatedMarker>
        )}

        {/* Other drivers (for passengers) */}
        {userRole === 'passenger' && otherDrivers.map((driver) => (
          <AnimatedMarker
            key={driver.user_id}
            position={[driver.lat, driver.lng]}
            icon={createCustomIcon('driver', driver.heading)}
            title={driver.vehicle_label || `Driver ${driver.user_id.slice(0, 8)}`}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{driver.vehicle_label || `Driver ${driver.user_id.slice(0, 8)}`}</p>
                <p>Speed: {driver.speed.toFixed(1)} km/h</p>
                <p>Heading: {driver.heading.toFixed(0)}°</p>
                <p>Last updated: {new Date(driver.updated_at).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </AnimatedMarker>
        ))}

        {/* Other passengers (for drivers) */}
        {userRole === 'driver' && otherPassengers.map((passenger) => (
          <AnimatedMarker
            key={passenger.user_id}
            position={[passenger.lat, passenger.lng]}
            icon={createCustomIcon('passenger', passenger.heading)}
            title={`Passenger ${passenger.user_id.slice(0, 8)}`}
          >
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">Passenger {passenger.user_id.slice(0, 8)}</p>
                <p>Speed: {passenger.speed.toFixed(1)} km/h</p>
                <p>Heading: {passenger.heading.toFixed(0)}°</p>
                <p>Last updated: {new Date(passenger.updated_at).toLocaleTimeString()}</p>
              </div>
            </Popup>
          </AnimatedMarker>
        ))}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-white px-3 py-2 rounded-lg shadow-md">
        <div className="text-xs space-y-1">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            <span>{userRole === 'passenger' ? 'Your Location' : 'Your Vehicle'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <span>{userRole === 'passenger' ? 'Available Drivers' : 'Passengers'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
