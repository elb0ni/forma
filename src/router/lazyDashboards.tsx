import { lazy } from 'react'

// Cada dashboard de rol se carga de forma perezosa: el bundle de un rol nunca
// se descarga en el navegador de otro rol.
export const SuperAdminDashboard  = lazy(() => import('../screens/superadmin/SuperAdminDashboard').then(m => ({ default: m.SuperAdminDashboard })))
export const CoordinadorDashboard = lazy(() => import('../screens/coordinador/CoordinadorDashboard').then(m => ({ default: m.CoordinadorDashboard })))
export const InstructorDashboard  = lazy(() => import('../screens/instructor/InstructorDashboard').then(m => ({ default: m.InstructorDashboard })))

// Módulo en planeación: preview público (sin autenticación) del formato de
// Etapa Productiva. Vive fuera de los dashboards por rol a propósito.
export const EtapaProductivaPreview = lazy(() => import('../screens/productiva/EtapaProductivaPreview').then(m => ({ default: m.EtapaProductivaPreview })))
