import * as React from 'react';
import { createRoot } from 'react-dom/client';

interface StreamInfo {
  id: string;
  name: string;
  operator: string;
  status: 'active' | 'completed' | 'error';
  subscriptionCount: number;
  lastValue?: any;
  lastEmission?: number;
  createdAt: number;
  stack?: string;
}

interface AppInfo {
  appName: string;
  connected: boolean;
  detected: {
    rxjs: boolean;
    reduxObservable: boolean;
  };
  streams?: StreamInfo[];
}

const DevToolsPanel = () => {
  const [apps, setApps] = React.useState<AppInfo[]>([]);
  const [selectedStream, setSelectedStream] = React.useState<StreamInfo | null>(null);
  const [selectedApp, setSelectedApp] = React.useState<string | null>(null);
  const [viewMode, setViewMode] = React.useState<'list' | 'tree'>('list');
  const [filter, setFilter] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'completed' | 'error'>('all');
  const [connectionStatus, setConnectionStatus] = React.useState<string>('Connecting...');

  React.useEffect(() => {
    console.log('[RxJS DevTools Panel] Initializing panel...');
    
    // Connect to background script
    const port = (chrome as any).runtime.connect({ name: 'rxjs-devtools-panel' });
    
    setConnectionStatus('Connected to background');
    
    // Listen for messages from background script
    port.onMessage.addListener((message: any) => {
      console.log('[RxJS DevTools Panel] Received message:', message);
      
      if (message.source === 'rxjs-devtools-content' && message.type === 'APPS_UPDATE') {
        setApps(message.apps || []);
        setConnectionStatus(`Found ${message.apps?.length || 0} apps`);
        
        // Auto-select the first app if none selected
        if (!selectedApp && message.apps?.length > 0) {
          setSelectedApp(message.apps[0].appName);
        }
      }
    });

    port.onDisconnect.addListener(() => {
      setConnectionStatus('Disconnected');
    });

    return () => {
      port.disconnect();
    };
  }, [selectedApp]);

  const currentApp = apps.find(app => app.appName === selectedApp);
  const streams = currentApp?.streams || [];
  
  const filteredStreams = streams.filter(stream => {
    const matchesText = stream.name.toLowerCase().includes(filter.toLowerCase()) ||
                       stream.operator.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || stream.status === statusFilter;
    return matchesText && matchesStatus;
  });

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'completed': return '#6b7280';
      case 'error': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string): string => {
    switch (status) {
      case 'active': return '●';
      case 'completed': return '✓';
      case 'error': return '✗';
      default: return '◯';
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  if (!apps.length) {
    return (
      <div style={{ 
        padding: 16, 
        fontFamily: 'system-ui, -apple-system, sans-serif', 
        backgroundColor: '#1f2937',
        color: '#f9fafb',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: 24, marginBottom: 16, color: '#9ca3af' }}>🔍</div>
        <div style={{ fontSize: 18, marginBottom: 8 }}>No RxJS apps detected</div>
        <div style={{ fontSize: 14, color: '#6b7280' }}>
          Make sure your app uses @reefmix/rxjs-devtools-react
        </div>
        <div style={{ marginTop: 16, fontSize: 12, color: '#6b7280' }}>
          <strong>Status:</strong> {connectionStatus}
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#111827',
      color: '#f9fafb'
    }}>
      {/* Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 48,
        backgroundColor: '#1f2937',
        borderBottom: '1px solid #374151',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 16,
        paddingRight: 16,
        zIndex: 100
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginRight: 16 }}>
          📡 RxJS DevTools
        </div>
        
        {apps.length > 1 && (
          <select
            value={selectedApp || ''}
            onChange={(e) => setSelectedApp(e.target.value)}
            style={{
              backgroundColor: '#374151',
              border: '1px solid #4b5563',
              borderRadius: 4,
              color: '#f9fafb',
              padding: '4px 8px',
              marginRight: 16
            }}
          >
            {apps.map(app => (
              <option key={app.appName} value={app.appName}>
                {app.appName}
              </option>
            ))}
          </select>
        )}
        
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
          {streams.length} streams • {connectionStatus}
        </div>
      </div>

      {/* Sidebar - Stream List */}
      <div style={{ 
        width: 400, 
        backgroundColor: '#1f2937',
        borderRight: '1px solid #374151',
        marginTop: 48,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Filters */}
        <div style={{ padding: 12, borderBottom: '1px solid #374151' }}>
          <input
            type="text"
            placeholder="Filter streams..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#374151',
              border: '1px solid #4b5563',
              borderRadius: 4,
              color: '#f9fafb',
              padding: '8px 12px',
              fontSize: 14,
              marginBottom: 8
            }}
          />
          
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'active', 'completed', 'error'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                style={{
                  backgroundColor: statusFilter === status ? '#3b82f6' : '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: 4,
                  color: '#f9fafb',
                  padding: '4px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Stream List */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filteredStreams.map((stream) => (
            <div
              key={stream.id}
              onClick={() => setSelectedStream(stream)}
              style={{
                padding: 12,
                borderBottom: '1px solid #374151',
                cursor: 'pointer',
                backgroundColor: selectedStream?.id === stream.id ? '#374151' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ 
                color: getStatusColor(stream.status),
                fontSize: 16,
                minWidth: 16
              }}>
                {getStatusIcon(stream.status)}
              </span>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ 
                  fontSize: 14, 
                  fontWeight: 500,
                  color: '#f9fafb',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {stream.name}
                </div>
                
                <div style={{ 
                  fontSize: 12, 
                  color: '#9ca3af',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{stream.operator}</span>
                  <span>
                    {stream.subscriptionCount > 0 && `${stream.subscriptionCount} sub${stream.subscriptionCount > 1 ? 's' : ''}`}
                  </span>
                </div>
                
                {stream.lastEmission && (
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    Last: {formatTimeAgo(stream.lastEmission)}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {filteredStreams.length === 0 && (
            <div style={{ 
              padding: 24, 
              textAlign: 'center', 
              color: '#6b7280',
              fontSize: 14
            }}>
              {filter || statusFilter !== 'all' ? 'No streams match the filter' : 'No streams detected'}
            </div>
          )}
        </div>
      </div>

      {/* Main Content - Stream Details */}
      <div style={{ 
        flex: 1, 
        backgroundColor: '#111827',
        marginTop: 48,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {selectedStream ? (
          <>
            {/* Stream Header */}
            <div style={{ 
              padding: 16, 
              borderBottom: '1px solid #374151',
              backgroundColor: '#1f2937'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ 
                  color: getStatusColor(selectedStream.status),
                  fontSize: 20
                }}>
                  {getStatusIcon(selectedStream.status)}
                </span>
                <h2 style={{ 
                  fontSize: 20, 
                  fontWeight: 600, 
                  margin: 0,
                  color: '#f9fafb'
                }}>
                  {selectedStream.name}
                </h2>
                <span style={{
                  backgroundColor: '#374151',
                  color: '#9ca3af',
                  padding: '2px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontFamily: 'monospace'
                }}>
                  {selectedStream.operator}
                </span>
              </div>
              
              <div style={{ 
                display: 'flex', 
                gap: 16, 
                fontSize: 12, 
                color: '#9ca3af' 
              }}>
                <span>Created: {new Date(selectedStream.createdAt).toLocaleTimeString()}</span>
                <span>Subscriptions: {selectedStream.subscriptionCount}</span>
                <span>Status: {selectedStream.status}</span>
                {selectedStream.lastEmission && (
                  <span>Last Emission: {formatTimeAgo(selectedStream.lastEmission)}</span>
                )}
              </div>
            </div>

            {/* Stream Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
              {/* Last Value */}
              {selectedStream.lastValue !== undefined && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#f9fafb',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Last Emitted Value
                  </h3>
                  <div style={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 6,
                    padding: 12
                  }}>
                    <pre style={{ 
                      fontSize: 13, 
                      fontFamily: 'Consolas, Monaco, monospace',
                      color: '#22c55e',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordWrap: 'break-word'
                    }}>
                      {formatValue(selectedStream.lastValue)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {selectedStream.stack && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ 
                    fontSize: 14, 
                    fontWeight: 600, 
                    color: '#f9fafb',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Creation Stack Trace
                  </h3>
                  <div style={{
                    backgroundColor: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 6,
                    padding: 12
                  }}>
                    <pre style={{ 
                      fontSize: 11, 
                      fontFamily: 'Consolas, Monaco, monospace',
                      color: '#9ca3af',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.4
                    }}>
                      {selectedStream.stack}
                    </pre>
                  </div>
                </div>
              )}

              {/* Stream Info */}
              <div>
                <h3 style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: '#f9fafb',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Stream Information
                </h3>
                <div style={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: 6,
                  padding: 12
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Stream ID</div>
                      <div style={{ fontSize: 13, fontFamily: 'monospace', color: '#f9fafb' }}>
                        {selectedStream.id}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Operator</div>
                      <div style={{ fontSize: 13, color: '#f9fafb' }}>
                        {selectedStream.operator}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Status</div>
                      <div style={{ 
                        fontSize: 13, 
                        color: getStatusColor(selectedStream.status),
                        fontWeight: 500
                      }}>
                        {selectedStream.status}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>Subscriptions</div>
                      <div style={{ fontSize: 13, color: '#f9fafb' }}>
                        {selectedStream.subscriptionCount}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'column',
            color: '#6b7280'
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div style={{ fontSize: 16 }}>Select a stream to view details</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>
              Choose from {filteredStreams.length} available streams
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<DevToolsPanel />); 