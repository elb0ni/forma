import { useEffect } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/auth'
import { Ic } from '../components/ui'
import type { AuthUser, UserRole } from '../types'

// ─── Spinner de carga inicial ─────────────────────────────────────────────────

export function Spinner() {
  return (
    <div className="root-spinner">
      <Ic n="refresh" s={24} className="spin" style={{ color: '#a1a1aa' }}/>
    </div>
  )
}

// ─── Layout raíz: verifica sesión al montar ───────────────────────────────────

export function RootLayout() {
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
export function RequireAuth() {
  const user = useAuthStore(s => s.user)
  if (!user)              return <Navigate to="/login" replace/>
  if (user.primer_login)  return <Navigate to="/cambiar-contrasena" replace/>
  return <Outlet/>
}

// Solo para usuarios con primer_login pendiente
export function RequirePrimerLogin() {
  const user = useAuthStore(s => s.user)
  if (!user)              return <Navigate to="/login" replace/>
  if (!user.primer_login) return <Navigate to="/dashboard" replace/>
  return <Outlet/>
}

// Solo para usuarios sin sesión (redirige si ya está autenticado)
export function PublicOnly() {
  const user = useAuthStore(s => s.user)
  if (user && !user.primer_login) return <Navigate to="/dashboard" replace/>
  return <Outlet/>
}

// Frontera de acceso por rol: cada dashboard de rol solo se monta si el rol de la
// sesión (verificada contra el backend en /auth/me) está en la lista permitida.
// Esto es una capa adicional de defensa en el cliente — la autorización real de
// los datos la debe seguir aplicando el backend en cada endpoint.
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const user = useAuthStore(s => s.user)
  if (!user)                     return <Navigate to="/login" replace/>
  if (!roles.includes(user.rol)) return <Navigate to="/dashboard" replace/>
  return <Outlet/>
}

// A dónde cae cada rol al entrar a "/dashboard".
const ROLE_HOME: Record<UserRole, string> = {
  SUPER_ADMIN:     '/dashboard/superadmin',
  SUBDIRECTOR:     '/dashboard/coordinador',
  COORD_MISIONAL:  '/dashboard/coordinador',
  COORD_ACADEMICO: '/dashboard/coordinador',
  INSTRUCTOR:      '/dashboard/instructor',
}

// Redirige "/dashboard" al home del propio rol. Si el rol no está en la tabla
// (fail-closed) no se cae a ningún dashboard por defecto: se bloquea el acceso.
export function DashboardRedirect() {
  const rol = useAuthStore(s => s.user?.rol)
  const home = rol ? ROLE_HOME[rol] : undefined
  if (!home) return <RolNoReconocido/>
  return <Navigate to={home} replace/>
}

async function cerrarSesion() {
  try { await api.post('/auth/logout') } catch { /* noop */ }
  useAuthStore.getState().clearUser()
  window.location.href = '/login'
}

function RolNoReconocido() {
  return (
    <div className="root-spinner" style={{ flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 14, color: '#3f3f46', textAlign: 'center', maxWidth: 340 }}>
        Tu cuenta tiene un rol que esta aplicación no reconoce. Contacta a un administrador para que revise tu usuario.
      </div>
      <button
        onClick={cerrarSesion}
        style={{ height: 36, padding: '0 16px', borderRadius: 8, border: '1px solid #e4e4e7', background: '#fff', color: '#18181b', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
      >
        Cerrar sesión
      </button>
    </div>
  )
}
