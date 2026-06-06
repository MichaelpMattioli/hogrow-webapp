import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryClient, persister, cacheBuster } from '@/lib/queryClient'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: cacheBuster,
        // Não persiste o rate-shopper (cache removido): cada visita busca o estado atual.
        dehydrateOptions: {
          shouldDehydrateQuery: (q) =>
            q.state.status === 'success' &&
            !String(q.queryKey?.[0] ?? '').startsWith('booking-rates'),
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
