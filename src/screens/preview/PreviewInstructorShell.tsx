import { useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ic, BrandMark, Ava, Bdg } from '../../components/ui'
import type { IcName } from '../../components/ui'
import '../../components/Shell.css'

// ─── Réplica del Shell real (sidebar + header) para maquetas sin sesión ──────────
// Usa las mismas clases de Shell.css, así que cualquier cambio visual al Shell
// real se refleja aquí también. Datos de usuario/centro son estáticos (mock).

interface NavItem { id: string; label: string; icon: IcName }

const NAV: NavItem[] = [
  { id: 'inst-home',             label: 'Inicio',            icon: 'home'      },
  { id: 'inst-fichas',           label: 'Mis fichas',        icon: 'folder'    },
  { id: 'inst-sesiones',         label: 'Sesiones',          icon: 'list'      },
  { id: 'inst-etapa-productiva', label: 'Etapa productiva',  icon: 'briefcase' },
  { id: 'inst-reportes',         label: 'Reportes',          icon: 'trend'     },
]

const MOCK_USER = {
  nombre: 'Jorge Sánchez',
  rol:    'Instructor',
  centro: 'Centro de formación',
  email:  'jorge.sanchez@sena.edu.co',
}

export function PreviewInstructorShell({ breadcrumb, title, children }: {
  breadcrumb: string[]; title: string; children: ReactNode
}) {
  "use no memo"
  const navigate = useNavigate()
  const [activeNav, setActiveNav] = useState('inst-fichas')
  const [notice, setNotice] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  function onNav(id: string) {
    setActiveNav(id)
    if (id !== 'inst-fichas') {
      setNotice(true)
      setTimeout(() => setNotice(false), 2500)
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar__logo">
          <BrandMark size={24}/>
          <div>
            <div className="sidebar__brand-name">FORMA</div>
            <div className="sidebar__brand-sub">Seguimiento curricular</div>
          </div>
        </div>

        <div className="sidebar__centro">
          <div className="sidebar__centro-inner">
            <div className="sidebar__centro-badge">CT</div>
            <div className="sidebar__centro-info">
              <div className="sidebar__centro-name">{MOCK_USER.centro}</div>
              <div className="sidebar__centro-org">SENA</div>
            </div>
            <Ic n="chevronDown" s={12} style={{ color: '#71717a' }}/>
          </div>
        </div>

        <nav className="sidebar__nav">
          <div className="sidebar__nav-section">Instructor</div>
          {NAV.map(it => (
            <button key={it.id} onClick={() => onNav(it.id)}
              className={`sidebar__nav-btn${activeNav === it.id ? ' sidebar__nav-btn--active' : ''}`}>
              <Ic n={it.icon} s={15} style={{ color: activeNav === it.id ? '#0a0a0b' : '#71717a' }}/>
              <span style={{ flex: 1, textAlign: 'left' }}>{it.label}</span>
            </button>
          ))}

          <div className="sidebar__nav-section" style={{ paddingTop: 18 }}>Cuenta</div>
          <button className="sidebar__nav-btn" onClick={() => onNav('inst-ajustes')}>
            <Ic n="cog" s={15} style={{ color: '#71717a' }}/>
            Ajustes
          </button>
        </nav>

        <div className="sidebar__user">
          <div className="sidebar__user-inner">
            <Ava name={MOCK_USER.nombre} size={28}/>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar__user-name">{MOCK_USER.nombre}</div>
              <div className="sidebar__user-role">{MOCK_USER.rol}</div>
            </div>
          </div>
        </div>
      </aside>

      <main className="shell__main">
        <header className="shell-header">
          <div className="shell-header__info">
            <div className="shell-header__breadcrumb">
              {breadcrumb.map((b, i) => (
                <span key={i} className="shell-header__breadcrumb-item">
                  {i > 0 && <Ic n="chevronRight" s={11} style={{ color: '#a1a1aa' }}/>}
                  <span className={i === breadcrumb.length - 1 ? 'shell-header__breadcrumb-item--last' : ''}>{b}</span>
                </span>
              ))}
            </div>
            <div className="shell-header__title-row">
              <h1 className="shell-header__title">{title}</h1>
            </div>
          </div>

          <div className="shell-header__actions">
            <Bdg tone="accent" icon="sparkles">Vista de prueba</Bdg>
            <div className="shell-header__divider"/>
            <div className="shell-header__profile">
              <button className="shell-header__profile-btn" onClick={() => setProfileOpen(o => !o)}>
                <Ava name={MOCK_USER.nombre} size={26}/>
                <div style={{ textAlign: 'left' }}>
                  <div className="shell-header__profile-name">{MOCK_USER.nombre}</div>
                  <div className="shell-header__profile-role">{MOCK_USER.rol}</div>
                </div>
                <Ic n="chevronDown" s={12} style={{ color: '#71717a' }}/>
              </button>

              {profileOpen && (
                <>
                  <div className="shell-header__dropdown-overlay" onClick={() => setProfileOpen(false)}/>
                  <div className="shell-header__dropdown pop-in">
                    <div className="shell-header__dropdown-info">
                      <div className="shell-header__dropdown-name">{MOCK_USER.nombre}</div>
                      <div className="shell-header__dropdown-email">{MOCK_USER.email}</div>
                    </div>
                    <div className="shell-header__dropdown-actions">
                      <button className="shell-header__logout-btn" onClick={() => navigate('/login')}>
                        <Ic n="logout" s={14} style={{ color: '#71717a' }}/>
                        Cerrar sesión
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Shell.css declara overflow-y:auto acá, pero esta caja nunca crece más que su
            contenido — es la ventana la que hace scroll. Esa declaración "muerta" igual
            cuenta como scroll container para position:sticky, así que un hijo sticky (el
            calendario de la vista de competencia) nunca reacciona a scroll real. Se resetea
            a visible para que el sticky se ate a la ventana, que es lo que de verdad se mueve. */}
        <div className="shell__content screen-in" style={{ overflowY: 'visible' }}>
          {notice && (
            <div style={{
              marginBottom: 14, fontSize: 12, color: '#52525b', background: '#f7f7f8',
              border: '1px solid #e4e4e7', borderRadius: 8, padding: '8px 12px',
            }}>
              Solo la vista de competencia está maquetada en este prototipo — las demás secciones aún no tienen contenido.
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  )
}
