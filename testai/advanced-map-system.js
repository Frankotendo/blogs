// 🚗 NexRyde Advanced Interactive Map System
// Next-level passenger portal with vehicle selection and driver routing

class AdvancedMapSystem {
    constructor() {
        this.map = null;
        this.drivers = new Map(); // {id: {marker, data, type}}
        this.passengerMarker = null;
        this.passengerPosition = null;
        this.selectedVehicleType = null;
        this.activeTrip = null;
        this.socket = null;
        this.watchId = null;
        this.routeLines = new Map();
        this.driverRoutes = new Map();
        
        // Vehicle configurations
        this.vehicleTypes = {
            pragia: {
                name: 'Pragia',
                icon: '🛵',
                color: '#f59e0b',
                baseFare: 5,
                perKm: 2,
                capacity: 1,
                estimatedTime: 'fast'
            },
            taxi: {
                name: 'Taxi',
                icon: '🚗',
                color: '#3b82f6',
                baseFare: 10,
                perKm: 3,
                capacity: 4,
                estimatedTime: 'medium'
            },
            shuttle: {
                name: 'Shuttle',
                icon: '🚌',
                color: '#10b981',
                baseFare: 3,
                perKm: 1.5,
                capacity: 16,
                estimatedTime: 'slow'
            }
        };
        
        // Configuration
        this.config = {
            defaultCenter: [5.6037, -0.18696], // Kumasi, Ghana
            defaultZoom: 14,
            maxZoom: 19,
            searchRadius: 5000, // 5km search radius
            updateInterval: 2000,
            tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
        };
        
        this.init();
    }
    
    // Initialize the advanced map system
    init() {
        console.log('🚗 Initializing Advanced NexRyde Map System...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setup());
        } else {
            this.setup();
        }
    }
    
    // Setup complete system
    setup() {
        try {
            this.initializeMap();
            this.initializeSocket();
            this.startPassengerTracking();
            this.setupUI();
            this.setupEventListeners();
            
            console.log('✅ Advanced Map System initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Advanced Map:', error);
        }
    }
    
    // Initialize Leaflet map with enhanced features
    initializeMap() {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            throw new Error('Map container #map not found');
        }
        
        // Create enhanced map
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
        
        // Setup map container
        mapContainer.style.height = '100vh';
        mapContainer.style.width = '100%';
        mapContainer.style.position = 'relative';
        mapContainer.style.zIndex = '1';
        
