import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { useAuthStore } from '../../store/auth'
import { FichasAdmin } from '../shared/FichasAdmin'
import { ReportesAdmin } from '../shared/ReportesAdmin'
import { CoordinadorHome } from './CoordinadorHome'
import { CoordInstructores } from './CoordInstructores'
import { CoordAlertas } from './CoordAlertas'

const BASE = '/dashboard/coordinador'

const SECTION_PATH: Record<string, string> = {
  'coord-home':         BASE,
  'coord-fichas':       `${BASE}/fichas`,
  'coord-instructores': `${BASE}/instructores`,
  'coord-reportes':     `${BASE}/reportes`,
  'coord-alertas':      `${BASE}/alertas`,
}

const SECTION_BY_SEGMENT: Record<string, string> = {
  '':            'coord-home',
  fichas:        'coord-fichas',
  instructores:  'coord-instructores',
  reportes:      'coord-reportes',
  alertas:       'coord-alertas',
}

const COORD_TITLES: Record<string, string> = {
  'coord-home':         'Dashboard',
  'coord-fichas':       'Fichas en práctica',
  'coord-instructores': 'Instructores de práctica',
  'coord-reportes':     'Reportes',
  'coord-alertas':      'Alertas',
}

function sectionFor(pathname: string): string {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname
  const seg = rest.replace(/^\/+/, '').split('/')[0]
  return SECTION_BY_SEGMENT[seg] ?? 'coord-home'
}

// Fichas de la coordinación del usuario -- si su usuario no tiene coordinación
// académica asignada, no hay nada que mostrar.
function CoordFichas() {
  "use no memo"
  const user = useAuthStore(s => s.user)
  if (user?.coordinacion_academica_id == null || user?.centro_formacion_id == null) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 320, gap: 12, textAlign: 'center',
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>Sin coordinación asignada</div>
        <div style={{ fontSize: 13, color: '#71717a', maxWidth: 360 }}>
          Tu usuario no tiene una coordinación académica asignada. Pide a un administrador que te la asigne para gestionar fichas.
        </div>
      </div>
    )
  }
  return (
    <FichasAdmin
      scope={{
        coordinacionId: user.coordinacion_academica_id,
        centroId:       user.centro_formacion_id,
      }}
    />
  )
}

function CoordReportes() {
  "use no memo"
  const user = useAuthStore(s => s.user)
  return <ReportesAdmin coordinacionId={user?.coordinacion_academica_id ?? undefined} allowCentro={false}/>
}

export function CoordinadorDashboard() {
  "use no memo"
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const navItem = sectionFor(pathname)
  const title = COORD_TITLES[navItem] ?? 'Coordinación'

  function onNav(id: string) {
    navigate(SECTION_PATH[id] ?? BASE)
  }

  return (
    <Shell current={navItem} onNav={onNav} title={title} breadcrumb={['Coordinación', title]}>
      <Routes>
        <Route index element={
          <CoordinadorHome
            onNav={onNav}
            onOpenFicha={id => navigate(`${BASE}/fichas/${id}`)}
          />
        }/>
        <Route path="fichas/*" element={<CoordFichas/>}/>
        <Route path="instructores/*" element={<CoordInstructores/>}/>
        <Route path="reportes" element={<CoordReportes/>}/>
        <Route path="alertas" element={
          <CoordAlertas onOpenFicha={id => navigate(`${BASE}/fichas/${id}`)}/>
        }/>
        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}
