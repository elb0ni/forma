import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { useAuthStore } from '../../store/auth'
import { FichasAdmin } from '../shared/FichasAdmin'
import { ReportesAdmin } from '../shared/ReportesAdmin'
import { EquipoRutas } from '../panorama/Equipo'
import { CoordAlertas } from './CoordAlertas'
import { Asignacion } from '../panorama/Asignacion'
import { Panorama } from '../panorama/Panorama'

const BASE = '/dashboard/coordinador'

const SECTION_PATH: Record<string, string> = {
  'coord-home':         BASE,
  'coord-resumen':      `${BASE}/resumen`,
  'coord-fichas':       `${BASE}/fichas`,
  'coord-instructores': `${BASE}/instructores`,
  'coord-asignacion':   `${BASE}/asignacion`,
  'coord-reportes':     `${BASE}/reportes`,
  'coord-alertas':      `${BASE}/alertas`,
}

const SECTION_BY_SEGMENT: Record<string, string> = {
  '':            'coord-home',
  resumen:       'coord-resumen',
  fichas:        'coord-fichas',
  instructores:  'coord-instructores',
  asignacion:    'coord-asignacion',
  reportes:      'coord-reportes',
  alertas:       'coord-alertas',
}

const COORD_TITLES: Record<string, string> = {
  'coord-home':         'Mi coordinación',
  'coord-resumen':      'Resumen anterior',
  'coord-fichas':       'Fichas',
  'coord-instructores': 'Equipo',
  'coord-asignacion':   'Asignación',
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
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fx-tinta)' }}>Sin coordinación asignada</div>
        <div style={{ fontSize: 13, color: 'var(--fx-tinta-3)', maxWidth: 360 }}>
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
          <Panorama
            rutaEtapa={(f, e) => `${BASE}/fichas/${f}/etapa/${e}`}
            rutaAsignacion={`${BASE}/asignacion`}
            rutaAlertas={`${BASE}/alertas`}
            onOpenFicha={id => navigate(`${BASE}/fichas/${id}`)}
          />
        }/>
        {/* El resumen anterior se unió a Inicio (PLAN_REDISENO v3). */}
        <Route path="resumen" element={<Navigate to={BASE} replace/>}/>
        <Route path="fichas/*" element={<CoordFichas/>}/>
        <Route path="instructores/*" element={<EquipoRutas/>}/>
        <Route path="asignacion" element={<Asignacion rutaFicha={id => `${BASE}/fichas/${id}`}/>}/>
        <Route path="reportes" element={<CoordReportes/>}/>
        <Route path="alertas" element={
          <CoordAlertas onOpenFicha={id => navigate(`${BASE}/fichas/${id}`)}/>
        }/>
        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}
