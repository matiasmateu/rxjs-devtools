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

  React.useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.source === 'rxjs-devtools-content' && event.data.type === 'APPS_UPDATE') {
        setApps(event.data.apps || []);
        setLoading(false);
      }
    }
    window.addEventListener('message', handleMessage);
    // Initial loading timeout
    const timeout = setTimeout(() => setLoading(false), 2000);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  if (loading) return <div>Loading RxJS DevTools data...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!apps.length) return <div>No RxJS apps detected.</div>;

  return (
    <div style={{ padding: 16 }}>
      <h1>RxJS DevTools</h1>
      <ul>
        {apps.map((app, idx) => (
          <li key={idx} style={{ marginBottom: 8 }}>
            <strong>{app.appName}</strong> - {app.connected ? 'Connected' : 'Disconnected'}<br />
            RxJS: {app.detected.rxjs ? 'Yes' : 'No'}, Redux-Observable: {app.detected.reduxObservable ? 'Yes' : 'No'}
          </li>
        ))}
      </ul>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<DevToolsPanel />); 