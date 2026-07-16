import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ic, BrandMark, Ava } from './ui'
import type { IcName } from './ui'
import { SettingsModal } from './SettingsModal'
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
}

// Nav compartido por los roles de coordinación (subdirector / misional / académico)
const COORD_NAV: NavItem[] = [
  { id: 'coord-home',         label: 'Dashboard',    icon: 'home'   },
  { id: 'coord-fichas',       label: 'Mis fichas',   icon: 'folder' },
  { id: 'coord-instructores', label: 'Instructores', icon: 'users'  },
  { id: 'coord-reportes',     label: 'Reportes',     icon: 'trend'  },
  { id: 'coord-alertas',      label: 'Alertas',      icon: 'bell'   },
]

const NAV: Record<UserRole, NavItem[]> = {
  SUPER_ADMIN: [
    { id: 'admin-home',      label: 'Dashboard',       icon: 'home'      },
    { id: 'admin-dig',       label: 'Digitalización',  icon: 'upload'    },
    { id: 'admin-programas', label: 'Programas',        icon: 'layers'    },
    { id: 'admin-fichas',    label: 'Fichas',           icon: 'briefcase' },
    { id: 'admin-centros',   label: 'Centros',          icon: 'shield'    },
    { id: 'admin-usuarios',  label: 'Usuarios',         icon: 'users'     },
    { id: 'admin-reportes',  label: 'Reportes',         icon: 'trend'     },
  ],
  SUBDIRECTOR:     COORD_NAV,
  COORD_MISIONAL:  COORD_NAV,
  COORD_ACADEMICO: COORD_NAV,
  INSTRUCTOR: [
    { id: 'inst-home', label: 'Inicio', icon: 'home' },
    { id: 'inst-fichas', label: 'Mis fichas', icon: 'folder' },
    { id: 'inst-sesiones', label: 'Sesiones', icon: 'list' },
    { id: 'inst-reportes', label: 'Reportes', icon: 'trend' },
  ],
}

const ROL_LABEL: Record<UserRole, string> = {
  SUPER_ADMIN:     'Administración',
  SUBDIRECTOR:     'Subdirección',
  COORD_MISIONAL:  'Coord. Misional',
  COORD_ACADEMICO: 'Coord. Académico',
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
              Seguimiento curricular
            </div>
          </div>
        </div>

        {/* Centro (placeholder) */}
        <div className="sidebar__centro">
          <div className="sidebar__centro-inner">
            <div className="sidebar__centro-badge">CT</div>
            <div className="sidebar__centro-info">
              <div className="sidebar__centro-name">
                {user.centro_formacion || 'Centro de formación'}
              </div>
              <div className="sidebar__centro-org">SENA</div>
            </div>
            <Ic n="chevronDown" s={12} style={{ color: '#71717a' }} />
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
              <button
                key={it.id}
                onClick={() => onNav(it.id)}
                className={`sidebar__nav-btn${active ? ' sidebar__nav-btn--active' : ''}`}
              >
                <Ic n={it.icon} s={15} style={{ color: active ? '#0a0a0b' : '#71717a' }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
                {it.badge !== undefined && (
                  <span className={`sidebar__nav-badge ${typeof it.badge === 'number' ? 'sidebar__nav-badge--number' : 'sidebar__nav-badge--text'}`}>
                    {it.badge}
                  </span>
                )}
              </button>
            )
          })}

          <div className="sidebar__nav-section" style={{ paddingTop: 18 }}>
            Cuenta
          </div>
          <button className="sidebar__nav-btn" onClick={() => setIsOpenModal(true)}>
            <Ic n="cog" s={15} style={{ color: '#71717a' }} />
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
}

function Header({ title, subtitle, breadcrumb, actions }: HeaderProps) {
  const navigate = useNavigate()
  const user = useAuthStore(s => s.user)!
  const clearUser = useAuthStore(s => s.clearUser)
  const [open, setOpen] = useState(false)

  async function logout() {
    setOpen(false)
    await api.post('/auth/logout').catch(() => { })
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <header className="shell-header">
      <div className="shell-header__info">
        {breadcrumb && (
          <div className="shell-header__breadcrumb">
            {breadcrumb.map((b, i) => (
              <span key={i} className="shell-header__breadcrumb-item">
                {i > 0 && <Ic n="chevronRight" s={11} style={{ color: '#a1a1aa' }} />}
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
            <Ic n="chevronDown" s={12} style={{ color: '#71717a' }} />
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
                    <Ic n="logout" s={14} style={{ color: '#71717a' }} />
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
  return (
    <div className="shell dash-in">
      <Sidebar current={current} onNav={onNav} />
      <main className="shell__main">
        <Header title={title} subtitle={subtitle} breadcrumb={breadcrumb} actions={actions} />
        <div className="shell__content screen-in">
          {children}
        </div>
      </main>
    </div>
  )
}
