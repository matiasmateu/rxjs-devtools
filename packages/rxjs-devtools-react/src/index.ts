// Types
export interface RxjsDevtoolsOptions {
  appName: string;
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

function detectRxjs(): boolean {
  try {
    // Try to require or access rxjs global
    return !!(
      (window as any).rxjs ||
      (typeof require !== 'undefined' && require.resolve && require.resolve('rxjs'))
    );
  } catch {
    return false;
  }
}

function detectReduxObservable(): boolean {
  try {
    // Try to require or access redux-observable global
    if ((window as any).reduxObservable) return true;
    if (typeof require !== 'undefined' && require.resolve && require.resolve('redux-observable')) {
      window.__REDUX_OBSERVABLE_PRESENT__ = true;
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function initializeRxjsDevtools(options: RxjsDevtoolsOptions): void {
  if (!options?.appName) {
    throw new Error('App name is required for RxJS DevTools initialization.');
  }

  // Detect RxJS and redux-observable
  const rxjsDetected = detectRxjs();
  const reduxObservableDetected = detectReduxObservable();

  if (!rxjsDetected) {
    console.error('[RxJS DevTools] RxJS not detected in the app.');
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

  // Register this app
  window.__RXJS_DEVTOOLS_HOOK__.registerApp({
    appName: options.appName,
    connected: true,
    detected: {
      rxjs: rxjsDetected,
      reduxObservable: reduxObservableDetected,
    },
  });

  // Optionally log connection status
  console.info(
    `[RxJS DevTools] Initialized for app: ${options.appName}. RxJS: ${rxjsDetected}, redux-observable: ${reduxObservableDetected}`
  );
} 