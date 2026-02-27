-- ============================================================
-- PASSENGER LOCATION TRACKING FOR DRIVERS
-- ============================================================

-- 1. Create passenger_locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.passenger_locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  passenger_id text NOT NULL UNIQUE,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  accuracy numeric,
  heading numeric,
  speed numeric,
  last_updated timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT passenger_locations_pkey PRIMARY KEY (id),
  CONSTRAINT passenger_locations_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.unihub_users(id) ON DELETE CASCADE
);

-- 2. Enable RLS for passenger_locations
ALTER TABLE public.passenger_locations ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS policies for passenger_locations
DROP POLICY IF EXISTS "Public can view passenger locations" ON public.passenger_locations;
DROP POLICY IF EXISTS "Passengers can update own location" ON public.passenger_locations;
DROP POLICY IF EXISTS "Public can insert passenger locations" ON public.passenger_locations;

CREATE POLICY "Public can view passenger locations" ON public.passenger_locations
  FOR SELECT USING (true);

CREATE POLICY "Passengers can update own location" ON public.passenger_locations
  FOR UPDATE USING (auth.uid()::text = passenger_id);

CREATE POLICY "Public can insert passenger locations" ON public.passenger_locations
  FOR INSERT WITH CHECK (true);

-- 4. Grant permissions
GRANT SELECT ON public.passenger_locations TO anon;
GRANT SELECT ON public.passenger_locations TO authenticated;
GRANT INSERT ON public.passenger_locations TO anon;
GRANT INSERT ON public.passenger_locations TO authenticated;
GRANT UPDATE ON public.passenger_locations TO authenticated;
GRANT DELETE ON public.passenger_locations TO authenticated;

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_passenger_locations_passenger_id ON public.passenger_locations(passenger_id);
CREATE INDEX IF NOT EXISTS idx_passenger_locations_last_updated ON public.passenger_locations(last_updated DESC);

-- 6. Add passenger location tracking to ride nodes
DO $$
BEGIN
    -- Add passenger_latitude column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unihub_nodes' 
        AND column_name = 'passenger_latitude'
    ) THEN
        ALTER TABLE unihub_nodes ADD COLUMN passenger_latitude numeric;
        RAISE NOTICE 'Added passenger_latitude column to unihub_nodes';
    END IF;

    -- Add passenger_longitude column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unihub_nodes' 
        AND column_name = 'passenger_longitude'
    ) THEN
        ALTER TABLE unihub_nodes ADD COLUMN passenger_longitude numeric;
        RAISE NOTICE 'Added passenger_longitude column to unihub_nodes';
    END IF;

    -- Add passenger_last_update column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'unihub_nodes' 
        AND column_name = 'passenger_last_update'
    ) THEN
        ALTER TABLE unihub_nodes ADD COLUMN passenger_last_update timestamp with time zone;
        RAISE NOTICE 'Added passenger_last_update column to unihub_nodes';
    END IF;
END $$;

-- 7. Create function to update passenger location in active rides
CREATE OR REPLACE FUNCTION update_passenger_location_in_ride(
    p_passenger_id text,
    p_latitude numeric,
    p_longitude numeric,
    p_accuracy numeric DEFAULT NULL,
    p_heading numeric DEFAULT NULL,
    p_speed numeric DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    -- Update passenger_locations table
    INSERT INTO passenger_locations (passenger_id, latitude, longitude, accuracy, heading, speed, last_updated)
    VALUES (p_passenger_id, p_latitude, p_longitude, p_accuracy, p_heading, p_speed, NOW())
    ON CONFLICT (passenger_id) 
    DO UPDATE SET
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        accuracy = EXCLUDED.accuracy,
        heading = EXCLUDED.heading,
        speed = EXCLUDED.speed,
        last_updated = EXCLUDED.last_updated;
    
    -- Update active ride nodes with passenger location
    UPDATE unihub_nodes 
    SET 
        passenger_latitude = p_latitude,
        passenger_longitude = p_longitude,
        passenger_last_update = NOW()
    WHERE 
        status IN ('forming', 'qualified', 'dispatched')
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(passengers) AS p
            WHERE p->>'id' = p_passenger_id
        );
    
    RAISE NOTICE 'Updated passenger location for %', p_passenger_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Enable realtime for passenger tracking
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE unihub_drivers, driver_locations, passenger_locations, unihub_nodes;

-- 9. Create view for driver passenger tracking
CREATE OR REPLACE VIEW driver_passenger_tracking AS
SELECT 
    n.id as node_id,
    n."assignedDriverId" as driver_id,
    n.status as ride_status,
    n.passenger_latitude,
    n.passenger_longitude,
    n.passenger_last_update,
    pl.latitude as current_passenger_lat,
    pl.longitude as current_passenger_lng,
    pl.last_updated as passenger_location_updated,
    dl.latitude as driver_lat,
    dl.longitude as driver_lng,
    dl.last_updated as driver_location_updated,
    -- Calculate distance between driver and passenger
    CASE 
        WHEN n.passenger_latitude IS NOT NULL AND dl.latitude IS NOT NULL THEN
            6371 * acos(
                cos(radians(n.passenger_latitude)) * cos(radians(dl.latitude)) *
                cos(radians(dl.longitude) - radians(n.passenger_longitude)) +
                sin(radians(n.passenger_latitude)) * sin(radians(dl.latitude))
            )
        ELSE NULL
    END as distance_km
FROM unihub_nodes n
LEFT JOIN driver_locations dl ON n."assignedDriverId" = dl.driver_id
LEFT JOIN passenger_locations pl ON (
    EXISTS (
        SELECT 1 FROM jsonb_array_elements(n.passengers) AS p
        WHERE p->>'id' = pl.passenger_id
    )
)
WHERE n."assignedDriverId" IS NOT NULL 
    AND n.status IN ('qualified', 'dispatched');

-- 10. Test the setup
SELECT 
    'Passenger tracking setup complete' as status,
    (SELECT COUNT(*) FROM passenger_locations) as passenger_location_count,
    (SELECT COUNT(*) FROM driver_passenger_tracking) as active_tracking_pairs;
