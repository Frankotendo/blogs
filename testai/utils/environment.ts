// NEW CODE START - Environment Detection & Error Handling Utilities

// Safe environment detection that works in all environments
export const getEnvironment = (): 'development' | 'production' | 'preview' | 'unknown' => {
  // Check for Vercel environment
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const hostname = window.location.hostname;
    
    // Vercel preview URLs
    if (hostname.includes('.vercel.app') && hostname !== 'your-production-domain.vercel.app') {
      return 'preview';
    }
    
    // Production domain (replace with your actual domain)
    if (hostname === 'your-production-domain.vercel.app' || hostname === 'your-custom-domain.com') {
      return 'production';
    }
    
    // Local development
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.includes('.local')) {
      return 'development';
    }
  }
  
  // Fallback checks
  if (typeof process !== 'undefined' && process.env?.NODE_ENV) {
    return process.env.NODE_ENV as 'development' | 'production';
  }
  
  // Default to development for safety
  return 'development';
};

// Safe error logging that works in all environments
export const safeLog = {
  error: (message: string, error?: any) => {
    const env = getEnvironment();
    
    if (env === 'development') {
      console.error(message, error);
    } else if (env === 'production' || env === 'preview') {
      // In production/preview, log to external service or silently handle
      console.error(message);
    }
  },
  
  warn: (message: string, data?: any) => {
    const env = getEnvironment();
    if (env === 'development') {
      console.warn(message, data);
    }
  },
  
  info: (message: string, data?: any) => {
    const env = getEnvironment();
    if (env === 'development') {
      console.info(message, data);
    }
  }
};

// Check if we're in production or preview
export const isProduction = () => {
  const env = getEnvironment();
  return env === 'production' || env === 'preview';
};

// NEW CODE END
