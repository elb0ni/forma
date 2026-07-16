import { useEffect } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Login } from '../screens/Login'
import { CambiarContrasena } from '../screens/CambiarContrasena'
import { RoleDashboard } from '../screens/Dashboard'
import { Ic } from '../components/ui'
import type { AuthUser } from '../types'
import './router.css'

// ─── Spinner de carga inicial ─────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="root-spinner">
      <Ic n="refresh" s={24} className="spin" style={{ color: '#a1a1aa' }}/>
    </div>
  )
}

// ─── Layout raíz: verifica sesión al montar ───────────────────────────────────

function RootLayout() {
  const isInitialized = useAuthStore(s => s.isInitialized)

  useEffect(() => {
    api.get<AuthUser>('/auth/me')
      .then(r => useAuthStore.getState().setUser(r.data))
      .catch(() => {})
      .finally(() => useAuthStore.getState().setInitialized())
  }, [])

  if (!isInitialized) return <Spinner/>
  return <Outlet/>
}

// ─── Guards ───────────────────────────────────────────────────────────────────

// Rutas que requieren sesión activa y contraseña ya cambiada
function RequireAuth() {
  const user = useAuthStore(s => s.user)
  if (!user)              return <Navigate to="/login" replace/>
  if (user.primer_login)  return <Navigate to="/cambiar-contrasena" replace/>
  return <Outlet/>
}

// Solo para usuarios con primer_login pendiente
function RequirePrimerLogin() {
  const user = useAuthStore(s => s.user)
  if (!user)              return <Navigate to="/login" replace/>
  if (!user.primer_login) return <Navigate to="/dashboard" replace/>
  return <Outlet/>
}

// Solo para usuarios sin sesión (redirige si ya está autenticado)
function PublicOnly() {
  const user = useAuthStore(s => s.user)
  if (user && !user.primer_login) return <Navigate to="/dashboard" replace/>
  return <Outlet/>
}

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
          { path: '/dashboard', element: <RoleDashboard/> },
        ],
      },
      { path: '/',  element: <Navigate to="/dashboard" replace/> },
      { path: '*',  element: <Navigate to="/dashboard" replace/> },
    ],
  },
])
