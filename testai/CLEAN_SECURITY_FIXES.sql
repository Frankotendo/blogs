-- ============================================================
-- CLEAN SECURITY FIXES - Handles Existing Objects
-- Run this if URGENT_SECURITY_FIXES.sql failed
-- ============================================================

-- STEP 1: Drop existing policies and functions (clean slate)
DROP POLICY IF EXISTS "Users can view own login attempts" ON public.login_attempts;
DROP POLICY IF EXISTS "System can insert login attempts" ON public.login_attempts;
DROP FUNCTION IF EXISTS public.check_login_attempts(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.secure_user_login(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.secure_driver_login(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.unlock_user_account(TEXT);
DROP FUNCTION IF EXISTS public.unlock_driver_account(TEXT);
DROP FUNCTION IF EXISTS public.get_login_statistics(INTEGER);

-- STEP 2: Recreate login attempts table (if needed)
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  success BOOLEAN DEFAULT FALSE,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- STEP 3: Add security columns (if not exists)
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

-- STEP 4: Create indexes (if not exists)
CREATE INDEX IF NOT EXISTS idx_login_attempts_phone ON public.login_attempts(phone);
CREATE INDEX IF NOT EXISTS idx_login_attempts_time ON public.login_attempts(attempt_time);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON public.login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_users_locked_until ON public.unihub_users(locked_until);
CREATE INDEX IF NOT EXISTS idx_drivers_locked_until ON public.unihub_drivers(locked_until);

-- STEP 5: Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create policies (clean versions)
CREATE POLICY "Users can view own login attempts" ON public.login_attempts
  FOR SELECT USING (auth.uid()::text = phone);

CREATE POLICY "System can insert login attempts" ON public.login_attempts
  FOR INSERT WITH CHECK (true);

-- STEP 7: Rate limiting function
CREATE OR REPLACE FUNCTION public.check_login_attempts(p_phone TEXT, p_ip TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    recent_attempts INTEGER;
    is_locked BOOLEAN;
BEGIN
    -- Check if account is locked
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
    RETURN recent_attempts < 5;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 8: Secure user login function
CREATE OR REPLACE FUNCTION public.secure_user_login(p_phone TEXT, p_pin TEXT, p_ip TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    user_record RECORD;
    is_valid BOOLEAN;
    login_result JSON;
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
        -- Log failed attempt
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
    
    -- Verify PIN (assuming current PIN is plain text)
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
        UPDATE public.unihub_users 
        SET 
            failed_attempts = user_record.failed_attempts + 1,
            last_login_attempt = NOW()
        WHERE id = user_record.id;
        
        -- Lock account after 5 failed attempts
        IF user_record.failed_attempts + 1 >= 5 THEN
            UPDATE public.unihub_users 
            SET locked_until = NOW() + INTERVAL '30 minutes'
            WHERE id = user_record.id;
        END IF;
        
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

-- STEP 9: Secure driver login function
CREATE OR REPLACE FUNCTION public.secure_driver_login(p_driver_id TEXT, p_pin TEXT, p_ip TEXT, p_user_agent TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
    driver_record RECORD;
    is_valid BOOLEAN;
    login_result JSON;
BEGIN
    -- Check rate limiting first
    IF NOT check_login_attempts(p_driver_id, p_ip) THEN
        -- Log failed attempt
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
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
        -- Log failed attempt
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
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
    
    -- Verify PIN (assuming current PIN is plain text)
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
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
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
        UPDATE public.unihub_drivers 
        SET 
            failed_attempts = driver_record.failed_attempts + 1,
            last_login_attempt = NOW()
        WHERE id = driver_record.id;
        
        -- Lock account after 5 failed attempts
        IF driver_record.failed_attempts + 1 >= 5 THEN
            UPDATE public.unihub_drivers 
            SET locked_until = NOW() + INTERVAL '30 minutes'
            WHERE id = driver_record.id;
        END IF;
        
        -- Log failed attempt
        INSERT INTO public.login_attempts (phone, ip_address, success, user_agent)
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

-- STEP 10: Grant permissions
GRANT ALL ON public.login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_user_login TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_driver_login TO authenticated;

-- STEP 11: Test the security functions
SELECT 'SECURITY TEST' as test_type, secure_user_login('0000000000', '0000', '127.0.0.1', 'Test') as result;

-- ============================================================
-- CLEAN VERSION COMPLETE
-- ============================================================

-- Next: Run MIGRATE_EXISTING_DATA.sql to initialize existing users
