# URGENT: Black Screen Fix for Production

## Problem
Your app shows a black screen on Vercel production/preview but works in development due to LiveMap component import errors.

## Immediate Fix (Deploy Now)

### 1. Database Fix
Run this SQL in Supabase Dashboard (SQL Editor):

```sql
-- Drop existing policies to fix conflicts
DROP POLICY IF EXISTS "Anyone can view live locations" ON live_locations;
DROP POLICY IF EXISTS "Users can update own live location" ON live_locations;
DROP POLICY IF EXISTS "Users can insert own live location" ON live_locations;
DROP POLICY IF EXISTS "Users can delete own live location" ON live_locations;

-- Create clean policies
CREATE POLICY "Enable view for all users" ON live_locations
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for own user" ON live_locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for own user" ON live_locations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Enable delete for own user" ON live_locations
  FOR DELETE USING (auth.uid() = user_id);
```

### 2. Deploy to Vercel
The code is already fixed - LiveMap is temporarily disabled to prevent black screen.

## After Deployment (Enable Live Tracking)

### Step 1: Install Dependencies
```bash
npm install leaflet react-leaflet @types/leaflet
```

### Step 2: Enable LiveMap
In `index.tsx`, change line 20 from:
```typescript
const LiveMap: React.ComponentType<any> | null = null;
```
to:
```typescript
import { LiveMap } from "./components/LiveMap";
```

### Step 3: Add CSS
In `index.html`, add this to the `<head>`:
```html
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
```

### Step 4: Test Locally
```bash
npm run dev
```

### Step 5: Deploy Again
Once working locally, deploy to Vercel.

## Current Status
✅ App will work (no black screen) - LiveMap shows placeholder
⏳ Live tracking disabled until dependencies are installed
📱 All other features working normally

## Why This Happened
- Leaflet dependencies missing in production build
- Import errors caused React to crash
- Temporary fix prevents crash while maintaining UI

## Support
The live tracking system is fully built and ready - just needs the dependencies installed to activate.
