import React, { useState, useRef, useEffect } from 'react';
import { Minimize2, Maximize2, X, Layers, Navigation, Users, Car, Settings, RefreshCw } from 'lucide-react';

interface MapContainerProps {
  children: React.ReactNode;
  title?: string;
  isMaximized: boolean;
  onMaximize: () => void;
  onMinimize: () => void;
  onClose?: () => void;
  showControls?: boolean;
  onRefresh?: () => void;
}

const MapContainer: React.FC<MapContainerProps> = ({
  children,
  title = "Live Tracking Map",
  isMaximized,
  onMaximize,
  onMinimize,
  onClose,
  showControls = true,
  onRefresh
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`
        relative bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden transition-all duration-300
        ${isMaximized ? 'fixed inset-4 z-50' : 'h-[600px]'}
        ${isFullscreen ? 'fixed inset-0 z-50' : ''}
      `}
    >
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <span className="text-slate-400 text-sm">Live</span>
        </div>
        
        <div className="flex items-center gap-2">
          {showControls && (
            <>
              <button
                onClick={onRefresh}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={toggleFullscreen}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button
                onClick={isMaximized ? onMinimize : onMaximize}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title={isMaximized ? "Minimize" : "Maximize"}
              >
                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Map Content */}
      <div className="relative flex-1 h-[calc(100%-60px)]">
        {children}
      </div>

      {/* Floating Controls Overlay */}
      {showControls && (
        <div className="absolute bottom-4 left-4 bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-600 p-2 shadow-xl">
          <div className="flex flex-col gap-2">
            <button
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Toggle Layers"
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Center Map"
            >
              <Navigation className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Show Users"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Show Vehicles"
            >
              <Car className="w-4 h-4" />
            </button>
            <button
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Status Bar */}
      <div className="absolute bottom-4 right-4 bg-slate-800/90 backdrop-blur-sm rounded-xl border border-slate-600 px-3 py-2 shadow-xl">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span>Connected</span>
          <span className="text-slate-500">•</span>
          <span id="location-count">Loading...</span>
        </div>
      </div>
    </div>
  );
};

export default MapContainer;
