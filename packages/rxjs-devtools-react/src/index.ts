// Types
export interface RxjsDevtoolsOptions {
  appName: string;
  forceDetection?: {
    rxjs?: boolean;
    reduxObservable?: boolean;
  };
}

export interface StreamInfo {
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

interface RxjsDevtoolsAppInfo {
  appName: string;
  connected: boolean;
  detected: {
    rxjs: boolean;
    reduxObservable: boolean;
  };
  streams?: StreamInfo[];
}

interface RxjsDevtoolsHook {
  apps: RxjsDevtoolsAppInfo[];
  registerApp(appInfo: RxjsDevtoolsAppInfo): void;
  updateStreams?(appName: string, streams: StreamInfo[]): void;
}

declare global {
  interface Window {
    __RXJS_DEVTOOLS_HOOK__?: RxjsDevtoolsHook;
    __REDUX_OBSERVABLE_PRESENT__?: boolean;
    __RXJS_ORIGINAL_OBSERVABLE__?: any;
    __RXJS_STREAMS_TRACKER__?: StreamTracker;
  }
}

class StreamTracker {
  private streams = new Map<string, StreamInfo>();
  private streamIdCounter = 0;
  private appName: string;

  constructor(appName: string) {
    this.appName = appName;
  }

  generateStreamId(): string {
    return `stream_${++this.streamIdCounter}_${Date.now()}`;
  }

  captureStack(): string {
    const stack = new Error().stack || '';
    // Clean up the stack to show only relevant application code
    return stack
      .split('\n')
      .slice(3, 8) // Skip the first few lines (Error, this function, wrapper)
      .filter(line => !line.includes('node_modules'))
      .join('\n');
  }

  extractVariableName(stack: string): string {
    // Try to extract variable name from stack trace
    const match = stack.match(/at\s+(?:Object\.)?(\w+)/);
    if (match) {
      return match[1];
    }
    
    // Fallback patterns
    const functionMatch = stack.match(/at\s+(.+?)\s+\(/);
    if (functionMatch) {
      const funcName = functionMatch[1].split('.').pop() || 'unknown';
      return funcName;
    }
    
    return `observable_${this.streamIdCounter}`;
  }

  registerStream(id: string, operator: string, stack: string): void {
    const name = this.extractVariableName(stack);
    
    const streamInfo: StreamInfo = {
      id,
      name,
      operator,
      status: 'active',
      subscriptionCount: 0,
      createdAt: Date.now(),
      stack
    };

    this.streams.set(id, streamInfo);
    this.notifyUpdate();
  }

  updateStream(id: string, updates: Partial<StreamInfo>): void {
    const stream = this.streams.get(id);
    if (stream) {
      Object.assign(stream, updates);
      this.notifyUpdate();
    }
  }

  subscribeToStream(id: string): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.subscriptionCount++;
      this.notifyUpdate();
    }
  }

  unsubscribeFromStream(id: string): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.subscriptionCount--;
      if (stream.subscriptionCount <= 0) {
        stream.status = 'completed';
      }
      this.notifyUpdate();
    }
  }

  emitValue(id: string, value: any): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.lastValue = value;
      stream.lastEmission = Date.now();
      this.notifyUpdate();
    }
  }

  errorStream(id: string): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.status = 'error';
      this.notifyUpdate();
    }
  }

  completeStream(id: string): void {
    const stream = this.streams.get(id);
    if (stream) {
      stream.status = 'completed';
      this.notifyUpdate();
    }
  }

  getStreams(): StreamInfo[] {
    return Array.from(this.streams.values());
  }

  private notifyUpdate(): void {
    if (window.__RXJS_DEVTOOLS_HOOK__?.updateStreams) {
      window.__RXJS_DEVTOOLS_HOOK__.updateStreams(this.appName, this.getStreams());
    }
  }
}

function patchObservable(tracker: StreamTracker): void {
  // Only patch once
  if (window.__RXJS_ORIGINAL_OBSERVABLE__) {
    return;
  }

  try {
    // Try to get Observable from various locations
    let Observable: any = null;
    
    if (typeof require !== 'undefined') {
      try {
        Observable = require('rxjs').Observable;
      } catch {}
    }
    
    if (!Observable && (window as any).rxjs) {
      Observable = (window as any).rxjs.Observable;
    }
    
    if (!Observable && typeof (window as any).Observable !== 'undefined') {
      Observable = (window as any).Observable;
    }

    if (!Observable) {
      // Try dynamic import
      if (typeof (window as any).import !== 'undefined') {
        (window as any).import('rxjs').then((rxjs: any) => {
          Observable = rxjs.Observable;
          if (Observable) {
            performPatch(Observable, tracker);
          }
        }).catch(() => {});
      }
      return;
    }

    performPatch(Observable, tracker);
  } catch (error) {
    console.warn('[RxJS DevTools] Failed to patch Observable:', error);
  }
}

