# 🗄️ Supabase Database Schema for Live Location Tracking

## 📍 **YES - Supabase IS REQUIRED**

For **live location tracking across all users**, Supabase is essential because:

1. **Real-time Sync** - Socket.IO needs database persistence
2. **User Authentication** - Track which passenger/driver
3. **Location History** - Store GPS coordinates
4. **Ride Matching** - Connect passengers to drivers
5. **Status Management** - Online/offline/busy states

---

## 🚀 **COMPLETE SQL SCHEMA**

### **1. Driver Locations Table**
```sql
-- Create driver locations table for real-time tracking
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id VARCHAR(50) NOT NULL REFERENCES unihub_drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('Pragia', 'Taxi', 'Shuttle')),
  status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
  heading DECIMAL(3, 0), -- Direction in degrees (0-360)
  speed DECIMAL(5, 2), -- Speed in km/h
  accuracy DECIMAL(5, 2), -- GPS accuracy in meters
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_driver_locations_driver_id ON driver_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_locations_status ON driver_locations(status);
CREATE INDEX IF NOT EXISTS idx_driver_locations_vehicle_type ON driver_locations(vehicle_type);
CREATE INDEX IF NOT EXISTS idx_driver_locations_last_updated ON driver_locations(last_updated);

-- Add RLS (Row Level Security)
ALTER TABLE driver_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Drivers can update their own location
CREATE POLICY "Drivers can update own location" ON driver_locations
  FOR UPDATE USING (auth.uid()::text = driver_id);

-- Policy: Everyone can view driver locations (for passenger app)
CREATE POLICY "Everyone can view driver locations" ON driver_locations
  FOR SELECT USING (true);

-- Policy: Drivers can insert their own location
CREATE POLICY "Drivers can insert own location" ON driver_locations
  FOR INSERT WITH CHECK (auth.uid()::text = driver_id);
```

### **2. Passenger Locations Table**
```sql
-- Create passenger locations table
CREATE TABLE IF NOT EXISTS passenger_locations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  passenger_id VARCHAR(50) NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(5, 2), -- GPS accuracy in meters
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_passenger_locations_passenger_id ON passenger_locations(passenger_id);
CREATE INDEX IF NOT EXISTS idx_passenger_locations_last_updated ON passenger_locations(last_updated);

-- Enable RLS
ALTER TABLE passenger_locations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can update their own location
CREATE POLICY "Users can update own location" ON passenger_locations
  FOR ALL USING (auth.uid() = passenger_id);
```

### **3. Active Rides Table (Enhanced)**
```sql
-- Enhance existing rides table with location tracking
ALTER TABLE unihub_rides 
ADD COLUMN IF NOT EXISTS pickup_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS pickup_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS dropoff_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS dropoff_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS driver_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS driver_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS passenger_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS passenger_longitude DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS estimated_distance DECIMAL(8, 2), -- in km
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER, -- in minutes
ADD COLUMN IF NOT EXISTS actual_distance DECIMAL(8, 2), -- in km
ADD COLUMN IF NOT EXISTS actual_duration INTEGER, -- in minutes
ADD COLUMN IF NOT EXISTS tracking_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS tracking_ended_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for location queries
CREATE INDEX IF NOT EXISTS idx_rides_pickup_location ON unihub_rides(pickup_latitude, pickup_longitude);
CREATE INDEX IF NOT EXISTS idx_rides_driver_location ON unihub_rides(driver_latitude, driver_longitude);
CREATE INDEX IF NOT EXISTS idx_rides_status_location ON unihub_rides(status, pickup_latitude, pickup_longitude);
```

### **4. Location History Table (for analytics)**
```sql
-- Create location history table for tracking analytics
CREATE TABLE IF NOT EXISTS location_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('driver', 'passenger')),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  heading DECIMAL(3, 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for analytics
CREATE INDEX IF NOT EXISTS idx_location_history_user_id ON location_history(user_id);
CREATE INDEX IF NOT EXISTS idx_location_history_user_type ON location_history(user_type);
CREATE INDEX IF NOT EXISTS idx_location_history_created_at ON location_history(created_at);
CREATE INDEX IF NOT EXISTS idx_location_history_location ON location_history(latitude, longitude);

-- Enable RLS
ALTER TABLE location_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own history
CREATE POLICY "Users can view own location history" ON location_history
  FOR SELECT USING (auth.uid()::text = user_id);

-- Policy: System can insert location data
CREATE POLICY "System can insert location data" ON location_history
  FOR INSERT WITH CHECK (true);
```

