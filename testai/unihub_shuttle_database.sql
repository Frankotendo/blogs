-- ===================================
-- 🚌 UNIHUB SHUTTLE TRACKING DATABASE
-- ===================================

-- Users table (Students and Non-students)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    user_type VARCHAR(20) CHECK (user_type IN ('student', 'non_student', 'driver')) NOT NULL,
    student_id VARCHAR(50), -- For students
    department VARCHAR(100), -- For students
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drivers table
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    driver_license VARCHAR(50) UNIQUE NOT NULL,
    vehicle_type VARCHAR(20) CHECK (vehicle_type IN ('taxi', 'shuttle', 'pragia')) NOT NULL,
    vehicle_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_capacity INTEGER NOT NULL,
    current_latitude DECIMAL(10, 8),
    current_longitude DECIMAL(11, 8),
    last_location_update TIMESTAMP WITH TIME ZONE,
    is_online BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    current_trip_id UUID, -- Will reference trips after it's created
    rating DECIMAL(3, 2) DEFAULT 5.0,
    total_trips INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shuttle routes (for campus shuttles)
CREATE TABLE IF NOT EXISTS shuttle_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_name VARCHAR(100) NOT NULL,
    route_color VARCHAR(7) DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Shuttle route stops
CREATE TABLE IF NOT EXISTS shuttle_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES shuttle_routes(id) ON DELETE CASCADE,
    stop_name VARCHAR(100) NOT NULL,
    stop_order INTEGER NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    estimated_wait_time INTEGER DEFAULT 5, -- minutes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trips table
CREATE TABLE IF NOT EXISTS trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id),
    passenger_id UUID REFERENCES users(id),
    pickup_latitude DECIMAL(10, 8) NOT NULL,
    pickup_longitude DECIMAL(11, 8) NOT NULL,
    pickup_address TEXT,
    destination_latitude DECIMAL(10, 8),
    destination_longitude DECIMAL(11, 8),
    destination_address TEXT,
    vehicle_type VARCHAR(20) NOT NULL,
    trip_status VARCHAR(20) CHECK (trip_status IN ('requested', 'dispatched', 'arrived', 'in_progress', 'completed', 'cancelled')) DEFAULT 'requested',
    fare_amount DECIMAL(10, 2),
    payment_status VARCHAR(20) CHECK (payment_status IN ('pending', 'paid', 'refunded')) DEFAULT 'pending',
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'mobile_money', 'card')) DEFAULT 'cash',
    estimated_pickup_time TIMESTAMP WITH TIME ZONE,
    actual_pickup_time TIMESTAMP WITH TIME ZONE,
    estimated_dropoff_time TIMESTAMP WITH TIME ZONE,
    actual_dropoff_time TIMESTAMP WITH TIME ZONE,
    distance_km DECIMAL(8, 3),
    duration_minutes INTEGER,
    route_data JSONB, -- Store route geometry and steps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Driver location history (for tracking and analytics)
CREATE TABLE IF NOT EXISTS driver_location_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed_kmh DECIMAL(5, 2),
    heading DECIMAL(5, 2), -- Direction in degrees
    accuracy_meters DECIMAL(6, 2),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trip_id UUID REFERENCES trips(id) -- Link to trip if during trip
);

-- Shuttle schedules (for campus routes)
CREATE TABLE IF NOT EXISTS shuttle_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID REFERENCES shuttle_routes(id) ON DELETE CASCADE,
    driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    frequency_minutes INTEGER DEFAULT 15, -- How often shuttle runs
    days_of_week TEXT[], -- ['monday', 'tuesday', ...]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trip ratings
