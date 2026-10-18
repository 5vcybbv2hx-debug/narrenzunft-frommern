import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { initTheme } from '@/lib/theme'
import { initPush } from '@/lib/push'

initTheme()
initPush() // Push: GENAU EINMAL initialisieren (nie ein zweites init an irgendeiner Stelle)

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)