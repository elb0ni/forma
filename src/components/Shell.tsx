import { Fragment, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ic, BrandMark, Ava } from './ui'
import type { IcName } from './ui'
import { SettingsModal } from './SettingsModal'
import { AmbitoSelector } from './Ambito'
import { Buscador } from './Buscador'
import { useAmbito } from '../store/ambito'
import { useAuthStore } from '../store/auth'
import type { UserRole } from '../types'
import api from '../lib/api'
import './Shell.css'

// ─── Nav config por rol ───────────────────────────────────────────────────────

interface NavItem {
  id: string
  label: string
  icon: IcName
  badge?: string | number
  // Primera opción de un grupo secundario: se pinta un título antes.
  seccion?: string
}

// Menús (PLAN_REDISENO v3): lo del día a día arriba; lo que se usa poco,
// en una sección aparte. Nombres del glosario: "etapa productiva",
// "instructor de seguimiento".
const COORD_NAV: NavItem[] = [
  { id: 'coord-home',         label: 'Mi coordinación', icon: 'home'   },
  { id: 'coord-fichas',       label: 'Fichas',          icon: 'folder' },
  { id: 'coord-asignacion',   label: 'Asignación',      icon: 'layers' },
  { id: 'coord-instructores', label: 'Equipo',          icon: 'users'  },
  { id: 'coord-reportes',     label: 'Reportes',        icon: 'trend'  },
  { id: 'coord-alertas',      label: 'Alertas',         icon: 'bell',  seccion: 'Más' },
]

const NAV: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { id: 'admin-home',       label: 'Inicio',      icon: 'home'      },
    { id: 'admin-fichas',     label: 'Fichas',      icon: 'briefcase' },
    { id: 'admin-asignacion', label: 'Asignación',  icon: 'layers'    },
    { id: 'admin-equipo',     label: 'Equipo',      icon: 'users'     },
    { id: 'admin-reportes',   label: 'Reportes',    icon: 'trend'     },
    { id: 'admin-centros',    label: 'Centros y coordinaciones', icon: 'shield', seccion: 'Configuración' },
    { id: 'admin-programas',  label: 'Programas',   icon: 'layers'    },
    { id: 'admin-usuarios',   label: 'Cuentas de usuario', icon: 'user' },
    { id: 'admin-datos',      label: 'SofiaPlus y datos', icon: 'list' },
  ],
  // Mismas pantallas que el super admin, acotadas a su centro por el backend.
  SUBDIRECTOR: [
    { id: 'admin-home',       label: 'Inicio',      icon: 'home'      },
    { id: 'admin-fichas',     label: 'Fichas',      icon: 'briefcase' },
    { id: 'admin-asignacion', label: 'Asignación',  icon: 'layers'    },
    { id: 'admin-equipo',     label: 'Equipo',      icon: 'users'     },
    { id: 'admin-reportes',   label: 'Reportes',    icon: 'trend'     },
    { id: 'admin-centros',    label: 'Mi centro',   icon: 'shield', seccion: 'Configuración' },
    { id: 'admin-programas',  label: 'Programas',   icon: 'layers'    },
    { id: 'admin-usuarios',   label: 'Cuentas de usuario', icon: 'user' },
    { id: 'admin-catalogo',   label: 'Catálogo',    icon: 'checkCircle' },
    { id: 'admin-datos',      label: 'Salud de los datos', icon: 'list' },
  ],
  COORD_ACADEMICO: COORD_NAV,
  INSTRUCTOR: [
    { id: 'inst-home', label: 'Hoy', icon: 'home' },
    { id: 'inst-etapa-productiva', label: 'Aprendices', icon: 'users' },
    { id: 'inst-reportes', label: 'Reportes', icon: 'trend' },
  ],
}

// Ámbito de quien entra, escrito: lo que ve en FORMA.
const AMBITO: Record<UserRole, string> = {
  SUPER_ADMIN:     'Regional Atlántico',
  SUBDIRECTOR:     'Subdirección de centro',
  COORD_ACADEMICO: 'Coordinación académica',
  INSTRUCTOR:      'Instructor de seguimiento',
}

// Iniciales del centro para el badge del sidebar (ej. "Centro Nacional Colombo
// Alemán" -> "CN"); "CT" genérico solo si el usuario no tiene centro asignado.
function centroSigla(nombre?: string): string {
  if (!nombre) return 'CT'
  const palabras = nombre.split(/\s+/).filter(Boolean)
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase()
  return (palabras[0][0] + palabras[1][0]).toUpperCase()
}

const ROL_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN:     'Administración',
  SUBDIRECTOR:     'Subdirección',
  COORD_ACADEMICO: 'Coordinador',
  INSTRUCTOR:      'Instructor',
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

interface SidebarProps {
  current: string
  onNav: (id: string) => void
}

