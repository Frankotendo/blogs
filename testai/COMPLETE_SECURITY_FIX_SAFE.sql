-- ============================================================
-- COMPLETE SECURITY SYSTEM FIX - SAFE VERSION
-- ============================================================

-- 1. CREATE SECURITY QUESTIONS IF NOT EXISTS
CREATE TABLE IF NOT EXISTS public.security_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  question text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp without time zone DEFAULT now(),
  CONSTRAINT security_questions_pkey PRIMARY KEY (id)
);

-- Insert default security questions (ignore conflicts)
INSERT INTO public.security_questions (question, is_active) VALUES
  ('What was your first pet''s name?', true),
  ('What city were you born in?', true),
  ('What is your mother''s maiden name?', true),
  ('What was your first school?', true),
  ('What is your favorite color?', true),
  ('What year did you graduate?', true),
  ('What is your dream car?', true),
  ('What is your favorite food?', true)
ON CONFLICT (question) DO NOTHING;

-- 2. CREATE USER SECURITY ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.user_security_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id text,
  question_id uuid,
  answer_hash text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT user_security_answers_pkey PRIMARY KEY (id),
  CONSTRAINT user_security_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.unihub_users(id),
  CONSTRAINT user_security_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.security_questions(id)
);

-- 3. CREATE DRIVER SECURITY ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.driver_security_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id text,
  question_id uuid,
  answer_hash text NOT NULL,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT driver_security_answers_pkey PRIMARY KEY (id),
  CONSTRAINT driver_security_answers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.unihub_drivers(id),
  CONSTRAINT driver_security_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.security_questions(id)
);

-- 4. CREATE ADMIN LOGIN ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.admin_login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  admin_email text NOT NULL,
  ip_address text NOT NULL,
  success boolean NOT NULL DEFAULT false,
  user_agent text,
  attempt_time timestamp without time zone DEFAULT now(),
  CONSTRAINT admin_login_attempts_pkey PRIMARY KEY (id)
);

-- 5. CREATE LOGIN ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  ip_address text NOT NULL,
  attempt_time timestamp with time zone DEFAULT now(),
  success boolean DEFAULT false,
  user_agent text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT login_attempts_pkey PRIMARY KEY (id)
);

-- 6. CREATE PASSENGER LOCATIONS TABLE
CREATE TABLE IF NOT EXISTS public.passenger_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  passenger_id text NOT NULL UNIQUE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT passenger_locations_pkey PRIMARY KEY (id),
  CONSTRAINT passenger_locations_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.unihub_users(id)
);

