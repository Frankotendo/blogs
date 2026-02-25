// 🚌 ENHANCED UNIHUB TRACKING SYSTEM - FIXED VERSION
// Proper driver-passenger tracking with role-based alerts

// Enhanced configuration with user roles
const enhancedConfig = {
    ...window.config || {},
    userRoles: {
        PASSENGER: 'passenger',
        DRIVER: 'driver',
        ADMIN: 'admin'
    },
    notificationTypes: {
        DRIVER_TO_PASSENGER: 'driver_to_passenger',
        PASSENGER_TO_DRIVER: 'passenger_to_driver',
        ADMIN_ALL: 'admin_all'
    }
};

// Global state management
const trackingState = {
    currentUserRole: enhancedConfig.userRoles.PASSENGER, // Default to passenger
    activeTrip: null,
    driverNotifications: new Map(),
    passengerNotifications: new Map(),
    adminView: {
        showAllTrips: false,
        selectedTripId: null,
        trackingMode: 'overview' // 'overview', 'trip_detail', 'driver_focus'
    }
};

// Role-based notification system
class RoleBasedNotificationManager {
    constructor() {
        this.sentNotifications = new Map(); // key -> {timestamp, type, recipient}
        this.proximityThresholds = [2.0, 0.5, 0.1]; // km
    }
    
    // Send notification to specific role only
    sendNotification(message, type = 'info', targetRole = null, recipientId = null) {
        // Only send if user role matches target
        if (targetRole && trackingState.currentUserRole !== targetRole) {
            return false;
        }
        
        // Only send if specific recipient matches
        if (recipientId && this.getCurrentUserId() !== recipientId) {
            return false;
        }
        
        console.log(`📢 [${trackingState.currentUserRole}] ${message}`);
        
        // Show visual notification for appropriate roles
        if (trackingState.currentUserRole === enhancedConfig.userRoles.PASSENGER || 
            trackingState.currentUserRole === enhancedConfig.userRoles.ADMIN) {
            this.showVisualNotification(message, type);
        }
        
        return true;
    }
    
    // Driver-specific notifications (only shown to drivers)
    notifyDriver(message, driverId = null) {
        return this.sendNotification(
            `🚗 Driver: ${message}`, 
            'driver', 
            enhancedConfig.userRoles.DRIVER, 
            driverId
        );
    }
    
    // Passenger-specific notifications (only shown to passengers)
    notifyPassenger(message, passengerId = null) {
        return this.sendNotification(
            `📍 Passenger: ${message}`, 
            'passenger', 
            enhancedConfig.userRoles.PASSENGER, 
            passengerId
        );
    }
    
    // Admin notifications (shown to admin only)
    notifyAdmin(message) {
        return this.sendNotification(
            `⚙️ Admin: ${message}`, 
            'admin', 
            enhancedConfig.userRoles.ADMIN
        );
    }
    
    // Proximity notifications for passengers only
    checkDriverProximity(driverId, passengerLocation) {
        // Only send proximity notifications to passengers
        if (trackingState.currentUserRole !== enhancedConfig.userRoles.PASSENGER) {
            return;
        }
        
        const driver = window.drivers?.[driverId];
        if (!driver || !passengerLocation) return;
        
        const driverPos = driver.getLatLng();
        const distance = calculateDistance(
            driverPos.lat, driverPos.lng,
            passengerLocation.lat, passengerLocation.lng
        );
        
        const notificationKey = `proximity_${driverId}`;
        const lastNotification = this.sentNotifications.get(notificationKey);
        
        // Check each proximity threshold
        this.proximityThresholds.forEach((threshold, index) => {
            if (distance < threshold) {
                const timeSinceLast = lastNotification ? Date.now() - lastNotification.timestamp : Infinity;
                
                // Only send if not sent recently (within last 30 seconds)
                if (!lastNotification || timeSinceLast > 30000) {
                    const messages = [
                        `🛣️ Driver ${driverId} is en route - ${Math.ceil(distance / 0.4 * 60)} min away`,
                        `📍 Driver ${driverId} is nearby - 1 minute away`,
                        `🚗 Driver ${driverId} has arrived!`
                    ];
                    
                    this.notifyPassenger(messages[index]);
                    this.sentNotifications.set(notificationKey, {
                        timestamp: Date.now(),
                        type: 'proximity',
                        threshold
                    });
                    
                    // Play arrival sound for final notification
                    if (threshold === 0.1 && typeof playSound === 'function') {
                        playSound('arrival');
                    }
                }
            }
        });
    }
    
