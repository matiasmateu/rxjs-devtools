console.log('[INFO][RxJS DevTools - Background] Background script starting...');

// Store connections to devtools panels
const devtoolsConnections: { [tabId: string]: any } = {};
// Store pending messages for tabs that don't have devtools open yet
const pendingMessages: { [tabId: string]: any[] } = {};

// Debug counters
let messagesReceived = 0;
let messagesRelayed = 0;
let messagesPending = 0;

// Listen for connections from devtools panels
chrome.runtime.onConnect.addListener((port: any) => {
  console.log('[DEBUG][RxJS DevTools - Background] Connection attempt with name:', port.name);
  
  if (port.name === 'rxjs-devtools-panel') {
    // DevTools panels will send their tab ID in the first message
    console.log('[DEBUG][RxJS DevTools - Background] DevTools panel connecting, waiting for tab ID...');
    
    // Listen for the initial connection message with tab ID
    port.onMessage.addListener((message: any) => {
      console.log('[INFO][RxJS DevTools - Background] Received message from panel:', message);
      
      if (message.source === 'rxjs-devtools-panel' && message.type === 'PANEL_CONNECT') {
        const tabId = message.tabId;
        console.log('[DEBUG][RxJS DevTools - Background] DevTools panel connecting for tab:', tabId);
        
        if (tabId) {
          devtoolsConnections[tabId] = port;
          console.log(`[INFO][RxJS DevTools - Background] DevTools panel connected for tab ${tabId}`);
          
          // Send any pending messages
          const pending = pendingMessages[tabId];
          if (pending && pending.length > 0) {
            console.log(`[INFO][RxJS DevTools - Background] Sending ${pending.length} pending messages to panel for tab ${tabId}`);
            pending.forEach((message, index) => {
              console.log(`[DEBUG][RxJS DevTools - Background] Sending pending message ${index + 1}:`, message);
              port.postMessage(message);
              messagesRelayed++;
            });
            delete pendingMessages[tabId];
          } else {
            console.log(`[DEBUG][RxJS DevTools - Background] No pending messages for tab ${tabId}`);
          }
          
          port.onDisconnect.addListener(() => {
            delete devtoolsConnections[tabId];
            console.log(`[INFO][RxJS DevTools - Background] DevTools panel disconnected for tab ${tabId}`);
          });
          
          // Send confirmation back to panel
          port.postMessage({
            source: 'rxjs-devtools-background',
            type: 'PANEL_CONNECTED',
            tabId: tabId
          });
        } else {
          console.error('[ERROR][RxJS DevTools - Background] No tab ID provided in panel connect message');
        }
      }
      
      if (message.source === 'rxjs-devtools-panel' && message.type === 'TRIGGER_DETECTION') {
        const tabId = message.tabId;
        console.log(`[INFO][RxJS DevTools - Background] Triggering detection for tab ${tabId}`);
        
        // Inject script to trigger detection
        chrome.tabs.executeScript(tabId, {
          code: `
            console.log('[RxJS DevTools - Background] Manual detection triggered via background script');
            
            // Trigger detection in the page
            if (window.__RXJS_DEVTOOLS_HOOK__) {
              const event = new CustomEvent('rxjs-devtools-manual-detection');
              window.dispatchEvent(event);
              console.log('[RxJS DevTools - Background] Dispatched manual detection event');
            }
            
            // Force update from stream tracker
            if (window.__RXJS_STREAMS_TRACKER__) {
              window.__RXJS_STREAMS_TRACKER__.sendUpdate();
              console.log('[RxJS DevTools - Background] Forced stream tracker update');
            }
            
            // Also trigger a bridge update
            if (window.__RXJS_DEVTOOLS_BRIDGE_SEND_UPDATE__) {
              window.__RXJS_DEVTOOLS_BRIDGE_SEND_UPDATE__();
              console.log('[RxJS DevTools - Background] Triggered bridge update');
            }
          `
        }, (result: any) => {
          if (chrome.runtime.lastError) {
            console.error('[ERROR][RxJS DevTools - Background] Failed to inject detection script:', chrome.runtime.lastError);
          } else {
            console.log('[INFO][RxJS DevTools - Background] Detection script injected successfully');
          }
        });
      }
    });
  } else {
    console.log('[DEBUG][RxJS DevTools - Background] Ignoring connection with name:', port.name);
  }
});

