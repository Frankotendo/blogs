// 🚌 UNIHUB ENHANCED TRACKING SYSTEM
// Professional shuttle and ride tracking with Uber-style navigation

// Enhanced configuration with realistic parameters
const enhancedConfig = {
    mapCenter: [5.6037, -0.18696], // Kumasi, Ghana
    defaultZoom: 13,
    maxZoom: 19,
    updateInterval: 2000,
    geolocationOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    },
    
    // Vehicle-specific movement patterns
    vehiclePatterns: {
        shuttle: {
            baseSpeed: 0.00012,        // Slower speed
            speedVariation: 0.3,       // 30% variation
            stopProbability: 0.15,      // 15% chance to stop
            stopDuration: 3000,        // 3 seconds at stops
            turnProbability: 0.08,      // 8% chance to turn
            maxSpeed: 35,              // 35 km/h max
            avgSpeed: 25                // 25 km/h average
        },
        taxi: {
            baseSpeed: 0.00018,        // Moderate speed
            speedVariation: 0.4,       // 40% variation
            stopProbability: 0.08,      // 8% chance to stop
            stopDuration: 1500,        // 1.5 seconds stops
            turnProbability: 0.15,      // 15% chance to turn
            maxSpeed: 50,              // 50 km/h max
            avgSpeed: 40                // 40 km/h average
        },
        pragia: {
            baseSpeed: 0.00025,        // Fastest speed
            speedVariation: 0.5,       // 50% variation
            stopProbability: 0.03,      // 3% chance to stop
            stopDuration: 800,          // 0.8 seconds stops
            turnProbability: 0.20,      // 20% chance to turn
            maxSpeed: 60,              // 60 km/h max
            avgSpeed: 45                // 45 km/h average
        }
    },
    
    // Shuttle routes for campus
    shuttleRoutes: {
        campus_main: {
            name: 'Campus Main Route',
            color: '#3b82f6',
            frequency: 15, // minutes
            stops: [
                { id: 'stop1', name: 'Main Gate', lat: 5.6037, lng: -0.18696, waitTime: 3000 },
                { id: 'stop2', name: 'Library', lat: 5.6050, lng: -0.1870, waitTime: 2000 },
                { id: 'stop3', name: 'Science Block', lat: 5.6060, lng: -0.1880, waitTime: 2500 },
                { id: 'stop4', name: 'Student Center', lat: 5.6040, lng: -0.1850, waitTime: 3000 },
                { id: 'stop5', name: 'Hostel A', lat: 5.6020, lng: -0.1840, waitTime: 2000 }
            ]
        },
        science_faculty: {
            name: 'Science Faculty Route',
            color: '#10b981',
            frequency: 20,
            stops: [
                { id: 'stop1', name: 'Science Gate', lat: 5.6070, lng: -0.1890, waitTime: 2000 },
                { id: 'stop2', name: 'Lab Block', lat: 5.6080, lng: -0.1900, waitTime: 1500 },
                { id: 'stop3', name: 'Research Center', lat: 5.6065, lng: -0.1875, waitTime: 2500 }
            ]
        }
    }
};

