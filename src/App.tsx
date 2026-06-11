import { Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import PageContainer from '@/components/layout/PageContainer';
import ErrorBoundary from '@/components/layout/ErrorBoundary';
import NotFound from '@/pages/NotFound';

const Home           = lazy(() => import('@/pages/Home'));
const Clientes       = lazy(() => import('@/pages/Clientes'));
const ClienteDetalhe = lazy(() => import('@/pages/ClienteDetalhe'));
const Metas          = lazy(() => import('@/pages/Metas'));
const Feriados       = lazy(() => import('@/pages/Feriados'));
const Cadastro       = lazy(() => import('@/pages/Cadastro'));

const Spinner = () => (
  <div
    className="flex items-center justify-center gap-2 py-20"
    style={{ color: 'var(--text-m)' }}
    role="status"
    aria-live="polite"
  >
    <Loader2 size={16} className="animate-spin" />
    Carregando...
  </div>
);

function Layout() {
  // Reset the error boundary whenever the route changes, so a crash on one
  // page doesn't keep the fallback visible after navigating elsewhere.
  const { pathname } = useLocation();
  return (
    <>
      <Navbar />
      <PageContainer>
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </PageContainer>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index               element={<Home />} />
        <Route path="clientes"     element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteDetalhe />} />
        <Route path="metas"        element={<Metas />} />
        <Route path="feriados"     element={<Feriados />} />
        <Route path="cadastro"     element={<Cadastro />} />
        <Route path="*"            element={<NotFound />} />
      </Route>
    </Routes>
  );
}
