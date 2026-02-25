// 🔧 FIXED LOGIC - Professional Alert System & Map Management
// Complete solution for unnecessary alerts and unprofessional redirects

class FixedLogicSystem {
    constructor() {
        this.alertStates = new Map(); // Track alert states to prevent duplicates
        this.tripStates = new Map(); // Track trip states
        this.notificationQueue = []; // Queue notifications properly
        this.mapRedirects = new Map(); // Track map redirects
        this.lastAlertTimes = new Map(); // Prevent alert spam
        this professionalMode = true; // Professional mode flag
        
        // Configuration
        this.config = {
            alertCooldown: 5000, // 5 seconds between same alerts
            maxAlertsPerMinute: 3,
            redirectDelay: 1000, // 1 second delay for professional redirects
            sessionTimeout: 300000, // 5 minutes session timeout
            professionalTransitions: true
        };
        
        this.init();
    }
    
    init() {
        console.log('🔧 Initializing Fixed Logic System...');
        this.setupProfessionalAlertSystem();
        this.setupMapManagement();
        this.setupTripStateManagement();
        console.log('✅ Fixed Logic System initialized');
    }
    
    // =====================================================
    // 1. PROFESSIONAL ALERT SYSTEM
    // =====================================================
    
    setupProfessionalAlertSystem() {
        // Override default alert with professional version
        window.showNotification = (message, type = 'info', options = {}) => {
            return this.showProfessionalNotification(message, type, options);
        };
        
        // Override console alerts for debugging
        const originalConsoleLog = console.log;
        console.log = (...args) => {
            if (this.professionalMode && args[0] && args[0].includes('🚗 Driver')) {
                return; // Suppress driver spam logs in professional mode
            }
            originalConsoleLog.apply(console, args);
        };
    }
    
    // Professional notification system
    showProfessionalNotification(message, type = 'info', options = {}) {
        const {
            duration = 4000,
            persistent = false,
            action = null,
            priority = 'normal',
            category = 'general'
        } = options;
        
        // Check for duplicate alerts
        const alertKey = `${category}_${message}_${type}`;
        const now = Date.now();
        const lastAlert = this.lastAlertTimes.get(alertKey);
        
        if (lastAlert && (now - lastAlert) < this.config.alertCooldown) {
            console.log(`🔇 Suppressed duplicate alert: ${message}`);
            return false;
        }
        
        // Update last alert time
        this.lastAlertTimes.set(alertKey, now);
        
        // Create professional notification
        const notification = this.createProfessionalNotification(message, type, options);
        
        // Add to queue with priority
        this.notificationQueue.push({
            element: notification,
            timestamp: now,
            priority,
            persistent
        });
        
        // Process queue
        this.processNotificationQueue();
        
        return true;
    }
    
    createProfessionalNotification(message, type, options) {
        const colors = {
            info: { bg: '#3b82f6', border: '#2563eb' },
            success: { bg: '#10b981', border: '#059669' },
            warning: { bg: '#f59e0b', border: '#d97706' },
            error: { bg: '#ef4444', border: '#dc2626' },
            driver: { bg: '#6366f1', border: '#4f46e5' },
            trip: { bg: '#8b5cf6', border: '#7c3aed' }
        };
        
        const color = colors[type] || colors.info;
        
        const notification = document.createElement('div');
        notification.className = 'professional-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, ${color.bg} 0%, ${color.border} 100%);
            color: white;
            padding: 16px 20px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 380px;
            border-left: 4px solid ${color.border};
            backdrop-filter: blur(10px);
            transform: translateX(400px);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            opacity: 0;
        `;
        
        // Professional content structure
        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="font-size: 18px; margin-top: 2px;">${this.getNotificationIcon(type)}</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600; margin-bottom: 4px; line-height: 1.3;">${message}</div>
                    ${options.action ? `
                        <button onclick="(${options.action})()" style="
                            margin-top: 8px;
                            padding: 6px 12px;
                            background: rgba(255,255,255,0.2);
                            border: 1px solid rgba(255,255,255,0.3);
                            border-radius: 6px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                            font-weight: 500;
                            transition: all 0.2s ease;
                        " onmouseover="this.style.background='rgba(255,255,255,0.3)'" 
                           onmouseout="this.style.background='rgba(255,255,255,0.2)'">
                            ${options.actionText || 'View Details'}
                        </button>
                    ` : ''}
                </div>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: rgba(255,255,255,0.7);
                    cursor: pointer;
                    font-size: 16px;
                    padding: 0;
                    margin-left: 8px;
                ">✕</button>
            </div>
        `;
        
        return notification;
    }
    
