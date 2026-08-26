import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

// Force re-transform: Vite transform cache was stale (mismatched dep hashes)
ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)