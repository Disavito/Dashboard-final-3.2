import React, { Suspense, lazy } from 'react';
import { createBrowserRouter } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Loader from './components/ui/loader';

// --- Lazy Loaded Components ---
// This tells React to load these components only when they are needed.
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const PeoplePage = lazy(() => import('./pages/People')); // Carga diferida para la página de Socios
const InvoicingLayout = lazy(() => import('./pages/invoicing/InvoicingLayout'));
const BoletasPage = lazy(() => import('./pages/invoicing/BoletasPage'));
const ResumenDiarioPage = lazy(() => import('./pages/invoicing/ResumenDiarioPage'));
const NotasCreditoPage = lazy(() => import('./pages/invoicing/NotasCreditoPage'));
const RecibosPage = lazy(() => import('./pages/invoicing/RecibosPage'));

// --- Suspense Wrapper ---
// A helper function to wrap components in a Suspense boundary.
// This shows the Loader component while the actual page component is being downloaded.
const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType<any>>) => (
  <Suspense fallback={<Loader />}>
    <Component />
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <DashboardLayout />,
    children: [
      {
        index: true,
        element: withSuspense(DashboardPage),
      },
      {
        path: 'people', // Definición de la ruta /people
        element: withSuspense(PeoplePage),
      },
      {
        path: 'invoicing',
        element: withSuspense(InvoicingLayout),
        children: [
          {
            path: 'boletas',
            element: withSuspense(BoletasPage),
          },
          {
            path: 'resumen-diario',
            element: withSuspense(ResumenDiarioPage),
          },
          {
            path: 'notas-credito',
            element: withSuspense(NotasCreditoPage),
          },
          {
            path: 'recibos',
            element: withSuspense(RecibosPage),
          },
          {
            path: 'facturas',
            element: <div>Facturación de Facturas (Próximamente)</div>,
          },
        ],
      },
      // ... other main routes
    ],
  },
]);

export default router;