// Listen for messages from content scripts AND devtools panels
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  messagesReceived++;
  console.log(`[INFO][RxJS DevTools - Background] Received message #${messagesReceived}:`, message, 'from:', sender.tab?.id ? `tab ${sender.tab.id}` : 'devtools');
  
  const tabId = sender.tab?.id;
  
  // Handle messages from content scripts
  if (message.source === 'rxjs-devtools-content' && message.type === 'APPS_UPDATE') {
    if (!tabId) {
      console.error('[ERROR][RxJS DevTools - Background] No tab ID in sender for APPS_UPDATE');
      sendResponse({ error: 'No tab ID' });
      return;
    }
    console.log(`[DEBUG][RxJS DevTools - Background] Processing APPS_UPDATE for tab ${tabId}`);
    const devtoolsPort = devtoolsConnections[tabId];
    
    if (devtoolsPort) {
      // Relay message to devtools panel
      messagesRelayed++;
      console.log(`[INFO][RxJS DevTools - Background] Relaying message #${messagesRelayed} to devtools panel for tab ${tabId}`);
      console.log(`[DEBUG][RxJS DevTools - Background] Message being relayed:`, message);
      
      try {
        devtoolsPort.postMessage(message);
        console.log(`[DEBUG][RxJS DevTools - Background] Message relayed successfully`);
        sendResponse({ success: true, relayed: true });
      } catch (error) {
        console.error(`[ERROR][RxJS DevTools - Background] Failed to relay message:`, error);
        sendResponse({ error: 'Failed to relay message' });
      }
    } else {
      messagesPending++;
      console.log(`[INFO][RxJS DevTools - Background] No devtools panel connected for tab ${tabId}, storing message #${messagesPending}`);
      
      // Store message for when devtools panel connects
      if (!pendingMessages[tabId]) {
        pendingMessages[tabId] = [];
      }
      const pending = pendingMessages[tabId];
      pending.push(message);
      console.log(`[DEBUG][RxJS DevTools - Background] Stored message. Total pending for tab ${tabId}: ${pending.length}`);
      
      // Keep only the last 10 messages to avoid memory issues
      if (pending.length > 10) {
        pending.shift();
        console.log(`[DEBUG][RxJS DevTools - Background] Removed oldest pending message to keep limit`);
      }
      
      sendResponse({ success: true, pending: true });
    }
    
    // Debug summary
    const connectionCount = Object.keys(devtoolsConnections).length;
    console.log(`[DEBUG][RxJS DevTools - Background] Stats - Received: ${messagesReceived}, Relayed: ${messagesRelayed}, Pending: ${messagesPending}, Active connections: ${connectionCount}`);
    console.log(`[DEBUG][RxJS DevTools - Background] Available tab connections:`, Object.keys(devtoolsConnections));
  } else {
    console.log(`[DEBUG][RxJS DevTools - Background] Ignoring message with source: ${message.source}, type: ${message.type}`);
    sendResponse({ ignored: true });
  }
  
  return true; // Keep message channel open for async response
});



// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId: any) => {
  const hadPending = !!pendingMessages[tabId];
  const hadConnection = !!devtoolsConnections[tabId];
  
  delete pendingMessages[tabId];
  delete devtoolsConnections[tabId];
  
  console.log(`[INFO][RxJS DevTools - Background] Cleaned up data for closed tab ${tabId}. Had pending: ${hadPending}, had connection: ${hadConnection}`);
});

console.log('[INFO][RxJS DevTools - Background] Background script initialized');
