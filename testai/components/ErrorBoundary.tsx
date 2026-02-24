// NEW CODE START - Error Boundary Component for Production Safety
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getEnvironment, safeLog, isProduction } from '../utils/environment';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    safeLog.error('ErrorBoundary caught an error', { error, errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Show alert in production/preview environments
    const env = getEnvironment();
    if (env === 'production' || env === 'preview') {
      // Production-safe alert
      try {
        // Use a more user-friendly alert
        const errorMessage = 'Service temporarily unavailable. Please refresh the page.';
        
        // Try to use a modern notification first
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('App Error', {
            body: errorMessage,
            icon: '/favicon.ico'
          });
        } else {
          // Fallback to alert
          alert(errorMessage);
        }
      } catch (alertError) {
        // Silent fallback if alert fails
        console.error('Alert failed:', alertError);
      }
    }

    // In production, you might want to send this to an error reporting service
    if (env === 'production') {
      // Example: Send to Sentry, LogRocket, etc.
      // window.Sentry?.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    }
  }

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Production-safe fallback
      const env = getEnvironment();
      
      if (env === 'production' || env === 'preview') {
        // Minimal error UI for production/preview
        return (
          <div 
            style={{
              height: '100vh',
              width: '100vw',
              position: 'fixed',
              top: 0,
              left: 0,
              zIndex: 9999,
              background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '40px',
                height: '40px',
                margin: '0 auto 16px',
                background: 'rgba(59, 130, 246, 0.1)',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <i 
                  className="fas fa-exclamation-circle" 
                  style={{ 
                    fontSize: '18px', 
                    color: '#3b82f6' 
                  }}
                />
              </div>
              <div style={{ fontSize: '14px' }}>
                Service temporarily unavailable
              </div>
            </div>
          </div>
        );
      }

      // Development fallback with details
      return (
        <div 
          style={{
            height: '100vh',
            width: '100vw',
            position: 'fixed',
            top: 0,
            left: 0,
            zIndex: 9999,
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            color: '#e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}
        >
          <div style={{
            maxWidth: '400px',
            textAlign: 'center',
            background: 'rgba(30, 41, 59, 0.5)',
            padding: '40px',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 20px',
              background: 'rgba(59, 130, 246, 0.2)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid rgba(59, 130, 246, 0.3)'
            }}>
              <i 
                className="fas fa-exclamation-triangle" 
                style={{ 
                  fontSize: '24px', 
                  color: '#3b82f6' 
                }}
              />
            </div>
            
            <h2 style={{
              fontSize: '18px',
              fontWeight: '700',
              marginBottom: '12px',
              color: '#ffffff',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              System Temporarily Unavailable
            </h2>
            
            <p style={{
              fontSize: '14px',
              color: '#94a3b8',
              lineHeight: '1.5',
              marginBottom: '24px'
            }}>
              We're experiencing technical difficulties. 
              Please refresh the page or try again later.
            </p>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.3)';
              }}
            >
              Refresh Page
            </button>
            
            {this.state.error && (
              <details style={{
                marginTop: '24px',
                textAlign: 'left',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                padding: '16px'
              }}>
                <summary style={{
                  cursor: 'pointer',
                  color: '#ef4444',
                  fontSize: '12px',
                  fontWeight: '600',
                  marginBottom: '8px'
                }}>
                  Error Details (Development Only)
                </summary>
                <pre style={{
                  fontSize: '10px',
                  color: '#fca5a5',
                  overflow: 'auto',
                  maxHeight: '200px',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
// NEW CODE END