### **5. Real-time Functions**
```sql
-- Function to update driver location
CREATE OR REPLACE FUNCTION update_driver_location(
  p_driver_id VARCHAR(50),
  p_latitude DECIMAL(10, 8),
  p_longitude DECIMAL(11, 8),
  p_vehicle_type VARCHAR(20),
  p_status VARCHAR(20),
  p_heading DECIMAL(3, 0) DEFAULT NULL,
  p_speed DECIMAL(5, 2) DEFAULT NULL,
  p_accuracy DECIMAL(5, 2) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Upsert driver location
  INSERT INTO driver_locations (
    driver_id, latitude, longitude, vehicle_type, status, 
    heading, speed, accuracy, last_updated
  ) VALUES (
    p_driver_id, p_latitude, p_longitude, p_vehicle_type, p_status,
    p_heading, p_speed, p_accuracy, NOW()
  )
  ON CONFLICT (driver_id) 
  DO UPDATE SET
    latitude = p_latitude,
    longitude = p_longitude,
    vehicle_type = p_vehicle_type,
    status = p_status,
    heading = p_heading,
    speed = p_speed,
    accuracy = p_accuracy,
    last_updated = NOW();
  
  -- Add to history
  INSERT INTO location_history (
    user_id, user_type, latitude, longitude, accuracy, speed, heading
  ) VALUES (
    p_driver_id, 'driver', p_latitude, p_longitude, p_accuracy, p_speed, p_heading
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to update passenger location
CREATE OR REPLACE FUNCTION update_passenger_location(
  p_passenger_id VARCHAR(50),
  p_latitude DECIMAL(10, 8),
  p_longitude DECIMAL(11, 8),
  p_accuracy DECIMAL(5, 2) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Upsert passenger location
  INSERT INTO passenger_locations (
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
  
  -- Add to history
  INSERT INTO location_history (
    user_id, user_type, latitude, longitude, accuracy
  ) VALUES (
    p_passenger_id, 'passenger', p_latitude, p_longitude, p_accuracy
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby drivers
CREATE OR REPLACE FUNCTION find_nearby_drivers(
  p_latitude DECIMAL(10, 8),
  p_longitude DECIMAL(11, 8),
  p_radius_km INTEGER DEFAULT 5,
  p_vehicle_type VARCHAR(20) DEFAULT NULL,
  p_status VARCHAR(20) DEFAULT 'online'
)
RETURNS TABLE(
  driver_id VARCHAR(50),
  driver_name VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  vehicle_type VARCHAR(20),
  status VARCHAR(20),
  distance_km DECIMAL(8, 2),
  eta_minutes INTEGER,
  rating DECIMAL(3, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dl.driver_id,
    d.name as driver_name,
    dl.latitude,
    dl.longitude,
    dl.vehicle_type,
    dl.status,
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
  FROM driver_locations dl
  JOIN unihub_drivers d ON dl.driver_id = d.id
  WHERE 
    dl.status = p_status
    AND (p_vehicle_type IS NULL OR dl.vehicle_type = p_vehicle_type)
    AND (6371 * acos(
      cos(radians(p_latitude)) * cos(radians(dl.latitude)) * 
      cos(radians(dl.longitude) - radians(p_longitude)) + 
      sin(radians(p_latitude)) * sin(radians(dl.latitude))
    )) <= p_radius_km
  ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;
```

---

## 🔌 **Real-time Subscriptions**

### **Supabase Real-time Setup**
```typescript
// Subscribe to driver location updates
const driverLocationSubscription = supabase
  .channel('driver_locations')
  .on('postgres_changes', 
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'driver_locations',
      filter: 'status=eq.online'
    }, 
    (payload) => {
      // Update driver position on map
      updateDriverMarker(payload.new);
    }
  )
  .subscribe();

// Subscribe to passenger location updates
const passengerLocationSubscription = supabase
  .channel('passenger_locations')
  .on('postgres_changes', 
    { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'passenger_locations'
    }, 
    (payload) => {
      // Update passenger position on map
      updatePassengerMarker(payload.new);
    }
  )
  .subscribe();
```

---

## 📱 **Integration with Socket.IO**

### **Enhanced Socket Events**
```typescript
// Driver updates location
socket.on('driverLocationUpdate', async (data) => {
  const { driverId, lat, lng, vehicleType, status, heading, speed, accuracy } = data;
  
  // Update Supabase
  await supabase.rpc('update_driver_location', {
    p_driver_id: driverId,
    p_latitude: lat,
    p_longitude: lng,
    p_vehicle_type: vehicleType,
    p_status: status,
    p_heading: heading,
    p_speed: speed,
    p_accuracy: accuracy
  });
  
  // Broadcast to passengers
  socket.broadcast.emit('driverLocationUpdate', data);
});

// Passenger updates location
socket.on('passengerLocationUpdate', async (data) => {
  const { passengerId, lat, lng, accuracy } = data;
  
  // Update Supabase
  await supabase.rpc('update_passenger_location', {
    p_passenger_id: passengerId,
    p_latitude: lat,
    p_longitude: lng,
    p_accuracy: accuracy
  });
  
  // Broadcast to drivers
  socket.broadcast.emit('passengerLocationUpdate', data);
});
```

---

## 🎯 **CORRECTED ANSWERS**

### **1. Will passengers track real drivers?**
✅ **YES - WITH SUPABASE**
- Real-time database sync across all users
- Socket.IO + Supabase real-time subscriptions
- Persistent location storage
- Live updates to all connected clients

### **2. Will map show vehicle icons?**
✅ **YES - WITH DATABASE**
- Vehicle type stored in database
- Icons based on `vehicle_type` field
- Status indicators from `status` field
- Enhanced popups with database info

### **3. Will drivers navigate to passengers?**
✅ **YES - WITH COORDINATES**
- Pickup/dropoff coordinates stored in database
- Real-time location sharing
- Automatic Google Maps integration
- Route optimization possible

---

## 🚀 **IMPLEMENTATION STEPS**

1. **Run SQL commands** in Supabase SQL editor
2. **Set up real-time subscriptions** in your app
3. **Update Socket.IO** to use database functions
4. **Test with multiple users** for live sync
5. **Monitor performance** with indexes

**Supabase is ESSENTIAL** for true multi-user live location tracking!
