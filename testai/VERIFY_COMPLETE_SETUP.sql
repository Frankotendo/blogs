-- Verify Security Questions and Functions
-- Run this to complete the testing

-- Test 1: Check security questions
SELECT * FROM security_questions WHERE is_active = true;

-- Test 2: Test login attempts function
SELECT * FROM check_login_attempts('test_user', 'user_login');

-- Test 3: Test logging function
SELECT log_login_attempt('test_user', 'success', 'user_login', '127.0.0.1', 'test-agent');

-- Test 4: Check if functions exist
SELECT proname, proargtypes FROM pg_proc WHERE proname LIKE '%login%' OR proname LIKE '%security%' OR proname LIKE '%verify%';

-- Test 5: Verify PIN reset functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%reset_pin%';
