-- FIX SCRIPT: Run this if you get "policy already exists" errors
-- This script drops existing policies and recreates them cleanly

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view live locations" ON live_locations;
DROP POLICY IF EXISTS "Users can update own live location" ON live_locations;
DROP POLICY IF EXISTS "Users can insert own live location" ON live_locations;
DROP POLICY IF EXISTS "Users can delete own live location" ON live_locations;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_live_locations_updated_at ON live_locations;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Recreate policies with proper names
CREATE POLICY "Enable view for all users" ON live_locations
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for own user" ON live_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own user" ON live_locations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for own user" ON live_locations
  FOR DELETE USING (auth.uid() = user_id);

-- Recreate trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_live_locations_updated_at
  BEFORE UPDATE ON live_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Verify table exists and has correct structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'live_locations' 
ORDER BY ordinal_position;

-- Verify RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'live_locations';

-- Verify realtime is enabled
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' AND tablename = 'live_locations';
