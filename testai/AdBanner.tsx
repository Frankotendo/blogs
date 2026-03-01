import React, { useEffect, useState } from 'react';

interface AdBannerProps {
  settings: any;
  className?: string;
  showOnlyOnContentPages?: boolean;
}

const AdBanner: React.FC<AdBannerProps> = ({ 
  settings, 
  className = "", 
  showOnlyOnContentPages = true 
}) => {
  const [canShowAd, setCanShowAd] = useState(false);
  const [adBlocked, setAdBlocked] = useState(false);

  useEffect(() => {
    // Check if AdSense is available
    const checkAdSense = () => {
      if (window.adSenseBlocked) {
        setAdBlocked(true);
        setCanShowAd(false);
        return;
      }

      // Only show ads on pages with substantial content
      const hasSubstantialContent = checkPageContent();
      setCanShowAd(hasSubstantialContent && !adBlocked);
    };

    checkAdSense();
    
    // Re-check when window.adSenseBlocked might change
    const interval = setInterval(checkAdSense, 1000);
    return () => clearInterval(interval);
  }, [adBlocked]);

  const checkPageContent = (): boolean => {
    // AdSense policy: Only show ads on pages with substantial content
    const url = window.location.pathname;
    const viewMode = window.location.hash || '';
    
    // Don't show ads on:
    // - Login/authentication pages
    // - Loading screens
    // - Modal dialogs
    // - Navigation-only pages
    // - Under construction pages
    const noAdPages = ['/login', '/auth', '/loading', '/modal', '/nav'];
    const isNoAdPage = noAdPages.some(page => url.includes(page));
    
    // Don't show ads on certain view modes
    const noAdViews = ['tracking', 'admin', 'driver-auth'];
    const isNoAdView = noAdViews.some(view => viewMode.includes(view));
    
    // Check if page has actual content (not just navigation)
    const hasContent = document.body.innerText.length > 200;
    
    // Don't show ads if there are modals open
    const hasModal = document.querySelector('[role="dialog"]') !== null;
    
    return !isNoAdPage && !isNoAdView && hasContent && !hasModal;
  };

  if (!canShowAd || !settings?.adSenseClientId) {
    return null;
  }

  return (
    <div className={`ad-container ${className}`}>
      {adBlocked ? (
        <div className="text-center text-gray-500 text-sm py-4">
          <p>Advertisements help support our service</p>
          <p className="text-xs">Please consider disabling your ad blocker</p>
        </div>
      ) : (
        <ins
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={settings.adSenseClientId}
          data-ad-slot={settings.adSenseSlotId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      )}
    </div>
  );
};

export default AdBanner;