// Enhanced driver data with realistic properties
const enhancedDrivers = [
    { 
        id: 'DRV001', 
        lat: 5.6037, 
        lng: -0.18696, 
        vehicleType: 'shuttle', 
        routeId: 'campus_main',
        currentStopIndex: 0,
        status: 'active',
        rating: 4.8,
        totalTrips: 245
    },
    { 
        id: 'DRV002', 
        lat: 5.6050, 
        lng: -0.1850, 
        vehicleType: 'taxi',
        status: 'active',
        rating: 4.6,
        totalTrips: 189
    },
    { 
        id: 'DRV003', 
        lat: 5.6020, 
        lng: -0.1880, 
        vehicleType: 'pragia',
        status: 'active',
        rating: 4.5,
        totalTrips: 156
    },
    { 
        id: 'DRV004', 
        lat: 5.6045, 
        lng: -0.1875, 
        vehicleType: 'shuttle',
        routeId: 'campus_main',
        currentStopIndex: 2,
        status: 'active',
        rating: 4.9,
        totalTrips: 312
    },
    { 
        id: 'DRV005', 
        lat: 5.6030, 
        lng: -0.1845, 
        vehicleType: 'taxi',
        status: 'active',
        rating: 4.7,
        totalTrips: 203
    },
    { 
        id: 'DRV006', 
        lat: 5.6060, 
        lng: -0.1890, 
        vehicleType: 'pragia',
        status: 'active',
        rating: 4.4,
        totalTrips: 178
    },
    { 
        id: 'DRV007', 
        lat: 5.6015, 
        lng: -0.1860, 
        vehicleType: 'taxi',
        status: 'active',
        rating: 4.8,
        totalTrips: 267
    },
    { 
        id: 'DRV008', 
        lat: 5.6040, 
        lng: -0.1830, 
        vehicleType: 'shuttle',
        routeId: 'science_faculty',
        currentStopIndex: 1,
        status: 'active',
        rating: 4.9,
        totalTrips: 298
    }
];

// Enhanced shuttle tracking system
class ShuttleTracker {
    constructor() {
        this.activeShuttles = new Map();
        this.routeProgress = new Map();
    }
    
    // Track shuttle movement along predefined routes
    trackShuttleMovement(shuttleId, routeId) {
        const route = enhancedConfig.shuttleRoutes[routeId];
        const shuttle = enhancedDrivers.find(d => d.id === shuttleId);
        
        if (!shuttle || !route) return;
        
        const pattern = enhancedConfig.vehiclePatterns.shuttle;
        const currentStopIndex = shuttle.currentStopIndex || 0;
        const targetStop = route.stops[currentStopIndex];
        
        // Calculate distance to next stop
        const distance = calculateDistance(
            shuttle.lat, shuttle.lng,
            targetStop.lat, targetStop.lng
        );
        
        if (distance < 0.01) { // Reached stop
            // Stop at bus stop
            shuttle.isAtStop = true;
            shuttle.currentStop = targetStop;
            
            setTimeout(() => {
                shuttle.isAtStop = false;
                shuttle.currentStopIndex = (currentStopIndex + 1) % route.stops.length;
            }, targetStop.waitTime);
            
            return {
                lat: targetStop.lat,
                lng: targetStop.lng,
                status: 'stopped',
                currentStop: targetStop.name
            };
        } else {
            // Move towards next stop
            const direction = calculateBearing(
                shuttle.lat, shuttle.lng,
                targetStop.lat, targetStop.lng
            );
            
            // Calculate movement
            const speedVariation = 1 - pattern.speedVariation + Math.random() * (2 * pattern.speedVariation);
            const currentSpeed = pattern.baseSpeed * speedVariation;
            
            const deltaLat = Math.sin(direction * Math.PI / 180) * currentSpeed;
            const deltaLng = Math.cos(direction * Math.PI / 180) * currentSpeed;
            
            return {
                lat: shuttle.lat + deltaLat,
                lng: shuttle.lng + deltaLng,
                status: 'moving',
                nextStop: targetStop.name,
                distanceToStop: distance * 111000 // Convert to meters
            };
        }
    }
    
    // Get estimated arrival times for all shuttle stops
    getShuttleETA(shuttleId, routeId) {
        const route = enhancedConfig.shuttleRoutes[routeId];
        const shuttle = enhancedDrivers.find(d => d.id === shuttleId);
        
        if (!shuttle || !route) return {};
        
        const etas = {};
        let currentTime = Date.now();
        let currentStopIndex = shuttle.currentStopIndex || 0;
        
        // Calculate ETA for each stop
        for (let i = 0; i < route.stops.length; i++) {
            const stopIndex = (currentStopIndex + i) % route.stops.length;
            const stop = route.stops[stopIndex];
            
            if (i === 0 && shuttle.isAtStop) {
                etas[stop.id] = 'Now';
            } else {
                const travelTime = i * (route.frequency / route.stops.length) * 60000; // Convert to milliseconds
                const arrivalTime = new Date(currentTime + travelTime);
                etas[stop.id] = arrivalTime.toLocaleTimeString();
            }
        }
        
        return etas;
    }
}