        console.log('🗺️ Enhanced map initialized');
    }
    
    // Initialize Socket.IO with enhanced events
    initializeSocket() {
        try {
            this.socket = io();
            
            // Driver location updates
            this.socket.on('driverLocationUpdate', (data) => {
                this.updateDriverLocation(data);
            });
            
            // Trip assignment
            this.socket.on('tripAssigned', (data) => {
                this.handleTripAssigned(data);
            });
            
            // Driver accepted trip
            this.socket.on('driverAcceptedTrip', (data) => {
                this.handleDriverAcceptedTrip(data);
            });
            
            // Driver route updates
            this.socket.on('driverRouteUpdate', (data) => {
                this.updateDriverRoute(data);
            });
            
            // Connection events
            this.socket.on('connect', () => {
                console.log('🔗 Connected to NexRyde server');
                this.requestNearbyDrivers();
            });
            
            this.socket.on('disconnect', () => {
                console.log('🔌 Disconnected from server');
            });
            
            console.log('📡 Enhanced Socket.IO initialized');
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
                this.requestNearbyDrivers();
                console.log(`📍 Passenger located: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (±${accuracy.toFixed(0)}m)`);
            },
            (error) => {
                console.warn('⚠️ Could not get location:', error.message);
                this.setPassengerLocation(this.config.defaultCenter);
                this.requestNearbyDrivers();
            },
            options
        );
        
        // Watch for position changes
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                this.setPassengerLocation([latitude, longitude], accuracy);
                this.requestNearbyDrivers();
            },
            (error) => {
                console.warn('⚠️ Location tracking error:', error.message);
            },
            options
        );
    }
    
    // Setup passenger UI
    setupUI() {
        // Create vehicle selection panel
        this.createVehicleSelectionPanel();
        
        // Create trip request panel
        this.createTripRequestPanel();
        
        // Create driver info panel
        this.createDriverInfoPanel();
    }
    
    // Create vehicle selection panel
    createVehicleSelectionPanel() {
        const panel = document.createElement('div');
        panel.id = 'vehicle-selection-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 250px;
        `;
        
        panel.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">🚗 Select Vehicle</h3>
            <div class="vehicle-options" style="display: flex; flex-direction: column; gap: 10px;">
                ${Object.entries(this.vehicleTypes).map(([type, config]) => `
                    <div class="vehicle-option" data-vehicle="${type}" style="
                        padding: 12px;
                        border: 2px solid #e2e8f0;
                        border-radius: 8px;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    ">
                        <div style="font-size: 24px;">${config.icon}</div>
                        <div style="flex: 1;">
                            <div style="font-weight: 600; color: #1e293b;">${config.name}</div>
                            <div style="font-size: 12px; color: #64748b;">₵${config.baseFare} base + ₵${config.perKm}/km • ${config.capacity} seats</div>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button id="confirm-vehicle" style="
                margin-top: 15px;
                width: 100%;
                padding: 12px;
                background: #f59e0b;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
                display: none;
            ">Confirm Vehicle</button>
        `;
        
        document.body.appendChild(panel);
        
        // Add vehicle selection handlers
        panel.querySelectorAll('.vehicle-option').forEach(option => {
            option.addEventListener('click', () => {
                this.selectVehicle(option.dataset.vehicle);
            });
        });
        
        // Confirm button handler
        document.getElementById('confirm-vehicle').addEventListener('click', () => {
            this.confirmVehicleSelection();
        });
    }
    
    // Select vehicle type
    selectVehicle(vehicleType) {
        // Update UI
        document.querySelectorAll('.vehicle-option').forEach(option => {
            option.style.borderColor = '#e2e8f0';
            option.style.background = 'white';
        });
        
        const selectedOption = document.querySelector(`[data-vehicle="${vehicleType}"]`);
        selectedOption.style.borderColor = this.vehicleTypes[vehicleType].color;
        selectedOption.style.background = `${this.vehicleTypes[vehicleType].color}10`;
        
        this.selectedVehicleType = vehicleType;
        
        // Show confirm button
        document.getElementById('confirm-vehicle').style.display = 'block';
        
        // Filter drivers by vehicle type
        this.filterDriversByType(vehicleType);
    }
    
    // Confirm vehicle selection
    confirmVehicleSelection() {
        if (!this.selectedVehicleType) return;
        
        const config = this.vehicleTypes[this.selectedVehicleType];
        this.showNotification(`🚗 ${config.name} selected. Tap on a driver to request trip.`, 'info');
        
        // Hide vehicle panel
        document.getElementById('vehicle-selection-panel').style.display = 'none';
        
        // Show trip request panel
        document.getElementById('trip-request-panel').style.display = 'block';
    }
    
    // Create trip request panel
    createTripRequestPanel() {
        const panel = document.createElement('div');
        panel.id = 'trip-request-panel';
        panel.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 250px;
            display: none;
        `;
        
        panel.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">📍 Trip Details</h3>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #374151; font-size: 14px;">Pickup Location</label>
                <div id="pickup-display" style="padding: 8px; background: #f3f4f6; border-radius: 4px; font-size: 14px;">Current Location</div>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #374151; font-size: 14px;">Destination</label>
                <input type="text" id="destination-input" placeholder="Enter destination..." style="
                    width: 100%;
                    padding: 8px;
                    border: 1px solid #d1d5db;
                    border-radius: 4px;
                    font-size: 14px;
                ">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; color: #374151; font-size: 14px;">Vehicle Type</label>
                <div id="selected-vehicle-display" style="padding: 8px; background: #f3f4f6; border-radius: 4px; font-size: 14px;">Not selected</div>
            </div>
            <button id="request-trip" style="
                width: 100%;
                padding: 12px;
                background: #10b981;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 600;
            ">Request Trip</button>
        `;
        
        document.body.appendChild(panel);
        
        // Request trip handler
        document.getElementById('request-trip').addEventListener('click', () => {
            this.requestTrip();
        });
    }
    
    // Create driver info panel
    createDriverInfoPanel() {
        const panel = document.createElement('div');
        panel.id = 'driver-info-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            min-width: 300px;
            display: none;
        `;
        
        panel.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">🚗 Driver Info</h3>
            <div id="driver-details" style="margin-bottom: 15px;">
                <!-- Driver details will be populated here -->
            </div>
            <div id="driver-route" style="margin-bottom: 15px;">
                <!-- Driver route will be shown here -->
            </div>
            <div style="display: flex; gap: 10px;">
                <button id="contact-driver" style="
                    flex: 1;
                    padding: 8px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">📞 Contact</button>
                <button id="cancel-trip" style="
                    flex: 1;
                    padding: 8px;
                    background: #ef4444;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                ">❌ Cancel</button>
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    // Set passenger location
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
            this.passengerMarker.bindPopup('📍 Your Location');
        } else {
            this.passengerMarker.setLatLng(latlng);
        }
        
        // Update pickup display
        const pickupDisplay = document.getElementById('pickup-display');
        if (pickupDisplay) {
            pickupDisplay.textContent = `${latlng[0].toFixed(6)}, ${latlng[1].toFixed(6)}`;
        }
    }
    
    // Update driver location with enhanced features
    updateDriverLocation(data) {
        const { id, lat, lng, heading = null, status = 'available', type = 'taxi' } = data;
        
        if (!id || typeof lat !== 'number' || typeof lng !== 'number') {
            console.warn('⚠️ Invalid driver data:', data);
            return;
        }
        
        const latlng = [lat, lng];
        const vehicleConfig = this.vehicleTypes[type] || this.vehicleTypes.taxi;
        
        // Create or update driver marker
        if (!this.drivers.has(id)) {
            const icon = L.divIcon({
                html: `<div style="background: ${vehicleConfig.color}; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transform: rotate(${heading || 0}deg);">${vehicleConfig.icon}</div>`,
                iconSize: [28, 28],
                className: 'driver-marker'
            });
            
            const marker = L.marker(latlng, { icon }).addTo(this.map);
            
            // Enhanced popup with vehicle info
            const popupContent = `
                <div style="text-align: center; min-width: 150px;">
                    <div style="font-size: 20px; margin-bottom: 5px;">${vehicleConfig.icon}</div>
                    <div style="font-weight: 600; margin-bottom: 3px;">${vehicleConfig.name}</div>
                    <div style="font-size: 12px; color: #64748b;">Driver: ${id}</div>
                    <div style="font-size: 12px; color: #64748b;">Status: ${status}</div>
                    <div style="font-size: 12px; color: #64748b;">Fare: ₵${vehicleConfig.baseFare} + ₵${vehicleConfig.perKm}/km</div>
                    <button onclick="window.advancedMap.requestRideWithDriver('${id}', '${type}')" style="
                        margin-top: 8px;
                        padding: 6px 12px;
                        background: #10b981;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 12px;
                        width: 100%;
                    ">🚗 Request This Driver</button>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            
            // Add click handler for quick request
            marker.on('click', () => {
                this.handleDriverClick(id, type);
            });
            
            this.drivers.set(id, {
                marker,
                data: { id, lat, lng, heading, status, type, lastUpdate: Date.now() }
            });
            
            console.log(`🚗 Added ${type} driver ${id} at [${lat.toFixed(6)}, ${lng.toFixed(6)}]`);
        } else {
            const driver = this.drivers.get(id);
            
            // Update marker position and rotation
            const icon = L.divIcon({
                html: `<div style="background: ${vehicleConfig.color}; color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-size: 16px; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transform: rotate(${heading || 0}deg);">${vehicleConfig.icon}</div>`,
                iconSize: [28, 28],
                className: 'driver-marker'
            });
            
            driver.marker.setLatLng(latlng);
            driver.marker.setIcon(icon);
            driver.data = { id, lat, lng, heading, status, type, lastUpdate: Date.now() };
        }
    }
    
    // Handle driver click
    handleDriverClick(driverId, vehicleType) {
        if (!this.selectedVehicleType) {
            this.showNotification('🚗 Please select a vehicle type first', 'warning');
            return;
        }
        
        if (this.selectedVehicleType !== vehicleType) {
            this.showNotification(`🚗 This is a ${this.vehicleTypes[vehicleType].name}. You selected ${this.vehicleTypes[this.selectedVehicleType].name}`, 'warning');
            return;
        }
        
        // Show driver popup
        const driver = this.drivers.get(driverId);
        if (driver) {
            driver.marker.openPopup();
        }
    }
    
    // Request ride with specific driver
    requestRideWithDriver(driverId, vehicleType) {
        if (!this.passengerPosition) {
            this.showNotification('📍 Please enable location access', 'error');
            return;
        }
        
        const destination = document.getElementById('destination-input').value;
        if (!destination) {
            this.showNotification('📍 Please enter destination', 'error');
            return;
        }
        
        // Create trip request
        const tripRequest = {
            id: `TRIP_${Date.now()}`,
            passengerId: 'CURRENT_USER',
            driverId: driverId,
            vehicleType: vehicleType,
            pickupLocation: this.passengerPosition,
            destination: destination,
            requestTime: Date.now(),
            status: 'requested'
        };
        
        // Send to server
        if (this.socket) {
            this.socket.emit('requestTrip', tripRequest);
        } else {
            this.simulateTripRequest(tripRequest);
        }
        
        // Use professional notification
        this.showNotification(`🚗 Trip requested to ${this.vehicleTypes[vehicleType].name} driver ${driverId}`, 'success');
        
        // Store active trip
        this.activeTrip = tripRequest;
        
        // Set trip state in fixed logic system
        if (window.fixedLogic) {
            window.fixedLogic.setTripState(tripRequest.id, 'requested');
        }
    }
    
    // Handle trip assigned by driver
    handleTripAssigned(data) {
        const { driverId, tripId, estimatedArrival } = data;
        
        console.log(`🎯 Trip ${tripId} assigned to driver ${driverId}`);
        
        // Use professional notification system
        if (window.handleDriverPickup) {
            window.handleDriverPickup(driverId, 'CURRENT_USER', 'assigned');
        } else {
            this.showNotification(`🚗 Driver ${driverId} accepted your trip! ETA: ${estimatedArrival} minutes`, 'success');
        }
        
        // Show driver info panel
        this.showDriverInfoPanel(driverId);
        
        // Draw route from driver to passenger
        this.drawDriverRoute(driverId);
        
        // Update active trip
        if (this.activeTrip) {
            this.activeTrip.status = 'assigned';
            this.activeTrip.driverId = driverId;
        }
    }
    
    // Show driver info panel with route
    showDriverInfoPanel(driverId) {
        const driver = this.drivers.get(driverId);
        if (!driver) return;
        
        const vehicleConfig = this.vehicleTypes[driver.data.type];
        const panel = document.getElementById('driver-info-panel');
        const details = document.getElementById('driver-details');
        
        details.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <div style="font-size: 24px; background: ${vehicleConfig.color}; color: white; border-radius: 50%; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">${vehicleConfig.icon}</div>
                <div>
                    <div style="font-weight: 600;">${vehicleConfig.name} Driver</div>
                    <div style="font-size: 12px; color: #64748b;">ID: ${driverId}</div>
                </div>
            </div>
            <div style="font-size: 12px; color: #64748b;">
                <div>📍 Distance: ${this.calculateDistance(driver.data.lat, driver.data.lng, this.passengerPosition.lat, this.passengerPosition.lng).toFixed(1)} km</div>
                <div>⏱️ ETA: ${Math.ceil(this.calculateDistance(driver.data.lat, driver.data.lng, this.passengerPosition.lat, this.passengerPosition.lng) / 0.5 * 60)} min</div>
                <div>⭐ Rating: 4.8</div>
            </div>
        `;
        
        panel.style.display = 'block';
    }
    
    // Draw driver route to passenger
    drawDriverRoute(driverId) {
        const driver = this.drivers.get(driverId);
        if (!driver || !this.passengerPosition) return;
        
        const { lat, lng } = driver.data;
        const routeCoords = [
            [lat, lng],
            [this.passengerPosition.lat, this.passengerPosition.lng]
        ];
        
        // Remove existing route
        if (this.driverRoutes.has(driverId)) {
            this.map.removeLayer(this.driverRoutes.get(driverId));
        }
        
        // Create route line
        const routeLine = L.polyline(routeCoords, {
            color: '#10b981',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 5'
        }).addTo(this.map);
        
        this.driverRoutes.set(driverId, routeLine);
        
        // Center map on route
        const bounds = L.latLngBounds(routeCoords);
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }
    
    // Update driver route (real-time)
    updateDriverRoute(data) {
        const { driverId, route } = data;
        
        if (!this.drivers.has(driverId)) return;
        
        // Remove existing route
        if (this.driverRoutes.has(driverId)) {
            this.map.removeLayer(this.driverRoutes.get(driverId));
        }
        
        // Draw new route from coordinates
        if (route && route.coordinates) {
            const latlngs = route.coordinates.map(coord => [coord[1], coord[0]]);
            const routeLine = L.polyline(latlngs, {
                color: '#3b82f6',
                weight: 4,
                opacity: 0.7
            }).addTo(this.map);
            
            this.driverRoutes.set(driverId, routeLine);
        }
    }
    
    // Filter drivers by vehicle type
    filterDriversByType(vehicleType) {
        this.drivers.forEach((driver, id) => {
            if (driver.data.type === vehicleType) {
                driver.marker.setOpacity(1);
                driver.marker.setZIndexOffset(1000);
            } else {
                driver.marker.setOpacity(0.3);
                driver.marker.setZIndexOffset(0);
            }
        });
    }
    
    // Request nearby drivers from server
    requestNearbyDrivers() {
        if (!this.socket || !this.passengerPosition) return;
        
        this.socket.emit('requestNearbyDrivers', {
            lat: this.passengerPosition.lat,
            lng: this.passengerPosition.lng,
            radius: this.config.searchRadius
        });
    }
    
    // Calculate distance between two points
    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Show notification (integrated with professional system)
    showNotification(message, type = 'info') {
        // Use professional notification system if available
        if (window.showProfessionalNotification) {
            return window.showProfessionalNotification(message, type, {
                category: 'trip',
                priority: type === 'success' ? 'high' : 'normal'
            });
        }
        
        // Fallback to simple notification
        const colors = {
            info: '#3b82f6',
            success: '#10b981',
            warning: '#f59e0b',
            error: '#ef4444'
        };
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${colors[type]};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-size: 14px;
            max-width: 400px;
            text-align: center;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    // Setup event listeners
    setupEventListeners() {
        // Map click for destination selection
        this.map.on('click', (e) => {
            if (this.selectedVehicleType) {
                const { lat, lng } = e.latlng;
                document.getElementById('destination-input').value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                
                // Add destination marker
                L.marker([lat, lng]).addTo(this.map)
                    .bindPopup('📍 Destination')
                    .openPopup();
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            if (this.map) {
                this.map.invalidateSize();
            }
        });
    }
    
    // Start simulation mode
    startSimulationMode() {
        console.log('🎭 Starting simulation mode');
        
        // Simulate drivers of all types
        const driverTypes = ['pragia', 'taxi', 'shuttle'];
        
        setInterval(() => {
            driverTypes.forEach((type, index) => {
                const driverId = `${type.toUpperCase()}${String(index + 1).padStart(3, '0')}`;
                
                // Generate random position around Kumasi
                const baseLat = 5.6037;
                const baseLng = -0.18696;
                const lat = baseLat + (Math.random() - 0.5) * 0.03;
                const lng = baseLng + (Math.random() - 0.5) * 0.03;
                const heading = Math.floor(Math.random() * 360);
                
                this.updateDriverLocation({
                    id: driverId,
                    lat,
                    lng,
                    heading,
                    status: 'available',
                    type: type
                });
            });
        }, this.config.updateInterval);
    }
    
    // Public API
    getMap() { return this.map; }
    getDrivers() { return this.drivers; }
    getPassengerPosition() { return this.passengerPosition; }
    getSelectedVehicleType() { return this.selectedVehicleType; }
}

// Auto-initialize
window.advancedMap = new AdvancedMapSystem();

// Global functions for external access
window.requestRideWithDriver = (driverId, vehicleType) => {
    window.advancedMap.requestRideWithDriver(driverId, vehicleType);
};

console.log('🚗 Advanced NexRyde Map System loaded');
