-- Create live_locations table for real-time tracking (if not exists)
CREATE TABLE IF NOT EXISTS live_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('driver', 'passenger')),
  lat FLOAT8 NOT NULL,
  lng FLOAT8 NOT NULL,
  heading FLOAT8 DEFAULT 0,
  speed FLOAT8 DEFAULT 0,
  vehicle_label TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (if not already enabled)
ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view all live locations" ON live_locations;
DROP POLICY IF EXISTS "Users can insert their own live location" ON live_locations;
DROP POLICY IF EXISTS "Users can update their own live location" ON live_locations;
DROP POLICY IF EXISTS "Users can delete their own live location" ON live_locations;

-- Create policies for live_locations
CREATE POLICY "Users can view all live locations" ON live_locations
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own live location" ON live_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own live location" ON live_locations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own live location" ON live_locations
  FOR DELETE USING (auth.uid() = user_id);

-- Create indexes for performance (if not exists)
CREATE INDEX IF NOT EXISTS idx_live_locations_user_id ON live_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_role ON live_locations(role);
CREATE INDEX IF NOT EXISTS idx_live_locations_updated_at ON live_locations(updated_at);

-- Enable Realtime (check if publication exists first)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'live_locations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE live_locations;
    END IF;
END $$;

-- Function to clean up old locations (older than 5 minutes)
CREATE OR REPLACE FUNCTION cleanup_old_locations()
RETURNS void AS $$
BEGIN
  DELETE FROM live_locations 
  WHERE updated_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically clean up old locations every minute
-- This requires pg_cron extension, but we'll handle cleanup in the app instead
