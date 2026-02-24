-- NEW CODE START - Optional Supabase Schema for Driver Tracking (Future Enhancement)
-- This is OPTIONAL - current implementation works without any database changes

-- Driver locations table for real-time tracking
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT REFERENCES unihub_drivers(id) ON DELETE CASCADE, -- Fixed: references unihub_drivers table
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  vehicle_type VARCHAR(20) CHECK (vehicle_type IN ('Pragia', 'Taxi', 'Shuttle')),
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'busy', 'offline')),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  heading DECIMAL(3, 1), -- Direction in degrees (0-360)
  speed DECIMAL(5, 2), -- Speed in km/h
  
  CONSTRAINT valid_lat CHECK (lat >= -90 AND lat <= 90),
  CONSTRAINT valid_lng CHECK (lng >= -180 AND lng <= 180),
  CONSTRAINT valid_speed CHECK (speed >= 0 AND speed <= 200)
);

-- Index for performance
CREATE INDEX idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX idx_driver_locations_status ON driver_locations(status);
CREATE INDEX idx_driver_locations_last_updated ON driver_locations(last_updated);

-- Function to update driver location (upsert)
CREATE OR REPLACE FUNCTION update_driver_location(
  p_driver_id TEXT, -- Fixed: TEXT type to match unihub_drivers.id
  p_lat DECIMAL(10, 8),
  p_lng DECIMAL(11, 8),
  p_vehicle_type VARCHAR(20) DEFAULT NULL,
  p_status VARCHAR(20) DEFAULT 'online',
  p_heading DECIMAL(3, 1) DEFAULT NULL,
  p_speed DECIMAL(5, 2) DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO driver_locations (driver_id, lat, lng, vehicle_type, status, heading, speed, last_updated)
  VALUES (p_driver_id, p_lat, p_lng, p_vehicle_type, p_status, p_heading, p_speed, NOW())
  ON CONFLICT (driver_id) 
  DO UPDATE SET
    lat = EXCLUDED.lat,
    lng = EXCLUDED.lng,
    vehicle_type = COALESCE(EXCLUDED.vehicle_type, driver_locations.vehicle_type),
    status = EXCLUDED.status,
    heading = EXCLUDED.heading,
    speed = EXCLUDED.speed,
    last_updated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Real-time subscription policy (if using RLS)
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Drivers can view all driver locations" ON driver_locations;
DROP POLICY IF EXISTS "Drivers can update their own location" ON driver_locations;
DROP POLICY IF EXISTS "Drivers can update their own location" ON driver_locations;

-- Create policies only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_locations' 
    AND policyname = 'Drivers can view all driver locations'
  ) THEN
    CREATE POLICY "Drivers can view all driver locations" ON driver_locations
    FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_locations' 
    AND policyname = 'Drivers can update their own location'
  ) THEN
    CREATE POLICY "Drivers can update their own location" ON driver_locations
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'driver_locations' 
    AND policyname = 'Drivers can update their own location'
  ) THEN
    CREATE POLICY "Drivers can update their own location" ON driver_locations
    FOR UPDATE USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Clean up old locations (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_driver_locations()
RETURNS VOID AS $$
BEGIN
  DELETE FROM driver_locations 
  WHERE last_updated < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- NEW CODE END
