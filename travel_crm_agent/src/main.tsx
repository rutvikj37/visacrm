// must be first: keeps this panel's localStorage apart from the student portal on the same address
import './utils/storageScope'
import { reloadOnStaleAssets } from './utils/reloadOnStaleAssets'

// a deploy replaced the script files this open tab points at: reload once
reloadOnStaleAssets()
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
