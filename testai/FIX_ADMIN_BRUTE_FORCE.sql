-- ============================================================
-- FIX ADMIN ANTI-BRUTE FORCE SYSTEM
-- ============================================================

-- STEP 1: Create admin login attempts table (if not exists)
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_email TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    success BOOLEAN NOT NULL DEFAULT FALSE,
    user_agent TEXT,
    attempt_time TIMESTAMP DEFAULT NOW()
);

-- STEP 2: Create indexes for admin login attempts
CREATE INDEX IF NOT EXISTS idx_admin_email_time ON public.admin_login_attempts(admin_email, attempt_time);
CREATE INDEX IF NOT EXISTS idx_ip_time ON public.admin_login_attempts(ip_address, attempt_time);

-- STEP 3: Enable RLS for admin login attempts table
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;

-- STEP 4: Create RLS policy for admin login attempts
DROP POLICY IF EXISTS "Admins can manage own login attempts" ON public.admin_login_attempts;
CREATE POLICY "Admins can manage own login attempts" ON public.admin_login_attempts
    FOR ALL USING (current_setting('app.current_user_email', true) = admin_email);

-- STEP 5: Create admin anti-brute force function
CREATE OR REPLACE FUNCTION public.check_admin_login_attempts(p_admin_email TEXT, p_ip TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    recent_attempts INTEGER;
    is_locked BOOLEAN;
    lock_until TIMESTAMP;
BEGIN
    -- Check if admin account is locked (5 failed attempts in last hour)
    SELECT COUNT(*) > 4, MAX(attempt_time) + INTERVAL '1 hour' INTO is_locked, lock_until
    FROM public.admin_login_attempts 
    WHERE admin_email = p_admin_email 
    AND success = FALSE 
    AND attempt_time > NOW() - INTERVAL '1 hour'
    GROUP BY admin_email;
    
    IF is_locked AND lock_until > NOW() THEN
        RETURN FALSE;
    END IF;
    
    -- Count recent attempts from this IP (last 15 minutes)
    SELECT COUNT(*) INTO recent_attempts
    FROM public.admin_login_attempts 
    WHERE ip_address = p_ip 
    AND attempt_time > NOW() - INTERVAL '15 minutes';
    
    -- Allow max 3 attempts per 15 minutes per IP (stricter for admin)
    RETURN recent_attempts < 3;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 6: Create admin login attempt logging function
CREATE OR REPLACE FUNCTION public.log_admin_login_attempt(
    p_admin_email TEXT,
    p_ip TEXT,
    p_success BOOLEAN,
    p_user_agent TEXT DEFAULT NULL
) RETURNS JSON AS $$
BEGIN
    INSERT INTO public.admin_login_attempts (admin_email, ip_address, success, user_agent)
    VALUES (p_admin_email, p_ip, p_success, p_user_agent);
    
    RETURN json_build_object(
        'success', TRUE,
        'message', 'Login attempt logged',
        'admin_email', p_admin_email,
        'ip_address', p_ip,
        'success', p_success
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 7: Grant permissions for admin anti-brute force functions
GRANT ALL ON public.admin_login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_admin_login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_admin_login_attempt TO authenticated;

-- STEP 8: Test the admin anti-brute force system
SELECT 'ADMIN ANTI-BRUTE FORCE TEST' as test_type, 
       check_admin_login_attempts('admin@example.com', '127.0.0.1') as rate_limit_check;

-- STEP 9: Test logging function
SELECT 'ADMIN LOGIN ATTEMPT LOGGING TEST' as test_type,
       log_admin_login_attempt('admin@example.com', '127.0.0.1', FALSE, 'Test Agent') as logging_result;

-- ============================================================
-- ADMIN ANTI-BRUTE FORCE SYSTEM COMPLETE
-- ============================================================