    // Driver trip updates (only shown to drivers)
    updateDriverTripStatus(driverId, status, details = {}) {
        const messages = {
            'trip_assigned': `New trip assigned to ${details.passengerName || 'passenger'}`,
            'passenger_ready': 'Passenger is ready for pickup',
            'pickup_complete': 'Pickup completed successfully',
            'trip_completed': 'Trip completed successfully'
        };
        
        if (messages[status]) {
            this.notifyDriver(messages[status], driverId);
        }
    }
    
    // Admin trip monitoring
    updateAdminTripStatus(tripId, status, details = {}) {
        const messages = {
            'trip_requested': `New trip requested: ${tripId}`,
            'driver_assigned': `Driver assigned to trip ${tripId}`,
            'trip_started': `Trip ${tripId} started`,
            'trip_completed': `Trip ${tripId} completed`,
            'trip_cancelled': `Trip ${tripId} cancelled`
        };
        
        if (messages[status]) {
            this.notifyAdmin(`${messages[status]} - ${details.driverName || 'Unknown driver'}`);
        }
    }
    
    showVisualNotification(message, type = 'info') {
        if (typeof showNotification === 'function') {
            showNotification(message);
        }
    }
    
    getCurrentUserId() {
        // In a real app, this would get the current user's ID
        return trackingState.currentUserRole === enhancedConfig.userRoles.DRIVER ? 
            trackingState.activeTrip?.driverId : 
            'current_user';
    }
    
    clearNotifications(tripId = null) {
        if (tripId) {
            // Clear notifications for specific trip
            const keysToDelete = Array.from(this.sentNotifications.keys())
                .filter(key => key.includes(tripId));
            keysToDelete.forEach(key => this.sentNotifications.delete(key));
        } else {
            // Clear all notifications
            this.sentNotifications.clear();
        }
    }
}

// Enhanced driver tracking with passenger visibility
class DriverTrackingSystem {
    constructor() {
        this.notificationManager = new RoleBasedNotificationManager();
        this.tripTracking = new Map(); // tripId -> tracking data
    }
    
    // Start tracking a trip from driver perspective
    startDriverTripTracking(tripId, driverId, passengerLocation) {
        const trackingData = {
            tripId,
            driverId,
            passengerLocation,
            startTime: Date.now(),
            updates: [],
            status: 'active'
        };
        
        this.tripTracking.set(tripId, trackingData);
        
        // Notify driver of trip assignment
        this.notificationManager.updateDriverTripStatus(driverId, 'trip_assigned', {
            passengerLocation: passengerLocation
        });
        
        // Notify admin
        this.notificationManager.updateAdminTripStatus(tripId, 'driver_assigned', {
            driverId
        });
        
        // Start tracking updates
        this.startTripUpdates(tripId);
        
        console.log(`🚗 Started tracking trip ${tripId} for driver ${driverId}`);
    }
    
    // Start tracking from passenger perspective
    startPassengerTripTracking(tripId, driverId, driverLocation) {
        const trackingData = {
            tripId,
            driverId,
            driverLocation,
            startTime: Date.now(),
            updates: [],
            status: 'active'
        };
        
        this.tripTracking.set(tripId, trackingData);
        
        // Notify passenger of driver assignment
        this.notificationManager.notifyPassenger(
            `Driver ${driverId} assigned to your trip`
        );
        
        console.log(`📍 Started tracking trip ${tripId} for passenger`);
    }
    
    // Real-time trip updates
    startTripUpdates(tripId) {
        const trackingData = this.tripTracking.get(tripId);
        if (!trackingData) return;
        
        const updateInterval = setInterval(() => {
            const driver = window.drivers?.[trackingData.driverId];
            const passengerPosition = window.passengerPosition;
            
            if (!driver || !passengerPosition) {
                clearInterval(updateInterval);
                return;
            }
            
            const driverPos = driver.getLatLng();
            const distance = calculateDistance(
                driverPos.lat, driverPos.lng,
                passengerPosition.lat, passengerPosition.lng
            );
            
            // Update tracking data
            trackingData.updates.push({
                timestamp: Date.now(),
                driverLocation: { lat: driverPos.lat, lng: driverPos.lng },
                passengerLocation: { lat: passengerPosition.lat, lng: passengerPosition.lng },
                distance: distance,
                driverSpeed: driver.speed || 0
            });
            
            // Check proximity for passenger notifications
            this.notificationManager.checkDriverProximity(trackingData.driverId, passengerPosition);
            
            // Update admin view
            this.updateAdminTripView(tripId, {
                distance,
                driverLocation: { lat: driverPos.lat, lng: driverPos.lng },
                passengerLocation,
                status: this.getTripStatus(distance)
            });
            
            // Check if trip should end (driver arrived)
            if (distance < 0.05) { // Within 50 meters
                this.completeTrip(tripId);
                clearInterval(updateInterval);
            }
            
        }, 2000);
        
        // Store interval ID for cleanup
        trackingData.updateInterval = updateInterval;
    }
    
