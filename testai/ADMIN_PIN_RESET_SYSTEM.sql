-- Admin-Controlled PIN Reset System
-- This creates tables and functions for admin-approved PIN resets

-- Drop existing tables if they exist
DROP TABLE IF EXISTS pin_reset_requests CASCADE;

-- Create PIN reset requests table
CREATE TABLE IF NOT EXISTS public.pin_reset_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_type text NOT NULL CHECK (user_type IN ('user', 'driver')),
  user_id text NOT NULL,
  user_name text,
  user_phone text,
  request_reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_id text,
  admin_notes text,
  temporary_pin text,
  requested_at timestamp with time zone DEFAULT now(),
  reviewed_at timestamp with time zone,
  completed_at timestamp with time zone,
  metadata jsonb DEFAULT '{}'
);

-- Enable RLS for PIN reset requests
ALTER TABLE pin_reset_requests ENABLE ROW LEVEL SECURITY;

-- Create policies for PIN reset requests
DROP POLICY IF EXISTS "Admins can manage all PIN reset requests" ON pin_reset_requests;
DROP POLICY IF EXISTS "Users can view own PIN reset requests" ON pin_reset_requests;

CREATE POLICY "Admins can manage all PIN reset requests" ON pin_reset_requests
  FOR ALL USING (auth.jwt() ->> 'role' = 'authenticated');

CREATE POLICY "Users can view own PIN reset requests" ON pin_reset_requests
  FOR SELECT USING (user_id = auth.uid()::text OR user_phone = auth.jwt() ->> 'phone');

-- Function to create PIN reset request
CREATE OR REPLACE FUNCTION create_pin_reset_request(
  p_user_type text,
  p_user_id text,
  p_user_name text DEFAULT NULL,
  p_user_phone text DEFAULT NULL,
  p_request_reason text DEFAULT 'User requested PIN reset'
) RETURNS TABLE(
  success boolean,
  message text,
  request_id uuid
) AS $$
DECLARE
  v_request_id uuid;
  v_success boolean := false;
  v_message text := 'Request failed';
BEGIN
  -- Check if there's already a pending request
  IF EXISTS (
    SELECT 1 FROM pin_reset_requests 
    WHERE user_id = p_user_id 
      AND user_type = p_user_type 
      AND status = 'pending'
  ) THEN
    v_success := false;
    v_message := 'A reset request is already pending';
  ELSE
    -- Create new reset request
    INSERT INTO pin_reset_requests (
      user_type,
      user_id,
      user_name,
      user_phone,
      request_reason,
      status,
      metadata
    ) VALUES (
      p_user_type,
      p_user_id,
      p_user_name,
      p_user_phone,
      p_request_reason,
      'pending',
      jsonb_build_object(
        'requested_via', 'web_form',
        'ip_address', '127.0.0.1'
      )
    ) RETURNING id INTO v_request_id;
    
    v_success := true;
    v_message := 'PIN reset request submitted successfully';
  END IF;
  
  success := v_success;
  message := v_message;
  request_id := v_request_id;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to approve PIN reset request
CREATE OR REPLACE FUNCTION approve_pin_reset_request(
  p_request_id uuid,
  p_admin_id text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL,
  p_temporary_pin text DEFAULT NULL
) RETURNS TABLE(
  success boolean,
  message text,
  temporary_pin text
) AS $$
DECLARE
  v_request record;
  v_temp_pin text;
  v_success boolean := false;
  v_message text := 'Approval failed';
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM pin_reset_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    v_message := 'Request not found or already processed';
  ELSE
    -- Generate temporary PIN if not provided
    v_temp_pin := COALESCE(p_temporary_pin, LPAD(FLOOR(RANDOM() * 10000)::text, 4, '0'));
    
    -- Update user or driver PIN
    IF v_request.user_type = 'user' THEN
      UPDATE unihub_users
      SET pin = v_temp_pin, updated_at = NOW()
      WHERE id = v_request.user_id;
    ELSIF v_request.user_type = 'driver' THEN
      UPDATE unihub_drivers
      SET pin = v_temp_pin, updated_at = NOW()
      WHERE id = v_request.user_id;
    END IF;
    
    -- Update request status
    UPDATE pin_reset_requests
    SET 
      status = 'approved',
      admin_id = p_admin_id,
      admin_notes = p_admin_notes,
      temporary_pin = v_temp_pin,
      reviewed_at = NOW(),
      completed_at = NOW()
    WHERE id = p_request_id;
    
    v_success := true;
    v_message := 'PIN reset approved and temporary PIN assigned';
  END IF;
  
  success := v_success;
  message := v_message;
  temporary_pin := v_temp_pin;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for admin to reject PIN reset request
CREATE OR REPLACE FUNCTION reject_pin_reset_request(
  p_request_id uuid,
  p_admin_id text DEFAULT NULL,
  p_admin_notes text DEFAULT NULL
) RETURNS TABLE(
  success boolean,
  message text
) AS $$
DECLARE
  v_request record;
  v_success boolean := false;
  v_message text := 'Rejection failed';
BEGIN
  -- Get the request
  SELECT * INTO v_request
  FROM pin_reset_requests
  WHERE id = p_request_id AND status = 'pending';
  
  IF NOT FOUND THEN
    v_message := 'Request not found or already processed';
  ELSE
    -- Update request status
    UPDATE pin_reset_requests
    SET 
      status = 'rejected',
      admin_id = p_admin_id,
      admin_notes = p_admin_notes,
      reviewed_at = NOW()
    WHERE id = p_request_id;
    
    v_success := true;
    v_message := 'PIN reset request rejected';
  END IF;
  
  success := v_success;
  message := v_message;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get pending PIN reset requests for admin
CREATE OR REPLACE FUNCTION get_pending_pin_reset_requests() RETURNS TABLE(
  id uuid,
  user_type text,
  user_id text,
  user_name text,
  user_phone text,
  request_reason text,
  requested_at timestamp with time zone,
  status text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    id,
    user_type,
    user_id,
    user_name,
    user_phone,
    request_reason,
    requested_at,
    status
  FROM pin_reset_requests
  WHERE status = 'pending'
  ORDER BY requested_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has pending reset request
CREATE OR REPLACE FUNCTION check_pending_reset_request(
  p_user_id text,
  p_user_type text
) RETURNS TABLE(
  has_pending boolean,
  request_id uuid,
  requested_at timestamp with time zone
) AS $$
DECLARE
  v_request record;
BEGIN
  SELECT * INTO v_request
  FROM pin_reset_requests
  WHERE user_id = p_user_id 
    AND user_type = p_user_type 
    AND status = 'pending';
  
  IF FOUND THEN
    has_pending := true;
    request_id := v_request.id;
    requested_at := v_request.requested_at;
  ELSE
    has_pending := false;
    request_id := NULL;
    requested_at := NULL;
  END IF;
  
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
