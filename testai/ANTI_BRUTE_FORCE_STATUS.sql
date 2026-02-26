-- ============================================================
-- ANTI-BRUTE FORCE SYSTEM STATUS CHECK
-- ============================================================

-- Check if all anti-brute force components are set up
SELECT 'ANTI-BRUTE FORCE SYSTEM STATUS' as check_type,
       json_build_object(
           'users_table_security_columns', EXISTS (
               SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unihub_users' 
               AND column_name IN ('failed_attempts', 'locked_until', 'last_login_attempt')
           ),
           'drivers_table_security_columns', EXISTS (
               SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'unihub_drivers' 
               AND column_name IN ('failed_attempts', 'locked_until', 'last_login_attempt')
           ),
           'login_attempts_table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'login_attempts'),
           'admin_login_attempts_table', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_login_attempts'),
           'check_login_attempts_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_login_attempts'),
           'check_admin_login_attempts_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_admin_login_attempts'),
           'secure_user_login_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'secure_user_login'),
           'secure_driver_login_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'secure_driver_login'),
           'log_admin_login_attempt_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'log_admin_login_attempt'),
           'overall_status', CASE 
               WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'login_attempts')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_login_attempts')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_login_attempts')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_admin_login_attempts')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'secure_user_login')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'secure_driver_login')
               THEN 'ANTI_BRUTE_FORCE_READY'
               ELSE 'ANTI_BRUTE_FORCE_INCOMPLETE'
           END
       ) as status;

-- Show anti-brute force protection levels
SELECT 'ANTI-BRUTE FORCE PROTECTION LEVELS' as protection_type,
       json_build_object(
           'users', json_build_object(
               'rate_limiting', '5 attempts per 15 minutes',
               'account_lockout', '30 minutes after 5 failed attempts',
               'tracking', 'IP + phone + user_agent'
           ),
           'drivers', json_build_object(
               'rate_limiting', '5 attempts per 15 minutes', 
               'account_lockout', '30 minutes after 5 failed attempts',
               'tracking', 'IP + driver_id + user_agent'
           ),
           'admins', json_build_object(
               'rate_limiting', '3 attempts per 15 minutes (STRICTER)',
               'account_lockout', '60 minutes after 5 failed attempts (LONGER)',
               'tracking', 'IP + admin_email + user_agent'
           )
       ) as protection_levels;

-- Test basic anti-brute force function
SELECT 'ANTI-BRUTE FORCE TEST' as test_type,
       CASE 
           WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_login_attempts')
           THEN 'FUNCTION_EXISTS'
           ELSE 'FUNCTION_MISSING'
       END as user_function_status,
       CASE 
           WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_admin_login_attempts')
           THEN 'FUNCTION_EXISTS'
           ELSE 'FUNCTION_MISSING'
       END as admin_function_status;

-- ============================================================
-- ANTI-BRUTE FORCE STATUS CHECK COMPLETE
-- ============================================================
