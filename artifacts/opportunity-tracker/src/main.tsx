import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react'; // 1. Add this import

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// 2. Add this line right here:
setBaseUrl('https://applynow-nerdbunny.up.railway.app');

createRoot(document.getElementById('root')!, {
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
