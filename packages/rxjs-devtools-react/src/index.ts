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

  // Strategy 1: Try to find Observable through module detection
  const tryPatchObservable = () => {
    try {
      // Look for Observable in various locations
      let Observable: any = null;

      // Try to find Observable through require (CommonJS)
      if (typeof require !== 'undefined') {
        try {
          const rxjs = require('rxjs');
          Observable = rxjs.Observable;
          console.log('[RxJS DevTools] Found Observable via require');
        } catch {}
      }

      // Try global rxjs object
      if (!Observable && (window as any).rxjs?.Observable) {
        Observable = (window as any).rxjs.Observable;
        console.log('[RxJS DevTools] Found Observable via global rxjs');
      }

      // Try window.Observable
      if (!Observable && (window as any).Observable) {
        Observable = (window as any).Observable;
        console.log('[RxJS DevTools] Found Observable via window.Observable');
      }

      // Strategy 2: Monkey patch by intercepting prototype methods
      // This works even when Observable is imported as ES modules
      if (!Observable) {
        // Try to detect when Observable instances are created by checking for prototype methods
        const originalPrototypeMethods = {
          subscribe: undefined as any,
          pipe: undefined as any,
          lift: undefined as any
        };

        // Set up a global hook to catch Observable instances
        const observableDetectionInterval = setInterval(() => {
          // Look for any object that has Observable-like methods
          try {
            // Check if any element has rxjs properties (webpack/bundler might expose them)
            const scripts = Array.from(document.querySelectorAll('script'));
            for (const script of scripts) {
              if (script.src && script.src.includes('rxjs')) {
                console.log('[RxJS DevTools] Detected RxJS script:', script.src);
              }
            }

            // Try to patch through DOM inspection
            if ((window as any).__webpack_require__) {
              console.log('[RxJS DevTools] Webpack detected, trying module resolution');
              // Webpack detected - try to find rxjs module
            }
          } catch (error) {
            // Silent fail
          }
        }, 100);

        // Stop detection after 5 seconds
        setTimeout(() => {
          clearInterval(observableDetectionInterval);
          if (!window.__RXJS_ORIGINAL_OBSERVABLE__) {
            console.warn('[RxJS DevTools] Could not find Observable constructor to patch. Stream tracking will not work.');
            console.warn('[RxJS DevTools] Make sure initializeRxjsDevtools is called after RxJS is loaded.');
          }
        }, 5000);

        return false;
      }

      if (Observable) {
        performPatch(Observable, tracker);
        return true;
      }
    } catch (error) {
      console.warn('[RxJS DevTools] Error during Observable detection:', error);
    }
    return false;
  };

  // Try immediately
  if (tryPatchObservable()) {
    return;
  }

  // If immediate patching failed, try again after a delay
  setTimeout(() => {
    if (!window.__RXJS_ORIGINAL_OBSERVABLE__) {
      tryPatchObservable();
    }
  }, 100);

  // Final attempt after all modules should be loaded
  setTimeout(() => {
    if (!window.__RXJS_ORIGINAL_OBSERVABLE__) {
      console.warn('[RxJS DevTools] Final attempt to patch Observable...');
      tryPatchObservable();
    }
  }, 1000);
}