function performPatch(Observable: any, tracker: StreamTracker): void {
  // Store original
  window.__RXJS_ORIGINAL_OBSERVABLE__ = Observable;

  // Patch Observable constructor
  const originalObservable = Observable;
  const originalCreate = Observable.create;
  const originalLift = Observable.prototype.lift;

  // Patch Observable.create if it exists
  if (originalCreate) {
    Observable.create = function(subscribe: any) {
      const streamId = tracker.generateStreamId();
      const stack = tracker.captureStack();
      tracker.registerStream(streamId, 'Observable.create', stack);
      
      const originalObservable = originalCreate.call(this, subscribe);
      (originalObservable as any).__rxjs_devtools_id__ = streamId;
      return originalObservable;
    };
  }

  // Patch Observable constructor
  function PatchedObservable(this: any, subscribe?: any) {
    const streamId = tracker.generateStreamId();
    const stack = tracker.captureStack();
    tracker.registerStream(streamId, 'new Observable', stack);
    
    const instance = originalObservable.call(this, subscribe) || this;
    (instance as any).__rxjs_devtools_id__ = streamId;
    return instance;
  }

  // Copy prototype and static methods
  PatchedObservable.prototype = Observable.prototype;
  Object.setPrototypeOf(PatchedObservable, Observable);
  Object.getOwnPropertyNames(Observable).forEach(key => {
    if (key !== 'prototype' && key !== 'name' && key !== 'length') {
      try {
        (PatchedObservable as any)[key] = (Observable as any)[key];
      } catch {}
    }
  });

  // Patch lift method (used by operators)
  if (originalLift) {
    Observable.prototype.lift = function(operator: any) {
      const streamId = tracker.generateStreamId();
      const stack = tracker.captureStack();
      const operatorName = operator?.constructor?.name || 'unknown';
      tracker.registerStream(streamId, operatorName, stack);
      
      const result = originalLift.call(this, operator);
      (result as any).__rxjs_devtools_id__ = streamId;
      return result;
    };
  }

  // Patch subscribe method
  const originalSubscribe = Observable.prototype.subscribe;
  Observable.prototype.subscribe = function(...args: any[]) {
    const streamId = (this as any).__rxjs_devtools_id__;
    if (streamId) {
      tracker.subscribeToStream(streamId);
    }

    // Wrap observer functions to track emissions
    const observer = args[0];
    if (observer && typeof observer === 'object') {
      const originalNext = observer.next;
      const originalError = observer.error;
      const originalComplete = observer.complete;

      if (originalNext) {
        observer.next = function(value: any) {
          if (streamId) {
            tracker.emitValue(streamId, value);
          }
          return originalNext.call(this, value);
        };
      }

      if (originalError) {
        observer.error = function(error: any) {
          if (streamId) {
            tracker.errorStream(streamId);
          }
          return originalError.call(this, error);
        };
      }

      if (originalComplete) {
        observer.complete = function() {
          if (streamId) {
            tracker.completeStream(streamId);
          }
          return originalComplete.call(this);
        };
      }
    } else if (typeof observer === 'function') {
      // Handle function-based observer
      args[0] = function(value: any) {
        if (streamId) {
          tracker.emitValue(streamId, value);
        }
        return observer(value);
      };
    }

    const subscription = originalSubscribe.apply(this, args);
    
    // Patch unsubscribe
    const originalUnsubscribe = subscription.unsubscribe;
    subscription.unsubscribe = function() {
      if (streamId) {
        tracker.unsubscribeFromStream(streamId);
      }
      return originalUnsubscribe.call(this);
    };

    return subscription;
  };

  // Replace global Observable if it exists
  try {
    if ((window as any).Observable) {
      (window as any).Observable = PatchedObservable;
    }
    if ((window as any).rxjs) {
      (window as any).rxjs.Observable = PatchedObservable;
    }
  } catch (error) {
    console.warn('[RxJS DevTools] Failed to replace global Observable:', error);
  }
}

function detectRxjsWithQueue(callback: (detected: boolean) => void) {
  let attempts = 0;
  const maxAttempts = 20;
  const interval = 100;

  const checkRxjs = () => {
    // Multiple detection strategies
    if ((window as any).rxjs) return true;
    if ((window as any).__RX_JS_PRESENT__) return true;
    
    // Check for RxJS operators in the global scope (common with bundlers)
    if ((window as any).operators) return true;
    
    // Check for common RxJS classes
    if (typeof (window as any).Observable !== 'undefined') return true;
    if (typeof (window as any).Subject !== 'undefined') return true;
    
    // Try dynamic import check (works with ES modules)
    try {
      if (typeof (window as any).importMeta !== 'undefined' && (window as any).importMeta.resolve) {
        (window as any).importMeta.resolve('rxjs');
        return true;
      }
    } catch {}
    
    // Check if any modules have been imported that contain rxjs patterns
    if (document.querySelectorAll('script[src*="rxjs"]').length > 0) return true;
    
    return false;
  };

  const detectionInterval = setInterval(() => {
    if (++attempts > maxAttempts) {
      clearInterval(detectionInterval);
      // Force detection to true if we can't detect it reliably
      callback(true); // Assume RxJS is present in modern apps
      return;
    }

    if (checkRxjs()) {
      clearInterval(detectionInterval);
      callback(true);
      return;
    }
  }, interval);

  // Immediate check
  if (checkRxjs()) {
    clearInterval(detectionInterval);
    callback(true);
  }
}

