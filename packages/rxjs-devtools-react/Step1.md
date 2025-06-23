# Step-by-Step Guide: React Integration for RxJS DevTools

This guide will walk you through building a React integration for RxJS that connects to the [rxjs-devtools-chrome-extension](../rxjs-devtools-chrome-extension), displays the app name, detects RxJS and redux-observable usage, and confirms correct connection with the global hook.

---

## 1. **Project Setup**

- Ensure you have the following packages installed in your React app:
  - `rxjs`
  - `redux-observable` (if using redux-observable)
  - The Chrome extension from `rxjs-devtools-chrome-extension` (install and load in your browser)

---

## 2. **Provide the App Name via Initialization**

- When initializing the devtools integration in your React app, pass the app name as a parameter (e.g., `initializeRxjsDevtools({ appName: 'MyApp' })`).
- This app name can be displayed in your status component (e.g., `RxjsDevtoolsStatus`) and used for identification in the devtools UI.
- You may retrieve the app name from your `package.json` during your build process or set it manually in your initialization code.

---

## 3. **Detect RxJS Usage (Internal Handling)**

- Detection of RxJS should be handled internally by the devtools integration. The user only needs to initialize the tool (e.g., `initializeRxjsDevtools({ appName: 'MyApp' })`).
- The integration will automatically check for RxJS presence and set any required global flags.
- If RxJS is not detected, an error will be logged to the console for debugging purposes.

---

## 4. **Detect redux-observable Usage (Internal Handling)**

- Detection of `redux-observable` should be handled internally by the devtools integration, just like RxJS detection.
- When the user initializes the tool (e.g., `initializeRxjsDevtools({ appName: 'MyApp' })`), the integration will automatically check for the presence of `redux-observable` and set any required global flags (such as `window.__REDUX_OBSERVABLE_PRESENT__`).
- No additional user code is required for this detection.

---

## 5. **Inject the Global Hook for Chrome Extension**

- This tool injects the global hook (`window.__RXJS_DEVTOOLS_HOOK__`) that will be used by the Chrome extension to communicate with your React app.
- The hook should be attached to the `window` object as early as possible in your app's lifecycle, ideally during initialization.
- Example of injecting the hook:
  ```js
  if (!window.__RXJS_DEVTOOLS_HOOK__) {
    window.__RXJS_DEVTOOLS_HOOK__ = {
      // Define methods and properties needed for communication
      apps: [],
      registerApp(appInfo) {
        this.apps.push(appInfo);
        // Optionally, notify the extension of the new app
      },
      // Add additional methods as needed
    };
  }
  ```
- The Chrome extension will detect and interact with this hook to establish a connection and exchange messages.

---

## 6. **Connection Status Communication**

- Connection status metadata is managed automatically by the integration. No manual action is required from you.
- When your app initializes or the connection state changes, the integration will internally update the Chrome extension via the global hook (`window.__RXJS_DEVTOOLS_HOOK__`).
- The Chrome extension will listen for these updates and display the connection state in its UI.
- Optionally, you may display a local status indicator in your app UI (e.g., "Connected to RxJS DevTools" or "Not Connected") by consuming the integration's status API, but you do not need to handle the communication with the extension yourself.
- For debugging, connection status changes may be logged to the console by the integration.


**End of Step 1 Guide**
