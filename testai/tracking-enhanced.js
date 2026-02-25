// tracking-enhanced.js - Complete UniHub Tracking System with All Features
// Enhanced version with location permissions, mobile view, vehicle types, and driver navigation

(function() {
    'use strict';
    
    // Global variables
    let map = null;
    let drivers = {};
    let passengerMarker = null;
    let passengerPosition = null;
    let simulationInterval = null;
    let watchId = null;
    let locationPermission = null;
    let currentVehicleFilter = 'all';
    let isMobile = window.innerWidth <= 768;
    let mapVisible = !isMobile; // Map hidden by default on mobile
    let activeMission = null;
    
    // Configuration
    const config = {
        mapCenter: [5.6037, -0.18696], // Kumasi, Ghana
        defaultZoom: 13,
        maxZoom: 19,
        updateInterval: 2000,
        geolocationOptions: {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        },
        vehicleTypes: {
            taxi: { 
                name: 'Taxi', 
                icon: '🚕', 
                color: '#fbbf24',
                baseFare: 5.00, 
                capacity: 4,
                waitTime: '5-10 min'
            },
            shuttle: { 
                name: 'Shuttle', 
                icon: '🚌', 
                color: '#3b82f6',
                baseFare: 3.00, 
                capacity: 12,
                waitTime: '10-15 min'
            },
            pragia: { 
                name: 'Pragia', 
                icon: '🏍️', 
                color: '#10b981',
                baseFare: 2.00, 
                capacity: 2,
                waitTime: '3-5 min'
            }
        }
    };
    
    // Load Leaflet manually if CDN fails
    function loadLeafletManually() {
        console.log('🔧 Attempting to load Leaflet manually...');
        
        // Create Leaflet CSS
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCSS);
        
        // Create Leaflet JS
        const leafletJS = document.createElement('script');
        leafletJS.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletJS.onload = () => {
            console.log('✅ Leaflet loaded manually');
            setTimeout(() => {
                initMap();
                requestLocationPermission();
                startDriverSimulation();
            }, 1000);
        };
        leafletJS.onerror = () => {
            console.error('❌ Manual Leaflet loading failed');
            showNotification('❌ Unable to load map - Check internet connection');
        };
        document.head.appendChild(leafletJS);
    }
    
    // Initialize the tracking system
    function initTracking() {
        console.log('🚀 Initializing UniHub Enhanced Tracking...');
        
        // Detect mobile
        isMobile = window.innerWidth <= 768;
        mapVisible = !isMobile;
        
        // Create UI elements
        createUI();
        
        // Wait for Leaflet to be available with timeout
        let leafletAttempts = 0;
        const maxAttempts = 20;
        
        function tryInitMap() {
            leafletAttempts++;
            console.log(`🗺️ Checking for Leaflet... Attempt ${leafletAttempts}/${maxAttempts}`);
            
            if (typeof L !== 'undefined') {
                console.log('✅ Leaflet loaded, initializing map...');
                initMap();
                requestLocationPermission();
                startDriverSimulation();
                console.log('✅ Enhanced Tracking initialized');
            } else if (leafletAttempts < maxAttempts) {
                console.log('⏳ Leaflet not yet loaded, waiting...');
                setTimeout(tryInitMap, 500);
            } else {
                console.error('❌ Leaflet failed to load after maximum attempts');
                showNotification('❌ Map loading failed - Please refresh the page');
                // Try to load Leaflet manually
                loadLeafletManually();
            }
        }
        
        tryInitMap();
    }
    
    // Create UI elements
    function createUI() {
        // Create mobile toggle button
        const mobileToggle = document.createElement('button');
        mobileToggle.id = 'mobile-map-toggle';
        mobileToggle.innerHTML = '🗺️ Show Map';
        mobileToggle.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #3b82f6;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 25px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
            z-index: 10001;
            cursor: pointer;
            transition: all 0.3s ease;
        `;
        mobileToggle.onclick = () => {
            console.log('🗺️ Toggle clicked');
            toggleMobileMap();
        };
        document.body.appendChild(mobileToggle);
        
        // Create vehicle type filter
        const vehicleFilter = document.createElement('div');
        vehicleFilter.id = 'vehicle-filter';
        vehicleFilter.innerHTML = `
            <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid #334155; border-radius: 12px; padding: 15px; margin: 10px 0; backdrop-filter: blur(10px);">
                <h4 style="color: #f8fafc; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">🚗 Select Vehicle Type</h4>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button onclick="window.UniHubTracking.filterByVehicle('all')" style="background: #64748b; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">All</button>
                    <button onclick="window.UniHubTracking.filterByVehicle('taxi')" style="background: #fbbf24; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">🚕 Taxi</button>
                    <button onclick="window.UniHubTracking.filterByVehicle('shuttle')" style="background: #3b82f6; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">🚌 Shuttle</button>
                    <button onclick="window.UniHubTracking.filterByVehicle('pragia')" style="background: #10b981; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">🏍️ Pragia</button>
                </div>
                <div id="vehicle-stats" style="margin-top: 10px; font-size: 12px; color: #94a3b8;"></div>
            </div>
        `;
        
        // Insert before map container
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.parentNode.insertBefore(vehicleFilter, mapContainer);
        }
        
        // Create location permission modal
        const permissionModal = document.createElement('div');
        permissionModal.id = 'permission-modal';
        permissionModal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10002;
        `;
        permissionModal.innerHTML = `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; max-width: 400px; margin: 20px;">
                <h3 style="color: #f8fafc; margin: 0 0 15px 0;">📍 Location Access</h3>
                <p style="color: #cbd5e1; margin: 0 0 20px 0; font-size: 14px;">UniHub needs your location to show nearby drivers and provide accurate pickup services.</p>
                <div style="display: flex; gap: 10px;">
                    <button onclick="grantLocationPermission()" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">Allow Location</button>
                    <button onclick="denyLocationPermission()" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; flex: 1;">Deny</button>
                </div>
            </div>
        `;
        document.body.appendChild(permissionModal);
        
        // Create driver navigation panel
        const driverPanel = document.createElement('div');
        driverPanel.id = 'driver-panel';
        driverPanel.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 20px;
            backdrop-filter: blur(10px);
            display: none;
            z-index: 10003;
            max-width: 400px;
            width: 90%;
        `;
        driverPanel.innerHTML = `
            <h3 style="color: #f8fafc; margin: 0 0 15px 0;">🗺️ Driver Navigation</h3>
            <div id="navigation-content" style="color: #cbd5e1; font-size: 14px;"></div>
            <button onclick="closeDriverPanel()" style="background: #64748b; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; margin-top: 15px;">Close</button>
        `;
        document.body.appendChild(driverPanel);
    }
    
    // Request location permission
    async function requestLocationPermission() {
        try {
            // Check if permissions API is available
            if (navigator.permissions) {
                const permission = await navigator.permissions.query({ name: 'geolocation' });
                locationPermission = permission.state;
                
                if (permission.state === 'granted') {
                    startPassengerTracking();
                } else if (permission.state === 'prompt') {
                    showPermissionModal();
                } else {
                    showManualLocationOption();
                }
                
                // Listen for permission changes
                permission.addEventListener('change', () => {
                    locationPermission = permission.state;
                    if (permission.state === 'granted') {
                        startPassengerTracking();
                    }
                });
            } else {
                // Fallback for browsers without permissions API
                showPermissionModal();
            }
        } catch (error) {
            console.error('❌ Permission check failed:', error);
            showPermissionModal();
        }
    }
    
    // Show permission modal
    function showPermissionModal() {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }
    
    // Hide permission modal
    function hidePermissionModal() {
        const modal = document.getElementById('permission-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }
    
    // Grant location permission
    function grantLocationPermission() {
        hidePermissionModal();
        startPassengerTracking();
        showNotification('📍 Location access granted - Tracking started');
    }
    
    // Deny location permission
    function denyLocationPermission() {
        hidePermissionModal();
        showManualLocationOption();
    }
    
    // Show manual location option
    function showManualLocationOption() {
        showNotification('⚠️ Location denied - Using default location');
        updatePassengerLocation(config.mapCenter[0], config.mapCenter[1]);
        updateVehicleStats();
    }
    
    // Toggle mobile map
    function toggleMobileMap() {
        const mapContainer = document.getElementById('map');
        const toggle = document.getElementById('mobile-map-toggle');
        
        if (!mapContainer || !toggle) {
            console.error('❌ Map container or toggle not found');
            return;
        }
        
        mapVisible = !mapVisible;
        
        console.log('🗺️ Toggling map:', mapVisible ? 'show' : 'hide');
        
        if (mapVisible) {
            mapContainer.style.display = 'block';
            toggle.innerHTML = '🗺️ Hide Map';
            if (map) {
                setTimeout(() => {
                    map.invalidateSize();
                }, 100);
            }
        } else {
            mapContainer.style.display = 'none';
            toggle.innerHTML = '🗺️ Show Map';
        }
    }
    
    // Filter by vehicle type
    function filterByVehicle(vehicleType) {
        currentVehicleFilter = vehicleType;
        updateDriverDisplay();
        updateVehicleStats();
    }
    
    // Update vehicle statistics
    function updateVehicleStats() {
        const statsElement = document.getElementById('vehicle-stats');
        if (!statsElement) return;
        
        const stats = {
            all: Object.keys(drivers).length,
            taxi: 0,
            shuttle: 0,
            pragia: 0
        };
        
        Object.values(drivers).forEach(driver => {
            if (driver.vehicleType && stats[driver.vehicleType] !== undefined) {
                stats[driver.vehicleType]++;
            }
        });
        
        let html = '';
        if (currentVehicleFilter === 'all') {
            html = `🚗 ${stats.all} drivers available`;
        } else {
            const vehicle = config.vehicleTypes[currentVehicleFilter];
            html = `${vehicle.icon} ${stats[currentVehicleFilter]} ${vehicle.name}s available - ${vehicle.waitTime} wait`;
        }
        
        statsElement.innerHTML = html;
    }
    
    // Update driver display based on filter
    function updateDriverDisplay() {
        Object.keys(drivers).forEach(driverId => {
            const driver = drivers[driverId];
            const shouldShow = currentVehicleFilter === 'all' || driver.vehicleType === currentVehicleFilter;
            
            if (shouldShow) {
                if (!driver._onMap) {
                    driver.addTo(map);
                    driver._onMap = true;
                }
            } else {
                if (driver._onMap) {
                    map.removeLayer(driver);
                    driver._onMap = false;
                }
            }
        });
    }
    
    // Initialize Leaflet map
    function initMap() {
        try {
            const mapContainer = document.getElementById('map');
            if (!mapContainer) {
                console.error('❌ Map container not found');
                return;
            }
            
            // Set map container size
            mapContainer.style.height = isMobile ? '300px' : '400px';
            mapContainer.style.width = '100%';
            mapContainer.style.border = '1px solid #334155';
            mapContainer.style.borderRadius = '8px';
            mapContainer.style.background = '#e2e8f0'; // Light gray background
            mapContainer.style.position = 'relative';
            mapContainer.style.zIndex = '100';
            
            // Show map by default on desktop, hide on mobile
            if (isMobile && !mapVisible) {
                mapContainer.style.display = 'none';
            } else {
                mapContainer.style.display = 'block';
            }
            
            // Create map instance with error handling
            try {
                map = L.map('map', {
                    center: config.mapCenter,
                    zoom: config.defaultZoom,
                    zoomControl: true,
                    attributionControl: true,
                    worldCopyJump: true
                });
                
                console.log('✅ Map instance created');
            } catch (mapError) {
                console.error('❌ Map creation failed:', mapError);
                showNotification('❌ Map initialization failed');
                return;
            }
            
            // Add OpenStreetMap tiles with error handling
            try {
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: config.maxZoom,
                    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
                    tileSize: 256,
                    detectRetina: true
                });
                
                tileLayer.on('tileerror', function(e) {
                    console.warn('⚠️ Tile loading error:', e);
                });
                
                tileLayer.on('tileload', function(e) {
                    console.log('✅ Tile loaded:', e.tile.src);
                });
                
                tileLayer.addTo(map);
                console.log('✅ Tile layer added successfully');
                
            } catch (tileError) {
                console.error('❌ Tile layer failed:', tileError);
                showNotification('❌ Map tiles failed to load');
                return;
            }
            
            // Enable map interactions
            map.on('click', function(e) {
                console.log('🗺️ Map clicked at:', e.latlng);
                showNotification(`🗺️ Map clicked: ${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`);
            });
            
            map.on('zoomend', function() {
                console.log('🔍 Map zoom level:', map.getZoom());
            });
            
            map.on('load', function() {
                console.log('✅ Map fully loaded');
                showNotification('🗺️ Map loaded successfully');
            });
            
            console.log('🗺️ Map initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
            showNotification('❌ Map initialization failed - Please refresh');
        }
    }
    
    // Start passenger location tracking
    function startPassengerTracking() {
        if (!navigator.geolocation) {
            console.warn('⚠️ Geolocation not supported');
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
    
    // Start driver simulation with vehicle types
    function startDriverSimulation() {
        console.log('🚗 Starting enhanced driver simulation...');
        
        const vehicleTypeKeys = Object.keys(config.vehicleTypes);
        const initialDrivers = [
            { id: 'driver1', lat: 5.6037, lng: -0.18696, speed: 0.0001, direction: Math.random() * 360, vehicleType: 'taxi' },
            { id: 'driver2', lat: 5.6050, lng: -0.1850, speed: 0.00015, direction: Math.random() * 360, vehicleType: 'shuttle' },
            { id: 'driver3', lat: 5.6020, lng: -0.1880, speed: 0.00012, direction: Math.random() * 360, vehicleType: 'pragia' },
            { id: 'driver4', lat: 5.6045, lng: -0.1875, speed: 0.00008, direction: Math.random() * 360, vehicleType: 'taxi' },
            { id: 'driver5', lat: 5.6030, lng: -0.1845, speed: 0.00011, direction: Math.random() * 360, vehicleType: 'shuttle' },
            { id: 'driver6', lat: 5.6060, lng: -0.1890, speed: 0.00009, direction: Math.random() * 360, vehicleType: 'pragia' },
            { id: 'driver7', lat: 5.6015, lng: -0.1860, speed: 0.00013, direction: Math.random() * 360, vehicleType: 'taxi' },
            { id: 'driver8', lat: 5.6040, lng: -0.1830, speed: 0.00010, direction: Math.random() * 360, vehicleType: 'shuttle' }
        ];
        
        // Add initial drivers
        initialDrivers.forEach(driver => {
            updateDriverLocation(driver);
        });
        
        // Update vehicle stats
        updateVehicleStats();
        
        // Simulate real-time movement
        simulationInterval = setInterval(() => {
            Object.keys(drivers).forEach(driverId => {
                const marker = drivers[driverId];
                const currentPos = marker.getLatLng();
                
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
            if (Math.random() < 0.05) {
                const driverIds = Object.keys(drivers);
                if (driverIds.length > 0 && passengerPosition) {
                    const randomDriver = driverIds[Math.floor(Math.random() * driverIds.length)];
                    simulateRideAssignment(randomDriver);
                }
            }
            
        }, config.updateInterval);
        
        console.log('✅ Enhanced driver simulation started');
    }
    
    // Update driver location with vehicle type
    function updateDriverLocation(data) {
        try {
            const { id, lat, lng, vehicleType } = data;
            
            if (!id || typeof lat !== 'number' || typeof lng !== 'number') {
                console.warn('⚠️ Invalid driver location data:', data);
                return;
            }
            
            // Remove existing driver marker
            if (drivers[id]) {
                map.removeLayer(drivers[id]);
            }
            
            // Get vehicle type info
            const vehicle = config.vehicleTypes[vehicleType] || config.vehicleTypes.taxi;
            
            // Create driver icon with vehicle type
            const driverIcon = L.divIcon({
                html: `<div style="background: ${vehicle.color}; width: 28px; height: 28px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 14px;">${vehicle.icon}</div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14],
                popupAnchor: [0, -14]
            });
            
            // Add driver marker
            const marker = L.marker([lat, lng], { icon: driverIcon })
                .bindPopup(`
                    <div style="text-align: center;">
                        <div style="font-size: 16px; margin-bottom: 5px;">${vehicle.icon} ${vehicle.name}</div>
                        <div style="font-size: 12px; color: #64748b;">Driver ${id}</div>
                        <div style="font-size: 12px; color: #10b981;">${vehicle.baseFare.toFixed(2)} GHS base fare</div>
                        <div style="font-size: 12px; color: #64748b;">Capacity: ${vehicle.capacity} passengers</div>
                        <button onclick="window.UniHubTracking.requestRide('${id}')" style="background: #3b82f6; color: white; border: none; padding: 5px 10px; border-radius: 4px; margin-top: 5px; cursor: pointer;">Request Ride</button>
                    </div>
                `);
            
            // Store driver marker with vehicle type
            marker.vehicleType = vehicleType;
            marker._onMap = true;
            drivers[id] = marker;
            
            // Apply filter if needed
            if (currentVehicleFilter !== 'all' && vehicleType !== currentVehicleFilter) {
                map.removeLayer(marker);
                marker._onMap = false;
            }
            
            console.log(`🚗 ${vehicle.name} ${id} updated: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            
        } catch (error) {
            console.error('❌ Failed to update driver location:', error);
        }
    }
    
    // Request ride from specific driver
    function requestRide(driverId) {
        const driver = drivers[driverId];
        if (!driver) return;
        
        const driverPos = driver.getLatLng();
        const vehicle = config.vehicleTypes[driver.vehicleType];
        
        console.log('🎯 Ride requested:', driverId, vehicle.name);
        
        showNotification(`🚗 ${vehicle.name} requested! Driver ${driverId} is on the way.`);
        
        // Start driver navigation
        startDriverNavigation(driverId, driverPos.lat, driverPos.lng);
        
        // Focus map on driver
        if (map && driverPos) {
            map.setView([driverPos.lat, driverPos.lng], 15);
        }
    }
    
    // Start driver navigation
    function startDriverNavigation(driverId, pickupLat, pickupLng) {
        activeMission = {
            driverId: driverId,
            pickup: [pickupLat, pickupLng],
            status: 'dispatched',
            startTime: Date.now()
        };
        
        // Show driver navigation panel
        showDriverPanel(`
            <div style="text-align: center;">
                <h4 style="color: #10b981; margin: 0 0 15px 0;">🚗 Mission Active</h4>
                <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <div style="font-size: 14px; margin-bottom: 5px;"><strong>Driver ${driverId}</strong></div>
                    <div style="font-size: 12px; color: #94a3b8;">Status: <span style="color: #10b981;">Dispatched</span></div>
                    <div style="font-size: 12px; color: #94a3b8;">Pickup: ${pickupLat.toFixed(4)}, ${pickupLng.toFixed(4)}</div>
                </div>
                <div style="font-size: 12px; color: #cbd5e1; margin-bottom: 15px;">
                    <div>📍 Navigate to pickup location</div>
                    <div>⏱️ Estimated arrival: 5-8 minutes</div>
                    <div>📞 Contact passenger when nearby</div>
                </div>
                <button onclick="window.UniHubTracking.completeMission('${driverId}')" style="background: #10b981; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; width: 100%;">Complete Pickup</button>
            </div>
        `);
        
        // Open Google Maps for driver navigation
        if (passengerPosition) {
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${pickupLat},${pickupLng}&destination=${passengerPosition.lat},${passengerPosition.lng}&travelmode=driving`;
            window.open(mapsUrl, '_blank');
        }
    }
    
    // Show driver panel
    function showDriverPanel(content) {
        const panel = document.getElementById('driver-panel');
        const contentDiv = document.getElementById('navigation-content');
        if (panel && contentDiv) {
            contentDiv.innerHTML = content;
            panel.style.display = 'block';
        }
    }
    
    // Close driver panel
    function closeDriverPanel() {
        const panel = document.getElementById('driver-panel');
        if (panel) {
            panel.style.display = 'none';
        }
    }
    
    // Complete mission
    function completeMission(driverId) {
        if (activeMission && activeMission.driverId === driverId) {
            activeMission.status = 'completed';
            showNotification(`✅ Pickup completed for Driver ${driverId}`);
            closeDriverPanel();
            
            // Reset for next mission
            setTimeout(() => {
                activeMission = null;
            }, 2000);
        }
    }
    
    // Simulate ride assignment
    function simulateRideAssignment(driverId) {
        try {
            const driver = drivers[driverId];
            if (!driver || !passengerPosition) return;
            
            const driverPos = driver.getLatLng();
            const vehicle = config.vehicleTypes[driver.vehicleType];
            
            console.log('🎯 Ride assigned:', driverId, vehicle.name);
            
            showNotification(`🚗 ${vehicle.name} assigned! Opening navigation...`);
            
            // Start driver navigation
            startDriverNavigation(driverId, driverPos.lat, driverPos.lng);
            
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
            
            if (passengerPosition) {
                originLat = passengerPosition.lat;
                originLng = passengerPosition.lng;
            } else {
                [originLat, originLng] = config.mapCenter;
            }
            
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&travelmode=driving`;
            
            window.open(mapsUrl, '_blank');
            
            console.log(`🗺️ Navigation opened: ${originLat},${originLng} → ${destinationLat},${destinationLng}`);
            
        } catch (error) {
            console.error('❌ Failed to open navigation:', error);
        }
    }
    
    // Show notification
    function showNotification(message) {
        try {
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
                max-width: 300px;
            `;
            notification.textContent = message;
            
            document.body.appendChild(notification);
            
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
        addDriver: (id, lat, lng, vehicleType = 'taxi') => {
            updateDriverLocation({ id, lat: parseFloat(lat), lng: parseFloat(lng), vehicleType });
            updateVehicleStats();
        },
        removeDriver: (id) => {
            if (drivers[id]) {
                map.removeLayer(drivers[id]);
                delete drivers[id];
                updateVehicleStats();
            }
        },
        simulateRide: (driverId) => {
            simulateRideAssignment(driverId);
        },
        requestRide: requestRide,
        filterByVehicle: filterByVehicle,
        toggleMobileMap: toggleMobileMap,
        completeMission: completeMission,
        getActiveMission: () => activeMission,
        getLocationPermission: () => locationPermission
    };
    
    // Global functions for button onclick handlers
    window.filterByVehicle = filterByVehicle;
    window.grantLocationPermission = grantLocationPermission;
    window.denyLocationPermission = denyLocationPermission;
    window.closeDriverPanel = closeDriverPanel;
    
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
        
        @media (max-width: 768px) {
            #map {
                transition: all 0.3s ease;
            }
            
            #mobile-map-toggle:hover {
                transform: scale(1.05);
                box-shadow: 0 6px 16px rgba(59, 130, 246, 0.4);
            }
        }
    `;
    document.head.appendChild(style);
    
})();