// Uber-style driver matching algorithm
class DriverMatcher {
    static findBestDriver(passengerLocation, vehicleType = null, maxDistance = 5) {
        const availableDrivers = enhancedDrivers.filter(driver => {
            const marker = drivers[driver.id];
            return driver.status === 'active' && 
                   marker && 
                   marker._onMap && 
                   (!vehicleType || driver.vehicleType === vehicleType);
        });
        
        if (availableDrivers.length === 0) return null;
        
        // Score drivers based on multiple factors
        const scoredDrivers = availableDrivers.map(driver => {
            const distance = calculateDistance(
                driver.lat, driver.lng,
                passengerLocation.lat, passengerLocation.lng
            );
            
            // Calculate comprehensive score
            let score = distance * 10; // Distance factor (primary)
            
            // Vehicle type preference
            if (driver.vehicleType === 'shuttle') score -= 2;
            else if (driver.vehicleType === 'taxi') score -= 1;
            
            // Driver rating bonus
            if (driver.rating) score -= (driver.rating - 3) * 0.5;
            
            // Experience bonus
            if (driver.totalTrips > 200) score -= 1;
            
            // Calculate ETA
            const avgSpeed = enhancedConfig.vehiclePatterns[driver.vehicleType].avgSpeed;
            const eta = Math.ceil(distance / avgSpeed * 60);
            
            return {
                driverId: driver.id,
                driver,
                distance,
                score,
                eta,
                vehicleInfo: config.vehicleTypes[driver.vehicleType]
            };
        });
        
        // Sort by score (lower is better) and return best
        scoredDrivers.sort((a, b) => a.score - b.score);
        return scoredDrivers[0];
    }
}

// Enhanced navigation system
class NavigationSystem {
    static async startDriverNavigation(driverId, pickupLocation) {
        const driver = enhancedDrivers.find(d => d.id === driverId);
        if (!driver) return;
        
        // Calculate optimal route
        const routeData = await getRoute(
            driver.lat, driver.lng,
            pickupLocation.lat, pickupLocation.lng,
            'driving'
        );
        
        if (!routeData) {
            console.error('❌ Could not calculate route');
            return;
        }
        
        // Enhanced navigation panel
        this.showNavigationPanel(driverId, routeData, pickupLocation);
        
        // Start real-time navigation updates
        this.startNavigationUpdates(driverId, routeData, pickupLocation);
    }
    
