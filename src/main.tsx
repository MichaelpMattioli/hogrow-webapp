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
        // Não persiste rate-shopper nem a aba de Metas (cache removido): cada visita
        // busca o estado atual — metas mudam por upload a qualquer hora, fora do ciclo 09:30.
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => {
            const k = String(q.queryKey?.[0] ?? '');
            return q.state.status === 'success' &&
              !k.startsWith('cliente-rate-shopper') &&
              !k.startsWith('booking-rates') &&
              !k.startsWith('metas-');
          },
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PersistQueryClientProvider>
  </StrictMode>,
)
