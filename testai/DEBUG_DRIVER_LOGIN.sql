-- ============================================================
-- DEBUG DRIVER LOGIN ISSUES
-- ============================================================

-- Check if drivers table exists and has data
SELECT 
    'unihub_drivers table check' as check_type,
    COUNT(*) as driver_count,
    MIN(id) as sample_driver_id,
    MIN(name) as sample_driver_name,
    MIN(contact) as sample_driver_contact
FROM unihub_drivers;

-- Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'unihub_drivers' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check for any locked accounts
SELECT 
    id,
    name,
    contact,
    status,
    failed_attempts,
    locked_until,
    last_login_attempt,
    last_login
FROM unihub_drivers 
WHERE locked_until IS NOT NULL 
    AND locked_until > NOW();

-- Check recent security logs
SELECT 
    user_phone,
    attempt_type,
    status,
    created_at,
    metadata
FROM unihub_security_logs 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;

-- Test a simple driver query (replace 'test-driver-id' with actual driver ID)
SELECT 
    'Driver query test' as test_type,
    d.id,
    d.name,
    d.contact,
    d.pin,
    d.status,
    d.failed_attempts,
    d.locked_until
FROM unihub_drivers d
WHERE d.id = 'test-driver-id'  -- Replace with actual driver ID for testing

-- Test driver lookup by contact (replace 'test-contact' with actual contact)
SELECT 
    'Contact lookup test' as test_type,
    d.id,
    d.name,
    d.contact,
    d.pin,
    d.status
FROM unihub_drivers d
WHERE d.contact = 'test-contact'  -- Replace with actual contact for testing
LIMIT 1;

-- Test driver lookup by name (replace 'test-name' with actual name)
SELECT 
    'Name lookup test' as test_type,
    d.id,
    d.name,
    d.contact,
    d.pin,
    d.status
FROM unihub_drivers d
WHERE LOWER(d.name) = LOWER('test-name')  -- Replace with actual name for testing
LIMIT 1;