    static showNavigationPanel(driverId, routeData, pickupLocation) {
        const driver = enhancedDrivers.find(d => d.id === driverId);
        const vehicle = config.vehicleTypes[driver.vehicleType];
        
        const panel = document.getElementById('navigation-content');
        if (!panel) return;
        
        panel.innerHTML = `
            <div style="text-align: center;">
                <h4 style="color: #10b981; margin: 0 0 15px 0;">🚗 Navigation Active</h4>
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="font-size: 14px; margin-bottom: 5px;"><strong>Driver ${driverId}</strong></div>
                    <div style="font-size: 12px; color: #94a3b8;">Status: <span style="color: #10b981;">En Route</span></div>
                    <div style="font-size: 12px; color: #94a3b8;">Vehicle: ${vehicle.icon} ${vehicle.name}</div>
                    <div style="font-size: 12px; color: #94a3b8;">Rating: ⭐ ${driver.rating}</div>
                </div>
                <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="font-size: 14px; margin-bottom: 8px;"><strong>🛣️ Route Information</strong></div>
                    <div style="font-size: 12px; color: #94a3b8;" id="route-distance">📏 ${routeData.distance.toFixed(1)} km</div>
                    <div style="font-size: 12px; color: #94a3b8;" id="route-eta">⏱️ ${Math.ceil(routeData.duration)} min</div>
                    <div style="font-size: 12px; color: #94a3b8;" id="next-instruction">📍 Proceed to pickup location</div>
                </div>
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="font-size: 14px; margin-bottom: 8px;"><strong>📍 Pickup Location</strong></div>
                    <div style="font-size: 12px; color: #94a3b8;" id="pickup-distance">Distance: calculating...</div>
                    <div style="font-size: 12px; color: #94a3b8;" id="pickup-eta">ETA: calculating...</div>
                </div>
                <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 15px;">
                    <div>📍 Follow red route on map</div>
                    <div>📞 Contact passenger when nearby</div>
                    <div>✅ Confirm pickup on arrival</div>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="window.UniHubTracking.completeMission('${driverId}')" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">Complete Pickup</button>
                    <button onclick="window.UniHubTracking.openGoogleMaps('${driverId}')" style="background: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">🗺️ Maps</button>
                </div>
            </div>
        `;
    }
    
    static startNavigationUpdates(driverId, routeData, pickupLocation) {
        const navigationInterval = setInterval(() => {
            const driver = enhancedDrivers.find(d => d.id === driverId);
            if (!driver) {
                clearInterval(navigationInterval);
                return;
            }
            
            // Calculate current distance to pickup
            const distanceToPickup = calculateDistance(
                driver.lat, driver.lng,
                pickupLocation.lat, pickupLocation.lng
            );
            
            // Update navigation display
            const pickupDistanceEl = document.getElementById('pickup-distance');
            const pickupEtaEl = document.getElementById('pickup-eta');
            
            if (pickupDistanceEl) {
                pickupDistanceEl.textContent = `📏 ${distanceToPickup.toFixed(1)} km`;
            }
            
            if (pickupEtaEl) {
                const avgSpeed = enhancedConfig.vehiclePatterns[driver.vehicleType].avgSpeed;
                const eta = Math.ceil(distanceToPickup / avgSpeed * 60);
                pickupEtaEl.textContent = `⏱️ ${eta} min`;
            }
            
            // Check if arrived
            if (distanceToPickup < 0.05) { // Within 50 meters
                clearInterval(navigationInterval);
                this.notifyDriverArrival(driverId);
            }
            
            // Update route if driver deviates significantly
            if (distanceToPickup > routeData.distance * 1.2) {
                console.log('🔄 Driver deviated, recalculating route...');
                this.startDriverNavigation(driverId, pickupLocation);
                clearInterval(navigationInterval);
            }
        }, 2000);
    }
    
    static notifyDriverArrival(driverId) {
        showNotification(`🚗 Driver ${driverId} has arrived!`);
        
        // Update driver status
        const driver = enhancedDrivers.find(d => d.id === driverId);
        if (driver) {
            driver.status = 'arrived';
        }
        
        // Play arrival sound (if available)
        if (typeof playSound === 'function') {
            playSound('arrival');
        }
    }
}

// Smart notification system
class NotificationManager {
    constructor() {
        this.sentNotifications = new Set();
        this.proximityThresholds = [2.0, 0.5, 0.1]; // km
        this.proximityMessages = [
            '🛣️ Driver is en route - {eta} minutes away',
            '📍 Driver is nearby - 1 minute away',
            '🚗 Your driver has arrived!'
        ];
    }
    
