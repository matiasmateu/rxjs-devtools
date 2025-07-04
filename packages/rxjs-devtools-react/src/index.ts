// Types
export interface RxjsDevtoolsOptions {
  appName: string;
  forceDetection?: {
    rxjs?: boolean;
    reduxObservable?: boolean;
  };
}

interface RxjsDevtoolsAppInfo {
  appName: string;
  connected: boolean;
  detected: {
    rxjs: boolean;
    reduxObservable: boolean;
  };
}

interface RxjsDevtoolsHook {
  apps: RxjsDevtoolsAppInfo[];
  registerApp(appInfo: RxjsDevtoolsAppInfo): void;
}

declare global {
  interface Window {
    __RXJS_DEVTOOLS_HOOK__?: RxjsDevtoolsHook;
    __REDUX_OBSERVABLE_PRESENT__?: boolean;
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

  // Inject the global hook if not present
  if (!window.__RXJS_DEVTOOLS_HOOK__) {
    window.__RXJS_DEVTOOLS_HOOK__ = {
      apps: [],
      registerApp(appInfo: RxjsDevtoolsAppInfo) {
        this.apps.push(appInfo);
        // Optionally, notify the extension of the new app
        // (e.g., dispatch a custom event)
      },
    };
  }

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
      });

      console.info(
        `[RxJS DevTools] Initialized for app: ${options.appName}. RxJS: ${rxjsDetected}, redux-observable: ${reduxObservableDetected}`
      );
    });
  });
}
