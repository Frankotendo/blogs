-- SQL Query to display all active Pragia vehicles on the map
-- This query joins driver information with their current locations
-- and filters for vehicles with type 'Pragia'

SELECT 
    d.id AS driver_id,
    d.name AS driver_name,
    d."licensePlate",
    d.contact AS driver_contact,
    d.rating,
    d.status AS driver_status,
    dl.latitude,
    dl.longitude,
    dl.heading,
    dl.speed,
    dl.accuracy,
    dl.last_updated AS location_timestamp,
    -- Format as GeoJSON Point for easy map integration
    ST_SetSRID(ST_MakePoint(dl.longitude::float, dl.latitude::float), 4326) AS geom,
    -- Additional metadata for map display
    json_build_object(
        'driver_id', d.id,
        'driver_name', d.name,
        'vehicle_type', d.vehicleType,
        'license_plate', d."licensePlate",
        'contact', d.contact,
        'rating', d.rating,
        'status', d.status,
        'heading', dl.heading,
        'speed', dl.speed,
        'last_updated', dl.last_updated
    ) AS properties
FROM 
    public.unihub_drivers d
INNER JOIN 
    public.driver_locations dl ON d.id = dl.driver_id
WHERE 
    d.vehicleType = 'Pragia'
    AND d.status = 'online'  -- Only show online drivers
    AND dl.last_updated > NOW() - INTERVAL '30 minutes'  -- Only recent locations
ORDER BY 
    dl.last_updated DESC;
