import * as React from 'react';
import { createRoot } from 'react-dom/client';

interface AppInfo {
  appName: string;
  connected: boolean;
  detected: {
    rxjs: boolean;
    reduxObservable: boolean;
  };
}

const DevToolsPanel = () => {
  const [apps, setApps] = React.useState<AppInfo[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [debugInfo, setDebugInfo] = React.useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = React.useState<string>('Connecting...');
  const [tabInfo, setTabInfo] = React.useState<string>('Unknown');

  React.useEffect(() => {
    console.log('[RxJS DevTools Panel] Initializing panel...');
    setDebugInfo(prev => [...prev, { type: 'init', time: new Date().toLocaleTimeString(), message: 'Panel initializing' }]);
    
    // Get current tab info for debugging
    (chrome as any).devtools.inspectedWindow.eval('window.location.href', (result: any, isException: any) => {
      if (!isException) {
        setTabInfo(`Tab: ${result}, ID: ${(chrome as any).devtools.inspectedWindow.tabId}`);
        setDebugInfo(prev => [...prev, { 
          type: 'tab-info', 
          time: new Date().toLocaleTimeString(), 
          message: `Tab ID: ${(chrome as any).devtools.inspectedWindow.tabId}, URL: ${result}` 
        }]);
      }
    });
    
    // Connect to background script
    console.log('[RxJS DevTools Panel] Connecting to background script...');
    const port = (chrome as any).runtime.connect({ name: 'rxjs-devtools-panel' });
    
    setConnectionStatus('Connected to background');
    setDebugInfo(prev => [...prev, { type: 'connection', time: new Date().toLocaleTimeString(), message: 'Connected to background script' }]);
    
    // Listen for messages from background script
    port.onMessage.addListener((message: any) => {
      console.log('[RxJS DevTools Panel] Received message:', message);
      const debugEntry = { 
        type: 'message', 
        time: new Date().toLocaleTimeString(), 
        message: `Received: ${JSON.stringify(message)}` 
      };
      setDebugInfo(prev => [...prev.slice(-19), debugEntry]); // Keep last 20 messages
      
      if (message.source === 'rxjs-devtools-content' && message.type === 'APPS_UPDATE') {
        console.log('[RxJS DevTools Panel] Processing APPS_UPDATE:', message.apps);
        setApps(message.apps || []);
        setLoading(false);
        setConnectionStatus(`Found ${message.apps?.length || 0} apps`);
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('[RxJS DevTools Panel] Disconnected from background script');
      setConnectionStatus('Disconnected');
      setDebugInfo(prev => [...prev, { type: 'disconnection', time: new Date().toLocaleTimeString(), message: 'Disconnected from background script' }]);
      
      // Check for errors
      if ((chrome as any).runtime.lastError) {
        const errorMsg = `Disconnect error: ${(chrome as any).runtime.lastError.message}`;
        console.error('[RxJS DevTools Panel] Disconnect error:', (chrome as any).runtime.lastError);
        setDebugInfo(prev => [...prev, { type: 'error', time: new Date().toLocaleTimeString(), message: errorMsg }]);
      }
    });

    // Initial loading timeout
    const timeout = setTimeout(() => {
      setLoading(false);
      if (apps.length === 0) {
        setConnectionStatus('Timeout - no apps found');
      }
    }, 5000);

    return () => {
      port.disconnect();
      clearTimeout(timeout);
    };
  }, []);

  const renderDebugInfo = () => (
    <div style={{ maxHeight: '200px', overflow: 'auto', marginTop: 8 }}>
      {debugInfo.map((info, idx) => (
        <div key={idx} style={{ 
          margin: '2px 0', 
          padding: '2px 4px', 
          backgroundColor: info.type === 'error' ? '#ffebee' : '#f5f5f5', 
          fontSize: '11px' 
        }}>
          <span style={{ color: '#888' }}>[{info.time}]</span> 
          <span style={{ 
            color: info.type === 'message' ? '#007acc' : 
                   info.type === 'error' ? '#d32f2f' : '#666', 
            marginLeft: '4px' 
          }}>
            {info.message}
          </span>
        </div>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div style={{ padding: 16, fontFamily: 'Arial, sans-serif' }}>
        <div>Loading RxJS DevTools data...</div>
        <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
          <strong>Status:</strong> {connectionStatus}
        </div>
        <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
          <strong>Tab:</strong> {tabInfo}
        </div>
        <div style={{ marginTop: 16, fontSize: '12px', color: '#666' }}>
          <strong>Debug info:</strong>
          {debugInfo.length === 0 ? ' No messages received yet.' : ''}
          {renderDebugInfo()}
        </div>
      </div>
    );
  }

  if (error) return <div style={{ color: 'red', padding: 16 }}>{error}</div>;
  
  if (!apps.length) {
    return (
      <div style={{ padding: 16, fontFamily: 'Arial, sans-serif' }}>
        <div>No RxJS apps detected.</div>
        <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
          <strong>Status:</strong> {connectionStatus}
        </div>
        <div style={{ marginTop: 4, fontSize: '12px', color: '#666' }}>
          <strong>Tab:</strong> {tabInfo}
        </div>
        <div style={{ marginTop: 16, fontSize: '12px', color: '#666' }}>
          <strong>Debug info:</strong>
          {debugInfo.length === 0 ? ' No messages received yet.' : ''}
          {renderDebugInfo()}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, fontFamily: 'Arial, sans-serif' }}>
      <h1>RxJS DevTools</h1>
      <div style={{ marginBottom: 16, fontSize: '12px', color: '#666' }}>
        <strong>Status:</strong> {connectionStatus}
      </div>
      <div style={{ marginBottom: 16, fontSize: '12px', color: '#666' }}>
        <strong>Tab:</strong> {tabInfo}
      </div>
      <ul>
        {apps.map((app, idx) => (
          <li key={idx} style={{ marginBottom: 8 }}>
            <strong>{app.appName}</strong> - {app.connected ? 'Connected' : 'Disconnected'}<br />
            RxJS: {app.detected.rxjs ? 'Yes' : 'No'}, Redux-Observable: {app.detected.reduxObservable ? 'Yes' : 'No'}
          </li>
        ))}
      </ul>
      <div style={{ marginTop: 16, fontSize: '12px', color: '#666' }}>
        <strong>Recent messages:</strong>
        {renderDebugInfo()}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<DevToolsPanel />); 