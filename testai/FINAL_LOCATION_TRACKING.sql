-- ============================================================
-- FINAL LOCATION TRACKING SQL - Handles Existing Functions
-- Based on your actual unihub schema
-- Run these commands in Supabase SQL Editor
-- ============================================================

-- 1. Add location tracking to existing unihub_drivers table
ALTER TABLE public.unihub_drivers 
ADD COLUMN IF NOT EXISTS current_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS current_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS heading DECIMAL(3, 0),
ADD COLUMN IF NOT EXISTS speed DECIMAL(5, 2),
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;

-- 2. Create new driver_locations table for real-time tracking
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL REFERENCES public.unihub_drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  heading DECIMAL(3, 0),
  speed DECIMAL(5, 2),
  accuracy DECIMAL(5, 2),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(driver_id)
);

-- 3. Create passenger_locations table (for unihub_users)
CREATE TABLE IF NOT EXISTS public.passenger_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id TEXT NOT NULL REFERENCES public.unihub_users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(5, 2),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(passenger_id)
);

-- 4. Enhance existing unihub_nodes table with location columns
ALTER TABLE public.unihub_nodes 
ADD COLUMN IF NOT EXISTS pickup_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS pickup_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS dropoff_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS dropoff_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS driver_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS driver_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS passenger_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS passenger_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS estimated_distance DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER,
ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tracking_ended_at TIMESTAMP WITH TIME ZONE;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_last_updated ON public.driver_locations(last_updated);
CREATE INDEX IF NOT EXISTS idx_passenger_locations_passenger_id ON public.passenger_locations(passenger_id);
CREATE INDEX IF NOT EXISTS idx_passenger_locations_last_updated ON public.passenger_locations(last_updated);
CREATE INDEX IF NOT EXISTS idx_nodes_pickup_location ON public.unihub_nodes(pickup_latitude, pickup_longitude);
CREATE INDEX IF NOT EXISTS idx_nodes_driver_location ON public.unihub_nodes(driver_latitude, driver_longitude);

-- 6. Enable Row Level Security
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passenger_locations ENABLE ROW LEVEL SECURITY;

