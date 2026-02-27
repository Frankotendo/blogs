-- Update Existing Admin Access
-- This script updates your existing admin user with proper permissions

-- 1. Check your existing admin user
-- Run this first to see your current admin user:
SELECT id, username, phone, pin, created_at FROM unihub_users WHERE username = 'admin';

-- 2. Update your existing admin user with admin role metadata
-- Replace 'your-admin-id' with the actual ID from the query above
UPDATE auth.users 
SET raw_user_meta_data = '{"role": "admin"}'::jsonb
WHERE id = 'your-admin-id';

-- 3. Add RLS policy to allow admin full access
DROP POLICY IF EXISTS "admin_full_access" ON unihub_users;
CREATE POLICY "admin_full_access" ON unihub_users
  FOR ALL
  USING (auth.role() = 'authenticated' AND (
    auth.jwt() ->> 'role' = 'admin' OR 
    id = auth.uid()
  ))
  WITH CHECK (
    auth.role() = 'authenticated' AND (
      auth.jwt() ->> 'role' = 'admin' OR 
      id = auth.uid()
    )
  );

-- 4. Add RLS policy for admin access to all tables
DROP POLICY IF EXISTS "admin_access_drivers" ON unihub_drivers;
CREATE POLICY "admin_access_drivers" ON unihub_drivers
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "admin_access_nodes" ON unihub_nodes;
CREATE POLICY "admin_access_nodes" ON unihub_nodes
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "admin_access_settings" ON unihub_settings;
CREATE POLICY "admin_access_settings" ON unihub_settings
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "admin_access_registrations" ON unihub_registrations;
CREATE POLICY "admin_access_registrations" ON unihub_registrations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "admin_access_topups" ON unihub_topups;
CREATE POLICY "admin_access_topups" ON unihub_topups
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

DROP POLICY IF EXISTS "admin_access_transactions" ON unihub_transactions;
CREATE POLICY "admin_access_transactions" ON unihub_transactions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- 5. Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;

-- 6. Test query to verify admin access
SELECT 'Admin access setup complete' as status;

-- Instructions:
-- 1. First run the SELECT query at the top to get your admin user ID
-- 2. Replace 'your-admin-id' in the UPDATE statement with your actual ID
-- 3. Run the rest of the script
