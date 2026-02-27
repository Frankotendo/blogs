-- ============================================================
-- OFFLINE DRIVER LOCATION CLEANUP
-- ============================================================

-- 1. Remove locations for offline drivers (older than 5 minutes)
DELETE FROM driver_locations 
WHERE driver_id IN (
    SELECT id FROM unihub_drivers 
    WHERE status = 'offline'
    OR last_location_update < NOW() - INTERVAL '5 minutes'
);

-- 2. Create function to clean up stale locations
CREATE OR REPLACE FUNCTION cleanup_stale_driver_locations()
RETURNS void AS $$
BEGIN
    -- Remove locations older than 10 minutes
    DELETE FROM driver_locations 
    WHERE last_updated < NOW() - INTERVAL '10 minutes';
    
    -- Remove locations for drivers who are offline
    DELETE FROM driver_locations 
    WHERE driver_id IN (
        SELECT id FROM unihub_drivers WHERE status = 'offline'
    );
    
    RAISE NOTICE 'Cleaned up stale driver locations';
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger for automatic cleanup
CREATE OR REPLACE FUNCTION trigger_cleanup_driver_locations()
RETURNS trigger AS $$
BEGIN
    -- When driver goes offline, remove their location
    IF NEW.status = 'offline' AND OLD.status != 'offline' THEN
        DELETE FROM driver_locations WHERE driver_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Add trigger to unihub_drivers table
DROP TRIGGER IF EXISTS cleanup_offline_driver_locations ON unihub_drivers;
CREATE TRIGGER cleanup_offline_driver_locations
    AFTER UPDATE ON unihub_drivers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_driver_locations();

-- 5. Schedule cleanup every 5 minutes (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-driver-locations', '*/5 * * * *', 'SELECT cleanup_stale_driver_locations();');

-- 6. Test the cleanup function
SELECT cleanup_stale_driver_locations();
