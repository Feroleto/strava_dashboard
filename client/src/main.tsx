// boot first: its module-scope side effects kick off /auth/me, the gate
// check, the heavy activities prefetch and the active page's chunk download
// before i18n/React below are even evaluated
import './lib/boot';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import './index.css';
import App from './App.tsx';
import i18n from './i18n';
import { AuthProvider } from './features/auth/AuthContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </I18nextProvider>
  </StrictMode>,
);
