-- ============================================================
-- ADSENSE COMPLIANCE FIXES
-- ============================================================

-- 1. Update settings to disable problematic ad placements
UPDATE unihub_settings 
SET 
    adSenseStatus = 'inactive',
    adSenseClientId = NULL,
    adSenseSlotId = NULL,
    adSenseLayoutKey = NULL
WHERE id = 1;

-- 2. Add content value to about page
UPDATE unihub_settings 
SET 
    aboutMeText = 'NexRyde is Ghana''s premier ride-sharing platform, connecting passengers with verified drivers for safe, affordable transportation.',
    about_me_text = 'NexRyde is Ghana''s premier ride-sharing platform, connecting passengers with verified drivers for safe, affordable transportation.'
WHERE id = 1;

-- 3. Add meaningful content sections
UPDATE unihub_settings 
SET 
    hub_announcement = 'Welcome to NexRyde! Your reliable transportation partner in Ghana. Book rides, track drivers in real-time, and travel safely across the city.',
    app_wallpaper = 'https://images.unsplash.com/photo-1556736175-2c4cf3dc5a8?w=1920&q=80'
WHERE id = 1;

-- 4. Verify the changes
SELECT 
    'AdSense Compliance Update' as status,
    adSenseStatus,
    aboutMeText,
    hub_announcement
FROM unihub_settings 
WHERE id = 1;
