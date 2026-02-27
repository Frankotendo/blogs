-- ============================================================
-- VERIFY AND SETUP TRACKING DATABASE STRUCTURE
-- ============================================================

-- 1. Check existing tables
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_name IN ('unihub_drivers', 'driver_locations')
ORDER BY table_name;

-- 2. Check unihub_drivers table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'unihub_drivers' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Check driver_locations table structure  
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'driver_locations' 
    AND table_schema = 'public'
ORDER BY ordinal_position;

-- 4. Ensure unihub_drivers has required columns for tracking
DO $$
BEGIN
    -- Add vehicleType column if it doesn't exist (note: your schema uses quotes)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unihub_drivers' 
        AND column_name = 'vehicleType'
    ) THEN
        ALTER TABLE unihub_drivers ADD COLUMN "vehicleType" text DEFAULT 'Taxi' CHECK ("vehicleType" = ANY (ARRAY['Pragia'::text, 'Taxi'::text, 'Shuttle'::text]));
        RAISE NOTICE 'Added vehicleType column to unihub_drivers';
    END IF;

    -- Add status column if it doesn't exist (your schema already has this)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unihub_drivers' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE unihub_drivers ADD COLUMN status text DEFAULT 'offline' CHECK (status = ANY (ARRAY['online'::text, 'busy'::text, 'offline'::text]));
        RAISE NOTICE 'Added status column to unihub_drivers';
    END IF;

    -- Add name column if it doesn't exist (your schema already has this)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unihub_drivers' 
        AND column_name = 'name'
    ) THEN
        ALTER TABLE unihub_drivers ADD COLUMN name text;
        RAISE NOTICE 'Added name column to unihub_drivers';
    END IF;

    -- Add pin column if it doesn't exist (your schema already has this)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unihub_drivers' 
        AND column_name = 'pin'
    ) THEN
        ALTER TABLE unihub_drivers ADD COLUMN pin text;
        RAISE NOTICE 'Added pin column to unihub_drivers';
    END IF;
END $$;

-- 5. Create driver_locations table if it doesn't exist (from existing script)
CREATE TABLE IF NOT EXISTS public.driver_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  driver_id text NOT NULL UNIQUE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  heading numeric,
  speed numeric,
  accuracy numeric,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT driver_locations_pkey PRIMARY KEY (id),
  CONSTRAINT driver_locations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.unihub_drivers(id) ON DELETE CASCADE
);

-- 6. Setup RLS for driver_locations
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Public can view driver locations" ON public.driver_locations;
DROP POLICY IF EXISTS "Drivers can update own location" ON public.driver_locations;
DROP POLICY IF EXISTS "Public can insert driver locations" ON public.driver_locations;

-- Create new RLS policies
CREATE POLICY "Public can view driver locations" ON public.driver_locations
  FOR SELECT USING (true);

CREATE POLICY "Drivers can update own location" ON public.driver_locations
  FOR UPDATE USING (auth.uid()::text = driver_id);

CREATE POLICY "Public can insert driver locations" ON public.driver_locations
  FOR INSERT WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.driver_locations TO anon;
GRANT SELECT ON public.driver_locations TO authenticated;
GRANT INSERT ON public.driver_locations TO anon;
GRANT INSERT ON public.driver_locations TO authenticated;
GRANT UPDATE ON public.driver_locations TO authenticated;
GRANT DELETE ON public.driver_locations TO authenticated;

-- 7. Setup RLS for unihub_drivers (for public read access)
ALTER TABLE public.unihub_drivers ENABLE ROW LEVEL SECURITY;

-- Drop existing driver policies
DROP POLICY IF EXISTS "Public can view drivers" ON public.unihub_drivers;
DROP POLICY IF EXISTS "Drivers can update own profile" ON public.unihub_drivers;

-- Create new driver policies
CREATE POLICY "Public can view drivers" ON public.unihub_drivers
  FOR SELECT USING (true);

CREATE POLICY "Drivers can update own profile" ON public.unihub_drivers
  FOR UPDATE USING (auth.uid()::text = id);

-- Grant permissions for drivers
GRANT SELECT ON public.unihub_drivers TO anon;
GRANT SELECT ON public.unihub_drivers TO authenticated;
GRANT INSERT ON public.unihub_drivers TO anon;
GRANT INSERT ON public.unihub_drivers TO authenticated;
GRANT UPDATE ON public.unihub_drivers TO authenticated;
GRANT DELETE ON public.unihub_drivers TO authenticated;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_last_updated ON public.driver_locations(last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_unihub_drivers_status ON public.unihub_drivers(status);
CREATE INDEX IF NOT EXISTS idx_unihub_drivers_vehicleType ON public.unihub_drivers("vehicleType");

-- 9. Enable Realtime for tracking tables
-- Drop existing publications
DROP PUBLICATION IF EXISTS supabase_realtime;

-- Create new publication with tracking tables
CREATE PUBLICATION supabase_realtime FOR TABLE unihub_drivers, driver_locations;

-- 10. Test the setup with sample data (optional)
-- This will only insert if tables are empty
DO $$
BEGIN
    -- Insert sample driver if none exist
    IF (SELECT COUNT(*) FROM unihub_drivers) = 0 THEN
        INSERT INTO unihub_drivers (id, name, "vehicleType", status, pin) VALUES
        ('SAMPLE_DRIVER_001', 'Sample Driver 1', 'Taxi', 'online', '1234'),
        ('SAMPLE_DRIVER_002', 'Sample Driver 2', 'Pragia', 'online', '5678'),
        ('SAMPLE_DRIVER_003', 'Sample Driver 3', 'Shuttle', 'busy', '9012');
        RAISE NOTICE 'Inserted sample drivers';
    END IF;

    -- Insert sample locations if none exist
    IF (SELECT COUNT(*) FROM driver_locations) = 0 THEN
        INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed) VALUES
        ('SAMPLE_DRIVER_001', 5.6037, -0.1870, 45, 40),
        ('SAMPLE_DRIVER_002', 5.6147, -0.1970, 90, 35),
        ('SAMPLE_DRIVER_003', 5.5937, -0.1770, 180, 50);
        RAISE NOTICE 'Inserted sample driver locations';
    END IF;
END $$;

-- 11. Final verification
SELECT 
    'Setup Complete' as status,
    (SELECT COUNT(*) FROM unihub_drivers) as driver_count,
    (SELECT COUNT(*) FROM driver_locations) as location_count,
    (SELECT COUNT(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime') as realtime_tables_enabled;

-- Instructions:
-- 1. Run this entire script in your Supabase SQL Editor
-- 2. Check the output for any error messages
-- 3. Verify the final counts show your data
-- 4. Test with the tracking HTML files