function performPatch(Observable: any, tracker: StreamTracker): void {
  // Store original
  window.__RXJS_ORIGINAL_OBSERVABLE__ = Observable;
  console.log('[RxJS DevTools] Starting Observable patching...');

  try {
    // Store original methods
    const originalCreate = Observable.create;
    const originalLift = Observable.prototype.lift;
    const originalSubscribe = Observable.prototype.subscribe;

    // Patch Observable.create if it exists
    if (originalCreate) {
      Observable.create = function(subscribe: any) {
        const streamId = tracker.generateStreamId();
        const stack = tracker.captureStack();
        tracker.registerStream(streamId, 'Observable.create', stack);
        
        const observable = originalCreate.call(this, subscribe);
        (observable as any).__rxjs_devtools_id__ = streamId;
        return observable;
      };
      console.log('[RxJS DevTools] Patched Observable.create');
    }

    // Patch constructor by wrapping it
    const OriginalObservable = Observable;
    const PatchedObservable = function(this: any, subscribe?: any) {
      const streamId = tracker.generateStreamId();
      const stack = tracker.captureStack();
      tracker.registerStream(streamId, 'new Observable', stack);
      
      const result = OriginalObservable.call(this, subscribe);
      if (result) {
        (result as any).__rxjs_devtools_id__ = streamId;
      }
      (this as any).__rxjs_devtools_id__ = streamId;
      return result;
    };

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
      Observable.prototype.lift = function(this: any, operator: any) {
        const parentId = (this as any).__rxjs_devtools_id__;
        const streamId = tracker.generateStreamId();
        const stack = tracker.captureStack();
        const operatorName = operator?.constructor?.name || 'unknown operator';
        
        tracker.registerStream(streamId, operatorName, stack);
        
        const result = originalLift.call(this, operator);
        (result as any).__rxjs_devtools_id__ = streamId;
        
        // Link parent-child relationship if possible
        if (parentId) {
          (result as any).__rxjs_devtools_parent_id__ = parentId;
        }
        
        return result;
      };
      console.log('[RxJS DevTools] Patched Observable.prototype.lift');
    }

    // Patch subscribe method
    if (originalSubscribe) {
      Observable.prototype.subscribe = function(this: any, ...args: any[]) {
        const streamId = (this as any).__rxjs_devtools_id__;
        
        if (streamId) {
          tracker.subscribeToStream(streamId);
          
          // Wrap observer functions to track emissions
          if (args.length > 0) {
            const observer = args[0];
            
            if (observer && typeof observer === 'object') {
              // Object observer
              if (observer.next && typeof observer.next === 'function') {
                const originalNext = observer.next;
                observer.next = function(value: any) {
                  tracker.emitValue(streamId, value);
                  return originalNext.call(this, value);
                };
              }
              
              if (observer.error && typeof observer.error === 'function') {
                const originalError = observer.error;
                observer.error = function(error: any) {
                  tracker.errorStream(streamId);
                  return originalError.call(this, error);
                };
              }
              
              if (observer.complete && typeof observer.complete === 'function') {
                const originalComplete = observer.complete;
                observer.complete = function() {
                  tracker.completeStream(streamId);
                  return originalComplete.call(this);
                };
              }
            } else if (typeof observer === 'function') {
              // Function observer
              args[0] = function(value: any) {
                tracker.emitValue(streamId, value);
                return observer(value);
              };
            }
          }
        }

        const subscription = originalSubscribe.apply(this, args);
        
        // Patch unsubscribe
        if (subscription && subscription.unsubscribe) {
          const originalUnsubscribe = subscription.unsubscribe;
          subscription.unsubscribe = function() {
            if (streamId) {
              tracker.unsubscribeFromStream(streamId);
            }
            return originalUnsubscribe.call(this);
          };
        }

        return subscription;
      };
      console.log('[RxJS DevTools] Patched Observable.prototype.subscribe');
    }

    // Try to replace global references
    try {
      if ((window as any).Observable === Observable) {
        (window as any).Observable = PatchedObservable;
      }
      if ((window as any).rxjs?.Observable === Observable) {
        (window as any).rxjs.Observable = PatchedObservable;
      }
    } catch (error) {
      console.warn('[RxJS DevTools] Could not replace global Observable references:', error);
    }

    console.log('[RxJS DevTools] Observable patching completed successfully');
  } catch (error) {
    console.error('[RxJS DevTools] Error during Observable patching:', error);
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

// Add manual stream registration API
export function registerStream(name: string, observable: any, options?: { operator?: string }): any {
  const tracker = window.__RXJS_STREAMS_TRACKER__;
  if (!tracker) {
    console.warn('[RxJS DevTools] Stream tracker not initialized. Call initializeRxjsDevtools first.');
    return observable;
  }

  const streamId = tracker.generateStreamId();
  const stack = tracker.captureStack();
  const operator = options?.operator || 'manual';
  
  tracker.registerStream(streamId, operator, stack);
  
  // Create a wrapper that tracks the stream
  const wrappedObservable = new Proxy(observable, {
    get(target, prop) {
      if (prop === 'subscribe') {
        return function(...args: any[]) {
          tracker.subscribeToStream(streamId);
          
          // Wrap observer to track emissions
          if (args.length > 0) {
            const observer = args[0];
            
            if (observer && typeof observer === 'object') {
              if (observer.next) {
                const originalNext = observer.next;
                observer.next = function(value: any) {
                  tracker.emitValue(streamId, value);
                  return originalNext.call(this, value);
                };
              }
              
              if (observer.error) {
                const originalError = observer.error;
                observer.error = function(error: any) {
                  tracker.errorStream(streamId);
                  return originalError.call(this, error);
                };
              }
              
              if (observer.complete) {
                const originalComplete = observer.complete;
                observer.complete = function() {
                  tracker.completeStream(streamId);
                  return originalComplete.call(this);
                };
              }
            } else if (typeof observer === 'function') {
              args[0] = function(value: any) {
                tracker.emitValue(streamId, value);
                return observer(value);
              };
            }
          }
          
          const subscription = target.subscribe.apply(target, args);
          
          // Wrap unsubscribe
          if (subscription && subscription.unsubscribe) {
            const originalUnsubscribe = subscription.unsubscribe;
            subscription.unsubscribe = function() {
              tracker.unsubscribeFromStream(streamId);
              return originalUnsubscribe.call(this);
            };
          }
          
          return subscription;
        };
      }
      
      if (prop === 'pipe') {
        return function(...operators: any[]) {
          const result = target.pipe.apply(target, operators);
          // Register the piped observable as a new stream
          const operatorNames = operators.map((op: any) => op.constructor?.name || 'operator').join(' → ');
          return registerStream(`${name}_piped`, result, { operator: operatorNames });
        };
      }
      
      return target[prop];
    }
  });
  
  // Store the stream ID on the wrapper
  (wrappedObservable as any).__rxjs_devtools_id__ = streamId;
  (wrappedObservable as any).__rxjs_devtools_name__ = name;
  
  return wrappedObservable;
}

// Convenience function for common RxJS creation patterns
export function trackObservable<T>(name: string, observable: any): any {
  return registerStream(name, observable, { operator: 'tracked' });
}

// Helper for Subject tracking
export function trackSubject<T>(name: string, subject: any): any {
  return registerStream(name, subject, { operator: 'Subject' });
}
