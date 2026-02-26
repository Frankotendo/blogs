-- ============================================================
-- FIX BLACK SCREEN ISSUES - PRODUCTION DEBUGGING
-- ============================================================

-- Check if all required tables exist for the app to function
SELECT 'TABLES CHECK' as check_type,
       json_build_object(
           'unihub_settings', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_settings'),
           'unihub_nodes', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_nodes'),
           'unihub_drivers', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_drivers'),
           'unihub_missions', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_missions'),
           'unihub_transactions', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_transactions'),
           'unihub_topups', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_topups'),
           'unihub_registrations', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_registrations'),
           'driver_locations', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'driver_locations'),
           'overall_status', CASE 
               WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_settings')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_nodes')
                    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_drivers')
               THEN 'TABLES_READY'
               ELSE 'TABLES_MISSING'
           END
       ) as table_status;

-- Check if essential settings exist
SELECT 'SETTINGS CHECK' as check_type,
       json_build_object(
           'has_settings', EXISTS (SELECT 1 FROM public.unihub_settings LIMIT 1),
           'settings_count', (SELECT COUNT(*) FROM public.unihub_settings),
           'sample_settings', (
               SELECT json_build_object(
                   'adminMomo', admin_momo,
                   'farePerPragia', fare_per_pragia,
                   'farePerTaxi', fare_per_taxi,
                   'commissionPerSeat', commission_per_seat
               ) FROM public.unihub_settings LIMIT 1
           ),
           'status', CASE 
               WHEN EXISTS (SELECT 1 FROM public.unihub_settings LIMIT 1) THEN 'SETTINGS_OK'
               ELSE 'SETTINGS_MISSING'
           END
       ) as settings_status;

-- Create missing driver_locations table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.driver_locations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    driver_id TEXT NOT NULL REFERENCES public.unihub_drivers(id),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for driver_locations
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON public.driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_last_updated ON public.driver_locations(last_updated);

-- Enable RLS for driver_locations
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for driver_locations
DROP POLICY IF EXISTS "Drivers can view own locations" ON public.driver_locations;
CREATE POLICY "Drivers can view own locations" ON public.driver_locations
    FOR SELECT USING (current_setting('app.current_user_email', true) IN (
        SELECT email FROM public.unihub_drivers WHERE id = driver_id
    ));

DROP POLICY IF EXISTS "Drivers can update own locations" ON public.driver_locations;
CREATE POLICY "Drivers can update own locations" ON public.driver_locations
    FOR INSERT WITH CHECK (current_setting('app.current_user_email', true) IN (
        SELECT email FROM public.unihub_drivers WHERE id = driver_id
    ));

-- Grant permissions
GRANT ALL ON public.driver_locations TO authenticated;
GRANT SELECT ON public.driver_locations TO anon;

-- Insert default settings if missing
INSERT INTO public.unihub_settings (
    id,
    admin_momo,
    admin_momo_name,
    whatsapp_number,
    commission_per_seat,
    shuttle_commission,
    fare_per_pragia,
    fare_per_taxi,
    solo_multiplier,
    about_me_text,
    registration_fee,
    created_at
) SELECT 
    gen_random_uuid(),
    '024-123-4567',
    'NexRyde Admin',
    '233241234567',
    2.0,
    0.5,
    5.0,
    8.0,
    2.5,
    'Welcome to NexRyde Logistics - Your trusted ride-sharing platform in Ghana.',
    20.0,
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM public.unihub_settings LIMIT 1);

-- Test the connection and data retrieval
SELECT 'CONNECTION TEST' as test_type,
       json_build_object(
           'database_connection', 'SUCCESS',
           'settings_accessible', EXISTS (SELECT 1 FROM public.unihub_settings LIMIT 1),
           'drivers_table_accessible', EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'unihub_drivers'),
           'sample_driver_count', (SELECT COUNT(*) FROM public.unihub_drivers LIMIT 1),
           'sample_node_count', (SELECT COUNT(*) FROM public.unihub_nodes LIMIT 1)
       ) as connection_test;

-- ============================================================
-- BLACK SCREEN FIXES COMPLETE
-- ============================================================