    checkProximity(driverId, passengerLocation) {
        const driver = enhancedDrivers.find(d => d.id === driverId);
        if (!driver || !passengerLocation) return;
        
        const distance = calculateDistance(
            driver.lat, driver.lng,
            passengerLocation.lat, passengerLocation.lng
        );
        
        // Check each proximity threshold
        this.proximityThresholds.forEach((threshold, index) => {
            const notificationKey = `${driverId}_${threshold}`;
            
            if (distance < threshold && !this.sentNotifications.has(notificationKey)) {
                const avgSpeed = enhancedConfig.vehiclePatterns[driver.vehicleType].avgSpeed;
                const eta = Math.ceil(distance / avgSpeed * 60);
                const message = this.proximityMessages[index].replace('{eta}', eta);
                
                showNotification(message);
                this.sentNotifications.add(notificationKey);
                
                // Play sound for arrival
                if (threshold === 0.1 && typeof playSound === 'function') {
                    playSound('arrival');
                }
            }
        });
    }
    
    resetNotifications(driverId) {
        // Clear sent notifications for this driver
        const keysToDelete = Array.from(this.sentNotifications).filter(key => key.startsWith(driverId));
        keysToDelete.forEach(key => this.sentNotifications.delete(key));
    }
}

// Initialize enhanced systems
const shuttleTracker = new ShuttleTracker();
const notificationManager = new NotificationManager();

// Enhanced driver simulation with realistic movement
function startEnhancedDriverSimulation() {
    // Initialize all enhanced drivers
    enhancedDrivers.forEach(driver => {
        updateDriverLocation({
            id: driver.id,
            lat: driver.lat,
            lng: driver.lng,
            vehicleType: driver.vehicleType,
            rating: driver.rating,
            totalTrips: driver.totalTrips
        });
    });
    
    // Enhanced simulation with realistic movement patterns
    const simulationInterval = setInterval(() => {
        enhancedDrivers.forEach(driver => {
            if (driver.status !== 'active') return;
            
            const pattern = enhancedConfig.vehiclePatterns[driver.vehicleType];
            let newPosition;
            
            if (driver.vehicleType === 'shuttle' && driver.routeId) {
                // Shuttle follows predefined route
                newPosition = shuttleTracker.trackShuttleMovement(driver.id, driver.routeId);
            } else {
                // Taxi and Pragia move freely
                newPosition = simulateFreeMovement(driver, pattern);
            }
            
            // Update driver location
            updateDriverLocation({
                id: driver.id,
                lat: newPosition.lat,
                lng: newPosition.lng,
                vehicleType: driver.vehicleType,
                status: newPosition.status || 'moving',
                currentStop: newPosition.currentStop,
                nextStop: newPosition.nextStop,
                rating: driver.rating,
                totalTrips: driver.totalTrips
            });
            
            // Update routes if driver is on active mission
            if (activeMission && activeMission.driverId === driver.id) {
                updateDriverRoute(driver.id, passengerPosition);
                notificationManager.checkProximity(driver.id, passengerPosition);
            }
        });
        
        // Smart ride assignment
        if (Math.random() < 0.02 && passengerPosition && !activeMission) {
            const bestDriver = DriverMatcher.findBestDriver(passengerPosition);
            
            if (bestDriver && bestDriver.distance < 5.0) {
                simulateRideAssignment(bestDriver.driverId);
                console.log(`🎯 Smart assignment: ${bestDriver.driverId} (${bestDriver.distance.toFixed(2)}km, ${bestDriver.eta}min, ⭐${bestDriver.driver.rating})`);
            }
        }
        
    }, enhancedConfig.updateInterval);
    
    console.log('✅ Enhanced realistic driver simulation started');
}

