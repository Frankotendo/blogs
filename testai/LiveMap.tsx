import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { useLiveTracking, LiveLocation } from './useLiveTracking';
import {
  createBusIcon,
  createPassengerIcon,
  createDirectionArrow,
  animateMarker,
  createPopupContent,
  calculateDistance,
} from './mapUtils';
import MapContainerWrapper from './MapContainer';
import { createClient } from '@supabase/supabase-js';
import 'leaflet/dist/leaflet.css';

const supabase = createClient(
  'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw'
);

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface LiveMapProps {
  userId: string;
  role: 'driver' | 'passenger';
  vehicleLabel?: string;
  center?: [number, number];
  zoom?: number;
  onLocationUpdate?: (location: { lat: number; lng: number }) => void;
}

// Component to handle map centering and bounds
const MapController: React.FC<{
  center?: [number, number];
  userLocation?: { lat: number; lng: number };
  locations: LiveLocation[];
  role: 'driver' | 'passenger';
}> = ({ center, userLocation, locations, role }) => {
  const map = useMap();
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 15);
    }
  }, [center, userLocation, map]);

  // Fit map to show all relevant markers
  useEffect(() => {
    if (locations.length > 0) {
      const bounds = L.latLngBounds([]);
      
      // Add user location if available
      if (userLocation) {
        bounds.extend([userLocation.lat, userLocation.lng]);
      }
      
      // Add other locations
      locations.forEach((location) => {
        bounds.extend([location.lat, location.lng]);
      });
      
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [locations, userLocation, map]);

  return null;
};

const LiveMap: React.FC<LiveMapProps> = ({
  userId,
  role,
  vehicleLabel,
  center,
  zoom = 15,
  onLocationUpdate,
}) => {
  const [mapCenter, setMapCenter] = useState<[number, number]>([5.6037, -0.1870]); // Default to Accra
  const [isClient, setIsClient] = useState(false);

  const {
    currentLocation,
    allLocations,
    isTracking,
    error,
    startTracking,
    stopTracking,
  } = useLiveTracking({
    userId,
    role,
    vehicleLabel,
    updateInterval: 1000,
  });

  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  // Handle client-side rendering
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update map center when user location changes
  useEffect(() => {
    if (currentLocation) {
      setMapCenter([currentLocation.lat, currentLocation.lng]);
      onLocationUpdate?.(currentLocation);
    }
  }, [currentLocation, onLocationUpdate]);

  // Filter locations based on role
  const relevantLocations = allLocations.filter(
    (location) => location.user_id !== userId
  );

  // Start tracking automatically
  useEffect(() => {
    if (isClient) {
      startTracking();
    }
    
    return () => {
      stopTracking();
    };
  }, [isClient, startTracking, stopTracking]);

  if (!isClient) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        backgroundColor: '#f3f4f6'
      }}>
        <div>Loading map...</div>
      </div>
    );
  }

  return (
    <MapContainerWrapper
      title={`${role === 'passenger' ? 'Passenger' : 'Driver'} Live Tracking`}
      isMaximized={false}
      onMaximize={() => {}}
      onMinimize={() => {}}
      onClose={() => {}}
      onRefresh={() => {
        // Force refresh of all locations
        const refreshLocations = async () => {
          try {
            const { data, error } = await supabase
              .from('live_locations')
              .select('*')
              .order('updated_at', { ascending: false });
            
            if (!error && data) {
              // Update the allLocations state from useLiveTracking hook
              // This will trigger a re-render with fresh data
            }
          } catch (err) {
            console.error('Error refreshing locations:', err);
          }
        };
        refreshLocations();
      }}
    >
      <div style={{ height: '100%', width: '100%', position: 'relative' }}>
        {/* Tracking Status */}
        <div style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.9)',
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          fontSize: '12px',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isTracking ? '#10b981' : '#ef4444',
            }} />
            <span style={{ color: '#f1f5f9' }}>{isTracking ? 'Tracking' : 'Not Tracking'}</span>
          </div>
          {currentLocation && (
            <div style={{ marginTop: '4px', fontSize: '10px', color: '#94a3b8' }}>
              Speed: {currentLocation.speed.toFixed(1)} km/h
            </div>
          )}
          {error && (
            <div style={{ marginTop: '4px', fontSize: '10px', color: '#ef4444' }}>
              {error}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.9)',
          padding: '8px 12px',
          borderRadius: '6px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
          fontSize: '12px',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(148, 163, 184, 0.2)'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px', color: '#f1f5f9' }}>
            {role === 'passenger' ? 'Passenger View' : 'Driver View'}
          </div>
          {role === 'passenger' ? (
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Blue: You • Red: Available buses
            </div>
          ) : (
            <div style={{ fontSize: '10px', color: '#94a3b8' }}>
              Red: You • Blue: Passengers
            </div>
          )}
        </div>

        <MapContainer
          center={center || mapCenter}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <MapController
            center={center}
            userLocation={currentLocation}
            locations={relevantLocations}
            role={role}
          />

          {/* User's own marker */}
          {currentLocation && (
            <Marker
              position={[currentLocation.lat, currentLocation.lng]}
              icon={role === 'driver' ? createBusIcon(vehicleLabel) : createPassengerIcon()}
            >
              <Popup>
                <div style={{ minWidth: '150px' }}>
                  <h4 style={{ margin: '0 0 8px 0' }}>
                    {role === 'driver' ? (vehicleLabel || 'Your Vehicle') : 'Your Location'}
                  </h4>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#6b7280' }}>
                    Speed: {currentLocation.speed.toFixed(1)} km/h
                  </p>
                  <p style={{ margin: '4px 0', fontSize: '12px', color: '#6b7280' }}>
                    Heading: {Math.round(currentLocation.heading)}°
                  </p>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Other locations */}
          {relevantLocations.map((location) => {
            const isDriver = location.role === 'driver';
            const distance = currentLocation 
              ? calculateDistance(
                  currentLocation.lat,
                  currentLocation.lng,
                  location.lat,
                  location.lng
                )
              : 0;

            return (
              <Marker
                key={location.user_id}
                position={[location.lat, location.lng]}
                icon={isDriver ? createBusIcon(location.vehicle_label) : createPassengerIcon()}
              >
                <Popup>
                  {createPopupContent(location)}
                  {currentLocation && (
                    <p style={{ margin: '4px 0', fontSize: '12px', color: '#6b7280' }}>
                      Distance: {distance.toFixed(2)} km
                    </p>
                  )}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    </MapContainerWrapper>
  );
};

export default LiveMap;
