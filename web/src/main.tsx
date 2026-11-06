import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// Fonts are bundled with the app (not loaded from the internet), so they work offline.
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/noto-sans-thai/400.css'
import './theme.css'
import App from './App'

// One shared data cache: each piece of data is fetched once and reused everywhere on screen.
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
