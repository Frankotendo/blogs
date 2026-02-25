# UniHub Live Tracking Module

## 🚀 REAL-TIME DRIVER TRACKING ADD-ON

A plug-and-play live tracking module for UniHub Dispatch System.

## 📁 FILES CREATED

1. **tracking.js** - Main tracking module
2. **tracking-html-additions.html** - HTML additions needed
3. **icons/** - Directory for map markers

## 🔧 INSTALLATION

### Step 1: Add HTML Head Content
Copy these lines into your HTML `<head>` section:

```html
<!-- Leaflet CSS -->
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
      crossorigin="" />

<!-- Leaflet JS -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" 
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" 
        crossorigin=""></script>

<!-- Socket.IO JS -->
<script src="https://cdn.socket.io/4.7.5/socket.io.min.js"></script>
```

### Step 2: Add Map Container
Add this where you want the map to appear:

```html
<div id="map"></div>
```

### Step 3: Add Tracking Script
Add this at the end of your HTML `<body>`:

```html
<script src="/tracking.js"></script>
```

### Step 4: Add Icons
Place these files in `/icons/` directory:
- `car.png` (32x32) - Driver marker
- `passenger.png` (32x32) - Passenger marker

## 🎯 FEATURES

✅ **Real-time Driver Tracking** - Updates every 3 seconds  
✅ **Passenger Location Detection** - Automatic GPS tracking  
✅ **Google Maps Navigation** - Opens turn-by-turn directions  
✅ **Unlimited Drivers** - Supports any number of drivers  
✅ **Socket.IO Integration** - Real-time communication  
✅ **OpenStreetMap Tiles** - Free map rendering  
✅ **Error Handling** - Graceful failure handling  
✅ **Notifications** - User-friendly alerts  

## 📡 SOCKET EVENTS

### Driver Location Updates
```javascript
socket.emit('driverLocationUpdate', {
    id: "driver123",
    lat: 5.6037,
    lng: -0.18696
});
```

### Ride Assignment
```javascript
socket.emit('rideAssigned', {
    driverId: "driver123",
    pickupLat: 5.6037,
    pickupLng: -0.18696
});
```

## 🗺️ MAP CONFIGURATION

- **Default Center**: Kumasi, Ghana (5.6037, -0.18696)
- **Default Zoom**: 13
- **Max Zoom**: 19
- **Map Source**: OpenStreetMap
- **Update Interval**: 3 seconds

## 🎮 PUBLIC API

```javascript
// Initialize tracking
UniHubTracking.init();

// Open navigation
UniHubTracking.navigateDriver(5.6037, -0.18696);

// Get driver count
const count = UniHubTracking.getDriverCount();

// Get passenger position
const position = UniHubTracking.getPassengerPosition();

// Center map on passenger
UniHubTracking.centerMapOnPassenger();
```

## 🌐 GOOGLE MAPS INTEGRATION

Automatically opens Google Maps navigation with:
- Origin: Current passenger location
- Destination: Pickup location
- Travel mode: Driving

URL Format:
```
https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&travelmode=driving
```

## 🔧 TECHNICAL DETAILS

### Dependencies
- Leaflet 1.9.4 (CDN)
- Socket.IO 4.7.5 (CDN)
- OpenStreetMap Tiles
- Browser Geolocation API

### Browser Support
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Performance
- Lightweight (~15KB minified)
- Efficient marker management
- Optimized socket connections
- Memory-safe cleanup

## 🚨 ERROR HANDLING

- Graceful map initialization failure
- Socket connection error recovery
- Geolocation permission handling
- Network timeout management
- Invalid data validation

## 📱 RESPONSIVE DESIGN

- Mobile-friendly map container
- Touch gesture support
- Adaptive sizing
- Notification positioning

## 🔒 SECURITY

- HTTPS-only geolocation
- CORS-compliant CDNs
- Input validation
- Safe DOM manipulation

---

**🎉 READY TO DEPLOY - ZERO MODIFICATIONS TO EXISTING CODE!**
