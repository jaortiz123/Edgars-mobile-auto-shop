import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, AuthDispatchProvider } from './context/AuthContext'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AuthDispatchProvider>
        <App />
      </AuthDispatchProvider>
    </AuthProvider>
  </StrictMode>,
);
