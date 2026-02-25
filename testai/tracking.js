// tracking.js - Real-time Driver Tracking Module
// Plug-in module for UniHub Dispatch System

(function() {
    'use strict';
    
    // Global variables
    let map = null;
    let drivers = {};
    let passengerMarker = null;
    let passengerPosition = null;
    let socket = null;
    let watchId = null;
    
    // Configuration
    const config = {
        mapCenter: [5.6037, -0.18696], // Kumasi, Ghana
        defaultZoom: 13,
        maxZoom: 19,
        updateInterval: 3000, // 3 seconds
        geolocationOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    };
    
    // Initialize the tracking system
    function initTracking() {
        console.log('🚀 Initializing UniHub Live Tracking...');
        
        // Initialize map
        initMap();
        
        // Initialize Socket.IO connection
        initSocket();
        
        // Start passenger location tracking
        startPassengerTracking();
        
        // Load driver icons
        loadIcons();
        
        console.log('✅ Live Tracking initialized successfully');
    }
    
    // Initialize Leaflet map
    function initMap() {
        try {
            // Create map instance
            map = L.map('map').setView(config.mapCenter, config.defaultZoom);
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: config.maxZoom
            }).addTo(map);
            
            // Set map container size
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.style.height = '400px';
                mapContainer.style.width = '100%';
                mapContainer.style.border = '1px solid #ddd';
                mapContainer.style.borderRadius = '8px';
            }
            
            console.log('🗺️ Map initialized');
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
        }
    }
    
    // Initialize Socket.IO connection
    function initSocket() {
        try {
            // Connect to Socket.IO server
            socket = io();
            
            // Listen for driver location updates
            socket.on('driverLocationUpdate', function(data) {
                updateDriverLocation(data);
            });
            
            // Listen for ride assignments
            socket.on('rideAssigned', function(data) {
                handleRideAssigned(data);
            });
            
            // Listen for connection events
            socket.on('connect', function() {
                console.log('🔗 Connected to tracking server');
            });
            
            socket.on('disconnect', function() {
                console.log('❌ Disconnected from tracking server');
            });
            
            socket.on('connect_error', function(error) {
                console.error('🔌 Socket connection error:', error);
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Socket.IO:', error);
        }
    }
    
    // Start passenger location tracking
    function startPassengerTracking() {
        if (!navigator.geolocation) {
            console.warn('⚠️ Geolocation not supported');
            return;
        }
        
        try {
            watchId = navigator.geolocation.watchPosition(
                function(position) {
                    updatePassengerLocation(position.coords.latitude, position.coords.longitude);
                },
                function(error) {
                    console.error('📍 Geolocation error:', error);
                },
                config.geolocationOptions
            );
            
            console.log('📍 Passenger tracking started');
        } catch (error) {
            console.error('❌ Failed to start passenger tracking:', error);
        }
    }
    
    // Update passenger location
    function updatePassengerLocation(lat, lng) {
        passengerPosition = { lat, lng };
        
        try {
            // Remove existing passenger marker
            if (passengerMarker) {
                map.removeLayer(passengerMarker);
            }
            
            // Create passenger icon
            const passengerIcon = L.icon({
                iconUrl: '/icons/passenger.svg',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });
            
            // Add passenger marker
            passengerMarker = L.marker([lat, lng], { icon: passengerIcon })
                .addTo(map)
                .bindPopup('📍 Your Location');
            
            // Center map on passenger if no drivers
            if (Object.keys(drivers).length === 0) {
                map.setView([lat, lng], config.defaultZoom);
            }
            
        } catch (error) {
            console.error('❌ Failed to update passenger location:', error);
        }
    }
    
    // Update driver location
    function updateDriverLocation(data) {
        try {
            const { id, lat, lng } = data;
            
            if (!id || typeof lat !== 'number' || typeof lng !== 'number') {
                console.warn('⚠️ Invalid driver location data:', data);
                return;
            }
            
            // Remove existing driver marker
            if (drivers[id]) {
                map.removeLayer(drivers[id]);
            }
            
            // Create driver icon
            const driverIcon = L.icon({
                iconUrl: '/icons/car.svg',
                iconSize: [32, 32],
                iconAnchor: [16, 16],
                popupAnchor: [0, -16]
            });
            
            // Add driver marker
            const marker = L.marker([lat, lng], { icon: driverIcon })
                .addTo(map)
                .bindPopup(`🚗 Driver ${id}`);
            
            // Store driver marker
            drivers[id] = marker;
            
            console.log(`🚗 Driver ${id} updated: ${lat}, ${lng}`);
            
        } catch (error) {
            console.error('❌ Failed to update driver location:', error);
        }
    }
    
    // Handle ride assignment
    function handleRideAssigned(data) {
        try {
            const { driverId, pickupLat, pickupLng } = data;
            
            console.log('🎯 Ride assigned:', data);
            
            // Show notification
            showNotification('🚗 Driver assigned! Opening navigation...');
            
            // Open Google Maps navigation
            navigateDriver(pickupLat, pickupLng);
            
            // Focus map on pickup location
            if (map && pickupLat && pickupLng) {
                map.setView([pickupLat, pickupLng], 15);
            }
            
        } catch (error) {
            console.error('❌ Failed to handle ride assignment:', error);
        }
    }
    
    // Navigate driver using Google Maps
    function navigateDriver(destinationLat, destinationLng) {
        try {
            if (!destinationLat || !destinationLng) {
                console.warn('⚠️ Invalid destination coordinates');
                return;
            }
            
            let originLat, originLng;
            
            // Use passenger location as origin if available
            if (passengerPosition) {
                originLat = passengerPosition.lat;
                originLng = passengerPosition.lng;
            } else {
                // Use map center as fallback
                [originLat, originLng] = config.mapCenter;
            }
            
            // Build Google Maps URL
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&travelmode=driving`;
            
            // Open in new tab
            window.open(mapsUrl, '_blank');
            
            console.log(`🗺️ Navigation opened: ${originLat},${originLng} → ${destinationLat},${destinationLng}`);
            
        } catch (error) {
            console.error('❌ Failed to open navigation:', error);
        }
    }
    
    // Load custom icons
    function loadIcons() {
        // Icons will be loaded from /icons/ directory
        // car.png and passenger.png should be placed there
        console.log('🎨 Icons loaded from /icons/');
    }
    
    // Show notification
    function showNotification(message) {
        try {
            // Create notification element
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #3b82f6;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                font-family: system-ui, -apple-system, sans-serif;
                font-size: 14px;
                animation: slideIn 0.3s ease;
            `;
            notification.textContent = message;
            
            // Add to page
            document.body.appendChild(notification);
            
            // Remove after 5 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 5000);
            
        } catch (error) {
            console.error('❌ Failed to show notification:', error);
        }
    }
    
    // Public API
    window.UniHubTracking = {
        init: initTracking,
        navigateDriver: navigateDriver,
        getDriverCount: () => Object.keys(drivers).length,
        getPassengerPosition: () => passengerPosition,
        centerMapOnPassenger: () => {
            if (passengerPosition && map) {
                map.setView([passengerPosition.lat, passengerPosition.lng], config.defaultZoom);
            }
        },
        // Test function for demonstration
        testMode: () => {
            console.log('🧪 Starting test mode...');
            
            // Simulate driver updates
            const testDrivers = [
                { id: 'driver1', lat: 5.6037, lng: -0.18696 },
                { id: 'driver2', lat: 5.6050, lng: -0.1850 },
                { id: 'driver3', lat: 5.6020, lng: -0.1880 }
            ];
            
            testDrivers.forEach(driver => {
                updateDriverLocation(driver);
            });
            
            // Simulate passenger location
            updatePassengerLocation(5.6037, -0.18696);
            
            // Simulate ride assignment after 3 seconds
            setTimeout(() => {
                handleRideAssigned({
                    driverId: 'driver1',
                    pickupLat: 5.6050,
                    pickupLng: -0.1850
                });
            }, 3000);
            
            console.log('✅ Test mode activated - 3 drivers simulated, ride assignment in 3 seconds');
        }
    };
    
    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracking);
    } else {
        initTracking();
    }
    
    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
})();