-- 7. Drop existing functions if they exist (to avoid conflicts)
DROP FUNCTION IF EXISTS public.update_driver_location(TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.update_driver_location(TEXT, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.update_passenger_location(TEXT, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.update_passenger_location(TEXT, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.find_nearby_drivers(DECIMAL, DECIMAL, INTEGER, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.find_nearby_drivers(DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.update_node_locations(TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.get_driver_location(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_passenger_location(TEXT) CASCADE;

-- 8. Create RLS Policies (drop existing if they exist)
DROP POLICY IF EXISTS "Drivers can view own location" ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can update own location" ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can insert own location" ON public.driver_locations;
DROP POLICY IF EXISTS "Everyone can view driver locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Users can view own location" ON public.passenger_locations;

-- Driver locations policies
CREATE POLICY "Drivers can view own location" ON public.driver_locations
  FOR SELECT USING (auth.uid()::text = driver_id);

CREATE POLICY "Drivers can update own location" ON public.driver_locations
  FOR UPDATE USING (auth.uid()::text = driver_id);

CREATE POLICY "Drivers can insert own location" ON public.driver_locations
  FOR INSERT WITH CHECK (auth.uid()::text = driver_id);

CREATE POLICY "Everyone can view driver locations" ON public.driver_locations
  FOR SELECT USING (true);

-- Passenger locations policies
CREATE POLICY "Users can view own location" ON public.passenger_locations
  FOR ALL USING (auth.uid()::text = passenger_id);

-- 9. Create functions for location updates (with explicit signatures)
CREATE OR REPLACE FUNCTION public.update_driver_location(
  p_driver_id TEXT,
  p_latitude DECIMAL(10, 8),
  p_longitude DECIMAL(11, 8),
  p_heading DECIMAL(3, 0) DEFAULT NULL,
  p_speed DECIMAL(5, 2) DEFAULT NULL,
  p_accuracy DECIMAL(5, 2) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Update driver's current location in main table
  UPDATE public.unihub_drivers 
  SET 
    current_latitude = p_latitude,
    current_longitude = p_longitude,
    heading = p_heading,
    speed = p_speed,
    last_location_update = NOW()
  WHERE id = p_driver_id;
  
  -- Insert/update in driver_locations table
  INSERT INTO public.driver_locations (
    driver_id, latitude, longitude, heading, speed, accuracy, last_updated
  ) VALUES (
    p_driver_id, p_latitude, p_longitude, p_heading, p_speed, p_accuracy, NOW()
  )
  ON CONFLICT (driver_id) 
  DO UPDATE SET
    latitude = p_latitude,
    longitude = p_longitude,
    heading = p_heading,
    speed = p_speed,
    accuracy = p_accuracy,
    last_updated = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_passenger_location(
  p_passenger_id TEXT,
  p_latitude DECIMAL(10, 8),
  p_longitude DECIMAL(11, 8),
  p_accuracy DECIMAL(5, 2) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Insert/update passenger location
  INSERT INTO public.passenger_locations (
    passenger_id, latitude, longitude, accuracy, last_updated
  ) VALUES (
    p_passenger_id, p_latitude, p_longitude, p_accuracy, NOW()
  )
  ON CONFLICT (passenger_id) 
  DO UPDATE SET
    latitude = p_latitude,
    longitude = p_longitude,
    accuracy = p_accuracy,
    last_updated = NOW();
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Function to find nearby drivers (matches your schema exactly)
CREATE OR REPLACE FUNCTION public.find_nearby_drivers(
  p_latitude DECIMAL(10, 8),
  p_longitude DECIMAL(11, 8),
  p_radius_km INTEGER DEFAULT 5,
  p_vehicle_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  driver_id TEXT,
  driver_name TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  "vehicleType" TEXT,
  status TEXT,
  distance_km DECIMAL(8, 2),
  eta_minutes INTEGER,
  rating DECIMAL(3, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dl.driver_id,
    d.name,
    dl.latitude,
    dl.longitude,
    d."vehicleType",
    d.status,
    -- Calculate distance using Haversine formula
    (6371 * acos(
      cos(radians(p_latitude)) * cos(radians(dl.latitude)) * 
      cos(radians(dl.longitude) - radians(p_longitude)) + 
      sin(radians(p_latitude)) * sin(radians(dl.latitude))
    ))::decimal(8,2) as distance_km,
    -- Estimate ETA (assuming 30 km/h average speed)
    CEIL((6371 * acos(
      cos(radians(p_latitude)) * cos(radians(dl.latitude)) * 
      cos(radians(dl.longitude) - radians(p_longitude)) + 
      sin(radians(p_latitude)) * sin(radians(dl.latitude))
    )) / 30 * 60) as eta_minutes,
    d.rating
  FROM public.driver_locations dl
  JOIN public.unihub_drivers d ON dl.driver_id = d.id
  WHERE 
    d.status = 'online'
    AND (p_vehicle_type IS NULL OR d."vehicleType" = p_vehicle_type)
    AND (6371 * acos(
      cos(radians(p_latitude)) * cos(radians(dl.latitude)) * 
      cos(radians(dl.longitude) - radians(p_longitude)) + 
      sin(radians(p_latitude)) * sin(radians(dl.latitude))
    )) <= p_radius_km
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Function to update node (ride) locations
CREATE OR REPLACE FUNCTION public.update_node_locations(
  p_node_id TEXT,
  p_driver_latitude DECIMAL(10, 8),
  p_driver_longitude DECIMAL(11, 8),
  p_passenger_latitude DECIMAL(10, 8),
  p_passenger_longitude DECIMAL(11, 8)
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.unihub_nodes 
  SET 
    driver_latitude = p_driver_latitude,
    driver_longitude = p_driver_longitude,
    passenger_latitude = p_passenger_latitude,
    passenger_longitude = p_passenger_longitude,
    tracking_started_at = COALESCE(tracking_started_at, NOW())
  WHERE id = p_node_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Function to get driver's current location
CREATE OR REPLACE FUNCTION public.get_driver_location(
  p_driver_id TEXT
)
RETURNS TABLE(
  driver_id TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  heading DECIMAL(3, 0),
  speed DECIMAL(5, 2),
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dl.driver_id,
    dl.latitude,
    dl.longitude,
    dl.heading,
    dl.speed,
    dl.last_updated
  FROM public.driver_locations dl
  WHERE dl.driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Function to get passenger's current location
CREATE OR REPLACE FUNCTION public.get_passenger_location(
  p_passenger_id TEXT
)
RETURNS TABLE(
  passenger_id TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  accuracy DECIMAL(5, 2),
  last_updated TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pl.passenger_id,
    pl.latitude,
    pl.longitude,
    pl.accuracy,
    pl.last_updated
  FROM public.passenger_locations pl
  WHERE pl.passenger_id = p_passenger_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 14. Grant permissions
GRANT ALL ON public.driver_locations TO authenticated;
GRANT ALL ON public.passenger_locations TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_driver_location(TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_passenger_location(TEXT, DECIMAL, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_nearby_drivers(DECIMAL, DECIMAL, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_node_locations(TEXT, DECIMAL, DECIMAL, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_driver_location(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_passenger_location(TEXT) TO authenticated;
