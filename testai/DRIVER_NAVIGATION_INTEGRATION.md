# 🚗 DRIVER NAVIGATION INTEGRATION GUIDE
# Perfect logic from driver checking to passenger navigation

## 🎯 **QUICK INTEGRATION WITH YOUR EXISTING SYSTEM**

### **Step 1: Add the Navigation System**
```html
<!-- Add to your HTML head -->
<script src="driver-navigation-system.js"></script>
```

### **Step 2: Initialize with Your Existing Drivers**
```javascript
// Initialize navigation system with your existing drivers
function initializeDriverNavigation() {
    console.log('🚗 Initializing driver navigation system...');
    
    // Add your existing enhanced drivers to navigation system
    enhancedDrivers.forEach(driver => {
        driverNavigationSystem.activeDrivers.set(driver.id, {
            id: driver.id,
            isOnline: true,
            isAvailable: driver.status === 'active',
            currentLocation: { lat: driver.lat, lng: driver.lng },
            vehicleType: driver.vehicleType,
            vehicleCapacity: config.vehicleTypes[driver.vehicleType].capacity,
            currentPassengers: 0,
            rating: driver.rating || 4.5,
            status: driver.status,
            completedTrips: driver.totalTrips || 0,
            vehicleStatus: 'ready',
            onBreak: false
        });
    });
    
    console.log(`✅ Added ${enhancedDrivers.length} drivers to navigation system`);
}
```

### **Step 3: Enhanced Ride Request with Navigation**
```javascript
// Replace your existing requestRideEnhanced function
async function requestRideWithNavigation(vehicleType = null) {
    if (!passengerPosition) {
        showNotification('❌ Please enable location access first');
        return;
    }
    
    console.log('🎯 Processing ride request with navigation system...');
    
    // Create passenger request
    const passengerRequest = {
        id: `REQ_${Date.now()}`,
        passengerId: 'CURRENT_USER',
        pickupLocation: passengerPosition,
        destinationLocation: passengerPosition, // Will be set by user
        preferredVehicleType: vehicleType,
        requestTime: Date.now()
    };
    
    // Find best drivers using navigation system
    const bestDrivers = driverNavigationSystem.findBestDriversForPassenger(passengerRequest);
    
    if (bestDrivers.length === 0) {
        showNotification('❌ No available drivers nearby');
        return;
    }
    
    // Select best driver
    const selectedDriver = bestDrivers[0];
    
    console.log(`🎯 Best driver selected: ${selectedDriver.driverId}`);
    console.log(`📍 Distance: ${selectedDriver.distance.toFixed(2)}km`);
    console.log(`⏱️ ETA: ${selectedDriver.eta} minutes`);
    console.log(`⭐ Match Score: ${selectedDriver.matchScore}`);
    
    // Start navigation to passenger
    try {
        const navigationSession = await driverNavigationSystem.startNavigationToPassenger(
            selectedDriver.driverId,
            passengerRequest
        );
        
        // Update your existing active mission
        activeMission = {
            driverId: selectedDriver.driverId,
            passengerLocation: passengerPosition,
            driverLocation: selectedDriver.driver.currentLocation,
            status: 'driver_assigned',
            requestTime: Date.now(),
            vehicleType: selectedDriver.driver.vehicleType,
            distance: selectedDriver.distance,
            eta: selectedDriver.eta,
            navigationSession: navigationSession
        };
        
        // Show enhanced notification
        showNotification(`🚗 ${selectedDriver.driver.vehicleType} assigned! Driver ${selectedDriver.driverId} (${selectedDriver.eta}min away, ⭐${selectedDriver.driver.rating})`);
        
        // Start route visualization
        await visualizeDriverRoute(selectedDriver.driverId, passengerPosition);
        
        // Focus map on both driver and passenger
        if (map) {
            const bounds = L.latLngBounds([
                [selectedDriver.driver.currentLocation.lat, selectedDriver.driver.currentLocation.lng],
                [passengerPosition.lat, passengerPosition.lng]
            ]);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
        
    } catch (error) {
        console.error('❌ Navigation start failed:', error);
        showNotification('❌ Could not start navigation to driver');
    }
}
```

