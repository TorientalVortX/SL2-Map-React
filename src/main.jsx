import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

const rootEl = document.getElementById('root')
createRoot(rootEl).render(<App />)

// Register Service Worker for caching tiles and static assets
if ('serviceWorker' in navigator) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/sw.js')
			.catch((err) => console.error('SW registration failed:', err))
	})
}
