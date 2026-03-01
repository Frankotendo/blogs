-- Fix for numeric field overflow in driver_locations table
-- The error occurs because coordinates exceed numeric(5,2) limits
-- Ghana coordinates: Latitude ~5-11°N, Longitude ~-4° to +2°E

-- First, create a backup of existing data
CREATE TABLE driver_locations_backup AS SELECT * FROM driver_locations;

-- Drop the problematic table
DROP TABLE IF EXISTS driver_locations;

-- Recreate with proper numeric precision for coordinates
CREATE TABLE public.driver_locations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    driver_id text NOT NULL UNIQUE,
    latitude numeric(10, 8) NOT NULL,  -- Increased precision for GPS coordinates
    longitude numeric(11, 8) NOT NULL, -- Increased precision for GPS coordinates
    heading numeric,
    speed numeric,
    accuracy numeric CHECK (accuracy >= 0::numeric AND accuracy <= 1000::numeric),
    last_updated timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    accuracy_threshold numeric DEFAULT 50,
    location_quality text DEFAULT 'unknown'::text,
    satellite_count integer,
    altitude numeric,
    altitude_accuracy numeric,
    CONSTRAINT driver_locations_pkey PRIMARY KEY (id),
    CONSTRAINT driver_locations_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.unihub_drivers(id)
);

-- Restore data from backup if exists
INSERT INTO driver_locations (driver_id, latitude, longitude, heading, speed, accuracy, last_updated, created_at, accuracy_threshold, location_quality, satellite_count, altitude, altitude_accuracy)
SELECT driver_id, latitude, longitude, heading, speed, accuracy, last_updated, created_at, accuracy_threshold, location_quality, satellite_count, altitude, altitude_accuracy
FROM driver_locations_backup;

-- Drop backup table
DROP TABLE IF EXISTS driver_locations_backup;

-- Also fix coordinate fields in unihub_nodes table
ALTER TABLE unihub_nodes 
    ALTER COLUMN pickup_latitude TYPE numeric(10, 8),
    ALTER COLUMN pickup_longitude TYPE numeric(11, 8),
    ALTER COLUMN dropoff_latitude TYPE numeric(10, 8),
    ALTER COLUMN dropoff_longitude TYPE numeric(11, 8),
    ALTER COLUMN driver_latitude TYPE numeric(10, 8),
    ALTER COLUMN driver_longitude TYPE numeric(11, 8),
    ALTER COLUMN passenger_latitude TYPE numeric(10, 8),
    ALTER COLUMN passenger_longitude TYPE numeric(11, 8);

-- Fix coordinates in unihub_drivers table
ALTER TABLE unihub_drivers
    ALTER COLUMN current_latitude TYPE numeric(10, 8),
    ALTER COLUMN current_longitude TYPE numeric(11, 8);

-- Fix coordinates in passenger_locations table
ALTER TABLE passenger_locations
    ALTER COLUMN latitude TYPE numeric(10, 8),
    ALTER COLUMN longitude TYPE numeric(11, 8);