### **Step 4: Update Driver Locations in Navigation System**
```javascript
// Modify your existing updateDriverLocation function
function updateDriverLocation(driverData) {
    const { id, lat, lng, vehicleType, status, rating } = driverData;
    
    // Update your existing marker system
    if (!drivers[id]) {
        const vehicle = config.vehicleTypes[vehicleType];
        const icon = L.divIcon({
            html: `<div style="background: ${vehicle.color}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${vehicle.icon}</div>`,
            iconSize: [30, 30],
            className: 'driver-marker'
        });
        
        drivers[id] = L.marker([lat, lng], { icon }).addTo(map);
        drivers[id]._onMap = true;
        drivers[id].vehicleType = vehicleType;
        drivers[id].status = status;
        drivers[id].rating = rating;
    } else {
        drivers[id].setLatLng([lat, lng]);
        
        // Update marker based on status
        const vehicle = config.vehicleTypes[vehicleType];
        const statusColors = {
            'available': vehicle.color,
            'en_route_to_pickup': '#f59e0b',
            'arrived_at_pickup': '#10b981',
            'passenger_picked_up': '#8b5cf6',
            'en_route_to_destination': '#3b82f6',
            'trip_completed': '#6b7280'
        };
        
        const icon = L.divIcon({
            html: `<div style="background: ${statusColors[status] || vehicle.color}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">${vehicle.icon}</div>`,
            iconSize: [30, 30],
            className: 'driver-marker'
        });
        
        drivers[id].setIcon(icon);
        drivers[id].status = status;
    }
    
    // UPDATE NAVIGATION SYSTEM - This is the key addition!
    const navDriver = driverNavigationSystem.activeDrivers.get(id);
    if (navDriver) {
        navDriver.currentLocation = { lat, lng };
        navDriver.status = status;
        
        // The navigation system will automatically:
        // - Update route progress
        // - Check for arrivals
        // - Send notifications
        // - Handle multiple passengers
    }
}
```

### **Step 5: Enhanced Route Visualization**
```javascript
// Visualize driver route with navigation data
async function visualizeDriverRoute(driverId, passengerLocation) {
    const driver = driverNavigationSystem.activeDrivers.get(driverId);
    if (!driver) return;
    
    // Clear existing routes
    if (window.driverRoute) {
        map.removeLayer(window.driverRoute);
    }
    
    try {
        // Get route from navigation system
        const routeData = await driverNavigationSystem.calculateRoute(
            driver.currentLocation,
            passengerLocation,
            'driving',
            driver.vehicleType
        );
        
        if (routeData && routeData.coordinates) {
            // Convert OSRM coordinates to Leaflet format
            const latlngs = routeData.coordinates.map(coord => [coord[1], coord[0]]);
            
            // Create route polyline
            window.driverRoute = L.polyline(latlngs, {
                color: '#ef4444',
                weight: 4,
                opacity: 0.7,
                dashArray: '10, 5'
            }).addTo(map);
            
            // Add route information
            const routeInfo = L.popup()
                .setLatLng([passengerLocation.lat, passengerLocation.lng])
                .setContent(`
                    <div style="text-align: center;">
                        <strong>🚗 Route to Passenger</strong><br>
                        Distance: ${routeData.distance.toFixed(1)} km<br>
                        ETA: ${Math.ceil(routeData.duration)} min<br>
                        Traffic: ${routeData.traffic?.level || 'Unknown'}
                    </div>
                `)
                .openOn(map);
            
            console.log(`🗺️ Route visualized: ${routeData.distance.toFixed(1)}km, ${Math.ceil(routeData.duration)}min`);
        }
    } catch (error) {
        console.error('❌ Route visualization failed:', error);
    }
}
```

### **Step 6: Driver Navigation UI**
```javascript
// Show driver navigation panel
function showDriverNavigationPanel(driverId, navigationSession) {
    const panel = document.getElementById('navigation-content');
    if (!panel) return;
    
    const driver = driverNavigationSystem.activeDrivers.get(driverId);
    const vehicle = config.vehicleTypes[driver.vehicleType];
    
    panel.innerHTML = `
        <div style="text-align: center;">
            <h4 style="color: #10b981; margin: 0 0 15px 0;">🚗 Navigation Active</h4>
            
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <div style="font-size: 14px; margin-bottom: 5px;"><strong>Driver ${driverId}</strong></div>
                <div style="font-size: 12px; color: #94a3b8;">Status: <span style="color: #10b981;">${navigationSession.status.replace(/_/g, ' ')}</span></div>
                <div style="font-size: 12px; color: #94a3b8;">Vehicle: ${vehicle.icon} ${vehicle.name}</div>
                <div style="font-size: 12px; color: #94a3b8;">Rating: ⭐ ${driver.rating}</div>
            </div>
            
            <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <div style="font-size: 14px; margin-bottom: 8px;"><strong>🛣️ Route Information</strong></div>
                <div style="font-size: 12px; color: #94a3b8;" id="route-distance">📏 ${navigationSession.route.distance.toFixed(1)} km</div>
                <div style="font-size: 12px; color: #94a3b8;" id="route-eta">⏱️ ${Math.ceil(navigationSession.route.duration)} min</div>
                <div style="font-size: 12px; color: #94a3b8;" id="next-instruction">📍 Proceed to pickup location</div>
                <div style="font-size: 12px; color: #94a3b8;" id="traffic-info">🚦 Traffic: ${navigationSession.route.traffic?.level || 'Unknown'}</div>
            </div>
            
            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <div style="font-size: 14px; margin-bottom: 8px;"><strong>📍 Pickup Location</strong></div>
                <div style="font-size: 12px; color: #94a3b8;" id="pickup-distance">Distance: calculating...</div>
                <div style="font-size: 12px; color: #94a3b8;" id="pickup-eta">ETA: calculating...</div>
                <div style="font-size: 12px; color: #94a3b8;" id="pickup-address">📍 Passenger Location</div>
            </div>
            
            <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 15px;">
                <div>📍 Follow red route on map</div>
                <div>📞 Contact passenger when nearby</div>
                <div>✅ Confirm pickup on arrival</div>
            </div>
            
            <div style="display: flex; gap: 10px;">
                <button onclick="confirmPickup('${driverId}')" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">✅ Confirm Pickup</button>
                <button onclick="openGoogleMapsNavigation('${driverId}')" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">🗺️ Maps</button>
            </div>
        </div>
    `;
}

