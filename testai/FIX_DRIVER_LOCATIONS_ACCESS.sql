-- ============================================================
-- FIX DRIVER_LOCATIONS TABLE ACCESS
-- ============================================================

-- Check if driver_locations table exists
SELECT 
    'driver_locations table check' as check_type,
    COUNT(*) as record_count
FROM information_schema.tables 
WHERE table_name = 'driver_locations' 
    AND table_schema = 'public';

-- If table doesn't exist, create it
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
  CONSTRAINT driver_locations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.unihub_drivers(id)
);

-- Create RLS policy to allow public read access
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
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

-- Grant necessary permissions
GRANT SELECT ON public.driver_locations TO anon;
GRANT SELECT ON public.driver_locations TO authenticated;
GRANT INSERT ON public.driver_locations TO anon;
GRANT INSERT ON public.driver_locations TO authenticated;
GRANT UPDATE ON public.driver_locations TO authenticated;
GRANT DELETE ON public.driver_locations TO authenticated;

-- Test the table access
SELECT 
    'Test driver_locations access' as test_type,
    COUNT(*) as location_count
FROM driver_locations
LIMIT 1;