    // Update admin trip view
    updateAdminTripView(tripId, data) {
        if (trackingState.currentUserRole !== enhancedConfig.userRoles.ADMIN) {
            return;
        }
        
        // Update admin panel if visible
        const adminPanel = document.getElementById('admin-trip-details');
        if (adminPanel && trackingState.adminView.selectedTripId === tripId) {
            this.renderAdminTripDetails(tripId, data);
        }
    }
    
    // Render admin trip details
    renderAdminTripDetails(tripId, data) {
        const trackingData = this.tripTracking.get(tripId);
        if (!trackingData) return;
        
        const adminPanel = document.getElementById('admin-trip-details');
        if (!adminPanel) return;
        
        const driver = window.drivers?.[trackingData.driverId];
        const vehicle = window.config?.vehicleTypes?.[driver?.vehicleType];
        
        adminPanel.innerHTML = `
            <div style="padding: 15px;">
                <h4>🚗 Trip ${tripId} - Live Tracking</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                    <div style="background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">Driver Info</div>
                        <div style="font-size: 12px;">ID: ${trackingData.driverId}</div>
                        <div style="font-size: 12px;">Vehicle: ${vehicle?.icon || '🚗'} ${vehicle?.name || 'Unknown'}</div>
                        <div style="font-size: 12px;">Status: <span style="color: #10b981;">${data.status || 'Active'}</span></div>
                    </div>
                    <div style="background: rgba(16, 185, 129, 0.1); padding: 10px; border-radius: 8px;">
                        <div style="font-weight: 600; margin-bottom: 5px;">Trip Progress</div>
                        <div style="font-size: 12px;">Distance: ${(data.distance || 0).toFixed(2)} km</div>
                        <div style="font-size: 12px;">Duration: ${Math.floor((Date.now() - trackingData.startTime) / 60000)} min</div>
                        <div style="font-size: 12px;">Speed: ${(data.driverSpeed || 0).toFixed(1)} km/h</div>
                    </div>
                </div>
                <div style="margin-top: 15px;">
                    <div style="font-weight: 600; margin-bottom: 5px;">📍 Live Locations</div>
                    <div style="font-size: 12px; color: #64748b;">
                        Driver: ${data.driverLocation?.lat.toFixed(6)}, ${data.driverLocation?.lng.toFixed(6)}
                    </div>
                    <div style="font-size: 12px; color: #64748b;">
                        Passenger: ${data.passengerLocation?.lat.toFixed(6)}, ${data.passengerLocation?.lng.toFixed(6)}
                    </div>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button onclick="window.UniHubTracking.focusOnDriver('${trackingData.driverId}')" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">📍 Focus Driver</button>
                    <button onclick="window.UniHubTracking.focusOnPassenger()" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">📍 Focus Passenger</button>
                    <button onclick="window.UniHubTracking.centerOnTrip('${tripId}')" style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">🗺️ Center Trip</button>
                </div>
            </div>
        `;
    }
    
    // Get trip status based on distance
    getTripStatus(distance) {
        if (distance < 0.05) return 'Arrived';
        if (distance < 0.5) return 'Nearby';
        if (distance < 2) return 'En Route';
        return 'Far';
    }
    
    // Complete trip
    completeTrip(tripId) {
        const trackingData = this.tripTracking.get(tripId);
        if (!trackingData) return;
        
        // Clear update interval
        if (trackingData.updateInterval) {
            clearInterval(trackingData.updateInterval);
        }
        
        // Update status
        trackingData.status = 'completed';
        
        // Notify all relevant parties
        this.notificationManager.updateDriverTripStatus(trackingData.driverId, 'trip_completed');
        this.notificationManager.updateAdminTripStatus(tripId, 'trip_completed');
        
        // Clear notifications
        this.notificationManager.clearNotifications(tripId);
        
        console.log(`✅ Trip ${tripId} completed`);
    }
    