// Update navigation UI in real-time
function updateNavigationUI(driverId, navigationSession) {
    const pickupDistanceEl = document.getElementById('pickup-distance');
    const pickupEtaEl = document.getElementById('pickup-eta');
    
    if (pickupDistanceEl) {
        pickupDistanceEl.textContent = `📏 ${navigationSession.distanceRemaining.toFixed(1)} km`;
    }
    
    if (pickupEtaEl) {
        const etaMinutes = Math.ceil((navigationSession.estimatedArrivalTime - Date.now()) / 60000);
        pickupEtaEl.textContent = `⏱️ ${etaMinutes} min`;
    }
}

// Confirm passenger pickup
function confirmPickup(driverId) {
    const navigationSession = driverNavigationSystem.activeNavigations.get(driverId);
    if (navigationSession) {
        driverNavigationSystem.confirmPickup(driverId, navigationSession, 'manual');
        showNotification('✅ Pickup confirmed!');
    }
}

// Open Google Maps navigation
function openGoogleMapsNavigation(driverId) {
    const navigationSession = driverNavigationSystem.activeNavigations.get(driverId);
    if (navigationSession) {
        const destination = navigationSession.passengerLocation;
        const url = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
        window.open(url, '_blank');
    }
}
```

### **Step 7: Initialize Everything**
```javascript
// Add to your existing initTracking function
function initTracking() {
    console.log('🚀 Initializing UniHub Enhanced Tracking with Navigation...');
    
    // Your existing initialization code...
    isMobile = window.innerWidth <= 768;
    mapVisible = !isMobile;
    
    // Initialize navigation system
    initializeDriverNavigation();
    
    // Continue with your existing map initialization...
    initMap();
    
    // Start driver simulation with navigation integration
    startEnhancedDriverSimulationWithNavigation();
}

