console.log('[INFO][RxJS DevTools - Chrome Extension] RxJS DevTools content script injected.');

// Direct injection approach similar to Redux DevTools
function injectBridgeScript() {
  // Check if already injected
  if ((window as any).__RXJS_DEVTOOLS_BRIDGE_INJECTED__) {
    console.log('[DEBUG][RxJS DevTools - Content] Bridge already injected');
    return;
  }

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('bridge.js');
  script.onload = function() {
    console.log('[DEBUG][RxJS DevTools - Content] Bridge script loaded successfully');
    (window as any).__RXJS_DEVTOOLS_BRIDGE_INJECTED__ = true;
    script.remove();
  };
  script.onerror = function(error) {
    console.error('[ERROR][RxJS DevTools - Content] Failed to load bridge script:', error);
  };
  
  (document.head || document.documentElement).appendChild(script);
}

// Inject immediately
injectBridgeScript();

// Track message sending
let messagesSent = 0;

// Listen for messages from the bridge script and forward to background
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.source === 'rxjs-devtools-bridge') {
    console.log('[INFO][RxJS DevTools - Content] Received message from bridge:', event.data);
    
    if (event.data.type === 'APPS_UPDATE') {
      messagesSent++;
      console.log(`[INFO][RxJS DevTools - Content] Forwarding apps to background (message #${messagesSent}):`, event.data.apps);
      
      // Check Chrome runtime availability
      console.log('[DEBUG][RxJS DevTools - Content] Chrome runtime available:', typeof chrome !== 'undefined');
      console.log('[DEBUG][RxJS DevTools - Content] Chrome runtime.sendMessage available:', typeof chrome?.runtime?.sendMessage);
      
      // Forward to background script
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const messageToSend = {
          source: 'rxjs-devtools-content',
          type: 'APPS_UPDATE',
          apps: event.data.apps,
          messageId: messagesSent,
          timestamp: Date.now()
        };
        
        console.log('[DEBUG][RxJS DevTools - Content] Sending message to background:', messageToSend);
        
        // Add timeout to detect if sendMessage hangs
        const timeoutId = setTimeout(() => {
          console.error(`[ERROR][RxJS DevTools - Content] Message #${messagesSent} timed out after 5 seconds`);
        }, 5000);
        
        try {
          const sendPromise = chrome.runtime.sendMessage(messageToSend);
          
          if (sendPromise && typeof sendPromise.then === 'function') {
            // Modern promise-based API
            sendPromise.then(() => {
              clearTimeout(timeoutId);
              console.log(`[DEBUG][RxJS DevTools - Content] Message #${messagesSent} sent to background successfully (promise)`);
            }).catch((error: any) => {
              clearTimeout(timeoutId);
              console.error(`[ERROR][RxJS DevTools - Content] Failed to send message #${messagesSent} to background (promise):`, error);
              
              // Check if it's a context invalidation error
              if (error.message && error.message.includes('Extension context invalidated')) {
                console.error('[ERROR][RxJS DevTools - Content] Extension context was invalidated - extension may have been reloaded');
              }
            });
          } else {
            // Legacy callback-based API or sync API
            clearTimeout(timeoutId);
            if (chrome.runtime.lastError) {
              console.error(`[ERROR][RxJS DevTools - Content] Failed to send message #${messagesSent} to background (callback):`, chrome.runtime.lastError);
            } else {
              console.log(`[DEBUG][RxJS DevTools - Content] Message #${messagesSent} sent to background successfully (callback)`);
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          console.error(`[ERROR][RxJS DevTools - Content] Exception when sending message #${messagesSent}:`, error);
        }
      } else {
        console.error('[ERROR][RxJS DevTools - Content] Chrome runtime not available or sendMessage missing');
        console.error('[ERROR][RxJS DevTools - Content] Chrome object:', typeof chrome);
        console.error('[ERROR][RxJS DevTools - Content] Chrome.runtime object:', typeof chrome?.runtime);
      }
    }
  }
});