    getNotificationIcon(type) {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            driver: '🚗',
            trip: '📍'
        };
        return icons[type] || icons.info;
    }
    
    processNotificationQueue() {
        // Sort by priority and timestamp
        this.notificationQueue.sort((a, b) => {
            if (a.priority !== b.priority) {
                const priorityOrder = { high: 3, normal: 2, low: 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            return a.timestamp - b.timestamp;
        });
        
        // Display notifications with proper spacing
        let verticalOffset = 20;
        this.notificationQueue.forEach((item, index) => {
            if (item.element.parentNode) return; // Already displayed
            
            setTimeout(() => {
                item.element.style.top = `${verticalOffset}px`;
                item.element.style.transform = 'translateX(0)';
                item.element.style.opacity = '1';
                
                document.body.appendChild(item.element);
                
                verticalOffset += item.element.offsetHeight + 10;
                
                // Auto-remove if not persistent
                if (!item.persistent) {
                    setTimeout(() => {
                        this.removeNotification(item.element);
                    }, 4000);
                }
            }, index * 100);
        });
        
        // Clear queue
        this.notificationQueue = [];
    }
    
    removeNotification(notification) {
        notification.style.transform = 'translateX(400px)';
        notification.style.opacity = '0';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    // =====================================================
    // 2. PROFESSIONAL MAP MANAGEMENT
    // =====================================================
    
    setupMapManagement() {
        // Override map redirects
        const originalOpen = window.open;
        window.open = (url, target, features) => {
            return this.professionalMapRedirect(url, target, features);
        };
        
        // Override location changes
        let lastLocationChange = 0;
        const originalAssign = Location.prototype.assign;
        Location.prototype.assign = function(url) {
            const now = Date.now();
            if (now - lastLocationChange < 2000) {
                console.warn('🚫 Blocked rapid location change');
                return;
            }
            lastLocationChange = now;
            return originalAssign.call(this, url);
        };
    }
    
    professionalMapRedirect(url, target = '_blank', features = '') {
        // Check if this is a map redirect
        if (url.includes('maps.google.com') || url.includes('openstreetmap.org')) {
            const redirectKey = `map_${url}`;
            const lastRedirect = this.mapRedirects.get(redirectKey);
            const now = Date.now();
            
            // Prevent duplicate redirects
            if (lastRedirect && (now - lastRedirect) < 5000) {
                console.log('🗺️ Suppressed duplicate map redirect');
                return null;
            }
            
            this.mapRedirects.set(redirectKey, now);
            
            // Show professional confirmation
            const confirmed = this.showMapRedirectConfirmation(url);
            if (!confirmed) {
                return null;
            }
        }
        
        // Professional redirect with delay
        setTimeout(() => {
            return window.open.call(window, url, target, features);
        }, this.config.redirectDelay);
    }
    
    showMapRedirectConfirmation(url) {
        // Create professional confirmation modal
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            backdrop-filter: blur(5px);
        `;
        
        modal.innerHTML = `
            <div style="
                background: white;
                padding: 30px;
                border-radius: 16px;
                max-width: 400px;
                width: 90%;
                text-align: center;
                box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            ">
                <div style="font-size: 48px; margin-bottom: 20px;">🗺️</div>
                <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 20px;">Open Navigation</h3>
                <p style="margin: 0 0 25px 0; color: #64748b; line-height: 1.5;">
                    Open Google Maps for turn-by-turn navigation to your destination?
                </p>
                <div style="display: flex; gap: 12px; justify-content: center;">
                    <button onclick="this.closest('div').parentElement.remove(); window.mapRedirectResult = true;" style="
                        padding: 12px 24px;
                        background: #10b981;
                        color: white;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                    ">Open Maps</button>
                    <button onclick="this.closest('div').parentElement.remove(); window.mapRedirectResult = false;" style="
                        padding: 12px 24px;
                        background: #f3f4f6;
                        color: #374151;
                        border: none;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 14px;
                    ">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        return new Promise((resolve) => {
            const checkResult = setInterval(() => {
                if (window.mapRedirectResult !== undefined) {
                    clearInterval(checkResult);
                    const result = window.mapRedirectResult;
                    delete window.mapRedirectResult;
                    modal.remove();
                    resolve(result);
                }
            }, 100);
        });
    }
    
    // =====================================================
    // 3. TRIP STATE MANAGEMENT
    // =====================================================
    
    setupTripStateManagement() {
        // Track trip states to prevent unnecessary alerts
        this.tripStates = new Map([
            ['requested', { alerts: ['driver_assigned', 'eta_update'] }],
            ['assigned', { alerts: ['driver_arrived', 'route_update'] }],
            ['picked_up', { alerts: ['destination_eta', 'route_progress'] }],
            ['completed', { alerts: ['rate_trip', 'receipt'] }],
            ['cancelled', { alerts: ['refund_info', 'rebook_option'] }]
        ]);
    }
    
    // Smart alert filtering based on trip state
    shouldShowAlert(category, tripId, alertType) {
        if (!tripId) return true;
        
        const currentState = this.getTripState(tripId);
        if (!currentState) return true;
        
        const allowedAlerts = this.tripStates.get(currentState)?.alerts || [];
        return allowedAlerts.includes(alertType);
    }
    
    getTripState(tripId) {
        return this.tripStates.get(tripId) || null;
    }
    
    setTripState(tripId, state) {
        this.tripStates.set(tripId, state);
        console.log(`🔄 Trip ${tripId} state: ${state}`);
    }
    
    // =====================================================
    // 4. DRIVER PICKUP ALERT FIXES
    // =====================================================
    
    // Smart driver pickup notification system
    handleDriverPickup(driverId, passengerId, action) {
        const alertKey = `pickup_${driverId}_${passengerId}`;
        const now = Date.now();
        const lastAlert = this.lastAlertTimes.get(alertKey);
        
        // Prevent duplicate pickup alerts
        if (lastAlert && (now - lastAlert) < 10000) {
            console.log(`🚫 Suppressed duplicate pickup alert for driver ${driverId}`);
            return false;
        }
        
        // Check trip state
        const tripId = `${driverId}_${passengerId}`;
        if (!this.shouldShowAlert('pickup', tripId, action)) {
            console.log(`🚫 Pickup alert not allowed for trip state: ${this.getTripState(tripId)}`);
            return false;
        }
        
        // Show appropriate message based on action
        const messages = {
            'assigned': '🚗 Driver assigned to your trip',
            'arrived': '📍 Driver has arrived at pickup location',
            'picked_up': '✅ Trip started - Enjoy your ride!',
            'completed': '🎉 Trip completed successfully'
        };
        
        const message = messages[action] || '🚗 Trip update';
        
        this.showProfessionalNotification(message, 'driver', {
            category: 'trip',
            priority: action === 'arrived' ? 'high' : 'normal',
            persistent: action === 'arrived',
            action: `window.viewTripDetails('${tripId}')`,
            actionText: 'View Trip'
        });
        
        this.lastAlertTimes.set(alertKey, now);
        this.setTripState(tripId, action);
        
        return true;
    }
    
    // =====================================================
    // 5. PROFESSIONAL ERROR HANDLING
    // =====================================================
    
    setupProfessionalErrorHandling() {
        // Override console.error for professional error display
        const originalConsoleError = console.error;
        console.error = (...args) => {
            if (this.professionalMode) {
                this.showProfessionalError(args.join(' '));
            }
            originalConsoleError.apply(console, args);
        };
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.showProfessionalError('An unexpected error occurred', event.reason);
            event.preventDefault();
        });
        
        // Handle JavaScript errors
        window.addEventListener('error', (event) => {
            this.showProfessionalError('JavaScript error', event.message);
            event.preventDefault();
        });
    }
    
    showProfessionalError(message, details = null) {
        this.showProfessionalNotification(
            `⚠️ ${message}`,
            'error',
            {
                persistent: true,
                priority: 'high',
                action: details ? `window.showErrorDetails('${details}')` : null,
                actionText: details ? 'View Details' : null
            }
        );
    }
    
    // =====================================================
    // 6. CLEANUP AND MAINTENANCE
    // =====================================================
    
    startMaintenance() {
        // Clean up old alerts
        setInterval(() => {
            const now = Date.now();
            const cutoff = now - 60000; // 1 minute ago
            
            for (const [key, time] of this.lastAlertTimes) {
                if (time < cutoff) {
                    this.lastAlertTimes.delete(key);
                }
            }
            
            for (const [key, time] of this.mapRedirects) {
                if (time < cutoff) {
                    this.mapRedirects.delete(key);
                }
            }
        }, 30000); // Every 30 seconds
    }
    
    // Public API
    enableProfessionalMode() {
        this.professionalMode = true;
        console.log('🎩 Professional mode enabled');
    }
    
    disableProfessionalMode() {
        this.professionalMode = false;
        console.log('👟 Professional mode disabled');
    }
    
    getNotificationStats() {
        return {
            totalAlerts: this.lastAlertTimes.size,
            queuedNotifications: this.notificationQueue.length,
            activeTrips: this.tripStates.size,
            recentRedirects: this.mapRedirects.size
        };
    }
}

// Initialize fixed logic system
window.fixedLogic = new FixedLogicSystem();

// Global functions for external access
window.handleDriverPickup = (driverId, passengerId, action) => {
    return window.fixedLogic.handleDriverPickup(driverId, passengerId, action);
};

window.showProfessionalNotification = (message, type, options) => {
    return window.fixedLogic.showProfessionalNotification(message, type, options);
};

window.enableProfessionalMode = () => {
    window.fixedLogic.enableProfessionalMode();
};

window.disableProfessionalMode = () => {
    window.fixedLogic.disableProfessionalMode();
};

console.log('🔧 Fixed Logic System loaded - Professional alerts and map management active');
