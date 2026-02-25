# 🗺️ MAP LAYOUT & REALISTIC LOCATION FIXES

## 🐛 **ISSUES IDENTIFIED:**

### **1. Map Covering Menu:**
- Map z-index too high
- Map container overlapping UI elements
- No proper layout constraints

### **2. Unrealistic Location:**
- Default center coordinates may not be accurate
- No proper location detection
- Map doesn't center on user's actual position

---

## 🛠️ **COMPLETE SOLUTION**

### **📱 FIXED MAP LAYOUT:**

```css
/* Add this CSS to fix map covering issues */
.map-container {
    position: relative !important;
    z-index: 1 !important;
    margin-top: 60px !important; /* Space for header */
    height: calc(100vh - 120px) !important; /* Full height minus header/footer */
    max-height: 600px !important;
    border-radius: 8px !important;
    overflow: hidden !important;
}

/* Ensure menu stays on top */
.header-nav, .main-menu, .control-panel {
    position: relative !important;
    z-index: 1000 !important;
}

/* Mobile specific */
@media (max-width: 768px) {
    .map-container {
        height: 50vh !important;
        margin-top: 50px !important;
        margin-bottom: 10px !important;
    }
}
```

### **🗺️ ENHANCED MAP INITIALIZATION:**

```javascript
// Fixed map initialization with proper layout
function initMap() {
    try {
        const mapContainer = document.getElementById('map');
        if (!mapContainer) {
            console.error('❌ Map container not found');
            return;
        }
        
        // Apply proper styling to prevent covering menu
        mapContainer.style.cssText = `
            position: relative;
            z-index: 1;
            height: calc(100vh - 120px);
            max-height: 600px;
            width: 100%;
            border: 1px solid #334155;
            border-radius: 8px;
            background: #e2e8f0;
            margin-top: 60px;
            overflow: hidden;
        `;
        
        // Mobile adjustments
        if (window.innerWidth <= 768) {
            mapContainer.style.height = '50vh';
            mapContainer.style.marginTop = '50px';
        }
        
        // Create map with proper options
        map = L.map('map', {
            center: config.mapCenter,
            zoom: config.defaultZoom,
            zoomControl: true,
            attributionControl: true,
            worldCopyJump: true,
            // Prevent map from covering other elements
            preferCanvas: true
        });
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: config.maxZoom
        }).addTo(map);
        
        console.log('✅ Map initialized with proper layout');
        
        // Get user location and center map
        centerMapOnUser();
        
    } catch (error) {
        console.error('❌ Map initialization failed:', error);
        showNotification('❌ Map initialization failed');
    }
}

// Center map on user's real location
async function centerMapOnUser() {
    console.log('🔍 Getting your real location...');
    
    try {
        // Try multiple location methods
        const location = await getRealisticLocation();
        
        console.log(`📍 Your location: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)} (${location.method})`);
        
        // Center map on user's actual location
        map.setView([location.lat, location.lng], 16);
        
        // Update passenger position
        updatePassengerLocationWithGeoreference(location.lat, location.lng, location.accuracy);
        
        // Show location indicator
        showLocationIndicator(location);
        
        // Start continuous tracking
        startRealisticTracking(location);
        
    } catch (error) {
        console.error('❌ Could not get location:', error);
        showNotification('📍 Using default location - Please enable location access');
    }
}

// Get realistic location with multiple methods
async function getRealisticLocation() {
    // Method 1: Try browser GPS first
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        });
        
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            method: 'GPS'
        };
    } catch (error) {
        console.warn('⚠️ GPS failed, trying alternatives...');
    }
    
    // Method 2: Try network location
    try {
        const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
                resolve,
                reject,
                { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
            );
        });
        
        return {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            method: 'Network'
        };
    } catch (error) {
        console.warn('⚠️ Network location failed, trying IP location...');
    }
    
    // Method 3: IP-based location
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        return {
            lat: data.latitude,
            lng: data.longitude,
            accuracy: 10000,
            city: data.city,
            country: data.country_name,
            method: 'IP Location'
        };
    } catch (error) {
        console.warn('⚠️ IP location failed, using manual selection...');
    }
    
    // Method 4: Manual location selection
    return await getManualLocation();
}

// Manual location selection with realistic options
async function getManualLocation() {
    return new Promise((resolve) => {
        // Create location selection modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; max-width: 450px; width: 90%; max-height: 80vh; overflow-y: auto;">
                <h3 style="margin: 0 0 20px 0; text-align: center;">📍 Select Your Location</h3>
                <p style="margin: 0 0 20px 0; color: #64748b; text-align: center;">
                    We couldn't detect your location automatically. Please select where you are:
                </p>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 16px;">🏫 Campus Locations</h4>
                    <div style="display: grid; gap: 10px;">
                        <button onclick="selectLocation(5.6037, -0.18696, 'Main Gate, KNUST')" style="padding: 12px; border: 1px solid #d1d5db; background: #f8fafc; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">🚪 Main Gate</div>
                            <div style="font-size: 12px; color: #64748b;">KNUST Main Entrance</div>
                        </button>
                        <button onclick="selectLocation(5.6050, -0.1870, 'Library, KNUST')" style="padding: 12px; border: 1px solid #d1d5db; background: #f8fafc; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">📚 Library</div>
                            <div style="font-size: 12px; color: #64748b;">Main Library Building</div>
                        </button>
                        <button onclick="selectLocation(5.6060, -0.1880, 'Science Block, KNUST')" style="padding: 12px; border: 1px solid #d1d5db; background: #f8fafc; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">🔬 Science Block</div>
                            <div style="font-size: 12px; color: #64748b;">Science Faculty</div>
                        </button>
                        <button onclick="selectLocation(5.6040, -0.1850, 'Student Center, KNUST')" style="padding: 12px; border: 1px solid #d1d5db; background: #f8fafc; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">👥 Student Center</div>
                            <div style="font-size: 12px; color: #64748b;">Student Activities Center</div>
                        </button>
                        <button onclick="selectLocation(5.6020, -0.1840, 'Hostel A, KNUST')" style="padding: 12px; border: 1px solid #d1d5db; background: #f8fafc; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">🏠 Hostel A</div>
                            <div style="font-size: 12px; color: #64748b;">Student Hostel</div>
                        </button>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 16px;">🏙️ Kumasi Areas</h4>
                    <div style="display: grid; gap: 10px;">
                        <button onclick="selectLocation(5.6148, -0.2059, 'Adum, Kumasi')" style="padding: 12px; border: 1px solid #d1d5db; background: #fef3c7; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">🏪 Adum</div>
                            <div style="font-size: 12px; color: #64748b;">Central Kumasi</div>
                        </button>
                        <button onclick="selectLocation(5.6415, -0.1863, 'Kejetia, Kumasi')" style="padding: 12px; border: 1px solid #d1d5db; background: #fef3c7; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">🚌 Kejetia</div>
                            <div style="font-size: 12px; color: #64748b;">Main Bus Terminal</div>
                        </button>
                        <button onclick="selectLocation(5.5950, -0.1969, 'Asokwa, Kumasi')" style="padding: 12px; border: 1px solid #d1d5db; background: #fef3c7; border-radius: 6px; cursor: pointer; text-align: left;">
                            <div style="font-weight: 600;">🏭 Asokwa</div>
                            <div style="font-size: 12px; color: #64748b;">Industrial Area</div>
                        </button>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0 0 10px 0; font-size: 16px;">🌍 Other Options</h4>
                    <button onclick="selectLocation(5.6037, -0.18696, 'KNUST Campus')" style="padding: 12px; border: 1px solid #d1d5db; background: #dbeafe; border-radius: 6px; cursor: pointer; text-align: left; width: 100%;">
                        <div style="font-weight: 600;">🎓 KNUST Campus (Default)</div>
                        <div style="font-size: 12px; color: #64748b;">Main campus area</div>
                    </button>
                </div>
                
                <div style="display: flex; gap: 10px;">
                    <button onclick="this.closest('.location-modal').remove()" style="flex: 1; padding: 12px; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer;">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        modal.className = 'location-modal';
        document.body.appendChild(modal);
        
        // Handle location selection
        window.selectLocation = function(lat, lng, name) {
            modal.remove();
            resolve({
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                accuracy: 100,
                method: 'Manual',
                locationName: name
            });
        };
    });
}

// Show location indicator
function showLocationIndicator(location) {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: white;
        padding: 12px 16px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-size: 14px;
        z-index: 1000;
        max-width: 250px;
    `;
    
    const methodIcons = {
        'GPS': '🛰️',
        'Network': '📶',
        'IP Location': '🌐',
        'Manual': '📍'
    };
    
    const accuracyText = location.accuracy ? ` (±${Math.round(location.accuracy)}m)` : '';
    const locationName = location.locationName || location.city || '';
    
    indicator.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">
            ${methodIcons[location.method] || '📍'} ${location.method}
        </div>
        ${locationName ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">${locationName}</div>` : ''}
        <div style="font-size: 12px; color: #94a3b8;">
            ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}${accuracyText}
        </div>
    `;
    
    document.body.appendChild(indicator);
    
    // Auto-hide after 8 seconds
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 8000);
}

// Start realistic continuous tracking
function startRealisticTracking(initialLocation) {
    if (!navigator.geolocation) {
        console.warn('⚠️ Geolocation not supported');
        return;
    }
    
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
    };
    
    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            const location = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            
            // Only update if position changed significantly (more than 10 meters)
            const distance = calculateDistance(
                initialLocation.lat, initialLocation.lng,
                location.lat, location.lng
            );
            
            if (distance > 0.01) { // 10 meters
                updatePassengerLocationWithGeoreference(location.lat, location.lng, location.accuracy);
                initialLocation = location;
            }
        },
        (error) => {
            console.warn('⚠️ Tracking error:', error.message);
        },
        options
    );
    
    // Store watch ID for cleanup
    window.locationWatchId = watchId;
}

// Calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}
```

