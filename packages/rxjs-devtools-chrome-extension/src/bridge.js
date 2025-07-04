(function() {
  'use strict';
  
  // Prevent duplicate injection
  if (window.__RXJS_DEVTOOLS_BRIDGE_ACTIVE__) {
    console.log('[DEBUG][RxJS DevTools - Bridge] Bridge already active, skipping');
    return;
  }
  window.__RXJS_DEVTOOLS_BRIDGE_ACTIVE__ = true;
  
  console.log('[INFO][RxJS DevTools - Bridge] Bridge script starting in main world...');
  
  let lastAppsState = null;
  let appsFound = false;
  
  function sendAppsUpdate(apps) {
    try {
      window.postMessage({
        source: 'rxjs-devtools-bridge',
        type: 'APPS_UPDATE',
        apps: apps,
      }, '*');
      console.log('[INFO][RxJS DevTools - Bridge] Sent apps update:', apps);
    } catch (error) {
      console.error('[ERROR][RxJS DevTools - Bridge] Failed to post message:', error);
    }
  }
  
  function checkForApps() {
    const hook = window.__RXJS_DEVTOOLS_HOOK__;
    
    if (hook && Array.isArray(hook.apps)) {
      const currentAppsState = JSON.stringify(hook.apps);
      
      // Only send update if apps have changed
      if (currentAppsState !== lastAppsState) {
        console.log('[INFO][RxJS DevTools - Bridge] Apps changed, sending update:', hook.apps);
        sendAppsUpdate(hook.apps);
        lastAppsState = currentAppsState;
        appsFound = true;
        return true; // Apps found and sent
      }
      return false; // Apps found but no change
    }
    return false; // No apps found
  }
  
  // Initial check
  if (checkForApps()) {
    console.log('[INFO][RxJS DevTools - Bridge] Apps found immediately');
  } else {
    console.log('[DEBUG][RxJS DevTools - Bridge] No apps found initially, will poll...');
  }
  
  // Poll for changes, but reduce frequency after apps are found
  let pollCount = 0;
  const maxInitialPolls = 30; // Poll aggressively for 30 seconds
  
  const pollInterval = setInterval(() => {
    pollCount++;
    
    const appsChanged = checkForApps();
    
    // If no apps found yet and we're still in initial polling period
    if (!appsFound && pollCount <= maxInitialPolls) {
      // Continue aggressive polling
      return;
    }
    
    // If apps were found or we've exceeded initial polling, switch to slow polling
    if (pollCount > maxInitialPolls) {
      clearInterval(pollInterval);
      console.log('[INFO][RxJS DevTools - Bridge] Switching to slow polling...');
      
      // Continue with slower polling only if apps were found
      if (appsFound) {
        setInterval(() => {
          checkForApps(); // Only log if changes occur
        }, 5000);
      } else {
        console.log('[INFO][RxJS DevTools - Bridge] No apps found after initial polling, stopping');
      }
    }
  }, 1000);
  
  console.log('[INFO][RxJS DevTools - Bridge] Bridge script initialized');
})(); 