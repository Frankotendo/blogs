import L from 'leaflet';
import { LiveLocation } from './useLiveTracking';

// Custom icon for buses/vehicles
export const createBusIcon = (label?: string) => {
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        background: #dc2626;
        border: 2px solid white;
        border-radius: 50%;
        width: 40px;
        height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z"/>
        </svg>
        ${label ? `
          <div style="
            position: absolute;
            top: -25px;
            background: rgba(0,0,0,0.8);
            color: white;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 12px;
            white-space: nowrap;
            font-weight: bold;
          ">${label}</div>
        ` : ''}
      </div>
    `,
    className: 'custom-bus-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20],
  });
};

// Custom icon for passengers
export const createPassengerIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        position: relative;
        background: #2563eb;
        border: 2px solid white;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    `,
    className: 'custom-passenger-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

// Direction arrow icon
export const createDirectionArrow = (heading: number) => {
  return L.divIcon({
    html: `
      <div style="
        position: absolute;
        transform: rotate(${heading}deg);
        width: 20px;
        height: 20px;
        margin-left: -10px;
        margin-top: -10px;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#fbbf24">
          <path d="M12 2l-5.5 9h3.5v7l5.5-9h-3.5z"/>
        </svg>
      </div>
    `,
    className: 'direction-arrow',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Smooth animation for marker movement
export const animateMarker = (
  marker: L.Marker,
  newPosition: [number, number],
  duration: number = 1000
) => {
  const startPos = marker.getLatLng();
  const endPos = L.latLng(newPosition[0], newPosition[1]);
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function for smooth animation
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    const currentLat = startPos.lat + (endPos.lat - startPos.lat) * easeProgress;
    const currentLng = startPos.lng + (endPos.lng - startPos.lng) * easeProgress;
    
    marker.setLatLng([currentLat, currentLng]);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };
  
  requestAnimationFrame(animate);
};

// Create popup content for location
export const createPopupContent = (location: LiveLocation) => {
  const lastUpdated = new Date(location.updated_at).toLocaleTimeString();
  const speedKmh = location.speed.toFixed(1);
  
  return `
    <div style="min-width: 150px;">
      <h4 style="margin: 0 0 8px 0; color: #1f2937;">
        ${location.vehicle_label || `${location.role.charAt(0).toUpperCase() + location.role.slice(1)}`}
      </h4>
      <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
        <strong>Role:</strong> ${location.role}
      </p>
      <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
        <strong>Speed:</strong> ${speedKmh} km/h
      </p>
      <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
        <strong>Heading:</strong> ${Math.round(location.heading)}°
      </p>
      <p style="margin: 4px 0; font-size: 12px; color: #6b7280;">
        <strong>Last updated:</strong> ${lastUpdated}
      </p>
    </div>
  `;
};

// Calculate distance between two points in km
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};
