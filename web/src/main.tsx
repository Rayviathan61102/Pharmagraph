import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled with the app (not loaded from the internet), so they work offline.
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/noto-sans-thai/400.css'
import './theme.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
