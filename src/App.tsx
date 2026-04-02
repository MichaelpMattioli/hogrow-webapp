import { Routes, Route, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Navbar from '@/components/layout/Navbar';
import PageContainer from '@/components/layout/PageContainer';

const Home           = lazy(() => import('@/pages/Home'));
const Clientes       = lazy(() => import('@/pages/Clientes'));
const ClienteDetalhe = lazy(() => import('@/pages/ClienteDetalhe'));
const Metas          = lazy(() => import('@/pages/Metas'));

const Spinner = () => (
  <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-m)' }}>
    Carregando...
  </div>
);

function Layout() {
  return (
    <>
      <Navbar />
      <PageContainer>
        <Suspense fallback={<Spinner />}>
          <Outlet />
        </Suspense>
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
      </Route>
    </Routes>
  );
}
