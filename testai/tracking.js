// 🚗 NexRyde Live Tracking Module
// Real-time georeferenced tracking with Leaflet + Socket.IO
// Plug-in module - No existing code modifications required

class LiveTrackingModule {
    constructor() {
        this.map = null;
        this.drivers = new Map(); // {id: {marker, data}}
        this.passengerMarker = null;
        this.passengerPosition = null;
        this.socket = null;
        this.watchId = null;
        this.routeLines = new Map(); // {driverId: polyline}
        
        // Configuration
        this.config = {
            defaultCenter: [5.6037, -0.18696], // Kumasi, Ghana
            defaultZoom: 13,
            maxZoom: 19,
            updateInterval: 2000,
            tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            iconPaths: {
                driver: '/icons/car.png',
                passenger: '/icons/passenger.png'
            }
        };
        
        this.init();
    }
    
    // Initialize the tracking module
    init() {
        console.log('🚗 Initializing NexRyde Live Tracking...');
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    // Setup map and tracking
    setup() {
        try {
            this.initializeMap();
            this.initializeSocket();
            this.startPassengerTracking();
            this.setupEventListeners();
            
            console.log('✅ Live Tracking Module initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Live Tracking:', error);
        }
    }
    
    // Initialize Leaflet map
    initializeMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            throw new Error('Map container #map not found');
        }
        
        // Create map
        this.map = L.map('map', {
            center: this.config.defaultCenter,
            zoom: this.config.defaultZoom,
            maxZoom: this.config.maxZoom,
            zoomControl: true
        });
        
        // Add OpenStreetMap tiles
        L.tileLayer(this.config.tileUrl, {
            attribution: '© OpenStreetMap contributors',
            maxZoom: this.config.maxZoom
        }).addTo(this.map);
        
        // Set map container size
        mapContainer.style.height = '100vh';
        mapContainer.style.width = '100%';
        mapContainer.style.position = 'relative';
        mapContainer.style.zIndex = '1';
        
