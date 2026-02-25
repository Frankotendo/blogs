-- ============================================================
-- SUPABASE SCHEMA REFERENCE (do not run as-is)
-- Use this to compare with your Supabase tables. Your DB may
-- already match; the app maps both camelCase and snake_case.
-- ============================================================

-- Table order and constraints may not be valid for execution.
-- WARNING: This schema is for context only and is not meant to be run.

CREATE TABLE public.unihub_drivers (
  id text NOT NULL,
  name text NOT NULL,
  "vehicleType" text CHECK ("vehicleType" = ANY (ARRAY['Pragia'::text, 'Taxi'::text, 'Shuttle'::text])),
  licensePlate text,
  contact text,
  walletBalance numeric DEFAULT 0.0,
  rating numeric DEFAULT 5.0,
  status text DEFAULT 'online'::text CHECK (status = ANY (ARRAY['online'::text, 'busy'::text, 'offline'::text])),
  pin text NOT NULL,
  photoUrl text,
  userId uuid,
  avatarUrl text,
  avatar_url text,
  CONSTRAINT unihub_drivers_pkey PRIMARY KEY (id)
);

CREATE TABLE public.unihub_missions (
  id text NOT NULL,
  location text,
  description text,
  entryfee numeric,
  driversjoined text[] DEFAULT '{}',
  status text DEFAULT 'open'::text,
  createdat timestamp with time zone DEFAULT now(),
  CONSTRAINT unihub_missions_pkey PRIMARY KEY (id)
);

CREATE TABLE public.unihub_nodes (
  id text NOT NULL,
  origin text NOT NULL,
  destination text NOT NULL,
  "capacityNeeded" integer DEFAULT 4,
  passengers jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'forming'::text CHECK (status = ANY (ARRAY['forming'::text, 'qualified'::text, 'dispatched'::text, 'completed'::text])),
  "leaderName" text,
  "leaderPhone" text,
  "farePerPerson" numeric DEFAULT 0,
  "createdAt" timestamp with time zone DEFAULT now(),
  "assignedDriverId" text,
  "verificationCode" text,
  "isSolo" boolean DEFAULT false,
  "isLongDistance" boolean DEFAULT false,
  negotiatedTotalFare numeric,
  creator_id text,
  vehicle_type text,
  "vehicleType" text CHECK ("vehicleType" = ANY (ARRAY['Pragia'::text, 'Taxi'::text, 'Shuttle'::text])),
  "driverNote" text,
  CONSTRAINT unihub_nodes_pkey PRIMARY KEY (id),
  CONSTRAINT unihub_nodes_assignedDriverId_fkey FOREIGN KEY ("assignedDriverId") REFERENCES public.unihub_drivers(id)
);

CREATE TABLE public.unihub_registrations (
  id text NOT NULL,
  name text,
  contact text,
  pin text,
  amount numeric,
  status text DEFAULT 'pending'::text,
  timestamp text,
  vehicle_type text,
  "licensePlate" text,
  "momoReference" text,
  "vehicleType" text,
  "photoUrl" text,
  "avatarUrl" text,
  CONSTRAINT unihub_registrations_pkey PRIMARY KEY (id)
);

CREATE TABLE public.unihub_security_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_phone text,
  attempt_type text,
  status text,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT unihub_security_logs_pkey PRIMARY KEY (id)
);

CREATE TABLE public.unihub_settings (
  id bigint NOT NULL DEFAULT 1,
  "adminMomo" text DEFAULT '000-000-0000'::text,
  "adminMomoName" text DEFAULT 'Admin'::text,
  "whatsappNumber" text DEFAULT '2330000000'::text,
  "commissionPerSeat" numeric DEFAULT 2.0,
  "farePerPragia" numeric DEFAULT 5.0,
  "farePerTaxi" numeric DEFAULT 8.0,
  "soloMultiplier" numeric DEFAULT 2.5,
  "aboutMeText" text DEFAULT 'Welcome to UniHub Dispatch.'::text,
  "aboutMeImages" jsonb DEFAULT '[]'::jsonb,
  "adminSecret" text DEFAULT '1234'::text,
  "appWallpaper" text,
  "registrationFee" numeric DEFAULT 20.00,
  hub_announcement text,
  about_me_text text DEFAULT 'Welcome to the Hub.'::text,
  about_me_images text[] DEFAULT '{}',
  app_wallpaper text DEFAULT ''::text,
  registration_fee numeric DEFAULT 20.00,
  "appLogo" text,
  "adSenseClientId" text,
  "adSenseSlotId" text,
  "adSenseLayoutKey" text,
  "adSenseStatus" text,
  "facebookUrl" text,
  "instagramUrl" text,
  "tiktokUrl" text,
  "shuttleCommission" numeric DEFAULT 0.0,
  "aiAssistantName" text DEFAULT 'unihub settings'::text,
  CONSTRAINT unihub_settings_pkey PRIMARY KEY (id)
);

CREATE TABLE public.unihub_topups (
  id text NOT NULL,
  "driverId" text,
  amount numeric NOT NULL,
  "momoReference" text NOT NULL,
  status text DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])),
  timestamp text,
  CONSTRAINT unihub_topups_pkey PRIMARY KEY (id),
  CONSTRAINT unihub_topups_driverId_fkey FOREIGN KEY ("driverId") REFERENCES public.unihub_drivers(id)
);

CREATE TABLE public.unihub_transactions (
  id text NOT NULL,
  "driverId" text,
  amount numeric NOT NULL,
  type text CHECK (type = ANY (ARRAY['commission'::text, 'topup'::text])),
  timestamp text,
  CONSTRAINT unihub_transactions_pkey PRIMARY KEY (id),
  CONSTRAINT unihub_transactions_driverId_fkey FOREIGN KEY ("driverId") REFERENCES public.unihub_drivers(id)
);

CREATE TABLE public.unihub_users (
  id text NOT NULL,
  username text NOT NULL,
  phone text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  password text,
  pin text,
  biometric_url text,
  "walletBalance" numeric DEFAULT 0,
  CONSTRAINT unihub_users_pkey PRIMARY KEY (id)
);
