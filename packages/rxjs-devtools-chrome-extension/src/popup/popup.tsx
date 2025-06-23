import * as React from 'react';
import { createRoot } from 'react-dom/client';

const Popup = () => (
  <div style={{ padding: 16 }}>
    <h1>RxJS DevTools</h1>
    <p>Extension loaded!</p>
  </div>
);

const root = createRoot(document.getElementById('root')!);
root.render(<Popup />);
