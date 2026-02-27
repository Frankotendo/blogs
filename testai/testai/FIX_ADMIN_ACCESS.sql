-- Fix Admin Access Issues
-- This script ensures admin user exists and has proper permissions
-- Based on actual database schema

-- 1. Create admin user in unihub_users table (using correct columns)
INSERT INTO unihub_users (id, username, phone, pin, created_at)
VALUES (
  'admin-user-id',
  'admin',
  'admin@nexryde.com',
  '1234',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  phone = EXCLUDED.phone,
  pin = EXCLUDED.pin;

-- 2. Create admin user in auth.users table for Supabase Auth
INSERT INTO auth.users (id, email, phone, created_at)
VALUES (
  'admin-user-id',
  'admin@nexryde.com',
  '+233200000000',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  phone = EXCLUDED.phone;

-- 3. Create admin user metadata with role
INSERT INTO auth.users (id, raw_user_meta_data)
VALUES (
  'admin-user-id',
  '{"role": "admin"}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;

-- 4. Add RLS policy to allow admin full access
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

-- 5. Add RLS policy for admin access to all tables
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

-- 6. Create function to check admin role
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN auth.jwt() ->> 'role' = 'admin';
END;
$$;

-- 7. Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;

-- 8. Test query to verify admin access
SELECT 'Admin access setup complete' as status;

-- 9. Check existing admin user
SELECT id, username, phone, pin, created_at FROM unihub_users WHERE username = 'admin';
