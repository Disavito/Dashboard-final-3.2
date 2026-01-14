import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingSpinner from './components/ui-custom/LoadingSpinner';

// Page Imports - Ahora con lazy loading
const DashboardLayout = lazy(() => import('./layouts/DashboardLayout'));
const AuthPage = lazy(() => import('./pages/Auth'));
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const SociosPage = lazy(() => import('./pages/People'));
const EditSocioPage = lazy(() => import('./pages/EditSocioPage'));
const InvoicingLayout = lazy(() => import('./pages/invoicing/InvoicingLayout'));
const BoletasPage = lazy(() => import('./pages/invoicing/BoletasPage'));
const ResumenDiarioPage = lazy(() => import('./pages/invoicing/ResumenDiarioPage'));
const NotasCreditoPage = lazy(() => import('./pages/invoicing/NotasCreditoPage'));
const RecibosPage = lazy(() => import('./pages/invoicing/RecibosPage')); // <-- NUEVO IMPORT
const IngresosPage = lazy(() => import('./pages/Income'));
const EgresosPage = lazy(() => import('./pages/Expenses'));
const CuentasPage = lazy(() => import('./pages/Accounts'));
const AccountDetails = lazy(() => import('./pages/AccountDetails'));
const PartnerDocuments = lazy(() => import('./pages/PartnerDocuments'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const JornadaPage = lazy(() => import('./pages/JornadaPage'));

function App() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      {/* Envolvemos las rutas con Suspense para manejar la carga perezosa */}
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          {/* Ruta Pública: Cualquiera puede acceder a la página de autenticación */}
          <Route path="/auth" element={<AuthPage />} />

          {/* Rutas Protegidas: El contenedor principal verifica el acceso al dashboard ('/') */}
          <Route element={<ProtectedRoute resourcePath="/" />}>
            <Route element={<DashboardLayout />}>
              {/* Dashboard es accesible si se tiene permiso para '/' */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />

              {/* Proteger cada sección con su respectivo resourcePath */}
              <Route element={<ProtectedRoute resourcePath="/people" />}>
                <Route path="people" element={<SociosPage />} />
                <Route path="people/:id" element={<EditSocioPage />} />
              </Route>
              
              <Route element={<ProtectedRoute resourcePath="/partner-documents" />}>
                <Route path="partner-documents" element={<PartnerDocuments />} />
              </Route>

              <Route element={<ProtectedRoute resourcePath="/invoicing" />}>
                <Route path="invoicing" element={<InvoicingLayout />}>
                  <Route index element={<Navigate to="boletas" replace />} />
                  <Route path="boletas" element={<BoletasPage />} />
                  <Route path="resumen-diario" element={<ResumenDiarioPage />} />
                  <Route path="notas-credito" element={<NotasCreditoPage />} />
                  <Route path="recibos" element={<RecibosPage />} /> {/* <-- RUTA AÑADIDA */}
                </Route>
              </Route>

              <Route element={<ProtectedRoute resourcePath="/jornada" />}>
                <Route path="jornada" element={<JornadaPage />} />
              </Route>

              <Route element={<ProtectedRoute resourcePath="/income" />}>
                <Route path="income" element={<IngresosPage />} />
              </Route>

              <Route element={<ProtectedRoute resourcePath="/expenses" />}>
                <Route path="expenses" element={<EgresosPage />} />
              </Route>

              <Route element={<ProtectedRoute resourcePath="/accounts" />}>
                <Route path="accounts" element={<CuentasPage />} />
                <Route path="accounts/:id" element={<AccountDetails />} />
              </Route>
              
              <Route element={<ProtectedRoute resourcePath="/settings" />}>
                <Route path="settings" element={<SettingsPage />} />
              </Route>

            </Route>
          </Route>
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;