// Simulate free movement for taxis and pragias
function simulateFreeMovement(driver, pattern) {
    // Simulate stopping (traffic lights, pickups, etc.)
    if (Math.random() < pattern.stopProbability) {
        return {
            lat: driver.lat,
            lng: driver.lng,
            status: 'stopped'
        };
    }
    
    // Update speed with realistic variation
    const speedVariation = 1 - pattern.speedVariation + Math.random() * (2 * pattern.speedVariation);
    const currentSpeed = pattern.baseSpeed * speedVariation;
    
    // Update direction occasionally for realistic turns
    if (Math.random() < pattern.turnProbability) {
        const turnAngle = (Math.random() - 0.5) * 60; // -30 to +30 degrees
        driver.direction = (driver.direction + turnAngle) % 360;
        if (driver.direction < 0) driver.direction += 360;
    }
    
    // Calculate movement
    const deltaLat = Math.sin(driver.direction * Math.PI / 180) * currentSpeed;
    const deltaLng = Math.cos(driver.direction * Math.PI / 180) * currentSpeed;
    
    let newLat = driver.lat + deltaLat;
    let newLng = driver.lng + deltaLng;
    
    // Boundary checking
    const bounds = {
        minLat: 5.5950, maxLat: 5.6150,
        minLng: -0.1950, maxLng: -0.1750
    };
    
    if (newLat < bounds.minLat || newLat > bounds.maxLat || 
        newLng < bounds.minLng || newLng > bounds.maxLng) {
        // Reverse direction if hitting boundary
        driver.direction = (driver.direction + 180) % 360;
        newLat = driver.lat + Math.sin(driver.direction * Math.PI / 180) * currentSpeed;
        newLng = driver.lng + Math.cos(driver.direction * Math.PI / 180) * currentSpeed;
    }
    
    // Update driver position
    driver.lat = newLat;
    driver.lng = newLng;
    
    return {
        lat: newLat,
        lng: newLng,
        status: 'moving'
    };
}

// Enhanced ride request with smart matching
async function requestRideEnhanced(vehicleType = null) {
    if (!passengerPosition) {
        showNotification('❌ Please enable location access first');
        return;
    }
    
    const bestDriver = DriverMatcher.findBestDriver(passengerPosition, vehicleType);
    
    if (!bestDriver) {
        showNotification('❌ No available drivers nearby');
        return;
    }
    
    console.log(`🎯 Best driver selected: ${bestDriver.driverId} (${bestDriver.distance.toFixed(2)}km away, ${bestDriver.eta}min ETA, ⭐${bestDriver.driver.rating})`);
    
    // Clear existing routes
    clearRoutes();
    
    // Create active mission
    activeMission = {
        driverId: bestDriver.driverId,
        passengerLocation: passengerPosition,
        driverLocation: { lat: bestDriver.driver.lat, lng: bestDriver.driver.lng },
        status: 'requested',
        requestTime: Date.now(),
        vehicleType: bestDriver.driver.vehicleType,
        distance: bestDriver.distance,
        eta: bestDriver.eta
    };
    
    showNotification(`🚗 ${bestDriver.vehicleInfo.name} requested! Driver ${bestDriver.driverId} (${bestDriver.eta}min away, ⭐${bestDriver.driver.rating})`);
    
    // Start enhanced navigation
    await NavigationSystem.startDriverNavigation(bestDriver.driverId, passengerPosition);
    
    // Start passenger route tracing
    await updatePassengerRoute(bestDriver.driverId);
    
    // Reset notifications for this driver
    notificationManager.resetNotifications(bestDriver.driverId);
    
    // Focus map to show both routes
    if (map && bestDriver.driver && passengerPosition) {
        const bounds = L.latLngBounds([
            [bestDriver.driver.lat, bestDriver.driver.lng],
            [passengerPosition.lat, passengerPosition.lng]
        ]);
        map.fitBounds(bounds, { padding: [50, 50] });
    }
}

// Calculate bearing between two points
function calculateBearing(lat1, lng1, lat2, lng2) {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

// Export enhanced functions
window.UniHubEnhanced = {
    startEnhancedDriverSimulation,
    requestRideEnhanced,
    shuttleTracker,
    DriverMatcher,
    NavigationSystem,
    NotificationManager,
    enhancedConfig,
    enhancedDrivers
};

console.log('🚌 Enhanced UniHub tracking system loaded');