-- 7. ADD PASSWORD FIELD TO USERS TABLE (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unihub_users' AND column_name = 'password') THEN
    ALTER TABLE public.unihub_users ADD COLUMN password text;
  END IF;
END $$;

-- 8. ADD PASSWORD FIELD TO DRIVERS TABLE (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unihub_drivers' AND column_name = 'password') THEN
    ALTER TABLE public.unihub_drivers ADD COLUMN password text;
  END IF;
END $$;

-- 9. ADD EMAIL FIELD TO DRIVERS TABLE (IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'unihub_drivers' AND column_name = 'email') THEN
    ALTER TABLE public.unihub_drivers ADD COLUMN email text;
  END IF;
END $$;

-- 10. CREATE RLS POLICIES (DROP EXISTING FIRST)

-- Security Questions
ALTER TABLE public.security_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view security questions" ON public.security_questions;
CREATE POLICY "Public can view security questions" ON public.security_questions
  FOR SELECT USING (is_active = true);

-- User Security Answers
ALTER TABLE public.user_security_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own security answers" ON public.user_security_answers;
CREATE POLICY "Users can manage own security answers" ON public.user_security_answers
  FOR ALL USING (auth.uid()::text = user_id);

-- Driver Security Answers
ALTER TABLE public.driver_security_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Drivers can manage own security answers" ON public.driver_security_answers;
CREATE POLICY "Drivers can manage own security answers" ON public.driver_security_answers
  FOR ALL USING (auth.uid()::text = driver_id);

-- Login Attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can insert login attempts" ON public.login_attempts;
CREATE POLICY "Public can insert login attempts" ON public.login_attempts
  FOR INSERT WITH CHECK (true);

-- Admin Login Attempts
ALTER TABLE public.admin_login_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can insert admin login attempts" ON public.admin_login_attempts;
CREATE POLICY "Public can insert admin login attempts" ON public.admin_login_attempts
  FOR INSERT WITH CHECK (true);

-- Passenger Locations
ALTER TABLE public.passenger_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view passenger locations" ON public.passenger_locations;
DROP POLICY IF EXISTS "Users can update own location" ON public.passenger_locations;
CREATE POLICY "Public can view passenger locations" ON public.passenger_locations
  FOR SELECT USING (true);
CREATE POLICY "Users can update own location" ON public.passenger_locations
  FOR UPDATE USING (auth.uid()::text = passenger_id);

-- 11. GRANT PERMISSIONS
GRANT SELECT ON public.security_questions TO anon;
GRANT SELECT ON public.security_questions TO authenticated;
GRANT ALL ON public.user_security_answers TO authenticated;
GRANT ALL ON public.driver_security_answers TO authenticated;
GRANT INSERT ON public.login_attempts TO anon;
GRANT INSERT ON public.login_attempts TO authenticated;
GRANT INSERT ON public.admin_login_attempts TO anon;
GRANT INSERT ON public.admin_login_attempts TO authenticated;
GRANT SELECT ON public.passenger_locations TO anon;
GRANT SELECT ON public.passenger_locations TO authenticated;
GRANT UPDATE ON public.passenger_locations TO authenticated;

-- 12. CREATE SECURITY FUNCTIONS (DROP EXISTING FIRST)

-- Function to check login attempts and lock account
DROP FUNCTION IF EXISTS check_login_attempts(text, text);
CREATE OR REPLACE FUNCTION check_login_attempts(
  p_identifier text,
  p_attempt_type text DEFAULT 'user_login'
) RETURNS TABLE(
  attempts_remaining integer,
  is_locked boolean,
  locked_until timestamp with time zone
) AS $$
DECLARE
  recent_attempts integer;
  max_attempts integer := 5;
  lock_duration_minutes integer := 15;
  lock_until_time timestamp with time zone;
BEGIN
  -- Count recent failed attempts in last 15 minutes
  SELECT COUNT(*) INTO recent_attempts
  FROM unihub_security_logs
  WHERE metadata->>'identifier' = p_identifier
    AND attempt_type = p_attempt_type
    AND status = 'failed'
    AND created_at > NOW() - INTERVAL '15 minutes';
  
  -- Calculate attempts remaining
  attempts_remaining := GREATEST(0, max_attempts - recent_attempts);
  
  -- Check if account should be locked
  IF recent_attempts >= max_attempts THEN
    lock_until_time := NOW() + INTERVAL '1 minute' * lock_duration_minutes;
    is_locked := true;
    locked_until := lock_until_time;
  ELSE
    is_locked := false;
    locked_until := NULL;
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log login attempt
DROP FUNCTION IF EXISTS log_login_attempt(text, text, text, text, text, jsonb);
CREATE OR REPLACE FUNCTION log_login_attempt(
  p_identifier text,
  p_attempt_type text,
  p_status text,
  p_ip_address text,
  p_user_agent text,
  p_metadata jsonb DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  INSERT INTO unihub_security_logs (
    user_phone,
    attempt_type,
    status,
    metadata,
    created_at
  ) VALUES (
    p_identifier,
    p_attempt_type,
    p_status,
    jsonb_build_object(
      'ip_address', p_ip_address,
      'user_agent', p_user_agent,
      'identifier', p_identifier
    ) || p_metadata,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. CREATE PASSWORD RESET FUNCTIONS

-- Function to verify security answer and allow password reset
DROP FUNCTION IF EXISTS verify_security_answer(text, uuid, text, text);
CREATE OR REPLACE FUNCTION verify_security_answer(
  p_user_id text,
  p_question_id uuid,
  p_answer text,
  p_user_type text DEFAULT 'user'
) RETURNS TABLE(
  success boolean,
  message text
) AS $$
DECLARE
  stored_hash text;
  answer_hash text;
  table_name text;
BEGIN
  -- Set table name based on user type
  table_name := CASE p_user_type
    WHEN 'user' THEN 'user_security_answers'
    WHEN 'driver' THEN 'driver_security_answers'
    ELSE 'user_security_answers'
  END;
  
  -- Get stored answer hash
  EXECUTE format('SELECT answer_hash FROM %I WHERE user_id = $1 AND question_id = $2', table_name)
  INTO stored_hash
  USING p_user_id, p_question_id;
  
  -- Hash the provided answer
  answer_hash := crypt(p_answer, stored_hash);
  
  -- Verify answer and return result
  IF stored_hash = answer_hash THEN
    success := true;
    message := 'Security answer verified';
    RETURN NEXT;
  ELSE
    success := false;
    message := 'Incorrect security answer';
    RETURN NEXT;
  END IF;
  
  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. TEST THE SETUP
SELECT 
    'Security setup complete' as status,
    (SELECT COUNT(*) FROM security_questions) as security_questions_count,
    (SELECT COUNT(*) FROM user_security_answers) as user_security_count,
    (SELECT COUNT(*) FROM driver_security_answers) as driver_security_count,
    (SELECT COUNT(*) FROM passenger_locations) as passenger_locations_count;