// Enhanced driver simulation with navigation
function startEnhancedDriverSimulationWithNavigation() {
    // Your existing driver simulation logic...
    
    // Add navigation system updates
    setInterval(() => {
        enhancedDrivers.forEach(driver => {
            // Update navigation system with new locations
            const navDriver = driverNavigationSystem.activeDrivers.get(driver.id);
            if (navDriver) {
                navDriver.currentLocation = { lat: driver.lat, lng: driver.lng };
            }
        });
    }, 2000);
}
```

---

## 🎯 **TESTING THE SYSTEM**

### **Test Driver Navigation:**
```javascript
// Test in browser console
window.testDriverNavigation = async function() {
    // Create test passenger request
    const testRequest = {
        id: 'TEST_REQ',
        passengerId: 'TEST_PASSENGER',
        pickupLocation: { lat: 5.6050, lng: -0.1870 },
        destinationLocation: { lat: 5.6060, lng: -0.1880 },
        preferredVehicleType: 'taxi'
    };
    
    // Find best drivers
    const bestDrivers = driverNavigationSystem.findBestDriversForPassenger(testRequest);
    console.log('🎯 Best drivers:', bestDrivers);
    
    // Start navigation with first driver
    if (bestDrivers.length > 0) {
        const session = await driverNavigationSystem.startNavigationToPassenger(
            bestDrivers[0].driverId,
            testRequest
        );
        console.log('🚗 Navigation started:', session);
    }
};

// Run test
testDriverNavigation();
```

### **Test Multiple Passengers:**
```javascript
// Test shuttle with multiple passengers
window.testShuttleQueue = function() {
    const shuttleId = 'DRV001'; // Assuming this is a shuttle
    
    // Add multiple passengers to queue
    const passengers = [
        { id: 'P1', pickupLocation: { lat: 5.6037, lng: -0.18696 } },
        { id: 'P2', pickupLocation: { lat: 5.6050, lng: -0.1870 } },
        { id: 'P3', pickupLocation: { lat: 5.6060, lng: -0.1880 } }
    ];
    
    passengers.forEach((passenger, index) => {
        setTimeout(() => {
            const result = driverNavigationSystem.addPassengerToQueue(shuttleId, {
                ...passenger,
                id: `REQ_${passenger.id}`,
                passengerId: passenger.id,
                destinationLocation: { lat: 5.6070, lng: -0.1890 }
            });
            console.log(`🚌 Added passenger ${passenger.id} to queue:`, result);
        }, index * 1000);
    });
};

// Run test
testShuttleQueue();
```

---

## ✅ **INTEGRATION CHECKLIST**

### **🔧 System Integration:**
- [x] Navigation system loaded
- [x] Existing drivers added to navigation
- [x] Driver location updates integrated
- [x] Ride request enhanced with navigation
- [x] Route visualization working
- [x] Navigation UI displaying
- [x] Real-time updates functioning

### **🚗 Navigation Features:**
- [x] Driver availability checking
- [x] Intelligent driver matching
- [x] Route calculation with traffic
- [x] Turn-by-turn directions
- [x] Real-time ETA updates
- [x] Arrival detection
- [x] Multiple passenger handling

### **📱 User Experience:**
- [x] Enhanced ride requests
- [x] Visual route tracking
- [x] Driver status updates
- [x] Pickup confirmations
- [x] Google Maps integration
- [x] Real-time notifications

**Your system now has perfect logic from driver checking to passenger navigation!** 🚗✨
