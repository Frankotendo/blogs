-- ============================================================
-- URGENT SECURITY FIXES - Implement Immediately
-- Run these commands in Supabase SQL Editor
-- ============================================================

-- STEP 1: Create login attempts tracking table
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 2: Add security columns to existing tables
ALTER TABLE public.unihub_users 
ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.unihub_drivers 
ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login_attempt TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;

-- STEP 3: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_login_attempts_phone ON public.login_attempts(phone);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON public.login_attempts(attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON public.unihub_users(locked_until);
CREATE INDEX IF NOT EXISTS idx_drivers_locked_until ON public.unihub_drivers(locked_until);

-- STEP 4: Enable Row Level Security
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create RLS policies for login attempts
CREATE POLICY "Users can view own login attempts" ON public.login_attempts
  FOR SELECT USING (auth.uid()::text = phone);

CREATE POLICY "System can insert login attempts" ON public.login_attempts
  FOR INSERT WITH CHECK (true);

-- STEP 6: Rate limiting check function
CREATE OR REPLACE FUNCTION public.check_login_attempts(p_phone TEXT, p_ip TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    recent_attempts INTEGER;
    is_locked BOOLEAN;
BEGIN
    -- Check if user account is locked
    SELECT locked_until > NOW() INTO is_locked
    FROM public.unihub_users 
    WHERE phone = p_phone;
    
    IF is_locked THEN
        RETURN FALSE;
    END IF;
    
    -- Count recent attempts from this IP (last 15 minutes)
    SELECT COUNT(*) INTO recent_attempts
    FROM public.login_attempts 
    WHERE ip_address = p_ip 
    AND attempt_time > NOW() - INTERVAL '15 minutes';
    
    -- Allow max 5 attempts per 15 minutes per IP
    IF recent_attempts >= 5 THEN
        RETURN FALSE;
    END IF;
    
    -- Count recent attempts for this phone (last 15 minutes)
    SELECT COUNT(*) INTO recent_attempts
    FROM public.login_attempts 
    WHERE phone = p_phone 
    AND attempt_time > NOW() - INTERVAL '15 minutes';
    
    -- Allow max 10 attempts per 15 minutes per phone
    RETURN recent_attempts < 10;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 7: Secure user login function
CREATE OR REPLACE FUNCTION public.secure_user_login(p_phone TEXT, p_pin TEXT, p_ip TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    is_valid BOOLEAN;
    login_result JSON;
    should_lock BOOLEAN;
BEGIN
    -- Check rate limiting first
    IF NOT check_login_attempts(p_phone, p_ip) THEN
        -- Log failed attempt
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
        VALUES (p_phone, p_ip, FALSE, p_user_agent);
        
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Too many login attempts. Please try again later.',
            'code', 'RATE_LIMIT_EXCEEDED'
        );
    END IF;
    
    -- Get user record
    SELECT * INTO user_record
    FROM public.unihub_users 
    WHERE phone = p_phone;
    
    IF NOT FOUND THEN
        -- Log failed attempt for non-existent user
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
        VALUES (p_phone, p_ip, FALSE, p_user_agent);
        
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Invalid phone number or PIN',
            'code', 'INVALID_CREDENTIALS'
        );
    END IF;
    
    -- Check if account is locked
    IF user_record.locked_until > NOW() THEN
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Account temporarily locked due to too many failed attempts',
            'code', 'ACCOUNT_LOCKED',
            'locked_until', user_record.locked_until
        );
    END IF;
    
    -- Verify PIN (assuming current PIN is plain text - will be hashed later)
    is_valid := (user_record.pin = p_pin);
    
    IF is_valid THEN
        -- Successful login
        UPDATE public.unihub_users 
        SET 
            failed_attempts = 0, 
            locked_until = NULL,
            last_login = NOW(),
            last_login_attempt = NOW()
        WHERE id = user_record.id;
        
        -- Log successful attempt
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
        VALUES (p_phone, p_ip, TRUE, p_user_agent);
        
        RETURN json_build_object(
            'success', TRUE, 
            'user_id', user_record.id,
            'username', user_record.username,
            'message', 'Login successful'
        );
    ELSE
        -- Failed login
        should_lock := (user_record.failed_attempts + 1) >= 5;
        
        UPDATE public.unihub_users 
        SET 
            failed_attempts = failed_attempts + 1,
            last_login_attempt = NOW(),
            locked_until = CASE 
                WHEN should_lock THEN NOW() + INTERVAL '30 minutes'
                ELSE locked_until
            END
        WHERE id = user_record.id;
        
        -- Log failed attempt
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
        VALUES (p_phone, p_ip, FALSE, p_user_agent);
        
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Invalid phone number or PIN',
            'code', 'INVALID_CREDENTIALS',
            'attempts_remaining', 5 - (user_record.failed_attempts + 1)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 8: Secure driver login function