    // Get all active trips for admin
    getActiveTrips() {
        return Array.from(this.tripTracking.entries())
            .filter(([_, data]) => data.status === 'active')
            .map(([tripId, data]) => ({
                tripId,
                driverId: data.driverId,
                startTime: data.startTime,
                status: data.status,
                updates: data.updates.length
            }));
    }
}

// Admin panel management
class AdminPanelManager {
    constructor() {
        this.isVisible = false;
        this.driverTracking = new DriverTrackingSystem();
    }
    
    // Toggle admin panel visibility
    toggle() {
        this.isVisible = !this.isVisible;
        const panel = document.getElementById('admin-panel');
        
        if (this.isVisible) {
            this.renderAdminPanel();
            if (panel) panel.style.display = 'block';
        } else {
            if (panel) panel.style.display = 'none';
        }
    }
    
    // Render admin panel
    renderAdminPanel() {
        const panel = document.getElementById('admin-panel');
        if (!panel) return;
        
        const activeTrips = this.driverTracking.getActiveTrips();
        
        panel.innerHTML = `
            <div style="background: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: 400px; max-height: 600px; overflow-y: auto;">
                <div style="padding: 15px; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0;">⚙️ Admin Panel</h3>
                        <button onclick="window.UniHubAdmin.toggle()" style="background: none; border: none; font-size: 18px; cursor: pointer;">✕</button>
                    </div>
                </div>
                <div style="padding: 15px;">
                    <div style="margin-bottom: 15px;">
                        <h4 style="margin: 0 0 10px 0;">🚗 Active Trips (${activeTrips.length})</h4>
                        ${activeTrips.length === 0 ? 
                            '<div style="color: #64748b; font-size: 12px;">No active trips</div>' :
                            activeTrips.map(trip => `
                                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; margin-bottom: 8px; cursor: pointer;" 
                                     onclick="window.UniHubAdmin.selectTrip('${trip.tripId}')">
                                    <div style="font-weight: 600;">Trip ${trip.tripId}</div>
                                    <div style="font-size: 12px; color: #64748b;">Driver: ${trip.driverId}</div>
                                    <div style="font-size: 12px; color: #64748b;">Duration: ${Math.floor((Date.now() - trip.startTime) / 60000)} min</div>
                                    <div style="font-size: 12px; color: #10b981;">Status: ${trip.status}</div>
                                </div>
                            `).join('')
                        }
                    </div>
                    <div id="admin-trip-details">
                        <!-- Trip details will be rendered here -->
                    </div>
                </div>
            </div>
        `;
    }
    
    // Select specific trip for detailed view
    selectTrip(tripId) {
        trackingState.adminView.selectedTripId = tripId;
        trackingState.adminView.trackingMode = 'trip_detail';
        
        // Get current trip data
        const trackingData = this.driverTracking.tripTracking.get(tripId);
        if (trackingData) {
            const driver = window.drivers?.[trackingData.driverId];
            const driverPos = driver?.getLatLng();
            const passengerPosition = window.passengerPosition;
            
            if (driverPos && passengerPosition) {
                const distance = calculateDistance(
                    driverPos.lat, driverPos.lng,
                    passengerPosition.lat, passengerPosition.lng
                );
                
                this.driverTracking.renderAdminTripDetails(tripId, {
                    distance,
                    driverLocation: { lat: driverPos.lat, lng: driverPos.lng },
                    passengerLocation,
                    status: this.driverTracking.getTripStatus(distance)
                });
            }
        }
    }
}

// Initialize enhanced tracking system
const roleBasedNotifications = new RoleBasedNotificationManager();
const driverTrackingSystem = new DriverTrackingSystem();
const adminPanelManager = new AdminPanelManager();

