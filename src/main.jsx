import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { TierProvider } from './context/TierContext.jsx'
import { I18nProvider } from './lib/i18n.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <TierProvider>
          <App />
        </TierProvider>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
)
