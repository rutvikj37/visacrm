import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyBrand, storedBrand } from './lib/theme'

// agency colour from the last visit (refreshed after login from agent/kyc)
applyBrand(storedBrand())

createRoot(document.getElementById('root')!).render(
    <App />
)
