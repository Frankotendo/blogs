# Live Tracking System Setup Guide

## Overview
This document explains how to set up and use the real-time live tracking system for your NexRyde Uber-like app.

## Features Implemented
- **Real-time location tracking** for passengers and drivers
- **Live map visualization** with Leaflet + OpenStreetMap
- **Animated markers** with smooth movement
- **Vehicle labels** (Bus 1, Bus 2, etc.)
- **Role-based views** (passenger sees drivers, drivers see passengers)
- **Supabase Realtime** integration
- **Geolocation API** with heading and speed calculation
- **Production-ready** with error handling and cleanup

## Database Setup

### 1. Run the SQL Script
Execute the SQL in `supabase_live_locations.sql` in your Supabase dashboard:

```sql
-- This creates the live_locations table with:
-- - Real-time subscriptions enabled
-- - Row Level Security policies
-- - Performance indexes
-- - Automatic cleanup function
```

### 2. Enable Realtime
In Supabase Dashboard:
1. Go to **Replication** tab
2. Enable **live_locations** table for realtime
3. Verify RLS policies are active

## Frontend Setup

### 1. Install Dependencies
```bash
npm install leaflet react-leaflet @types/leaflet
```

### 2. File Structure
```
testai/
├── components/
│   └── LiveMap.tsx          # Main map component
├── hooks/
│   └── useLiveTracking.ts    # Real-time tracking hook
├── utils/
│   └── mapHelpers.ts        # Map utilities and icons
├── supabase_live_locations.sql  # Database schema
└── LIVE_TRACKING_SETUP.md   # This file
```

### 3. Component Integration
The LiveMap component is already integrated into:

- **PassengerPortal**: Shows passenger location + all available drivers
- **DriverPortal**: Shows driver location + all requesting passengers

## How It Works

### Passenger View
- **Blue marker**: Your current location
- **Red bus markers**: Available drivers with labels
- **Real-time updates**: Every 1 second
- **Smooth animation**: Interpolated movement
- **Click markers**: See speed, heading, last update

### Driver View
- **Bus marker**: Your vehicle with label
- **Blue markers**: Passengers requesting rides
- **Direction arrows**: Shows passenger movement
- **Auto-updates**: Location sent to database every second

## Technical Details

### Real-time Architecture
1. **Geolocation API**: Gets device GPS coordinates
2. **Supabase Realtime**: Subscribes to location changes
3. **Leaflet Maps**: Renders OpenStreetMap tiles
4. **Animation System**: Smooth marker transitions

### Data Flow
```
Device GPS → useLiveTracking Hook → Supabase DB → Realtime Subscription → LiveMap Component
```

### Performance Features
- **Throttled updates**: 1-second intervals
- **Automatic cleanup**: Removes locations older than 5 minutes
- **Memory management**: Proper subscription cleanup on unmount
- **Optimized rendering**: Only updates changed markers

## Usage Instructions

### For Passengers
1. Open the app and go to "Ride Center"
2. Grant location permissions when prompted
3. View the live map showing:
   - Your location (blue marker)
   - Available drivers (red bus markers)
   - Distance and proximity information

### For Drivers
1. Log in as a driver/partner
2. Go to "Partner Terminal"
3. Grant location permissions
4. View the live map showing:
   - Your vehicle (bus marker with label)
   - Requesting passengers (blue markers)
   - Real-time passenger movement

## Configuration

### Map Settings
- **Default center**: Accra, Ghana (5.6037, -0.1870)
- **Default zoom**: 15
- **Tile server**: OpenStreetMap
- **Update frequency**: 1 second

### Customization Options
```typescript
// In LiveMap.tsx
<LiveMap
  userRole="passenger"           // or "driver"
  userId={currentUser.id}
  vehicleLabel="Bus 1"           // Only for drivers
  center={[5.6037, -0.1870]}    // Custom center
  zoom={15}                     // Custom zoom level
/>
```

## Production Deployment

### Vercel Considerations
- ✅ Works out of the box
- ✅ No API keys required
- ✅ Uses free OpenStreetMap tiles
- ✅ Supabase handles scaling

### Environment Variables
No additional environment variables needed - uses existing Supabase configuration.

## Troubleshooting

### Location Not Working
1. Check browser location permissions
2. Use HTTPS (required for geolocation)
3. Test on mobile device for better GPS

### Map Not Loading
1. Check internet connection
2. Verify OpenStreetMap tile access
3. Check browser console for errors

### Real-time Updates Not Working
1. Verify Supabase realtime is enabled
2. Check RLS policies
3. Confirm database table exists

### Performance Issues
1. Check number of active users
2. Verify cleanup function is running
3. Monitor database query performance

## API Limits & Costs

### OpenStreetMap
- ✅ Free
- ✅ No API key required
- ✅ No rate limiting for typical usage

### Supabase
- ✅ Realtime included in free tier
- ✅ 500MB database storage
- ✅ 2GB bandwidth

## Future Enhancements

### Potential Additions
- **Route drawing**: Show paths between locations
- **ETA calculation**: Estimated arrival times
- **Geofencing**: Automatic notifications
- **Offline support**: Cache map tiles
- **Multiple vehicles**: Support for fleet management

### Scaling Considerations
- **Redis integration**: For high-frequency updates
- **CDN**: For map tile caching
- **Load balancing**: For multiple regions

## Security Notes

### Location Privacy
- Locations auto-delete after 5 minutes
- RLS policies prevent unauthorized access
- No location history stored

### Data Protection
- HTTPS required for geolocation
- Supabase handles encryption
- No sensitive data in logs

## Support

For issues with the live tracking system:
1. Check browser console for errors
2. Verify Supabase configuration
3. Test geolocation permissions
4. Review this troubleshooting guide

---

**System Status**: ✅ Production Ready
**Last Updated**: February 2026
**Version**: 1.0.0
