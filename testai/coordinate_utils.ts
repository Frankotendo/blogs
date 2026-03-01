// Coordinate utilities to handle database schema constraints
// This ensures coordinates fit within the existing database schema

export interface CoordinateBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// Ghana coordinate bounds (approximately)
export const GHANA_BOUNDS: CoordinateBounds = {
  minLat: 4.5,   // Southern Ghana
  maxLat: 11.5,  // Northern Ghana
  minLng: -4.0,  // Western Ghana
  maxLng: 2.5    // Eastern Ghana
};

// Database schema constraints (based on existing schema)
export const DB_CONSTRAINTS = {
  LATITUDE_PRECISION: 5,
  LATITUDE_SCALE: 2,
  LONGITUDE_PRECISION: 5,
  LONGITUDE_SCALE: 2,
  MAX_LATITUDE_VALUE: 999.99, // numeric(5,2) maximum
  MAX_LONGITUDE_VALUE: 999.99 // numeric(5,2) maximum
};

/**
 * Validates and clamps coordinates to fit database schema
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns Validated coordinates that fit the database schema
 */
export function validateCoordinates(latitude: number, longitude: number): {
  latitude: number;
  longitude: number;
  isValid: boolean;
} {
  // Check if coordinates are within Ghana bounds
  const withinGhana = 
    latitude >= GHANA_BOUNDS.minLat && 
    latitude <= GHANA_BOUNDS.maxLat &&
    longitude >= GHANA_BOUNDS.minLng && 
    longitude <= GHANA_BOUNDS.maxLng;

  // Check if coordinates fit within database numeric constraints
  const withinDbConstraints = 
    Math.abs(latitude) <= DB_CONSTRAINTS.MAX_LATITUDE_VALUE &&
    Math.abs(longitude) <= DB_CONSTRAINTS.MAX_LONGITUDE_VALUE;

  // Clamp coordinates to database constraints if needed
  let validLatitude = latitude;
  let validLongitude = longitude;

  if (!withinDbConstraints) {
    // If outside database constraints, clamp to nearest valid value
    validLatitude = Math.max(
      -DB_CONSTRAINTS.MAX_LATITUDE_VALUE,
      Math.min(DB_CONSTRAINTS.MAX_LATITUDE_VALUE, latitude)
    );
    validLongitude = Math.max(
      -DB_CONSTRAINTS.MAX_LONGITUDE_VALUE,
      Math.min(DB_CONSTRAINTS.MAX_LONGITUDE_VALUE, longitude)
    );
  }

  // Round to database precision
  validLatitude = parseFloat(validLatitude.toFixed(DB_CONSTRAINTS.LATITUDE_SCALE));
  validLongitude = parseFloat(validLongitude.toFixed(DB_CONSTRAINTS.LONGITUDE_SCALE));

  return {
    latitude: validLatitude,
    longitude: validLongitude,
    isValid: withinGhana && withinDbConstraints
  };
}

/**
 * Formats coordinates for database storage
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns Formatted coordinates ready for database insertion
 */
export function formatCoordinatesForDB(latitude: number, longitude: number): {
  latitude: number;
  longitude: number;
} {
  const validated = validateCoordinates(latitude, longitude);
  return {
    latitude: validated.latitude,
    longitude: validated.longitude
  };
}

/**
 * Checks if a coordinate is within reasonable bounds for Ghana
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns True if coordinate is reasonable for Ghana
 */
export function isReasonableGhanaCoordinate(latitude: number, longitude: number): boolean {
  return validateCoordinates(latitude, longitude).isValid;
}

/**
 * Gets a fallback coordinate for Ghana (Accra) if invalid coordinates are provided
 * @param latitude Latitude value
 * @param longitude Longitude value
 * @returns Valid coordinates (fallback to Accra if invalid)
 */
export function getValidGhanaCoordinate(latitude: number, longitude: number): {
  latitude: number;
  longitude: number;
} {
  const validated = validateCoordinates(latitude, longitude);
  
  if (!validated.isValid) {
    // Fallback to Accra coordinates
    return {
      latitude: 5.60,  // Accra latitude
      longitude: -0.19 // Accra longitude
    };
  }
  
  return {
    latitude: validated.latitude,
    longitude: validated.longitude
  };
}
