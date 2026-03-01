-- Alternative views for Pragia map display
-- Choose the appropriate query based on your mapping needs

-- 1. Simple coordinates format (for basic map implementations)
SELECT 
    d.id,
    d.name,
    d."licensePlate",
    d.contact,
    d.rating,
    dl.latitude::float AS lat,
    dl.longitude::float AS lng,
    dl.heading,
    dl.speed,
    d.status,
    dl.last_updated
FROM public.unihub_drivers d
INNER JOIN public.driver_locations dl ON d.id = dl.driver_id
WHERE d.vehicleType = 'Pragia' AND d.status = 'online';

-- 2. GeoJSON Feature Collection (for advanced mapping libraries)
SELECT 
    json_build_object(
        'type', 'FeatureCollection',
        'features', json_agg(
            json_build_object(
                'type', 'Feature',
                'geometry', json_build_object(
                    'type', 'Point',
                    'coordinates', json_build_array(dl.longitude::float, dl.latitude::float)
                ),
                'properties', json_build_object(
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
                )
            )
        )
    ) AS geojson_features
FROM public.unihub_drivers d
INNER JOIN public.driver_locations dl ON d.id = dl.driver_id
WHERE d.vehicleType = 'Pragia' AND d.status = 'online'
AND dl.last_updated > NOW() - INTERVAL '30 minutes';

-- 3. Real-time tracking view (includes passenger info if on active trip)
SELECT 
    d.id AS driver_id,
    d.name AS driver_name,
    d."licensePlate",
    d.contact,
    d.rating,
    dl.latitude::float AS lat,
    dl.longitude::float AS lng,
    dl.heading,
    dl.speed,
    d.status,
    dl.last_updated,
    -- Check if driver is on active trip
    CASE 
        WHEN n.id IS NOT NULL THEN 
            json_build_object(
                'trip_id', n.id,
                'origin', n.origin,
                'destination', n.destination,
                'passengers', n.passengers,
                'status', n.status
            )
        ELSE NULL
    END AS active_trip
FROM public.unihub_drivers d
INNER JOIN public.driver_locations dl ON d.id = dl.driver_id
LEFT JOIN public.unihub_nodes n ON d.id = n.assignedDriverId 
    AND n.status IN ('dispatched', 'qualified')
WHERE d.vehicleType = 'Pragia' AND d.status = 'online'
AND dl.last_updated > NOW() - INTERVAL '30 minutes';