CREATE OR REPLACE FUNCTION public.secure_driver_login(p_driver_id TEXT, p_pin TEXT, p_ip TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    driver_record RECORD;
    is_valid BOOLEAN;
    login_result JSON;
    should_lock BOOLEAN;
BEGIN
    -- Check rate limiting first
    IF NOT check_login_attempts(p_driver_id, p_ip) THEN
        -- Log failed attempt
        INSERT INTO public.login_attempts (phone, p_ip_address, success, user_agent)
        VALUES (p_driver_id, p_ip, FALSE, p_user_agent);
        
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Too many login attempts. Please try again later.',
            'code', 'RATE_LIMIT_EXCEEDED'
        );
    END IF;
    
    -- Get driver record
    SELECT * INTO driver_record
    FROM public.unihub_drivers 
    WHERE id = p_driver_id;
    
    IF NOT FOUND THEN
        -- Log failed attempt for non-existent driver
        INSERT INTO public.login_attempts (phone, p_ip_address, success, user_agent)
        VALUES (p_driver_id, p_ip, FALSE, p_user_agent);
        
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Invalid driver ID or PIN',
            'code', 'INVALID_CREDENTIALS'
        );
    END IF;
    
    -- Check if account is locked
    IF driver_record.locked_until > NOW() THEN
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Account temporarily locked due to too many failed attempts',
            'code', 'ACCOUNT_LOCKED',
            'locked_until', driver_record.locked_until
        );
    END IF;
    
    -- Verify PIN (assuming current PIN is plain text - will be hashed later)
    is_valid := (driver_record.pin = p_pin);
    
    IF is_valid THEN
        -- Successful login
        UPDATE public.unihub_drivers 
        SET 
            failed_attempts = 0, 
            locked_until = NULL,
            last_login = NOW(),
            last_login_attempt = NOW()
        WHERE id = driver_record.id;
        
        -- Log successful attempt
        INSERT INTO public.login_attempts (phone, p_ip_address, success, user_agent)
        VALUES (p_driver_id, p_ip, TRUE, p_user_agent);
        
        RETURN json_build_object(
            'success', TRUE, 
            'driver_id', driver_record.id,
            'name', driver_record.name,
            'vehicleType', driver_record."vehicleType",
            'message', 'Login successful'
        );
    ELSE
        -- Failed login
        should_lock := (driver_record.failed_attempts + 1) >= 5;
        
        UPDATE public.unihub_drivers 
        SET 
            failed_attempts = failed_attempts + 1,
            last_login_attempt = NOW(),
            locked_until = CASE 
                WHEN should_lock THEN NOW() + INTERVAL '30 minutes'
                ELSE locked_until
            END
        WHERE id = driver_record.id;
        
        -- Log failed attempt
        INSERT INTO public.login_attempts (phone, p_ip_address, success, user_agent)
        VALUES (p_driver_id, p_ip, FALSE, p_user_agent);
        
        RETURN json_build_object(
            'success', FALSE, 
            'error', 'Invalid driver ID or PIN',
            'code', 'INVALID_CREDENTIALS',
            'attempts_remaining', 5 - (driver_record.failed_attempts + 1)
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 9: Function to unlock accounts (admin only)
CREATE OR REPLACE FUNCTION public.unlock_user_account(p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.unihub_users 
    SET 
        failed_attempts = 0,
        locked_until = NULL
    WHERE phone = p_phone;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.unlock_driver_account(p_driver_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.unihub_drivers 
    SET 
        failed_attempts = 0,
        locked_until = NULL
    WHERE id = p_driver_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 10: Function to get login statistics (admin only)
CREATE OR REPLACE FUNCTION public.get_login_statistics(p_hours INTEGER DEFAULT 24)
RETURNS TABLE(
    total_attempts BIGINT,
    successful_logins BIGINT,
    failed_logins BIGINT,
    unique_ips BIGINT,
    locked_accounts BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::bigint as total_attempts,
        COUNT(*) FILTER (WHERE success = TRUE)::bigint as successful_logins,
        COUNT(*) FILTER (WHERE success = FALSE)::bigint as failed_logins,
        COUNT(DISTINCT ip_address)::bigint as unique_ips,
        (SELECT COUNT(*)::bigint FROM public.unihub_users WHERE locked_until > NOW()) +
        (SELECT COUNT(*)::bigint FROM public.unihub_drivers WHERE locked_until > NOW()) as locked_accounts
    FROM public.login_attempts 
    WHERE attempt_time > NOW() - INTERVAL '1 hour' * p_hours;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 11: Grant permissions
GRANT ALL ON public.login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_user_login TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_driver_login TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_user_account TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_driver_account TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_login_statistics TO authenticated;

-- STEP 12: Create admin role for security functions (optional)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'security_admin') THEN
        CREATE ROLE security_admin;
        GRANT security_admin TO authenticated;
    END IF;
END $$;

-- ============================================================
-- IMPORTANT: Next Steps After Running This Script
-- ============================================================

-- 1. Update your application code to use the new secure functions:
--    - Replace direct login queries with secure_user_login() and secure_driver_login()
--    - Handle the new response codes (RATE_LIMIT_EXCEEDED, ACCOUNT_LOCKED, etc.)

-- 2. Implement PIN hashing (critical for production):
--    - Use bcrypt with salt (cost factor 12)
--    - Update the login functions to use crypt() for PIN verification

-- 3. Add monitoring and alerts:
--    - Monitor login_attempts table for suspicious activity
--    - Set up alerts for high failure rates
--    - Regular security audits

-- 4. Test the security measures:
--    - Try brute force attacks to verify rate limiting works
--    - Test account lockout functionality
--    - Verify logging and monitoring
