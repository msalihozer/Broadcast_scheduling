/**
 * @file src/main.jsx
 * @description React 18 uygulamasının DOM'a bağlandığı giriş noktası (Entry Point).
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