---

## 🎨 **IMPROVED CSS FOR LAYOUT:**

```css
/* Add this to your HTML head or CSS file */
<style>
/* Fix map covering issues */
#map {
    position: relative !important;
    z-index: 1 !important;
    margin-top: 60px !important;
    height: calc(100vh - 120px) !important;
    max-height: 600px !important;
    border-radius: 8px !important;
    overflow: hidden !important;
}

/* Ensure UI elements stay on top */
.header, .nav, .menu, .control-panel, .notification {
    position: relative !important;
    z-index: 1000 !important;
}

/* Mobile responsive */
@media (max-width: 768px) {
    #map {
        height: 50vh !important;
        margin-top: 50px !important;
        margin-bottom: 10px !important;
    }
}

/* Location modal styling */
.location-modal {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.location-modal button:hover {
    background: #f1f5f9 !important;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
</style>
```

---

## 🚀 **QUICK IMPLEMENTATION:**

### **Step 1: Add CSS to HTML Head**
```html
<style>
/* Add the CSS from above here */
</style>
```

### **Step 2: Replace Map Initialization**
```javascript
// Replace your existing initMap function with the new one
function initMap() {
    // Use the enhanced initMap function from above
}
```

### **Step 3: Test Location Detection**
```javascript
// Test in browser console:
window.testRealLocation = async function() {
    const location = await getRealisticLocation();
    console.log('🎯 Your realistic location:', location);
    
    if (map) {
        map.setView([location.lat, location.lng], 16);
        updatePassengerLocationWithGeoreference(location.lat, location.lng, location.accuracy);
    }
};

testRealLocation();
```

---

## ✅ **EXPECTED RESULTS:**

### **🗺️ Map Layout Fixed:**
- [ ] Map no longer covers menu/navigation
- [ ] Proper z-index layering
- [ ] Responsive height adjustments
- [ ] Mobile-friendly layout

### **📍 Realistic Location:**
- [ ] Multiple detection methods
- [ ] Manual location selection with realistic options
- [ ] Campus locations (KNUST specific)
- [ ] Kumasi area locations
- [ ] Visual location indicators
- [ ] Continuous tracking with movement detection

### **🎯 User Experience:**
- [ ] Map centers on actual location
- [ ] Clear location method indicators
- [ ] Easy manual location selection
- [ ] Smooth tracking updates
- [ ] Professional location modal

**Your map should now have proper layout and realistic location detection!** 🗺️✨
