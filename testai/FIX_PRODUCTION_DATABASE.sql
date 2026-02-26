-- ============================================================
-- PRODUCTION DATABASE FIXES - CAPACITY & DIRECTION TRACKING
-- ============================================================

-- Create driver_directions table for tracking route assignments
CREATE TABLE IF NOT EXISTS driver_directions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id TEXT NOT NULL,
    passenger_location JSONB NOT NULL, -- {lat: number, lng: number}
    destination JSONB, -- {lat: number, lng: number} - final destination
    directions_url TEXT NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status TEXT DEFAULT 'assigned' CHECK (status IN ('assigned', 'started', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_directions_driver_id ON driver_directions(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_directions_assigned_at ON driver_directions(assigned_at);
CREATE INDEX IF NOT EXISTS idx_driver_directions_status ON driver_directions(status);

-- Enable RLS (Row Level Security)
ALTER TABLE driver_directions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for driver_directions
CREATE POLICY "Drivers can view their own directions" ON driver_directions
    FOR SELECT USING (auth.uid()::text = driver_id);

CREATE POLICY "Drivers can insert their own directions" ON driver_directions
    FOR INSERT WITH CHECK (auth.uid()::text = driver_id);

CREATE POLICY "Drivers can update their own directions" ON driver_directions
    FOR UPDATE USING (auth.uid()::text = driver_id);

CREATE POLICY "Admins can view all directions" ON driver_directions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.users.id = auth.uid() 
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_driver_directions_updated_at 
    BEFORE UPDATE ON driver_directions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add vehicle capacity constraints to unihub_drivers table
ALTER TABLE unihub_drivers 
ADD COLUMN IF NOT EXISTS max_capacity INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS current_load INTEGER DEFAULT 0;

-- Add check constraints for realistic capacity values
ALTER TABLE unihub_drivers 
ADD CONSTRAINT check_max_capacity_positive CHECK (max_capacity > 0),
ADD CONSTRAINT check_current_load_non_negative CHECK (current_load >= 0),
ADD CONSTRAINT check_current_load_not_exceed_capacity CHECK (current_load <= max_capacity);

-- Update existing drivers with appropriate capacities based on vehicle type
UPDATE unihub_drivers 
SET max_capacity = CASE 
    WHEN vehicle_type = 'Pragia' THEN 4
    WHEN vehicle_type = 'Taxi' THEN 4
    WHEN vehicle_type = 'Shuttle' THEN 60
    ELSE 4
END
WHERE max_capacity = 4; -- Only update defaults

-- Add capacity tracking to unihub_nodes table
ALTER TABLE unihub_nodes 
ADD COLUMN IF NOT EXISTS max_capacity INTEGER,
ADD COLUMN IF NOT EXISTS vehicle_capacity_enforced BOOLEAN DEFAULT false;

-- Create function to validate vehicle capacity
CREATE OR REPLACE FUNCTION validate_vehicle_capacity(
    p_driver_id TEXT,
    p_requested_seats INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_driver RECORD;
    v_current_load INTEGER;
    v_available_seats INTEGER;
    v_result JSONB;
BEGIN
    -- Get driver details
    SELECT * INTO v_driver 
    FROM unihub_drivers 
    WHERE id = p_driver_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'valid', false,
            'error', 'Driver not found'
        );
    END IF;
    
    -- Calculate current load from active trips
    SELECT COALESCE(SUM(jsonb_array_length(passengers::jsonb)), 0) INTO v_current_load
    FROM unihub_nodes
    WHERE assigned_driver_id = p_driver_id
    AND status IN ('forming', 'qualified', 'dispatched');
    
    -- Calculate available seats
    v_available_seats := v_driver.max_capacity - v_current_load;
    
    -- Build result
    v_result := jsonb_build_object(
        'valid', v_available_seats >= p_requested_seats,
        'driver_id', p_driver_id,
        'vehicle_type', v_driver.vehicle_type,
        'max_capacity', v_driver.max_capacity,
        'current_load', v_current_load,
        'available_seats', v_available_seats,
        'requested_seats', p_requested_seats
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to assign driver directions
CREATE OR REPLACE FUNCTION assign_driver_direction(
    p_driver_id TEXT,
    p_passenger_lat NUMERIC,
    p_passenger_lng NUMERIC,
    p_destination_lat NUMERIC DEFAULT NULL,
    p_destination_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_driver_location RECORD;
    v_directions_url TEXT;
    v_direction_id UUID;
BEGIN
    -- Get driver's current location
    SELECT latitude, longitude INTO v_driver_location
    FROM driver_locations
    WHERE driver_id = p_driver_id
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Fallback to driver's stored location if no recent location
    IF NOT FOUND THEN
        SELECT latitude, longitude INTO v_driver_location
        FROM unihub_drivers
        WHERE id = p_driver_id;
    END IF;
    
    -- Build directions URL
    IF p_destination_lat IS NOT NULL AND p_destination_lng IS NOT NULL THEN
        -- Full route: Driver -> Passenger -> Destination
        v_directions_url := format(
            'https://www.google.com/maps/dir/?api=1&origin=%s,%s&waypoints=%s,%s&destination=%s,%s',
            v_driver_location.latitude, v_driver_location.longitude,
            p_passenger_lat, p_passenger_lng,
            p_destination_lat, p_destination_lng
        );
    ELSE
        -- Simple route: Driver -> Passenger
        v_directions_url := format(
            'https://www.google.com/maps/dir/?api=1&origin=%s,%s&destination=%s,%s',
            v_driver_location.latitude, v_driver_location.longitude,
            p_passenger_lat, p_passenger_lng
        );
    END IF;
    
    -- Insert direction record
    INSERT INTO driver_directions (
        driver_id,
        passenger_location,
        destination,
        directions_url,
        status
    ) VALUES (
        p_driver_id,
        jsonb_build_object('lat', p_passenger_lat, 'lng', p_passenger_lng),
        CASE 
            WHEN p_destination_lat IS NOT NULL AND p_destination_lng IS NOT NULL 
            THEN jsonb_build_object('lat', p_destination_lat, 'lng', p_destination_lng)
            ELSE NULL
        END,
        v_directions_url,
        'assigned'
    ) RETURNING id INTO v_direction_id;
    
    -- Return result
    RETURN jsonb_build_object(
        'success', true,
        'direction_id', v_direction_id,
        'directions_url', v_directions_url,
        'driver_location', jsonb_build_object(
            'lat', v_driver_location.latitude,
            'lng', v_driver_location.longitude
        ),
        'passenger_location', jsonb_build_object(
            'lat', p_passenger_lat,
            'lng', p_passenger_lng
        ),
        'destination', CASE 
            WHEN p_destination_lat IS NOT NULL AND p_destination_lng IS NOT NULL 
            THEN jsonb_build_object('lat', p_destination_lat, 'lng', p_destination_lng)
            ELSE NULL
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION validate_vehicle_capacity TO authenticated;
GRANT EXECUTE ON FUNCTION assign_driver_direction TO authenticated;
GRANT ALL ON driver_directions TO authenticated;
GRANT SELECT ON driver_directions TO anon;

-- Create view for active driver directions
CREATE OR REPLACE VIEW active_driver_directions AS
SELECT 
    dd.*,
    d.name as driver_name,
    d.vehicle_type,
    d.contact as driver_contact
FROM driver_directions dd
LEFT JOIN unihub_drivers d ON dd.driver_id = d.id
WHERE dd.status IN ('assigned', 'started')
ORDER BY dd.assigned_at DESC;

-- Grant permissions on view
GRANT SELECT ON active_driver_directions TO authenticated;
GRANT SELECT ON active_driver_directions TO anon;

-- Production check: Verify critical tables exist
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    -- Check unihub_settings
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'unihub_settings'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'unihub_settings table missing - this will cause black screen';
    END IF;
    
    -- Check unihub_nodes
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'unihub_nodes'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'unihub_nodes table missing - this will cause black screen';
    END IF;
    
    -- Check unihub_drivers
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'unihub_drivers'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'unihub_drivers table missing - this will cause black screen';
    END IF;
    
    -- Check driver_locations
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'driver_locations'
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        RAISE EXCEPTION 'driver_locations table missing - tracking will not work';
    END IF;
    
    RAISE NOTICE '✅ All critical tables exist - production ready';
END $$;

-- Insert default settings if missing
INSERT INTO unihub_settings (
    adminMomo, adminMomoName, whatsappNumber, 
    commissionPerSeat, shuttleCommission, 
    farePerPragia, farePerTaxi, soloMultiplier,
    aboutMeText
) SELECT 
    '0551234567', 'System Admin', '0551234567',
    2.0, 0.5,
    5.0, 10.0, 1.5,
    'Welcome to UniHub - Your campus transport solution'
WHERE NOT EXISTS (SELECT 1 FROM unihub_settings LIMIT 1);

-- Final production status report
SELECT 
    'Production Database Fixes Applied' as status,
    NOW() as applied_at,
    (SELECT COUNT(*) FROM unihub_settings) as settings_count,
    (SELECT COUNT(*) FROM unihub_drivers) as drivers_count,
    (SELECT COUNT(*) FROM driver_directions) as directions_count,
    (SELECT COUNT(*) FROM driver_locations) as locations_count;
