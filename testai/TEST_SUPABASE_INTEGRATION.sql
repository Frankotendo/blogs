-- ============================================================
-- TEST SUPABASE INTEGRATION - Verify Location Tracking Setup
-- Run these commands in Supabase SQL Editor to test integration
-- ============================================================

-- 1. Test if location tracking tables exist and are properly structured
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('driver_locations', 'passenger_locations', 'unihub_drivers', 'unihub_nodes')
    AND column_name LIKE '%latitude%' 
    OR column_name LIKE '%longitude%'
    OR column_name LIKE '%location%'
ORDER BY table_name, ordinal_position;

-- 2. Test foreign key relationships
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('driver_locations', 'passenger_locations', 'unihub_nodes');

-- 3. Test if functions exist
SELECT 
    proname AS function_name,
    pg_get_function_arguments(oid) AS arguments,
    pg_get_function_result(oid) AS return_type
FROM pg_proc 
WHERE proname IN (
    'update_driver_location', 
    'update_passenger_location', 
    'find_nearby_drivers',
    'get_driver_location',
    'get_passenger_location',
    'update_node_locations'
)
AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 4. Test if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    forcerlspolicy
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('driver_locations', 'passenger_locations');

-- 5. Test if policies exist
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename IN ('driver_locations', 'passenger_locations');

-- 6. Test sample data insertion (will rollback)
BEGIN;

-- Test driver location update function
SELECT update_driver_location(
    'TEST-001', 
    5.6037, 
    -0.1870, 
    45, 
    30.5, 
    10.2
) AS driver_location_test;

-- Test passenger location update function  
SELECT update_passenger_location(
    'USER-001',
    5.6038,
    -0.1871,
    5.0
) AS passenger_location_test;

-- Test find nearby drivers function
SELECT * FROM find_nearby_drivers(5.6037, -0.1870, 10, 'Taxi') LIMIT 5;

-- Test get driver location function
SELECT * FROM get_driver_location('TEST-001');

-- Test get passenger location function
SELECT * FROM get_passenger_location('USER-001');

ROLLBACK;

-- 7. Test real-time subscriptions setup
-- This checks if the tables can be used for real-time subscriptions
SELECT 
    schemaname,
    tablename,
    hasindexes,
    hasrules,
    hastriggers
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('driver_locations', 'passenger_locations', 'unihub_drivers');

-- 8. Test indexes for performance
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE schemaname = 'public' 
    AND tablename IN ('driver_locations', 'passenger_locations', 'unihub_nodes')
    AND (indexname LIKE '%location%' OR indexname LIKE '%driver%' OR indexname LIKE '%passenger%');

-- 9. Verify data types match TrackingComponent expectations
SELECT 
    'driver_locations' as table_name,
    column_name,
    data_type,
    CASE 
        WHEN column_name = 'latitude' AND data_type = 'numeric' THEN '✅ OK'
        WHEN column_name = 'longitude' AND data_type = 'numeric' THEN '✅ OK'
        WHEN column_name = 'driver_id' AND data_type = 'text' THEN '✅ OK'
        ELSE '❌ Check'
    END as status
FROM information_schema.columns 
WHERE table_name = 'driver_locations' 
    AND column_name IN ('latitude', 'longitude', 'driver_id')

UNION ALL

SELECT 
    'passenger_locations' as table_name,
    column_name,
    data_type,
    CASE 
        WHEN column_name = 'latitude' AND data_type = 'numeric' THEN '✅ OK'
        WHEN column_name = 'longitude' AND data_type = 'numeric' THEN '✅ OK'
        WHEN column_name = 'passenger_id' AND data_type = 'text' THEN '✅ OK'
        ELSE '❌ Check'
    END as status
FROM information_schema.columns 
WHERE table_name = 'passenger_locations' 
    AND column_name IN ('latitude', 'longitude', 'passenger_id')

UNION ALL

SELECT 
    'unihub_drivers' as table_name,
    column_name,
    data_type,
    CASE 
        WHEN column_name = 'vehicleType' AND data_type = 'text' THEN '✅ OK'
        WHEN column_name = 'status' AND data_type = 'text' THEN '✅ OK'
        WHEN column_name = 'name' AND data_type = 'text' THEN '✅ OK'
        ELSE '❌ Check'
    END as status
FROM information_schema.columns 
WHERE table_name = 'unihub_drivers' 
    AND column_name IN ('vehicleType', 'status', 'name');

-- 10. Integration Summary Report
SELECT 
    'Integration Test Results' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_locations') THEN '✅ driver_locations table exists'
        ELSE '❌ driver_locations table missing'
    END as result

UNION ALL

SELECT 
    'Integration Test Results' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'passenger_locations') THEN '✅ passenger_locations table exists'
        ELSE '❌ passenger_locations table missing'
    END as result

UNION ALL

SELECT 
    'Integration Test Results' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_driver_location') THEN '✅ update_driver_location function exists'
        ELSE '❌ update_driver_location function missing'
    END as result

UNION ALL

SELECT 
    'Integration Test Results' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'find_nearby_drivers') THEN '✅ find_nearby_drivers function exists'
        ELSE '❌ find_nearby_drivers function missing'
    END as result

UNION ALL

SELECT 
    'Integration Test Results' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'driver_locations' AND column_name = 'latitude') THEN '✅ driver_locations has latitude column'
        ELSE '❌ driver_locations missing latitude column'
    END as result

UNION ALL

SELECT 
    'Integration Test Results' as test_type,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unihub_drivers' AND column_name = 'vehicleType') THEN '✅ unihub_drivers has vehicleType column'
        ELSE '❌ unihub_drivers missing vehicleType column'
    END as result;
