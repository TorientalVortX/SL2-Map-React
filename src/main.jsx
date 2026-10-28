import { Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import App from './App.jsx'
import tileIndex from './generated/tile-index.json'
import './styles.css'

const RegionArranger = import.meta.env.DEV ? lazy(() => import('./dev/RegionArranger.jsx')) : null
const arranging = RegionArranger && new URLSearchParams(location.search).has('arrange')

const rootEl = document.getElementById('root')
createRoot(rootEl).render(arranging ? <Suspense fallback={null}><RegionArranger tileIndex={tileIndex} /></Suspense> : <App />)

if ('serviceWorker' in navigator && !arranging) {
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/sw.js')
			.catch((err) => console.error('SW registration failed:', err))
	})
}