CREATE TABLE IF NOT EXISTS trip_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    rating_type VARCHAR(20) CHECK (rating_type IN ('passenger_to_driver', 'driver_to_passenger')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for drivers.current_trip_id after trips table exists
ALTER TABLE drivers ADD CONSTRAINT fk_driver_current_trip 
    FOREIGN KEY (current_trip_id) REFERENCES trips(id) ON DELETE SET NULL;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL, -- 'trip_requested', 'driver_arrived', etc.
    data JSONB, -- Additional notification data
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_drivers_location ON drivers(current_latitude, current_longitude) WHERE is_online = TRUE;
CREATE INDEX IF NOT EXISTS idx_drivers_available ON drivers(is_available, is_online, vehicle_type);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(trip_status, created_at);
CREATE INDEX IF NOT EXISTS idx_trips_passenger ON trips(passenger_id, trip_status);
CREATE INDEX IF NOT EXISTS idx_driver_location_history_timestamp ON driver_location_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_shuttle_stops_route ON shuttle_stops(route_id, stop_order);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- Row Level Security (RLS) for privacy
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_location_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Drivers can view own profile" ON drivers FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Passengers can view own trips" ON trips FOR SELECT USING (passenger_id = auth.uid());
CREATE POLICY "Drivers can view assigned trips" ON trips FOR SELECT USING (driver_id = auth.uid());

-- Function to update driver location
CREATE OR REPLACE FUNCTION update_driver_location(
    p_driver_id UUID,
    p_latitude DECIMAL(10, 8),
    p_longitude DECIMAL(11, 8),
    p_speed_kmh DECIMAL(5, 2) DEFAULT NULL,
    p_heading DECIMAL(5, 2) DEFAULT NULL,
    p_accuracy_meters DECIMAL(6, 2) DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    -- Update driver current location
    UPDATE drivers 
    SET 
        current_latitude = p_latitude,
        current_longitude = p_longitude,
        last_location_update = NOW()
    WHERE id = p_driver_id;
    
    -- Insert into location history
    INSERT INTO driver_location_history (driver_id, latitude, longitude, speed_kmh, heading, accuracy_meters)
    VALUES (p_driver_id, p_latitude, p_longitude, p_speed_kmh, p_heading, p_accuracy_meters);
    
    -- Update trip if driver is on active trip
    UPDATE trips 
    SET 
        estimated_pickup_time = NOW() + INTERVAL '1 minute' * (
            SELECT calculate_distance(p_latitude, p_longitude, pickup_latitude, pickup_longitude) / 40.0
        )
    WHERE driver_id = p_driver_id 
    AND trip_status IN ('dispatched', 'en_route');
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearest available drivers
CREATE OR REPLACE FUNCTION find_nearest_drivers(
    p_latitude DECIMAL(10, 8),
    p_longitude DECIMAL(11, 8),
    p_vehicle_type VARCHAR(20) DEFAULT NULL,
    p_radius_km DECIMAL(5, 2) DEFAULT 10.0,
    p_limit INTEGER DEFAULT 5
) RETURNS TABLE (
    driver_id UUID,
    driver_name VARCHAR(255),
    vehicle_type VARCHAR(20),
    distance_km DECIMAL(8, 3),
    eta_minutes INTEGER,
    rating DECIMAL(3, 2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        u.full_name,
        d.vehicle_type,
        (6371 * acos(
            cos(radians(p_latitude)) * 
            cos(radians(d.current_latitude)) * 
            cos(radians(d.current_longitude) - radians(p_longitude)) + 
            sin(radians(p_latitude)) * 
            sin(radians(d.current_latitude))
        ))::DECIMAL(8, 3) as distance_km,
        CEIL((6371 * acos(
            cos(radians(p_latitude)) * 
            cos(radians(d.current_latitude)) * 
            cos(radians(d.current_longitude) - radians(p_longitude)) + 
            sin(radians(p_latitude)) * 
            sin(radians(d.current_latitude))
        )) / 40.0 * 60)::INTEGER as eta_minutes,
        d.rating
    FROM drivers d
    JOIN users u ON d.user_id = u.id
    WHERE d.is_online = TRUE 
    AND d.is_available = TRUE
    AND d.current_latitude IS NOT NULL
    AND d.current_longitude IS NOT NULL
    AND (p_vehicle_type IS NULL OR d.vehicle_type = p_vehicle_type)
    AND (6371 * acos(
        cos(radians(p_latitude)) * 
        cos(radians(d.current_latitude)) * 
        cos(radians(d.current_longitude) - radians(p_longitude)) + 
        sin(radians(p_latitude)) * 
        sin(radians(d.current_latitude))
    )) <= p_radius_km
    ORDER BY distance_km
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate distance (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL(10, 8), 
    lng1 DECIMAL(11, 8), 
    lat2 DECIMAL(10, 8), 
    lng2 DECIMAL(11, 8)
) RETURNS DECIMAL(8, 3) AS $$
BEGIN
    RETURN 6371 * acos(
        cos(radians(lat1)) * 
        cos(radians(lat2)) * 
        cos(radians(lng2) - radians(lng1)) + 
        sin(radians(lat1)) * 
        sin(radians(lat2))
    );
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample data for testing
INSERT INTO users (email, phone, full_name, user_type, student_id, department) VALUES
('student1@university.edu', '+233201234567', 'Kwame Asante', 'student', 'STD2024001', 'Computer Science'),
('student2@university.edu', '+233201234568', 'Ama Mensah', 'student', 'STD2024002', 'Business'),
('nonstudent1@gmail.com', '+233201234569', 'Kojo Smith', 'non_student', NULL, NULL),
('driver1@unihub.com', '+233201234570', 'Yaw Driver', 'driver', NULL, NULL);

INSERT INTO drivers (user_id, driver_license, vehicle_type, vehicle_plate, vehicle_capacity) VALUES
((SELECT id FROM users WHERE email = 'driver1@unihub.com'), 'DL001234567', 'shuttle', 'GT-1234-20', 12);

INSERT INTO shuttle_routes (route_name, route_color) VALUES
('Campus Main Route', '#3b82f6'),
('Science Faculty Route', '#10b981'),
('Hostel Route', '#f59e0b');

INSERT INTO shuttle_schedules (route_id, driver_id, start_time, end_time, frequency_minutes, days_of_week, is_active) VALUES
((SELECT id FROM shuttle_routes WHERE route_name = 'Campus Main Route'), (SELECT id FROM drivers WHERE vehicle_plate = 'GT-1234-20'), '07:00:00', '18:00:00', 15, ARRAY['1', '2', '3', '4', '5'], TRUE),
((SELECT id FROM shuttle_routes WHERE route_name = 'Science Faculty Route'), (SELECT id FROM drivers WHERE vehicle_plate = 'GT-1234-20'), '08:00:00', '17:00:00', 20, ARRAY['1', '2', '3', '4', '5'], TRUE);

INSERT INTO shuttle_stops (route_id, stop_name, stop_order, latitude, longitude, estimated_wait_time) VALUES
((SELECT id FROM shuttle_routes WHERE route_name = 'Campus Main Route'), 'Main Gate', 1, 5.6037, -0.18696, 5),
((SELECT id FROM shuttle_routes WHERE route_name = 'Campus Main Route'), 'Library', 2, 5.6050, -0.1870, 8),
((SELECT id FROM shuttle_routes WHERE route_name = 'Campus Main Route'), 'Science Block', 3, 5.6060, -0.1880, 10),
((SELECT id FROM shuttle_routes WHERE route_name = 'Campus Main Route'), 'Student Center', 4, 5.6040, -0.1850, 12);

-- Create a view for active shuttles
CREATE OR REPLACE VIEW active_shuttles AS
SELECT 
    d.id,
    u.full_name as driver_name,
    d.vehicle_plate,
    d.current_latitude,
    d.current_longitude,
    d.last_location_update,
    sr.route_name,
    sr.route_color
FROM drivers d
JOIN users u ON d.user_id = u.id
JOIN shuttle_schedules ss ON d.id = ss.driver_id
JOIN shuttle_routes sr ON ss.route_id = sr.id
WHERE d.vehicle_type = 'shuttle'
AND d.is_online = TRUE
AND ss.is_active = TRUE
AND sr.is_active = TRUE
AND EXTRACT(DOW FROM NOW())::text = ANY(ss.days_of_week)
AND NOW()::TIME BETWEEN ss.start_time AND ss.end_time;