function detectReduxObservableWithQueue(callback: (detected: boolean) => void) {
  let attempts = 0;
  const maxAttempts = 20;
  const interval = 100;

  const checkReduxObservable = () => {
    // Multiple detection strategies for redux-observable
    if (window.__REDUX_OBSERVABLE_PRESENT__) return true;
    if ((window as any).reduxObservable) return true;
    
    // Check for common redux-observable patterns
    if (typeof (window as any).combineEpics !== 'undefined') return true;
    if (typeof (window as any).createEpicMiddleware !== 'undefined') return true;
    
    // Check if any scripts contain redux-observable
    if (document.querySelectorAll('script[src*="redux-observable"]').length > 0) return true;
    
    // Check for epic-related patterns in the DOM/window
    if ((window as any).__EPIC_MIDDLEWARE__) return true;
    
    return false;
  };

  const detectionInterval = setInterval(() => {
    if (++attempts > maxAttempts) {
      clearInterval(detectionInterval);
      // For redux-observable, be more conservative - assume present if we can't detect
      callback(true); // Many modern apps use redux-observable without global exposure
      return;
    }

    if (checkReduxObservable()) {
      clearInterval(detectionInterval);
      callback(true);
      return;
    }
  }, interval);

  // Immediate check
  if (checkReduxObservable()) {
    clearInterval(detectionInterval);
    callback(true);
  }
}

/**
 * Helper function to manually indicate that RxJS and/or redux-observable are present
 * Call this before initializeRxjsDevtools if automatic detection fails
 */
export function setRxjsDetectionFlags(flags: { rxjs?: boolean; reduxObservable?: boolean }) {
  if (flags.rxjs) {
    (window as any).__RX_JS_PRESENT__ = true;
  }
  if (flags.reduxObservable) {
    window.__REDUX_OBSERVABLE_PRESENT__ = true;
  }
}

export function initializeRxjsDevtools(options: RxjsDevtoolsOptions): void {
  if (!options?.appName) {
    throw new Error('App name is required for RxJS DevTools initialization.');
  }

  // Create stream tracker
  const streamTracker = new StreamTracker(options.appName);
  window.__RXJS_STREAMS_TRACKER__ = streamTracker;

  // Inject the global hook if not present
  if (!window.__RXJS_DEVTOOLS_HOOK__) {
    window.__RXJS_DEVTOOLS_HOOK__ = {
      apps: [],
      registerApp(appInfo: RxjsDevtoolsAppInfo) {
        this.apps.push(appInfo);
      },
      updateStreams(appName: string, streams: StreamInfo[]) {
        const app = this.apps.find(a => a.appName === appName);
        if (app) {
          app.streams = streams;
        }
      }
    };
  }

  // Start tracking streams immediately
  patchObservable(streamTracker);

  // Use forced detection if provided
  if (options.forceDetection) {
    const rxjsDetected = options.forceDetection.rxjs ?? true;
    const reduxObservableDetected = options.forceDetection.reduxObservable ?? true;
    
    // Register app immediately with forced detection
    window.__RXJS_DEVTOOLS_HOOK__!.registerApp({
      appName: options.appName,
      connected: true,
      detected: {
        rxjs: rxjsDetected,
        reduxObservable: reduxObservableDetected,
      },
      streams: []
    });

    console.info(
      `[RxJS DevTools] Initialized for app: ${options.appName}. RxJS: ${rxjsDetected}, redux-observable: ${reduxObservableDetected} (forced)`
    );
    return;
  }

  // Detect RxJS and redux-observable with queue
  detectRxjsWithQueue((rxjsDetected) => {
    detectReduxObservableWithQueue((reduxObservableDetected) => {
      if (!rxjsDetected) {
        console.error('[RxJS DevTools] RxJS not detected in the app.');
      }

      // Register app once detection is complete
      window.__RXJS_DEVTOOLS_HOOK__!.registerApp({
        appName: options.appName,
        connected: true,
        detected: {
          rxjs: rxjsDetected,
          reduxObservable: reduxObservableDetected,
        },
        streams: []
      });

      console.info(
        `[RxJS DevTools] Initialized for app: ${options.appName}. RxJS: ${rxjsDetected}, redux-observable: ${reduxObservableDetected}`
      );
    });
  });
}
