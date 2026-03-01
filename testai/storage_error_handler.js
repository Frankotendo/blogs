// Storage Error Handler for Tracking Prevention
// Add this script to index.html to handle storage access issues

(function() {
  'use strict';
  
  // Override localStorage methods to handle tracking prevention
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  
  localStorage.setItem = function(key, value) {
    try {
      return originalSetItem(key, value);
    } catch (error) {
      console.warn('localStorage.setItem blocked by tracking prevention:', key);
      // Fallback to sessionStorage
      try {
        sessionStorage.setItem(key, value);
      } catch (sessionError) {
        console.warn('sessionStorage also blocked:', key);
      }
    }
  };
  
  localStorage.getItem = function(key) {
    try {
      return originalGetItem(key);
    } catch (error) {
      console.warn('localStorage.getItem blocked by tracking prevention:', key);
      // Fallback to sessionStorage
      try {
        return sessionStorage.getItem(key);
      } catch (sessionError) {
        return null;
      }
    }
  };
  
  localStorage.removeItem = function(key) {
    try {
      return originalRemoveItem(key);
    } catch (error) {
      console.warn('localStorage.removeItem blocked by tracking prevention:', key);
      // Fallback to sessionStorage
      try {
        sessionStorage.removeItem(key);
      } catch (sessionError) {
        // Ignore
      }
    }
  };
  
  // Handle postMessage errors from browser extensions
  const originalPostMessage = window.postMessage.bind(window);
  window.postMessage = function(message, targetOrigin, transfer) {
    try {
      return originalPostMessage(message, targetOrigin, transfer);
    } catch (error) {
      if (error.message.includes('target origin')) {
        console.warn('Browser extension postMessage error - safely ignored');
        return;
      }
      throw error;
    }
  };
  
  console.log('Storage error handler initialized');
})();
