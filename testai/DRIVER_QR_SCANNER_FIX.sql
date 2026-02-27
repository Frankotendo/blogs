-- ============================================================
-- DRIVER QR CODE SCANNER FIX
-- ============================================================

-- 1. Add QR scanner settings to unihub_settings
ALTER TABLE unihub_settings 
ADD COLUMN qr_scanner_enabled boolean DEFAULT true,
ADD COLUMN qr_scanner_fallback_text text DEFAULT 'Use camera to scan QR codes',
ADD COLUMN qr_scanner_last_used timestamp with time zone DEFAULT NULL;

-- 2. Update settings to enable QR scanner with camera fallback
UPDATE unihub_settings 
SET 
    qr_scanner_enabled = true,
    qr_scanner_fallback_text = 'Use camera to scan QR codes',
    qr_scanner_last_used = NOW()
WHERE id = 1;

-- 3. Create QR code tracking table
CREATE TABLE IF NOT EXISTS public.driver_qr_scans (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    driver_id text NOT NULL,
    qr_code text NOT NULL,
    scan_method text DEFAULT 'camera', -- 'camera' or 'manual'
    scan_timestamp timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT driver_qr_scans_pkey PRIMARY KEY (id),
    CONSTRAINT driver_qr_scans_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.unihub_drivers(id) ON DELETE CASCADE
);

-- 4. Enable RLS for QR scans
ALTER TABLE public.driver_qr_scans ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies for QR scanning
DROP POLICY IF EXISTS "Drivers can scan QR codes" ON public.driver_qr_scans;
DROP POLICY IF EXISTS "Public can view QR scans" ON public.driver_qr_scans;

CREATE POLICY "Drivers can scan QR codes" ON public.driver_qr_scans
    FOR ALL USING (driver_id = auth.uid()::text);

CREATE POLICY "Public can view QR scans" ON public.driver_qr_scans
    FOR SELECT USING (true);

-- 6. Grant permissions
GRANT SELECT ON public.driver_qr_scans TO anon;
GRANT SELECT ON public.driver_qr_scans TO authenticated;
GRANT INSERT ON public.driver_qr_scans TO anon;
GRANT INSERT ON public.driver_qr_scans TO authenticated;
GRANT UPDATE ON public.driver_qr_scans TO authenticated;
GRANT DELETE ON public.driver_qr_scans TO authenticated;

-- 7. Verify QR scanner setup
SELECT 
    'QR Scanner Setup Complete' as status,
    qr_scanner_enabled,
    qr_scanner_fallback_text
FROM unihub_settings 
WHERE id = 1;
