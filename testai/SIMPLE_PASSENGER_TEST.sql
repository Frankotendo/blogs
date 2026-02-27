-- ============================================================
-- SIMPLE PASSENGER GPS TEST (NO HEADING/SPEED)
-- ============================================================

-- 1. Check what columns exist in passenger_locations
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'passenger_locations' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Create test user first
INSERT INTO unihub_users (id, username, phone)
VALUES ('test_user_001', 'Test Passenger', '+233123456789')
ON CONFLICT (id) 
DO UPDATE SET
    username = EXCLUDED.username,
    phone = EXCLUDED.phone;

-- 2.1. Create test driver (since SAMPLE_DRIVER_001 doesn't exist)
INSERT INTO unihub_drivers (id, name, "vehicleType", status, pin)
VALUES ('TEST_DRIVER_001', 'Test Driver', 'Taxi', 'online', '1234')
ON CONFLICT (id) 
DO UPDATE SET
    name = EXCLUDED.name,
    "vehicleType" = EXCLUDED."vehicleType",
    status = EXCLUDED.status,
    pin = EXCLUDED.pin;

-- 3. Insert test passenger location (only existing columns)
INSERT INTO passenger_locations (passenger_id, latitude, longitude, accuracy)
VALUES ('test_user_001', 5.6037, -0.1870, 10)
ON CONFLICT (passenger_id) 
DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy = EXCLUDED.accuracy,
    last_updated = NOW();

-- 4. Create test ride with passenger
INSERT INTO unihub_nodes (
    id, 
    origin, 
    destination, 
    status, 
    passengers, 
    "assignedDriverId",
    passenger_latitude,
    passenger_longitude,
    passenger_last_update
) VALUES (
    'test_ride_001',
    'Accra Mall',
    'Airport',
    'dispatched',
    '[{"id": "test_user_001", "name": "Test Passenger"}]',
    'TEST_DRIVER_001',
    5.6037,
    -0.1870,
    NOW()
) ON CONFLICT (id) 
DO UPDATE SET
    status = EXCLUDED.status,
    "assignedDriverId" = EXCLUDED."assignedDriverId",
    passenger_latitude = EXCLUDED.passenger_latitude,
    passenger_longitude = EXCLUDED.passenger_longitude,
    passenger_last_update = EXCLUDED.passenger_last_update;

-- 5. Update test passenger location (simulate movement)
UPDATE passenger_locations 
SET 
    latitude = 5.6147,
    longitude = -0.1970,
    last_updated = NOW()
WHERE passenger_id = 'test_user_001';

-- 6. Update ride with new passenger location
UPDATE unihub_nodes 
SET 
    passenger_latitude = 5.6147,
    passenger_longitude = -0.1970,
    passenger_last_update = NOW()
WHERE id = 'test_ride_001';

-- 7. Verify data
SELECT 
    'Passenger Location Test' as test_type,
    passenger_id,
    latitude,
    longitude,
    last_updated
FROM passenger_locations 
WHERE passenger_id = 'test_user_001';

SELECT 
    'Ride Data Test' as test_type,
    id,
    status,
    "assignedDriverId",
    passenger_latitude,
    passenger_longitude,
    passenger_last_update
FROM unihub_nodes 
WHERE id = 'test_ride_001';

-- 8. Simulate passenger movement (run multiple times)
UPDATE passenger_locations 
SET 
    latitude = latitude + 0.001,
    longitude = longitude + 0.001,
    last_updated = NOW()
WHERE passenger_id = 'test_user_001';

UPDATE unihub_nodes 
SET 
    passenger_latitude = (SELECT latitude FROM passenger_locations WHERE passenger_id = 'test_user_001'),
    passenger_longitude = (SELECT longitude FROM passenger_locations WHERE passenger_id = 'test_user_001'),
    passenger_last_update = NOW()
WHERE id = 'test_ride_001';
