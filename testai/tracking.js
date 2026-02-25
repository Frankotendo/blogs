// Initialize Leaflet map
const map = L.map('map').setView([0, 0], 13);

// Use OSM tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Maintain drivers object
const drivers = {};
let passengerMarker = null;
let socket = null;

// Initialize Socket.IO
try {
    socket = io();
} catch (e) {
    console.log('Socket.IO not available, using standalone mode');
}

// Update drivers on socket "driverLocationUpdate"
if (socket) {
    socket.on('driverLocationUpdate', (data) => {
        const { driverId, lat, lng, name } = data;
        
        if (drivers[driverId]) {
            // Update existing driver position
            drivers[driverId].setLatLng([lat, lng]);
        } else {
            // Create new driver marker
            const driverIcon = L.divIcon({
                html: '🚗',
                iconSize: [30, 30],
                className: 'driver-marker'
            });
            
            drivers[driverId] = L.marker([lat, lng], { icon: driverIcon })
                .addTo(map)
                .bindPopup(name || `Driver ${driverId}`);
        }
        
        // Center map on driver if it's the first one
        if (Object.keys(drivers).length === 1) {
            map.setView([lat, lng], 15);
        }
    });
}

// Show passenger via navigator.geolocation.watchPosition
if ('geolocation' in navigator) {
    navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            
            if (passengerMarker) {
                passengerMarker.setLatLng([latitude, longitude]);
            } else {
                const passengerIcon = L.divIcon({
                    html: '👤',
                    iconSize: [30, 30],
                    className: 'passenger-marker'
                });
                
                passengerMarker = L.marker([latitude, longitude], { icon: passengerIcon })
                    .addTo(map)
                    .bindPopup('Your Location');
                
                map.setView([latitude, longitude], 15);
            }
        },
        (error) => {
            console.error('Geolocation error:', error);
        },
        {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        }
    );
}

// On "rideAssigned" open Google Maps directions
if (socket) {
    socket.on('rideAssigned', (data) => {
        const { driverLat, driverLng, passengerLat, passengerLng } = data;
        
        // Open Google Maps directions in new tab
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${passengerLat},${passengerLng}&destination=${driverLat},${driverLng}`;
        window.open(directionsUrl, '_blank');
    });
}

// Fallback function for manual ride assignment
window.assignRide = function(driverLat, driverLng, passengerLat, passengerLng) {
    const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${passengerLat},${passengerLng}&destination=${driverLat},${driverLng}`;
    window.open(directionsUrl, '_blank');
};

// Function to simulate driver location updates (for testing)
window.simulateDriver = function(driverId, lat, lng, name) {
    const eventData = { driverId, lat: parseFloat(lat), lng: parseFloat(lng), name };
    
    if (socket) {
        // In real app, this would come from server
        console.log('Simulating driver update:', eventData);
    }
    
    // Update locally for testing
    if (drivers[driverId]) {
        drivers[driverId].setLatLng([lat, lng]);
    } else {
        const driverIcon = L.divIcon({
            html: '🚗',
            iconSize: [30, 30],
            className: 'driver-marker'
        });
        
        drivers[driverId] = L.marker([lat, lng], { icon: driverIcon })
            .addTo(map)
            .bindPopup(name || `Driver ${driverId}`);
    }
};
