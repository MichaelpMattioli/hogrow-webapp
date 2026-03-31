import { Routes, Route, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import Navbar from '@/components/layout/Navbar';
import PageContainer from '@/components/layout/PageContainer';

const Clientes = lazy(() => import('@/pages/Clientes'));
const ClienteDetalhe = lazy(() => import('@/pages/ClienteDetalhe'));

function Layout() {
  return (
    <>
      <Navbar />
      <PageContainer>
        <Suspense fallback={<div className="text-center py-20 text-[var(--text-m)]">Carregando...</div>}>
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
        <Route index element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteDetalhe />} />
      </Route>
    </Routes>
  );
}
