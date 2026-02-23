-- ============================================================
-- LIVE TRACKING TABLES FOR NEXRYDE (SUPABASE)
-- ============================================================
-- This file is designed to be safe to add alongside your
-- existing schema files without breaking Vercel deployment.
-- Run these statements manually in the Supabase SQL editor.
-- ============================================================

-- 1) Store the current live GPS position for each trip/party.
--    We keep one row per (trip_id, role, user_id) and upsert
--    from the frontend for smooth real-time updates.

create table if not exists public.unihub_live_locations (
  id uuid primary key default gen_random_uuid(),
  trip_id text not null,
  role text not null check (role in ('driver','passenger')),
  user_id text not null,
  vehicle_type text check (vehicle_type in ('Pragia','Taxi','Shuttle')),
  latitude double precision not null,
  longitude double precision not null,
  heading double precision,
  speed double precision,
  updated_at timestamptz not null default now()
);

create unique index if not exists unihub_live_locations_trip_role_user_idx
  on public.unihub_live_locations(trip_id, role, user_id);

create index if not exists unihub_live_locations_trip_idx
  on public.unihub_live_locations(trip_id);

-- 2) Enable Supabase Realtime on this table so the web app
--    can subscribe and stream the other party's movement.

alter publication supabase_realtime
  add table if not exists public.unihub_live_locations;

