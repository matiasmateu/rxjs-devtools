console.log('RxJS DevTools content script injected.');

function forwardRxjsDevtoolsData() {
  const hook = (window as any).__RXJS_DEVTOOLS_HOOK__;
  if (hook && Array.isArray(hook.apps)) {
    window.postMessage({
      source: 'rxjs-devtools-content',
      type: 'APPS_UPDATE',
      apps: hook.apps,
    }, '*');
  }
}

// Listen for changes (in a real implementation, you might want to patch registerApp to notify)
setInterval(forwardRxjsDevtoolsData, 1000);
