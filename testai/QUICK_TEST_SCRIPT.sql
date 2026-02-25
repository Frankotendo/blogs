-- ============================================================
-- QUICK INTEGRATION TEST - Run in Supabase SQL Editor
-- ============================================================

-- STEP 1: Verify table structure
SELECT 
    'TABLES CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_locations') THEN '✅ driver_locations exists'
        ELSE '❌ driver_locations missing'
    END as result

UNION ALL

SELECT 
    'TABLES CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'passenger_locations') THEN '✅ passenger_locations exists'
        ELSE '❌ passenger_locations missing'
    END as result

UNION ALL

SELECT 
    'TABLES CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_drivers') THEN '✅ unihub_drivers exists'
        ELSE '❌ unihub_drivers missing'
    END as result;

-- STEP 2: Verify functions exist
SELECT 
    'FUNCTIONS CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_driver_location') THEN '✅ update_driver_location exists'
        ELSE '❌ update_driver_location missing'
    END as result

UNION ALL

SELECT 
    'FUNCTIONS CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'find_nearby_drivers') THEN '✅ find_nearby_drivers exists'
        ELSE '❌ find_nearby_drivers missing'
    END as result

UNION ALL

SELECT 
    'FUNCTIONS CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_passenger_location') THEN '✅ update_passenger_location exists'
        ELSE '❌ update_passenger_location missing'
    END as result;

-- STEP 3: Verify columns match TrackingComponent
SELECT 
    'COLUMNS CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_locations' AND column_name = 'latitude') THEN '✅ driver_locations.latitude'
        ELSE '❌ driver_locations.latitude missing'
    END as result

UNION ALL

SELECT 
    'COLUMNS CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_locations' AND column_name = 'longitude') THEN '✅ driver_locations.longitude'
        ELSE '❌ driver_locations.longitude missing'
    END as result

UNION ALL

SELECT 
    'COLUMNS CHECK' as test,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unihub_drivers' AND column_name = 'vehicleType') THEN '✅ unihub_drivers.vehicleType'
        ELSE '❌ unihub_drivers.vehicleType missing'
    END as result;

-- STEP 4: Test sample data (will rollback)
BEGIN;

-- First, get existing driver data
SELECT 'EXISTING DRIVERS' as test, id, name, "vehicleType", status 
FROM unihub_drivers 
WHERE status = 'online' 
LIMIT 3;

-- Use existing driver for test
SELECT 'TEST DRIVER ID' as test, id as result 
FROM unihub_drivers 
WHERE status = 'online' 
LIMIT 1;

-- Insert test driver location using existing driver
DO $$
DECLARE
    existing_driver_id TEXT;
BEGIN
    SELECT id INTO existing_driver_id 
    FROM unihub_drivers 
    WHERE status = 'online' 
    LIMIT 1;
    
    IF existing_driver_id IS NOT NULL THEN
        INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed, accuracy)
        VALUES (existing_driver_id, 5.6037, -0.1870, 45, 30.5, 10.2)
        ON CONFLICT (driver_id) DO UPDATE SET
            latitude = 5.6037,
            longitude = -0.1870,
            last_updated = NOW();
        
        RAISE NOTICE '✅ Test driver location inserted for: %', existing_driver_id;
    ELSE
        RAISE NOTICE '❌ No online drivers found for testing';
    END IF;
END $$;

-- Insert test passenger location (using existing user if available)
DO $$
DECLARE
    existing_user_id TEXT;
BEGIN
    SELECT id INTO existing_user_id 
    FROM unihub_users 
    LIMIT 1;
    
    IF existing_user_id IS NOT NULL THEN
        INSERT INTO passenger_locations (passenger_id, latitude, longitude, accuracy)
        VALUES (existing_user_id, 5.6038, -0.1871, 5.0)
        ON CONFLICT (passenger_id) DO UPDATE SET
            latitude = 5.6038,
            longitude = -0.1871,
            last_updated = NOW();
        
        RAISE NOTICE '✅ Test passenger location inserted for: %', existing_user_id;
    ELSE
        -- Insert with dummy user if no users exist
        INSERT INTO passenger_locations (passenger_id, latitude, longitude, accuracy)
        VALUES ('TEST-USER-001', 5.6038, -0.1871, 5.0)
        ON CONFLICT (passenger_id) DO UPDATE SET
            latitude = 5.6038,
            longitude = -0.1871,
            last_updated = NOW();
        
        RAISE NOTICE '✅ Test passenger location inserted with dummy ID';
    END IF;
END $$;

-- Test functions with existing data
DO $$
DECLARE
    existing_driver_id TEXT;
BEGIN
    SELECT id INTO existing_driver_id 
    FROM unihub_drivers 
    WHERE status = 'online' 
    LIMIT 1;
    
    IF existing_driver_id IS NOT NULL THEN
        PERFORM update_driver_location(existing_driver_id, 5.6037, -0.1870, 45, 30.5, 10.2);
        RAISE NOTICE '✅ update_driver_location function test passed';
    ELSE
        RAISE NOTICE '❌ Cannot test update_driver_location - no online drivers';
    END IF;
END $$;

-- Test passenger location function (only if user exists)
DO $$
DECLARE
    existing_user_id TEXT;
    test_result BOOLEAN;
BEGIN
    SELECT id INTO existing_user_id 
    FROM unihub_users 
    LIMIT 1;
    
    IF existing_user_id IS NOT NULL THEN
        test_result := update_passenger_location(existing_user_id, 5.6038, -0.1871, 5.0);
        RAISE NOTICE '✅ update_passenger_location function test passed for user: %', existing_user_id;
    ELSE
        RAISE NOTICE '❌ Cannot test update_passenger_location - no users exist in unihub_users';
    END IF;
END $$;

-- Test nearby drivers function
SELECT 'NEARBY DRIVERS' as test, COUNT(*) as result FROM find_nearby_drivers(5.6037, -0.1870, 10);

-- Show test data
SELECT 'TEST LOCATIONS' as test, driver_id, latitude, longitude, last_updated 
FROM driver_locations 
WHERE driver_id IN (SELECT id FROM unihub_drivers WHERE status = 'online' LIMIT 3);

ROLLBACK;

-- FINAL SUMMARY
SELECT 
    'INTEGRATION SUMMARY' as test,
    'All tests completed - Check results above' as result;
