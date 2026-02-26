-- ============================================================
-- FINAL SECURITY SYSTEM STATUS CHECK
-- ============================================================

-- Check complete security system status
SELECT 'FINAL SECURITY SYSTEM STATUS' as check_type,
       json_build_object(
           'security_questions', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_questions'),
           'user_security_answers', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_security_answers'),
           'driver_security_answers', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_security_answers'),
           'admin_security_answers', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_security_answers'),
           'login_attempts', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'login_attempts'),
           'admin_login_attempts', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_login_attempts'),
           'get_security_questions_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_security_questions'),
           'get_security_questions_text_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_security_questions_text'),
           'check_login_attempts_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_login_attempts'),
           'check_admin_login_attempts_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_admin_login_attempts'),
           'secure_user_login_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'secure_user_login'),
           'secure_driver_login_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'secure_driver_login'),
           'setup_admin_security_questions_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'setup_admin_security_questions'),
           'reset_admin_password_with_security_questions_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'reset_admin_password_with_security_questions'),
           'check_admin_security_setup_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_admin_security_setup'),
           'log_admin_login_attempt_function', EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'log_admin_login_attempt'),
           'overall_status', CASE 
               WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_questions')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_security_answers')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_login_attempts')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_security_questions')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'check_admin_login_attempts')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'setup_admin_security_questions')
                    AND EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'reset_admin_password_with_security_questions')
               THEN 'SECURITY_SYSTEM_COMPLETE'
               ELSE 'SECURITY_SYSTEM_INCOMPLETE'
           END
       ) as status;

-- Test security questions functionality
SELECT 'SECURITY QUESTIONS FUNCTIONALITY TEST' as test_type,
       get_security_questions() as json_questions,
       get_security_questions_text() as text_questions;

-- Test admin anti-brute force functionality
SELECT 'ADMIN ANTI-BRUTE FORCE TEST' as test_type,
       check_admin_login_attempts('admin@example.com', '127.0.0.1') as rate_limit_check;

-- Test admin login attempt logging
SELECT 'ADMIN LOGIN ATTEMPT LOGGING TEST' as test_type,
       log_admin_login_attempt('admin@example.com', '127.0.0.1', FALSE, 'Test Agent') as logging_result;

-- Show security questions count
SELECT 'SECURITY QUESTIONS COUNT' as test_type,
       COUNT(*) as total_questions,
       COUNT(*) FILTER (WHERE is_active = TRUE) as active_questions
FROM public.security_questions;

-- ============================================================
-- FINAL SECURITY SYSTEM STATUS CHECK COMPLETE
-- ============================================================
