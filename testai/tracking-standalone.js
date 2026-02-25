// tracking-standalone.js - Real-time Driver Tracking Module (No Server Required)
// Plug-in module for UniHub Dispatch System

(function() {
    'use strict';
    
    // Global variables
    let map = null;
    let drivers = {};
    let passengerMarker = null;
    let passengerPosition = null;
    let simulationInterval = null;
    let watchId = null;
    
    // Configuration
    const config = {
        mapCenter: [5.6037, -0.18696], // Kumasi, Ghana
        defaultZoom: 13,
        maxZoom: 19,
        updateInterval: 2000, // 2 seconds
        geolocationOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    };
    
    // Initialize the tracking system
    function initTracking() {
        console.log('🚀 Initializing UniHub Live Tracking (Standalone)...');
        
        // Initialize map
        initMap();
        
        // Start passenger location tracking
        startPassengerTracking();
        
        // Start driver simulation
        startDriverSimulation();
        
        // Load driver icons
        loadIcons();
        
        console.log('✅ Live Tracking initialized successfully');
    }
    
    // Initialize Leaflet map
    function initMap() {
        try {
            // Check if map container exists
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.error('❌ Map container not found');
                return;
            }
            
            // Set map container size
            mapContainer.style.height = '400px';
            mapContainer.style.width = '100%';
            mapContainer.style.border = '1px solid #334155';
            mapContainer.style.borderRadius = '8px';
            mapContainer.style.background = '#0f172a';
            mapContainer.style.position = 'relative';
            mapContainer.style.zIndex = '100';
            
            // Create map instance
            map = L.map('map', {
                center: config.mapCenter,
                zoom: config.defaultZoom,
                zoomControl: true,
                attributionControl: true
            });
            
            // Add OpenStreetMap tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: config.maxZoom
            }).addTo(map);
            
            // Enable map interactions
            map.on('click', function(e) {
                console.log('🗺️ Map clicked at:', e.latlng);
            });
            
            map.on('zoomend', function() {
                console.log('🔍 Map zoom level:', map.getZoom());
            });
            
            console.log('🗺️ Map initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
        }
    }
    
    // Start passenger location tracking
    function startPassengerTracking() {
        if (!navigator.geolocation) {
            console.warn('⚠️ Geolocation not supported');
            // Use default location
            updatePassengerLocation(config.mapCenter[0], config.mapCenter[1]);
            return;
        }
        
        try {
            watchId = navigator.geolocation.watchPosition(
                function(position) {
                    updatePassengerLocation(position.coords.latitude, position.coords.longitude);
                },
                function(error) {
                    console.error('📍 Geolocation error:', error);
                    // Use default location on error
                    updatePassengerLocation(config.mapCenter[0], config.mapCenter[1]);
                },
                config.geolocationOptions
            );
            
            console.log('📍 Passenger tracking started');
        } catch (error) {
            console.error('❌ Failed to start passenger tracking:', error);
            updatePassengerLocation(config.mapCenter[0], config.mapCenter[1]);
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
            const passengerIcon = L.divIcon({
                html: '<div style="background: #10b981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
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
    
    // Start driver simulation (real-time movement)
    function startDriverSimulation() {
        console.log('🚗 Starting driver simulation...');
        
        // Create initial drivers
        const initialDrivers = [
            { id: 'driver1', lat: 5.6037, lng: -0.18696, speed: 0.0001, direction: Math.random() * 360 },
            { id: 'driver2', lat: 5.6050, lng: -0.1850, speed: 0.00015, direction: Math.random() * 360 },
            { id: 'driver3', lat: 5.6020, lng: -0.1880, speed: 0.00012, direction: Math.random() * 360 },
            { id: 'driver4', lat: 5.6045, lng: -0.1875, speed: 0.00008, direction: Math.random() * 360 },
            { id: 'driver5', lat: 5.6030, lng: -0.1845, speed: 0.00011, direction: Math.random() * 360 }
        ];
        
        // Add initial drivers
        initialDrivers.forEach(driver => {
            updateDriverLocation(driver);
        });
        
        // Simulate real-time movement
        simulationInterval = setInterval(() => {
            Object.keys(drivers).forEach(driverId => {
                const marker = drivers[driverId];
                const currentPos = marker.getLatLng();
                
                // Calculate new position (simulate movement)
                const driver = initialDrivers.find(d => d.id === driverId);
                if (driver) {
                    // Update direction occasionally
                    if (Math.random() < 0.1) {
                        driver.direction += (Math.random() - 0.5) * 45;
                    }
                    
                    // Calculate new position
                    const deltaLat = Math.sin(driver.direction * Math.PI / 180) * driver.speed;
                    const deltaLng = Math.cos(driver.direction * Math.PI / 180) * driver.speed;
                    
                    const newLat = currentPos.lat + deltaLat;
                    const newLng = currentPos.lng + deltaLng;
                    
                    // Update driver location
                    driver.lat = newLat;
                    driver.lng = newLng;
                    
                    updateDriverLocation(driver);
                }
            });
            
            // Occasionally simulate ride assignment
            if (Math.random() < 0.05) { // 5% chance per update
                const driverIds = Object.keys(drivers);
                if (driverIds.length > 0 && passengerPosition) {
                    const randomDriver = driverIds[Math.floor(Math.random() * driverIds.length)];
                    simulateRideAssignment(randomDriver);
                }
            }
            
        }, config.updateInterval);
        
        console.log('✅ Driver simulation started');
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
            const driverIcon = L.divIcon({
                html: '<div style="background: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
                iconSize: [24, 24],
                iconAnchor: [12, 12],
                popupAnchor: [0, -12]
            });
            
            // Add driver marker
            const marker = L.marker([lat, lng], { icon: driverIcon })
                .addTo(map)
                .bindPopup(`🚗 Driver ${id}`);
            
            // Store driver marker
            drivers[id] = marker;
            
            console.log(`🚗 Driver ${id} updated: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            
        } catch (error) {
            console.error('❌ Failed to update driver location:', error);
        }
    }
    
    // Simulate ride assignment
    function simulateRideAssignment(driverId) {
        try {
            const driver = drivers[driverId];
            if (!driver || !passengerPosition) return;
            
            const driverPos = driver.getLatLng();
            
            console.log('🎯 Ride assigned:', driverId);
            
            // Show notification
            showNotification('🚗 Driver assigned! Opening navigation...');
            
            // Open Google Maps navigation
            navigateDriver(driverPos.lat, driverPos.lng);
            
            // Focus map on pickup location
            if (map && driverPos) {
                map.setView([driverPos.lat, driverPos.lng], 15);
            }
            
        } catch (error) {
            console.error('❌ Failed to simulate ride assignment:', error);
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
        // Icons are created inline as divs to avoid loading issues
        console.log('🎨 Using inline icons for better compatibility');
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
                background: #10b981;
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
        // Manual functions for testing
        addDriver: (id, lat, lng) => {
            updateDriverLocation({ id, lat: parseFloat(lat), lng: parseFloat(lng) });
        },
        removeDriver: (id) => {
            if (drivers[id]) {
                map.removeLayer(drivers[id]);
                delete drivers[id];
            }
        },
        simulateRide: (driverId) => {
            simulateRideAssignment(driverId);
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
