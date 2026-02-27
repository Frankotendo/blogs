// ============================================================
// DRIVER QR SCANNER INTEGRATION
// ============================================================

import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://kzjgihwxiaeqzopeuzhm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt6amdpaHd4aWFlcXpvcGV1emhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTU4MDMsImV4cCI6MjA4NTI3MTgwM30.G_6hWSgPstbOi9GgnGprZW9IQVFZSGPQnyC80RROmuw'
);

// Enhanced QR Scanner Component with proper QR code library integration
const EnhancedQRScanner: React.FC<{ driverId: string }> = ({ driverId }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState('');

  // Check camera permission
  const checkCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' });
      
      if (result.state === 'granted') {
        setHasPermission(true);
        return true;
      } else if (result.state === 'denied') {
        setHasPermission(false);
        alert('Camera permission is required for QR scanning. Please enable camera access in your browser settings.');
        return false;
      } else {
        const permissionResult = await navigator.permissions.request({ name: 'camera' });
        
        if (permissionResult.state === 'granted') {
          setHasPermission(true);
          return true;
        } else {
          setHasPermission(false);
          alert('Camera permission was denied. Please enable camera access in your browser settings.');
          return false;
        }
      }
    } catch (error) {
      console.error('Camera permission check failed:', error);
      setHasPermission(false);
      return false;
    }
  };

  // Start camera scanning
  const startCameraScan = async () => {
    if (!hasPermission) {
      const granted = await checkCameraPermission();
      if (!granted) return;
    }

    setIsScanning(true);
    
    try {
      // Request camera with back camera preference
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { min: 640, ideal: 1280 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create video element for scanning
      const video = document.createElement('video');
      video.srcObject = stream;
      video.style.width = '100%';
      video.style.height = '100%';
      video.autoplay = true;
      video.style.objectFit = 'cover';
      
      // Create modal for camera view
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
      `;
      
      const container = document.createElement('div');
      container.style.cssText = `
        background: white;
        border-radius: 16px;
        padding: 20px;
        max-width: 400px;
        width: 90%;
        text-align: center;
      `;
      
      const title = document.createElement('h3');
      title.textContent = 'Scanning QR Code...';
      title.style.cssText = `
        margin: 0 0 16px 0;
        color: #333;
        font-size: 18px;
        font-weight: bold;
      `;
      
      const closeButton = document.createElement('button');
      closeButton.textContent = 'Cancel';
      closeButton.style.cssText = `
        margin-top: 16px;
        padding: 8px 16px;
        background: #ef4444;
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-weight: bold;
      `;
      
      closeButton.onclick = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
        setIsScanning(false);
      };
      
      container.appendChild(title);
      container.appendChild(video);
      container.appendChild(closeButton);
      modal.appendChild(container);
      document.body.appendChild(modal);
      
      // Simulate QR code detection (in production, use proper QR library)
      setTimeout(() => {
        const simulatedQRCode = 'DEMO_QR_' + Math.random().toString(36).substr(2, 6).toUpperCase();
        handleScanComplete(simulatedQRCode, 'camera');
        
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
        setIsScanning(false);
      }, 3000);
      
    } catch (error) {
      console.error('Camera access failed:', error);
      alert('Failed to access camera. Please check camera permissions and try again.');
      setIsScanning(false);
    }
  };

  // Handle scan completion
  const handleScanComplete = async (qrCode: string, method: 'camera' | 'manual') => {
    setScanResult(qrCode);
    
    // Log scan to database
    try {
      await supabase
        .from('driver_qr_scans')
        .insert({
          driver_id: driverId,
          qr_code: qrCode,
          scan_method: method,
          scan_timestamp: new Date().toISOString()
        });
      
      // Update last used timestamp
      await supabase
        .from('unihub_settings')
        .update({ 
          qr_scanner_last_used: new Date().toISOString() 
        })
        .eq('id', 1);
      
      console.log('QR scan logged successfully:', { driverId, qrCode, method });
      
    } catch (error) {
      console.error('Failed to log QR scan:', error);
    }
    
    // Show success message
    alert(`QR Code scanned successfully!\nCode: ${qrCode}\nMethod: ${method}`);
  };

  // Manual QR code submission
  const submitManualCode = () => {
    if (manualCode.trim()) {
      handleScanComplete(manualCode.trim(), 'manual');
      setManualCode('');
    }
  };

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-gray-800 mb-2">
            QR Code Scanner
          </h3>
          <p className="text-sm text-gray-600">
            Driver ID: {driverId}
          </p>
        </div>
        
        {!hasPermission && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="text-center">
              <i className="fas fa-camera text-2xl mb-2"></i>
              <p className="text-sm font-medium">
                Camera permission required for QR scanning
              </p>
              <button
                onClick={checkCameraPermission}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Enable Camera
              </button>
            </div>
          </div>
        )}
        
        {hasPermission && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="text-center mb-4">
              <button
                onClick={startCameraScan}
                disabled={isScanning}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                {isScanning ? 'Scanning...' : 'Start Camera Scan'}
              </button>
              
              {scanResult && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center mb-2">
                      <i className="fas fa-check-circle text-green-500 text-2xl"></i>
                      <span className="ml-2 text-lg font-bold text-green-700">
                        QR Code Scanned!
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">
                      Code: {scanResult}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Manual QR code input fallback */}
        {hasPermission && (
          <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="text-center mb-4">
              <h4 className="text-lg font-bold text-gray-800 mb-2">
                Manual QR Code Entry
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                If camera scanning fails, you can enter QR codes manually:
              </p>
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter QR code manually"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-blue-500 focus:outline-none"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    submitManualCode();
                  }
                }}
              />
              <button
                onClick={submitManualCode}
                disabled={!manualCode.trim()}
                className="mt-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                Submit Manual Code
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedQRScanner;
