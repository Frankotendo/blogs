-- Test Security Functions
-- Run this to verify all functions are working correctly

-- Test 1: Check login attempts function
SELECT * FROM check_login_attempts('test_user', 'user_login');

-- Test 2: Log a login attempt
SELECT log_login_attempt('test_user', 'success', 'user_login', '127.0.0.1', 'test-agent');

-- Test 3: Verify security questions were inserted
SELECT * FROM security_questions WHERE is_active = true;

-- Test 4: Check if tables exist and have RLS enabled
SELECT 
  schemaname,
  tablename,
  rowsecurity 
FROM pg_tables 
WHERE tablename IN ('unihub_security_logs', 'security_questions', 'user_security_answers', 'driver_security_answers')
  AND schemaname = 'public';
