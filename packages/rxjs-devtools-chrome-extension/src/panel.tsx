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

// Loading spinner component
const LoadingSpinner = () => (
  <div style={{ 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center',
    padding: '20px',
    color: '#9ca3af'
  }}>
    <div style={{
      width: '20px',
      height: '20px',
      border: '2px solid #4b5563',
      borderTop: '2px solid #60a5fa',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
      marginRight: '8px'
    }}></div>
    <span>Loading streams...</span>
  </div>
);

// Empty state component
const EmptyState = ({ title, subtitle, icon }: { title: string; subtitle: string; icon: string }) => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    color: '#9ca3af',
    textAlign: 'center'
  }}>
    <div style={{ fontSize: '48px', marginBottom: '16px' }}>{icon}</div>
    <h3 style={{ fontSize: '18px', fontWeight: '600', margin: '0 0 8px 0', color: '#f9fafb' }}>{title}</h3>
    <p style={{ fontSize: '14px', margin: '0', maxWidth: '300px', lineHeight: '1.5' }}>{subtitle}</p>
  </div>
);

// Stream card component
const StreamCard = ({ 
  stream, 
  isSelected, 
  onClick 
}: { 
  stream: StreamInfo; 
  isSelected: boolean; 
  onClick: () => void; 
}) => (
  <div
    onClick={onClick}
    style={{
      padding: '12px 16px',
      margin: '4px 8px',
      backgroundColor: isSelected ? '#1e40af' : '#374151',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      border: isSelected ? '1px solid #3b82f6' : '1px solid transparent',
      borderLeft: `4px solid ${stream.status === 'active' ? '#10b981' : stream.status === 'error' ? '#ef4444' : '#6b7280'}`
    }}
    onMouseEnter={(e) => {
      if (!isSelected) {
        e.currentTarget.style.backgroundColor = '#4b5563';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }
    }}
    onMouseLeave={(e) => {
      if (!isSelected) {
        e.currentTarget.style.backgroundColor = '#374151';
        e.currentTarget.style.transform = 'translateY(0)';
      }
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
      <div style={{ 
        width: '8px', 
        height: '8px', 
        borderRadius: '50%', 
        backgroundColor: stream.status === 'active' ? '#10b981' : stream.status === 'error' ? '#ef4444' : '#6b7280',
        marginRight: '8px',
        boxShadow: stream.status === 'active' ? '0 0 4px #10b981' : 'none'
      }}></div>
      <span style={{ 
        fontWeight: '600', 
        fontSize: '14px', 
        color: '#f9fafb',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {stream.name}
      </span>
      {stream.subscriptionCount > 0 && (
        <span style={{
          backgroundColor: '#1f2937',
          color: '#60a5fa',
          padding: '2px 6px',
          borderRadius: '10px',
          fontSize: '11px',
          fontWeight: '600'
        }}>
          {stream.subscriptionCount}
        </span>
      )}
    </div>
    <div style={{
      fontSize: '12px',
      color: '#9ca3af',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }}>
      {stream.operator}
    </div>
  </div>
);

// Stats card component
const StatsCard = ({ title, value, subtitle, color }: { title: string; value: string | number; subtitle?: string; color: string }) => (
  <div style={{
    backgroundColor: '#1f2937',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #374151',
    flex: 1,
    minWidth: '120px'
  }}>
    <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>{title}</div>
    <div style={{ fontSize: '24px', fontWeight: '700', color, marginBottom: '4px' }}>{value}</div>
    {subtitle && <div style={{ fontSize: '11px', color: '#6b7280' }}>{subtitle}</div>}
  </div>
);

const DevToolsPanel = () => {
  const [apps, setApps] = React.useState<AppInfo[]>([]);
  const [selectedStream, setSelectedStream] = React.useState<StreamInfo | null>(null);
  const [selectedApp, setSelectedApp] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'completed' | 'error'>('all');
  const [connectionStatus, setConnectionStatus] = React.useState<string>('Connecting...');
  const [sortBy, setSortBy] = React.useState<'name' | 'created' | 'status' | 'subscriptions'>('name');
  const [isLoading, setIsLoading] = React.useState(true);
  const [isDetecting, setIsDetecting] = React.useState(false);
  const [lastDetectionTime, setLastDetectionTime] = React.useState<Date | null>(null);
  const [portRef, setPortRef] = React.useState<any>(null);

  React.useEffect(() => {
    console.log('[RxJS DevTools Panel] Initializing panel...');
    
    try {
      // Connect to background script
      const port = (chrome as any).runtime.connect({ name: 'rxjs-devtools-panel' });
      console.log('[RxJS DevTools Panel] Port connection created:', port);
      
      // Get the tab ID from the DevTools API
      const tabId = (chrome as any).devtools.inspectedWindow.tabId;
      console.log('[RxJS DevTools Panel] Current tab ID:', tabId);
      
      // Small delay to ensure port is fully established
      setTimeout(() => {
        setPortRef(port);
        setConnectionStatus('Connected to background');
        console.log('[RxJS DevTools Panel] Port connection established');
        
        // Send initial connection message with tab ID
        port.postMessage({
          source: 'rxjs-devtools-panel',
          type: 'PANEL_CONNECT',
          tabId: tabId
        });
        console.log('[RxJS DevTools Panel] Sent PANEL_CONNECT message with tab ID:', tabId);
      }, 100);
      
      // Listen for messages from background script
      port.onMessage.addListener((message: any) => {
        console.log('[RxJS DevTools Panel] Received message:', message);
        
        if (message.source === 'rxjs-devtools-background' && message.type === 'PANEL_CONNECTED') {
          console.log('[RxJS DevTools Panel] Panel connection confirmed for tab:', message.tabId);
          setConnectionStatus('Connected to tab ' + message.tabId);
        }
        
        if (message.source === 'rxjs-devtools-content' && message.type === 'APPS_UPDATE') {
          console.log('[RxJS DevTools Panel] Processing APPS_UPDATE with', message.apps?.length || 0, 'apps');
          setApps(message.apps || []);
          setConnectionStatus(`Found ${message.apps?.length || 0} apps`);
          setIsLoading(false);
          setIsDetecting(false);
          setLastDetectionTime(new Date());
          
          // Auto-select the first app if none selected
          if (!selectedApp && message.apps?.length > 0) {
            setSelectedApp(message.apps[0].appName);
            console.log('[RxJS DevTools Panel] Auto-selected app:', message.apps[0].appName);
          }
        }
      });

      port.onDisconnect.addListener(() => {
        console.log('[RxJS DevTools Panel] Port disconnected');
        setConnectionStatus('Disconnected');
        setIsLoading(false);
        setIsDetecting(false);
        setPortRef(null);
      });

      // Set loading timeout
      const timeout = setTimeout(() => {
        console.log('[RxJS DevTools Panel] Loading timeout reached');
        setIsLoading(false);
      }, 3000);

      return () => {
        console.log('[RxJS DevTools Panel] Cleaning up connection');
        port.disconnect();
        clearTimeout(timeout);
      };
    } catch (error) {
      console.error('[RxJS DevTools Panel] Failed to connect to background:', error);
      setConnectionStatus('Connection failed');
      setIsLoading(false);
    }
  }, [selectedApp]);

  const currentApp = apps.find(app => app.appName === selectedApp);
  const streams = currentApp?.streams || [];
  
  const filteredStreams = streams.filter(stream => {
    const matchesText = stream.name.toLowerCase().includes(filter.toLowerCase()) ||
                       stream.operator.toLowerCase().includes(filter.toLowerCase());
    const matchesStatus = statusFilter === 'all' || stream.status === statusFilter;
    return matchesText && matchesStatus;
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name);
      case 'created': return b.createdAt - a.createdAt;
      case 'status': return a.status.localeCompare(b.status);
      case 'subscriptions': return b.subscriptionCount - a.subscriptionCount;
      default: return 0;
    }
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

  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 1000) return 'just now';
    if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    return `${Math.floor(diff / 3600000)}h ago`;
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return '#10b981';
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

  const getStreamStats = () => {
    const totalStreams = streams.length;
    const activeStreams = streams.filter(s => s.status === 'active').length;
    const completedStreams = streams.filter(s => s.status === 'completed').length;
    const errorStreams = streams.filter(s => s.status === 'error').length;
    const totalSubscriptions = streams.reduce((sum, s) => sum + s.subscriptionCount, 0);
    
    return { totalStreams, activeStreams, completedStreams, errorStreams, totalSubscriptions };
  };

  const stats = getStreamStats();

  // Manual detection function
  const triggerDetection = async () => {
    console.log('[RxJS DevTools Panel] triggerDetection called, portRef:', !!portRef);
    
    if (!portRef) {
      console.warn('[RxJS DevTools Panel] No port connection available');
      setConnectionStatus('No connection to background script');
      return;
    }

    setIsDetecting(true);
    setConnectionStatus('Scanning for RxJS apps...');
    console.log('[RxJS DevTools Panel] Starting detection scan...');
    
    try {
      // Get the tab ID from the DevTools API
      const tabId = (chrome as any).devtools.inspectedWindow.tabId;
      console.log('[RxJS DevTools Panel] Current tab ID for detection:', tabId);
      
      // Send message to background script to trigger detection
      console.log('[RxJS DevTools Panel] Sending TRIGGER_DETECTION message to background');
      portRef.postMessage({
        source: 'rxjs-devtools-panel',
        type: 'TRIGGER_DETECTION',
        tabId: tabId,
        timestamp: Date.now()
      });

      // Also try to inject detection script directly into the inspected tab
      try {
        console.log('[RxJS DevTools Panel] Injecting detection script into tab:', tabId);
        // Inject a script to trigger detection directly using DevTools API
        await (chrome as any).devtools.inspectedWindow.eval(`
          console.log('[RxJS DevTools Panel] Manual detection triggered via DevTools injection');
          
          // Try to trigger app detection
          if (window.__RXJS_DEVTOOLS_HOOK__) {
            console.log('[RxJS DevTools Panel] Found hook, dispatching event');
            const event = new CustomEvent('rxjs-devtools-manual-detection');
            window.dispatchEvent(event);
          } else {
            console.log('[RxJS DevTools Panel] No hook found');
          }
          
          // Also try to manually check for streams
          if (window.__RXJS_STREAMS_TRACKER__) {
            console.log('[RxJS DevTools Panel] Found stream tracker, forcing update');
            window.__RXJS_STREAMS_TRACKER__.sendUpdate();
          } else {
            console.log('[RxJS DevTools Panel] No stream tracker found');
          }
        `);
        console.log('[RxJS DevTools Panel] Detection script injected successfully');
      } catch (tabError) {
        console.warn('[RxJS DevTools Panel] Failed to inject script directly:', tabError);
      }
    } catch (error) {
      console.error('[RxJS DevTools Panel] Detection failed:', error);
      setConnectionStatus('Detection failed: ' + String(error));
    }

    // Set timeout for detection
    setTimeout(() => {
      console.log('[RxJS DevTools Panel] Detection timeout reached');
      setIsDetecting(false);
      if (apps.length === 0) {
        setConnectionStatus('No apps detected after scan');
      }
    }, 3000);
  };

  // Loading state
  if (isLoading) {
    return (
      <div style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif', 
        backgroundColor: '#111827',
        color: '#f9fafb',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  // No apps state
  if (!apps.length) {
    return (
      <div style={{ 
        fontFamily: 'system-ui, -apple-system, sans-serif', 
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '40px'
      }}>
        <div style={{ 
          textAlign: 'center',
          maxWidth: '600px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '40px',
          border: '1px solid #334155',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🔍</div>
          <h2 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '24px', 
            fontWeight: '700',
            color: '#f8fafc'
          }}>
            No RxJS apps detected
          </h2>
          <p style={{ 
            fontSize: '16px', 
            color: '#94a3b8', 
            marginBottom: '32px',
            lineHeight: '1.6'
          }}>
            Make sure your app uses <code style={{ 
              backgroundColor: '#334155', 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>@reefmix/rxjs-devtools-react</code> and has called{' '}
            <code style={{ 
              backgroundColor: '#334155', 
              padding: '2px 6px', 
              borderRadius: '4px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>initializeRxjsDevtools()</code>
          </p>
          
          <div style={{ marginBottom: '24px' }}>
            <button
              onClick={triggerDetection}
              disabled={isDetecting}
              style={{
                backgroundColor: isDetecting ? '#374151' : '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isDetecting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto',
                transition: 'background-color 0.2s',
                opacity: isDetecting ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isDetecting) {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDetecting) {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                }
              }}
            >
              {isDetecting ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #ffffff',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Scanning...
                </>
              ) : (
                <>
                  🔄 Scan for Apps
                </>
              )}
            </button>
          </div>

          <div style={{ fontSize: '14px', color: '#94a3b8' }}>
            <strong>Troubleshooting:</strong>
            <ul style={{ textAlign: 'left', marginTop: '8px', paddingLeft: '20px' }}>
              <li>Refresh the page after installing the extension</li>
              <li>Check that the app is calling <code style={{ backgroundColor: '#334155', padding: '1px 4px', borderRadius: '3px', fontSize: '12px' }}>initializeRxjsDevtools()</code></li>
              <li>Open browser console to see RxJS DevTools logs</li>
              <li>Make sure you're on the correct tab with your app</li>
            </ul>
          </div>
        </div>
        
        <div style={{ 
          position: 'absolute', 
          bottom: '20px', 
          right: '20px', 
          fontSize: '12px', 
          color: '#94a3b8',
          backgroundColor: '#1e293b',
          padding: '12px 16px',
          borderRadius: '8px',
          border: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div><strong>Status:</strong> {connectionStatus}</div>
          {lastDetectionTime && (
            <div><strong>Last scan:</strong> {lastDetectionTime.toLocaleTimeString()}</div>
          )}
          <div><strong>Extension:</strong> Connected</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#0f172a',
      color: '#f8fafc'
    }}>
      {/* Header with Stats Dashboard */}
      <div style={{
        backgroundColor: '#1e293b',
        borderBottom: '1px solid #334155',
        padding: '20px 24px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '24px' }}>📡</div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>RxJS DevTools</div>
                <div style={{ fontSize: '13px', color: '#94a3b8' }}>{connectionStatus}</div>
              </div>
            </div>
            
            {apps.length > 1 && (
              <select
                value={selectedApp || ''}
                onChange={(e) => setSelectedApp(e.target.value)}
                style={{
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {apps.map(app => (
                  <option key={app.appName} value={app.appName}>
                    {app.appName}
                  </option>
                ))}
              </select>
            )}
            
            <button
              onClick={triggerDetection}
              disabled={isDetecting}
              style={{
                backgroundColor: isDetecting ? '#374151' : '#475569',
                color: '#f8fafc',
                border: '1px solid #64748b',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: isDetecting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background-color 0.2s',
                opacity: isDetecting ? 0.7 : 1
              }}
              onMouseEnter={(e) => {
                if (!isDetecting) {
                  e.currentTarget.style.backgroundColor = '#64748b';
                }
              }}
              onMouseLeave={(e) => {
                if (!isDetecting) {
                  e.currentTarget.style.backgroundColor = '#475569';
                }
              }}
              title="Refresh and scan for RxJS apps"
            >
              {isDetecting ? (
                <>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    border: '2px solid #f8fafc',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  Scanning...
                </>
              ) : (
                <>
                  🔄 Refresh
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <StatsCard title="Total Streams" value={stats.totalStreams} color="#f8fafc" />
                     <StatsCard title="Active" value={stats.activeStreams} color="#22c55e" subtitle={stats.totalStreams > 0 ? `${Math.round((stats.activeStreams / stats.totalStreams) * 100)}%` : '0%'} />
          <StatsCard title="Completed" value={stats.completedStreams} color="#94a3b8" />
          <StatsCard title="Errors" value={stats.errorStreams} color="#ef4444" />
          <StatsCard title="Total Subscriptions" value={stats.totalSubscriptions} color="#3b82f6" />
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Enhanced Sidebar */}
        <div style={{ 
          width: '440px', 
          backgroundColor: '#1e293b',
          borderRight: '1px solid #334155',
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Enhanced Search and Filters */}
          <div style={{ padding: '20px', borderBottom: '1px solid #334155' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="🔍 Search streams by name or operator..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                style={{
                  width: '100%',
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  padding: '12px 16px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#475569'}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                style={{
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '13px',
                  flex: 1,
                  outline: 'none'
                }}
              >
                <option value="all">All Status ({stats.totalStreams})</option>
                <option value="active">🟢 Active ({stats.activeStreams})</option>
                <option value="completed">✅ Completed ({stats.completedStreams})</option>
                <option value="error">❌ Error ({stats.errorStreams})</option>
              </select>
              
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                style={{
                  backgroundColor: '#334155',
                  border: '1px solid #475569',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  padding: '8px 12px',
                  fontSize: '13px',
                  flex: 1,
                  outline: 'none'
                }}
              >
                <option value="name">Sort by Name</option>
                <option value="created">Sort by Created</option>
                <option value="status">Sort by Status</option>
                <option value="subscriptions">Sort by Subscriptions</option>
              </select>
            </div>
            
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Showing {filteredStreams.length} of {streams.length} streams
            </div>
          </div>

          {/* Stream List with Modern Cards */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
            {filteredStreams.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <EmptyState 
                  title="No streams found"
                  subtitle={streams.length === 0 ? "No streams detected in this app" : "Try adjusting your search or filter criteria"}
                  icon={streams.length === 0 ? "📭" : "🔍"}
                />
              </div>
            ) : (
              filteredStreams.map(stream => (
                <StreamCard
                  key={stream.id}
                  stream={stream}
                  isSelected={selectedStream?.id === stream.id}
                  onClick={() => setSelectedStream(stream)}
                />
              ))
            )}
          </div>
        </div>

        {/* Enhanced Main Content */}
        <div style={{ flex: 1, backgroundColor: '#0f172a', overflow: 'auto' }}>
          {selectedStream ? (
            <div style={{ padding: '32px' }}>
              {/* Stream Header */}
              <div style={{ marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '50%', 
                    backgroundColor: getStatusColor(selectedStream.status),
                    boxShadow: selectedStream.status === 'active' ? `0 0 8px ${getStatusColor(selectedStream.status)}` : 'none',
                    animation: selectedStream.status === 'active' ? 'pulse 2s infinite' : 'none'
                  }}></div>
                  <h1 style={{ 
                    margin: 0, 
                    fontSize: '32px', 
                    fontWeight: '800',
                    color: '#f8fafc',
                    letterSpacing: '-0.025em'
                  }}>
                    {selectedStream.name}
                  </h1>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                  <div style={{ 
                    backgroundColor: '#1e293b',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: getStatusColor(selectedStream.status),
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    border: `1px solid ${getStatusColor(selectedStream.status)}20`
                  }}>
                    {selectedStream.status}
                  </div>
                  
                  <div style={{ color: '#94a3b8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>👥</span>
                    {selectedStream.subscriptionCount} subscription{selectedStream.subscriptionCount !== 1 ? 's' : ''}
                  </div>
                  
                  <div style={{ color: '#94a3b8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>⏰</span>
                    Created {formatTimeAgo(selectedStream.createdAt)}
                  </div>

                  {selectedStream.lastEmission && (
                    <div style={{ color: '#94a3b8', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>📡</span>
                      Last emission {formatTimeAgo(selectedStream.lastEmission)}
                    </div>
                  )}
                </div>
              </div>

              {/* Content Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '32px' }}>
                {/* Stream Information Card */}
                <div style={{ 
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  padding: '24px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '18px', 
                    fontWeight: '600',
                    color: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    ℹ️ Stream Information
                  </h3>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Stream ID</div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: '#f8fafc', 
                        fontFamily: 'monospace', 
                        wordBreak: 'break-all',
                        backgroundColor: '#0f172a',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid #334155'
                      }}>
                        {selectedStream.id}
                      </div>
                    </div>
                    
                    <div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '6px', fontWeight: '500' }}>Operator Chain</div>
                      <div style={{ 
                        fontSize: '14px', 
                        color: '#60a5fa',
                        backgroundColor: '#0f172a',
                        padding: '12px',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        border: '1px solid #1e40af20',
                        lineHeight: '1.5'
                      }}>
                        {selectedStream.operator}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Activity Metrics Card */}
                <div style={{ 
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  padding: '24px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <h3 style={{ 
                    margin: '0 0 20px 0', 
                    fontSize: '18px', 
                    fontWeight: '600',
                    color: '#f8fafc',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    📊 Activity Metrics
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: '#3b82f6', marginBottom: '4px' }}>
                        {selectedStream.subscriptionCount}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Active Subscriptions</div>
                    </div>
                    
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '28px', fontWeight: '700', color: getStatusColor(selectedStream.status), marginBottom: '4px' }}>
                        {getStatusIcon(selectedStream.status)}
                      </div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '500' }}>Current Status</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Last Emitted Value */}
              {selectedStream.lastValue !== undefined && (
                <div style={{ 
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  marginBottom: '24px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ 
                    padding: '20px 24px',
                    borderBottom: '1px solid #334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '18px', 
                      fontWeight: '600',
                      color: '#f8fafc'
                    }}>
                      📤 Last Emitted Value
                    </h3>
                    <div style={{ 
                      backgroundColor: '#22c55e',
                      color: '#ffffff',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      LATEST
                    </div>
                  </div>
                  
                  <div style={{ padding: '24px' }}>
                    <pre style={{ 
                      fontSize: '13px', 
                      color: '#f8fafc',
                      fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
                      backgroundColor: '#0f172a',
                      padding: '20px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      overflow: 'auto',
                      maxHeight: '400px',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: '1.6'
                    }}>
                      {formatValue(selectedStream.lastValue)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Stack Trace */}
              {selectedStream.stack && (
                <div style={{ 
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}>
                  <div style={{ 
                    padding: '20px 24px',
                    borderBottom: '1px solid #334155'
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      fontSize: '18px', 
                      fontWeight: '600',
                      color: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      🔍 Creation Stack Trace
                    </h3>
                  </div>
                  
                  <div style={{ padding: '24px' }}>
                    <pre style={{ 
                      fontSize: '11px', 
                      color: '#94a3b8',
                      fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
                      backgroundColor: '#0f172a',
                      padding: '20px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: '1.6',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}>
                      {selectedStream.stack}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <EmptyState 
                title="Select a stream to explore"
                subtitle={`Choose from ${filteredStreams.length} streams in the sidebar to see detailed information, real-time values, and debugging data`}
                icon="🚀"
              />
            </div>
          )}
        </div>
      </div>
      
      {/* CSS Animations */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<DevToolsPanel />); 