function Sidebar({ current, onNav }: SidebarProps) {
  const [isOpenModal, setIsOpenModal] = useState<boolean>(false)
  const user = useAuthStore(s => s.user)!
  const items = NAV[user.rol] ?? []

  return (
    <>
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar__logo">
          <BrandMark size={24} />
          <div>
            <div className="sidebar__brand-name">FORMA</div>
            <div className="sidebar__brand-sub">
              Seguimiento etapa productiva
            </div>
          </div>
        </div>

        {/* Centro */}
        <div className="sidebar__centro">
          <div className="sidebar__centro-inner">
            <div className="sidebar__centro-badge">{user.rol === 'SUPER_ADMIN' ? 'RA' : centroSigla(user.centro_formacion)}</div>
            <div className="sidebar__centro-info">
              <div className="sidebar__centro-name">
                {user.rol === 'SUPER_ADMIN' ? 'Los 4 centros' : (user.centro_formacion || 'Centro de formación')}
              </div>
              <div className="sidebar__centro-org">{AMBITO[user.rol]}</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="sidebar__nav">
          <div className="sidebar__nav-section">
            {ROL_LABEL[user.rol]}
          </div>

          {items.map(it => {
            const active = current === it.id
            return (
              <Fragment key={it.id}>
              {it.seccion && <div className="sidebar__nav-section" style={{ paddingTop: 18 }}>{it.seccion}</div>}
              <button
                onClick={() => onNav(it.id)}
                className={`sidebar__nav-btn${active ? ' sidebar__nav-btn--active' : ''}`}
              >
                <Ic n={it.icon} s={15} style={{ color: active ? 'var(--fx-morado)' : 'var(--fx-tinta-3)' }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {it.badge !== undefined && (
                  <span className={`sidebar__nav-badge ${typeof it.badge === 'number' ? 'sidebar__nav-badge--number' : 'sidebar__nav-badge--text'}`}>
                    {it.badge}
                  </span>
                )}
              </button>
              </Fragment>
            )
          })}

          <div className="sidebar__nav-section" style={{ paddingTop: 18 }}>
            Cuenta
          </div>
          <button className="sidebar__nav-btn" onClick={() => setIsOpenModal(true)}>
            <Ic n="cog" s={15} style={{ color: 'var(--fx-tinta-3)' }} />
            Ajustes
          </button>
        </nav>

        {/* Usuario */}
        <div className="sidebar__user">
          <div className="sidebar__user-inner">
            <Ava name={user.nombre_completo} size={28} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar__user-name">
                {user.nombre_completo.split(' ').slice(0, 2).join(' ')}
              </div>
              <div className="sidebar__user-role">
                {ROL_LABEL[user.rol]}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {isOpenModal && <SettingsModal onClose={() => setIsOpenModal(false)} />}
    </>
  )
}

// ─── Header ───────────────────────────────────────────────────────────────────

interface HeaderProps {
  title: string
  subtitle?: string
  breadcrumb?: string[]
  actions?: ReactNode
  onMenu?: () => void
}

function Header({ title, subtitle, breadcrumb, actions, onMenu }: HeaderProps) {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)!
  const clearUser = useAuthStore(s => s.clearUser)
  const [open, setOpen] = useState(false)

  async function logout() {
    setOpen(false)
    await api.post('/auth/logout').catch(() => { })
    useAmbito.getState().setCentro(null)
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <header className="shell-header">
      {onMenu && (
        <button type="button" className="shell-header__menu" onClick={onMenu} aria-label="Abrir el menú">
          <Ic n="list" s={16} />
        </button>
      )}
      <div className="shell-header__info">
        {breadcrumb && (
          <div className="shell-header__breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={i} className="shell-header__breadcrumb-item">
                {i > 0 && <Ic n="chevronRight" s={11} style={{ color: 'var(--fx-tinta-4)' }} />}
                <span className={i === breadcrumb.length - 1 ? 'shell-header__breadcrumb-item--last' : ''}>{b}</span>
              </span>
            ))}
          </div>
        )}
        <div className="shell-header__title-row">
          <h1 className="shell-header__title">{title}</h1>
          {subtitle && <span className="shell-header__subtitle">{subtitle}</span>}
        </div>
      </div>

      <div className="shell-header__actions">
        <Buscador />
        <AmbitoSelector />
        {actions}
        <div className="shell-header__divider" />

        {/* Perfil */}
        <div className="shell-header__profile">
          <button onClick={() => setOpen(o => !o)} className="shell-header__profile-btn">
            <Ava name={user.nombre_completo} size={26} />
            <div style={{ textAlign: 'left' }}>
              <div className="shell-header__profile-name">
                {user.nombre_completo.split(' ').slice(0, 2).join(' ')}
              </div>
              <div className="shell-header__profile-role">
                {ROL_LABEL[user.rol]}
              </div>
            </div>
            <Ic n="chevronDown" s={12} style={{ color: 'var(--fx-tinta-3)' }} />
          </button>

          {open && (
            <>
              <div className="shell-header__dropdown-overlay" onClick={() => setOpen(false)} />
              <div className="shell-header__dropdown pop-in">
                {/* Info de usuario */}
                <div className="shell-header__dropdown-info">
                  <div className="shell-header__dropdown-name">{user.nombre_completo}</div>
                  <div className="shell-header__dropdown-email">{user.email}</div>
                </div>

                {/* Logout */}
                <div className="shell-header__dropdown-actions">
                  <button onClick={logout} className="shell-header__logout-btn">
                    <Ic n="logout" s={14} style={{ color: 'var(--fx-tinta-3)' }} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export interface ShellProps {
  current: string
  onNav: (id: string) => void
  title: string
  subtitle?: string
  breadcrumb?: string[]
  actions?: ReactNode
  children: ReactNode
}

export function Shell({ current, onNav, title, subtitle, breadcrumb, actions, children }: ShellProps) {
  // En celular el menú lateral se esconde y se abre con el botón "Menú".
  const [menu, setMenu] = useState(false)
  return (
    <div className={`shell dash-in${menu ? ' shell--menu' : ''}`}>
      <Sidebar current={current} onNav={(id) => { setMenu(false); onNav(id) }} />
      <div className="shell__velo" onClick={() => setMenu(false)} />
      <main className="shell__main">
        <Header title={title} subtitle={subtitle} breadcrumb={breadcrumb} actions={actions} onMenu={() => setMenu(true)} />
        <div className="shell__content screen-in">
          {children}
        </div>
      </main>
    </div>
  )
}