// Enhanced ride request with proper role-based tracking
async function requestRideWithRoleTracking(vehicleType = null) {
    if (!window.passengerPosition) {
        roleBasedNotifications.notifyPassenger('Please enable location access first');
        return;
    }
    
    // Find best driver using existing logic
    const bestDriver = window.UniHubEnhanced?.DriverMatcher?.findBestDriver(window.passengerPosition, vehicleType);
    
    if (!bestDriver) {
        roleBasedNotifications.notifyPassenger('No available drivers nearby');
        return;
    }
    
    const tripId = `TRIP_${Date.now()}`;
    
    console.log(`🎯 Role-based trip assignment: ${bestDriver.driverId} for trip ${tripId}`);
    
    // Create active mission with trip ID
    if (window.activeMission) {
        window.activeMission.tripId = tripId;
    }
    
    // Start tracking for both driver and passenger
    driverTrackingSystem.startDriverTripTracking(tripId, bestDriver.driverId, window.passengerPosition);
    driverTrackingSystem.startPassengerTripTracking(tripId, bestDriver.driverId, {
        lat: bestDriver.driver.lat,
        lng: bestDriver.driver.lng
    });
    
    // Notify based on user role
    if (trackingState.currentUserRole === enhancedConfig.userRoles.PASSENGER) {
        roleBasedNotifications.notifyPassenger(
            `${bestDriver.vehicleInfo.name} requested! Driver ${bestDriver.driverId} (${bestDriver.eta}min away, ⭐${bestDriver.driver.rating})`
        );
    } else if (trackingState.currentUserRole === enhancedConfig.userRoles.ADMIN) {
        roleBasedNotifications.notifyAdmin(
            `Trip ${tripId} assigned to driver ${bestDriver.driverId}`
        );
    }
    
    // Continue with existing ride request logic
    if (typeof requestRideEnhanced === 'function') {
        await requestRideEnhanced(vehicleType);
    }
}

// Set user role (for testing/demo)
function setUserRole(role) {
    if (Object.values(enhancedConfig.userRoles).includes(role)) {
        trackingState.currentUserRole = role;
        console.log(`👤 User role set to: ${role}`);
        
        // Show/hide admin panel based on role
        if (role === enhancedConfig.userRoles.ADMIN) {
            adminPanelManager.renderAdminPanel();
            const panel = document.getElementById('admin-panel');
            if (panel) panel.style.display = 'block';
        } else {
            const panel = document.getElementById('admin-panel');
            if (panel) panel.style.display = 'none';
        }
    }
}

// Export enhanced functions
window.UniHubTracking = {
    ...window.UniHubTracking || {},
    requestRideWithRoleTracking,
    setUserRole,
    driverTrackingSystem,
    roleBasedNotifications,
    focusOnDriver: (driverId) => {
        const driver = window.drivers?.[driverId];
        if (driver && window.map) {
            const pos = driver.getLatLng();
            window.map.setView([pos.lat, pos.lng], 16);
        }
    },
    focusOnPassenger: () => {
        if (window.passengerPosition && window.map) {
            window.map.setView([window.passengerPosition.lat, window.passengerPosition.lng], 16);
        }
    },
    centerOnTrip: (tripId) => {
        const trackingData = driverTrackingSystem.tripTracking.get(tripId);
        if (trackingData && window.map) {
            const driver = window.drivers?.[trackingData.driverId];
            const driverPos = driver?.getLatLng();
            const passengerPos = window.passengerPosition;
            
            if (driverPos && passengerPos) {
                const bounds = L.latLngBounds([
                    [driverPos.lat, driverPos.lng],
                    [passengerPos.lat, passengerPos.lng]
                ]);
                window.map.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }
};

window.UniHubAdmin = {
    toggle: () => adminPanelManager.toggle(),
    selectTrip: (tripId) => adminPanelManager.selectTrip(tripId)
};

// Add admin panel to DOM if it doesn't exist
if (!document.getElementById('admin-panel')) {
    const adminPanel = document.createElement('div');
    adminPanel.id = 'admin-panel';
    adminPanel.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: none;
    `;
    document.body.appendChild(adminPanel);
}

// Add role selector for testing
if (!document.getElementById('role-selector')) {
    const roleSelector = document.createElement('div');
    roleSelector.id = 'role-selector';
    roleSelector.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        z-index: 10000;
        background: white;
        padding: 10px;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    `;
    roleSelector.innerHTML = `
        <div style="font-size: 12px; margin-bottom: 5px;">👤 User Role:</div>
        <select onchange="window.UniHubTracking.setUserRole(this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #d1d5db;">
            <option value="${enhancedConfig.userRoles.PASSENGER}">📍 Passenger</option>
            <option value="${enhancedConfig.userRoles.DRIVER}">🚗 Driver</option>
            <option value="${enhancedConfig.userRoles.ADMIN}">⚙️ Admin</option>
        </select>
    `;
    document.body.appendChild(roleSelector);
}

console.log('🔔 Role-based notification system loaded');