        console.log('🗺️ Map initialized with OpenStreetMap tiles');
    }
    
    // Initialize Socket.IO connection
    initializeSocket() {
        try {
            // Connect to Socket.IO server (adjust URL as needed)
            this.socket = io();
            
            // Listen for driver location updates
            this.socket.on('driverLocationUpdate', (data) => {
                this.updateDriverLocation(data);
            });
            
            // Listen for ride assignments
            this.socket.on('rideAssigned', (data) => {
                this.handleRideAssigned(data);
            });
            
            // Listen for connection events
            this.socket.on('connect', () => {
                console.log('🔗 Connected to tracking server');
            });
            
            this.socket.on('disconnect', () => {
                console.log('🔌 Disconnected from tracking server');
            });
            
            console.log('📡 Socket.IO initialized');
        } catch (error) {
            console.warn('⚠️ Socket.IO not available, using simulation mode');
            this.startSimulationMode();
        }
    }
    
    // Start passenger GPS tracking
    startPassengerTracking() {
        if (!navigator.geolocation) {
            console.warn('⚠️ Geolocation not supported');
            this.setPassengerLocation(this.config.defaultCenter);
            return;
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000
        };
        
        // Get initial position
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                this.setPassengerLocation([latitude, longitude], accuracy);
                console.log(`📍 Passenger location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy.toFixed(0)}m)`);
            },
            (error) => {
                console.warn('⚠️ Could not get passenger location:', error.message);
                this.setPassengerLocation(this.config.defaultCenter);
            },
            options
        );
        
        // Watch for position changes
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                this.setPassengerLocation([latitude, longitude], accuracy);
            },
            (error) => {
                console.warn('⚠️ Location tracking error:', error.message);
            },
            options
        );
    }
    
    // Set passenger location and update marker
    setPassengerLocation(latlng, accuracy = null) {
        this.passengerPosition = { lat: latlng[0], lng: latlng[1] };
        
        // Create or update passenger marker
        if (!this.passengerMarker) {
            const icon = L.divIcon({
                html: '<div style="background: #3b82f6; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 12px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">👤</div>',
                iconSize: [20, 20],
                className: 'passenger-marker'
            });
            
            this.passengerMarker = L.marker(latlng, { icon }).addTo(this.map);
            
            // Add popup
            this.passengerMarker.bindPopup('📍 Your Location').openPopup();
        } else {
            this.passengerMarker.setLatLng(latlng);
        }
        
        // Add accuracy circle if available
        if (accuracy && accuracy > 0) {
            if (!this.accuracyCircle) {
                this.accuracyCircle = L.circle(latlng, {
                    radius: accuracy,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.1,
                    color: '#3b82f6',
                    weight: 1
                }).addTo(this.map);
            } else {
                this.accuracyCircle.setLatLng(latlng);
                this.accuracyCircle.setRadius(accuracy);
            }
        }
        
        // Center map on passenger if no drivers are visible
        if (this.drivers.size === 0) {
            this.map.setView(latlng, 15);
        }
    }
    
    // Update driver location
    updateDriverLocation(data) {
        const { id, lat, lng, heading = null, status = 'active' } = data;
        
        if (!id || typeof lat !== 'number' || typeof lng !== 'number') {
            console.warn('⚠️ Invalid driver location data:', data);
            return;
        }
        
        const latlng = [lat, lng];
        
        // Create or update driver marker
        if (!this.drivers.has(id)) {
            const icon = L.divIcon({
                html: '<div style="background: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">🚗</div>',
                iconSize: [24, 24],
                className: 'driver-marker'
            });
            
            const marker = L.marker(latlng, { icon }).addTo(this.map);
            
            // Add popup with driver info
            marker.bindPopup(`🚗 Driver ${id}<br>Status: ${status}`);
            
            this.drivers.set(id, {
                marker,
                data: { id, lat, lng, heading, status, lastUpdate: Date.now() }
            });
            
            console.log(`🚗 Added driver ${id} at [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
        } else {
            const driver = this.drivers.get(id);
            driver.marker.setLatLng(latlng);
            driver.data = { id, lat, lng, heading, status, lastUpdate: Date.now() };
            
            // Update marker rotation if heading available
            if (heading !== null) {
                const icon = driver.marker.getIcon();
                const rotation = heading;
                icon.options.iconAnchor = [12, 12];
                icon.options.html = `<div style="background: #ef4444; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transform: rotate(${rotation}deg);">🚗</div>`;
                driver.marker.setIcon(icon);
            }
        }
        
        // Update popup content
        const driver = this.drivers.get(id);
        driver.marker.setPopupContent(`🚗 Driver ${id}<br>Status: ${status}<br>Speed: ${this.calculateSpeed(driver.data)} km/h`);
    }
    
    // Handle ride assignment
    handleRideAssigned(data) {
        const { driverId, pickupLat, pickupLng, destinationLat, destinationLng } = data;
        
        console.log(`🎯 Ride assigned to driver ${driverId}`);
        
        // Show notification
        this.showNotification(`🚗 Driver ${driverId} assigned to your ride!`);
        
        // Draw route from driver to pickup
        this.drawRoute(driverId, pickupLat, pickupLng, '#10b981');
        
        // Auto-navigate after 2 seconds
        setTimeout(() => {
            this.navigateDriver(driverId, pickupLat, pickupLng);
        }, 2000);
        
        // Center map to show route
        if (this.drivers.has(driverId)) {
            const driver = this.drivers.get(driverId);
            const bounds = L.latLngBounds([
                [driver.data.lat, driver.data.lng],
                [pickupLat, pickupLng]
            ]);
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
    
    // Navigate driver using Google Maps
    navigateDriver(driverId, destLat, destLng) {
        if (!this.drivers.has(driverId)) {
            console.warn(`⚠️ Driver ${driverId} not found`);
            return;
        }
        
        const driver = this.drivers.get(driverId);
        const { lat, lng } = driver.data;
        
        // Open Google Maps directions
        const url = `https://www.google.com/maps/dir/?api=1&origin=${lat},${lng}&destination=${destLat},${destLng}&travelmode=driving`;
        
        console.log(`🗺️ Opening navigation for driver ${driverId}: ${url}`);
        
        // Open in new tab
        window.open(url, '_blank');
        
        // Show notification
        this.showNotification(`🗺️ Navigation opened for Driver ${driverId}`);
    }
    
    // Draw route on map
    drawRoute(driverId, destLat, destLng, color = '#3b82f6') {
        if (!this.drivers.has(driverId)) {
            return;
        }
        
        const driver = this.drivers.get(driverId);
        const { lat, lng } = driver.data;
        
        // Remove existing route for this driver
        if (this.routeLines.has(driverId)) {
            this.map.removeLayer(this.routeLines.get(driverId));
        }
        
        // Create simple straight line route (in production, use routing API)
        const routeCoords = [
            [lat, lng],
            [destLat, destLng]
        ];
        
        const polyline = L.polyline(routeCoords, {
            color: color,
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 5'
        }).addTo(this.map);
        
        this.routeLines.set(driverId, polyline);
    }
    
    // Calculate speed (simulated)
    calculateSpeed(driverData) {
        // In real implementation, calculate from previous positions
        return Math.floor(Math.random() * 40) + 20; // 20-60 km/h
    }
    
    // Show notification
    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #1e293b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            max-width: 300px;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Map click event
        this.map.on('click', (e) => {
            const { lat, lng } = e.latlng;
            console.log(`📍 Map clicked: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.invalidateSize();
            }
        });
    }
    
    // Start simulation mode (when Socket.IO not available)
    startSimulationMode() {
        console.log('🎭 Starting simulation mode');
        
        // Simulate driver updates
        setInterval(() => {
            const driverIds = ['DRV001', 'DRV002', 'DRV003'];
            const randomDriver = driverIds[Math.floor(Math.random() * driverIds.length)];
            
            // Generate random position around Kumasi
            const baseLat = 5.6037;
            const baseLng = -0.18696;
            const lat = baseLat + (Math.random() - 0.5) * 0.05;
            const lng = baseLng + (Math.random() - 0.5) * 0.05;
            const heading = Math.floor(Math.random() * 360);
            
            this.updateDriverLocation({
                id: randomDriver,
                lat,
                lng,
                heading,
                status: 'active'
            });
        }, this.config.updateInterval);
        
        // Simulate ride assignment every 30 seconds
        setInterval(() => {
            if (this.drivers.size > 0 && this.passengerPosition) {
                const driverIds = Array.from(this.drivers.keys());
                const randomDriver = driverIds[Math.floor(Math.random() * driverIds.length)];
                
                // Random destination near passenger
                const destLat = this.passengerPosition.lat + (Math.random() - 0.5) * 0.02;
                const destLng = this.passengerPosition.lng + (Math.random() - 0.5) * 0.02;
                
                this.handleRideAssigned({
                    driverId: randomDriver,
                    pickupLat: this.passengerPosition.lat,
                    pickupLng: this.passengerPosition.lng,
                    destinationLat: destLat,
                    destinationLng: destLng
                });
            }
        }, 30000);
    }
    
    // Public API
    getMap() {
        return this.map;
    }
    
    getDrivers() {
        return this.drivers;
    }
    
    getPassengerPosition() {
        return this.passengerPosition;
    }
    
    // Cleanup
    destroy() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        this.routeLines.forEach(line => this.map.removeLayer(line));
        this.drivers.forEach(driver => this.map.removeLayer(driver.marker));
        
        if (this.passengerMarker) {
            this.map.removeLayer(this.passengerMarker);
        }
        
        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
        }
        
        console.log('🧹 Live Tracking Module cleaned up');
    }
}

// Auto-initialize when script loads
window.liveTracking = new LiveTrackingModule();

// Global functions for external access
window.navigateDriver = (driverId, destLat, destLng) => {
    window.liveTracking.navigateDriver(driverId, destLat, destLng);
};

window.updateDriverLocation = (data) => {
    window.liveTracking.updateDriverLocation(data);
};

window.handleRideAssigned = (data) => {
    window.liveTracking.handleRideAssigned(data);
};

console.log('🚗 NexRyde Live Tracking Module loaded');
