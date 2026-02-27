-- Security Functions with Proper Function Replacement
-- This script safely replaces existing functions if they exist

-- First, drop existing functions to avoid signature conflicts
DROP FUNCTION IF EXISTS log_login_attempt(text,text,text,text,text,jsonb);
DROP FUNCTION IF EXISTS check_login_attempts(text,text);
DROP FUNCTION IF EXISTS verify_security_answer_and_reset_pin(text,uuid,text,text);
DROP FUNCTION IF EXISTS verify_driver_security_answer_and_reset_pin(text,uuid,text,text);

-- Create security logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.unihub_security_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_phone text,
  attempt_type text,
  status text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Function to check login attempts
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
  v_attempts_remaining integer;
  v_is_locked boolean;
  v_locked_until timestamp with time zone;
BEGIN
  -- Count recent failed attempts in last 15 minutes
  SELECT COUNT(*) INTO recent_attempts
  FROM unihub_security_logs
  WHERE metadata->>'identifier' = p_identifier
    AND attempt_type = p_attempt_type
    AND status = 'failed'
    AND created_at > NOW() - INTERVAL '15 minutes';
  
  -- Calculate attempts remaining
  v_attempts_remaining := GREATEST(0, max_attempts - recent_attempts);
  
  -- Check if account should be locked
  IF recent_attempts >= max_attempts THEN
    lock_until_time := NOW() + INTERVAL '1 minute' * lock_duration_minutes;
    v_is_locked := true;
    v_locked_until := lock_until_time;
  ELSE
    v_is_locked := false;
    v_locked_until := NULL;
  END IF;
  
  -- Return the results
  attempts_remaining := v_attempts_remaining;
  is_locked := v_is_locked;
  locked_until := v_locked_until;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log login attempts (with correct parameter order)
CREATE OR REPLACE FUNCTION log_login_attempt(
  p_identifier text,
  p_status text,
  p_attempt_type text DEFAULT 'user_login',
  p_ip_address text DEFAULT '127.0.0.1',
  p_user_agent text DEFAULT 'unknown',
  p_metadata jsonb DEFAULT '{}'
) RETURNS void AS $$
BEGIN
  INSERT INTO unihub_security_logs (
    user_phone,
    attempt_type,
    status,
    metadata
  ) VALUES (
    p_identifier,
    p_attempt_type,
    p_status,
    jsonb_build_object(
      'identifier', p_identifier,
      'ip_address', p_ip_address,
      'user_agent', p_user_agent
    ) || p_metadata
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create security questions table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.security_questions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question text NOT NULL UNIQUE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Create user security answers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_security_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text,
  question_id uuid,
  answer_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT user_security_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.unihub_users(id),
  CONSTRAINT user_security_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.security_questions(id)
);

-- Create driver security answers table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.driver_security_answers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id text,
  question_id uuid,
  answer_hash text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_security_answers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.unihub_drivers(id),
  CONSTRAINT driver_security_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.security_questions(id)
);

-- Insert default security questions
INSERT INTO public.security_questions (question, is_active) VALUES
  ('What was your childhood nickname?', true),
  ('What is your mother''s maiden name?', true),
  ('What was name of your first pet?', true),
  ('What city were you born in?', true),
  ('What is your favorite food?', true)
ON CONFLICT (question) DO NOTHING;

-- Function to verify security answer and reset PIN
CREATE OR REPLACE FUNCTION verify_security_answer_and_reset_pin(
  p_user_id text,
  p_question_id uuid,
  p_answer text,
  p_new_pin text
) RETURNS TABLE(
  success boolean,
  message text
) AS $$
DECLARE
  v_success boolean := false;
  v_message text := 'Invalid security answer';
  stored_answer text;
BEGIN
  -- Get stored answer hash
  SELECT answer_hash INTO stored_answer
  FROM user_security_answers
  WHERE user_id = p_user_id AND question_id = p_question_id;
  
  -- Check if answer matches (simple comparison for now)
  IF stored_answer IS NOT NULL AND stored_answer = p_answer THEN
    -- Update user's PIN
    UPDATE unihub_users
    SET pin = p_new_pin,
        updated_at = NOW()
    WHERE id = p_user_id;
    
    v_success := true;
    v_message := 'PIN reset successfully';
  ELSE
    v_success := false;
    v_message := 'Security answer does not match';
  END IF;
  
  success := v_success;
  message := v_message;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify driver security answer and reset PIN
CREATE OR REPLACE FUNCTION verify_driver_security_answer_and_reset_pin(
  p_driver_id text,
  p_question_id uuid,
  p_answer text,
  p_new_pin text
) RETURNS TABLE(
  success boolean,
  message text
) AS $$
DECLARE
  v_success boolean := false;
  v_message text := 'Invalid security answer';
  stored_answer text;
BEGIN
  -- Get stored answer hash
  SELECT answer_hash INTO stored_answer
  FROM driver_security_answers
  WHERE driver_id = p_driver_id AND question_id = p_question_id;
  
  -- Check if answer matches (simple comparison for now)
  IF stored_answer IS NOT NULL AND stored_answer = p_answer THEN
    -- Update driver's PIN
    UPDATE unihub_drivers
    SET pin = p_new_pin,
        updated_at = NOW()
    WHERE id = p_driver_id;
    
    v_success := true;
    v_message := 'PIN reset successfully';
  ELSE
    v_success := false;
    v_message := 'Security answer does not match';
  END IF;
  
  success := v_success;
  message := v_message;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS for security tables
ALTER TABLE unihub_security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_security_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_security_answers ENABLE ROW LEVEL SECURITY;

-- Create policies for security logs
CREATE POLICY "Users can view own security logs" ON unihub_security_logs
  FOR SELECT USING (metadata->>'identifier' = auth.uid()::text);

CREATE POLICY "Users can insert own security logs" ON unihub_security_logs
  FOR INSERT WITH CHECK (metadata->>'identifier' = auth.uid()::text);

-- Create policies for security questions
CREATE POLICY "Everyone can view active security questions" ON security_questions
  FOR SELECT USING (is_active = true);

-- Create policies for user security answers
CREATE POLICY "Users can manage own security answers" ON user_security_answers
  FOR ALL USING (user_id = auth.uid()::text);

-- Create policies for driver security answers
CREATE POLICY "Drivers can manage own security answers" ON driver_security_answers
  FOR ALL USING (driver_id = auth.uid()::text);
