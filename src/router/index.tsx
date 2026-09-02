import { Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'
import { Login } from '../screens/Login'
import { CambiarContrasena } from '../screens/CambiarContrasena'
import { Spinner, RootLayout, RequireAuth, RequirePrimerLogin, PublicOnly, RequireRole, DashboardRedirect } from './guards'
import { SuperAdminDashboard, CoordinadorDashboard, InstructorDashboard } from './lazyDashboards'
import { CompetenciaPreview } from '../screens/preview/CompetenciaPreview'
import './router.css'

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  {
    element: <RootLayout/>,
    children: [
      {
        element: <PublicOnly/>,
        children: [
          { path: '/login', element: <Login/> },
        ],
      },
      {
        element: <RequirePrimerLogin/>,
        children: [
          { path: '/cambiar-contrasena', element: <CambiarContrasena/> },
        ],
      },
      {
        element: <RequireAuth/>,
        children: [
          { path: '/dashboard', element: <DashboardRedirect/> },
          {
            element: <RequireRole roles={['SUPER_ADMIN']}/>,
            children: [
              { path: '/dashboard/superadmin', element: <Suspense fallback={<Spinner/>}><SuperAdminDashboard/></Suspense> },
            ],
          },
          {
            element: <RequireRole roles={['SUBDIRECTOR', 'COORD_MISIONAL', 'COORD_ACADEMICO']}/>,
            children: [
              { path: '/dashboard/coordinador', element: <Suspense fallback={<Spinner/>}><CoordinadorDashboard/></Suspense> },
            ],
          },
          {
            element: <RequireRole roles={['INSTRUCTOR']}/>,
            children: [
              { path: '/dashboard/instructor/*', element: <Suspense fallback={<Spinner/>}><InstructorDashboard/></Suspense> },
            ],
          },
        ],
      },
      // Vista de prueba/maqueta, sin autenticación — solo para validar diseño.
      { path: '/preview/competencia', element: <CompetenciaPreview/> },

      { path: '/',  element: <Navigate to="/dashboard" replace/> },
      { path: '*',  element: <Navigate to="/dashboard" replace/> },
    ],
  },
])
