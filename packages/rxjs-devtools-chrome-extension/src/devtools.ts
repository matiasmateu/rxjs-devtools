// DevTools page script - creates the actual panel in Chrome DevTools
declare const chrome: any;

console.log('RxJS DevTools: devtools.js loaded');
console.log('RxJS DevTools: chrome object:', typeof chrome);
console.log('RxJS DevTools: chrome.devtools:', typeof chrome?.devtools);
console.log('RxJS DevTools: chrome.devtools.panels:', typeof chrome?.devtools?.panels);

// Add a visible indicator that this script ran
document.title = 'RxJS DevTools - Script Loaded';

if (chrome && chrome.devtools && chrome.devtools.panels) {
  console.log('RxJS DevTools: Attempting to create panel...');
  
  chrome.devtools.panels.create(
    'RxJS', // Panel title
    '', // Icon path (empty for now to avoid path issues)
    'panel.html', // Panel page
    (panel: any) => {
      console.log('RxJS DevTools: panel created successfully', panel);
      if (chrome.runtime.lastError) {
        console.error('RxJS DevTools: Error creating panel:', chrome.runtime.lastError);
      } else {
        console.log('RxJS DevTools: Panel creation completed without errors');
      }
    }
  );
} else {
  console.error('RxJS DevTools: chrome.devtools.panels not available');
  console.error('RxJS DevTools: Available chrome properties:', Object.keys(chrome || {}));
} 