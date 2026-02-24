import L from 'leaflet';

// Custom icon creation for different roles
export const createCustomIcon = (role: 'driver' | 'passenger', heading: number = 0): L.Icon => {
  const isDriver = role === 'driver';
  
  // SVG icons for better quality and rotation support
  const svgIcon = isDriver ? 
    `<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${heading} 16 16)">
        <rect x="8" y="12" width="16" height="8" fill="#dc2626" stroke="#991b1b" stroke-width="1" rx="2"/>
        <rect x="10" y="8" width="12" height="6" fill="#ef4444" stroke="#dc2626" stroke-width="1" rx="1"/>
        <circle cx="12" cy="18" r="2" fill="#ffffff"/>
        <circle cx="20" cy="18" r="2" fill="#ffffff"/>
        <text x="16" y="28" text-anchor="middle" fill="#dc2626" font-size="8" font-weight="bold">BUS</text>
      </g>
    </svg>` :
    `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(${heading} 12 12)">
        <circle cx="12" cy="12" r="8" fill="#2563eb" stroke="#1d4ed8" stroke-width="2"/>
        <circle cx="12" cy="10" r="3" fill="#ffffff"/>
        <path d="M12 13 Q12 16 10 18 Q12 17 14 18 Q12 16 12 13" fill="#ffffff"/>
      </g>
    </svg>`;

  return L.divIcon({
    html: svgIcon,
    className: 'custom-marker',
    iconSize: isDriver ? [32, 32] : [24, 24],
    iconAnchor: isDriver ? [16, 16] : [12, 12],
    popupAnchor: isDriver ? [0, -16] : [0, -12],
  });
};

// Position interpolation for smooth animation
export const interpolatePosition = (
  from: [number, number],
  to: [number, number],
  progress: number
): [number, number] => {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  
  // Linear interpolation for simplicity
  // For more realistic movement, you could use geodesic interpolation
  const lat = lat1 + (lat2 - lat1) * progress;
  const lng = lng1 + (lng2 - lng1) * progress;
  
  return [lat, lng];
};

// Calculate distance between two points in kilometers
export const calculateDistance = (
  point1: [number, number],
  point2: [number, number]
): number => {
  const [lat1, lng1] = point1;
  const [lat2, lng2] = point2;
  
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

// Calculate bearing from point1 to point2
export const calculateBearing = (
  point1: [number, number],
  point2: [number, number]
): number => {
  const [lat1, lng1] = point1;
  const [lat2, lng2] = point2;
  
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
           Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
};

// Format speed display
export const formatSpeed = (speedKmh: number): string => {
  if (speedKmh < 0.1) return '0 km/h';
  return `${speedKmh.toFixed(1)} km/h`;
};

// Format time ago
export const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const time = new Date(timestamp);
  const diffMs = now.getTime() - time.getTime();
  
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  
  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return time.toLocaleDateString();
};

// Generate vehicle label suggestions
export const generateVehicleLabels = (count: number): string[] => {
  const labels = [];
  for (let i = 1; i <= count; i++) {
    labels.push(`Bus ${i}`);
  }
  return labels;
};

// Check if a point is within a certain radius of another point
export const isWithinRadius = (
  point1: [number, number],
  point2: [number, number],
  radiusKm: number
): boolean => {
  const distance = calculateDistance(point1, point2);
  return distance <= radiusKm;
};

// Get map bounds that include all points with padding
export const getBoundsForPoints = (
  points: [number, number][],
  padding: number = 0.01
): L.LatLngBounds => {
  if (points.length === 0) {
    return L.latLngBounds([[5.6037 - padding, -0.1870 - padding], [5.6037 + padding, -0.1870 + padding]]);
  }
  
  const lats = points.map(p => p[0]);
  const lngs = points.map(p => p[1]);
  
  const minLat = Math.min(...lats) - padding;
  const maxLat = Math.max(...lats) + padding;
  const minLng = Math.min(...lngs) - padding;
  const maxLng = Math.max(...lngs) + padding;
  
  return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
};

// Debounce function for throttling updates
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle function for rate limiting
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};
