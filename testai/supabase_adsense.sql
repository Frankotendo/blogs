-- ============================================================
-- AdSense columns for unihub_settings (Supabase)
-- Your schema already includes adSenseClientId, adSenseSlotId,
-- adSenseLayoutKey, adSenseStatus — no need to run this.
-- Run only if a fresh unihub_settings table is missing these.
-- ============================================================

-- Option A: If your table uses camelCase column names (quoted in Postgres):
ALTER TABLE unihub_settings
  ADD COLUMN IF NOT EXISTS "adSenseClientId" TEXT,
  ADD COLUMN IF NOT EXISTS "adSenseSlotId" TEXT,
  ADD COLUMN IF NOT EXISTS "adSenseLayoutKey" TEXT,
  ADD COLUMN IF NOT EXISTS "adSenseStatus" TEXT;

-- Option B: If you prefer snake_case (uncomment and use instead of Option A;
-- the app already reads both via sData.adsense_client_id etc.):
-- ALTER TABLE unihub_settings
--   ADD COLUMN IF NOT EXISTS adsense_client_id TEXT,
--   ADD COLUMN IF NOT EXISTS adsense_slot_id TEXT,
--   ADD COLUMN IF NOT EXISTS adsense_layout_key TEXT,
--   ADD COLUMN IF NOT EXISTS adsense_status TEXT;

-- Then set your publisher ID (optional, you can also set via Admin UI):
-- UPDATE unihub_settings SET "adSenseClientId" = 'ca-pub-7812709042449387' WHERE id = 1;
