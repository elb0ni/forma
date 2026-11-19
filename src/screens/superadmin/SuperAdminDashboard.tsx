import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { DashboardHome } from './DashboardHome'
import { ProgramasFormacion } from './ProgramasFormacion'
import { FichasAdmin } from '../shared/FichasAdmin'
import { CentrosCoord } from './CentrosCoord'
import { UsuariosAdmin } from './UsuariosAdmin'
import { ReportesAdmin } from '../shared/ReportesAdmin'
import { Integridad } from './Integridad'
import { Asignacion } from '../panorama/Asignacion'
import { Panorama } from '../panorama/Panorama'
import { Datos } from '../panorama/Datos'
import { Catalogo } from './CatalogoVista'
import { useAuthStore } from '../../store/auth'

const BASE = '/dashboard/superadmin'

// id de nav (para resaltar el sidebar) ↔ segmento de URL
const SECTION_PATH: Record<string, string> = {
  'admin-home':      BASE,
  'admin-panorama':  `${BASE}/panorama`,
  'admin-programas': `${BASE}/programas`,
  'admin-fichas':    `${BASE}/fichas`,
  'admin-asignacion': `${BASE}/asignacion`,
  'admin-centros':   `${BASE}/centros`,
  'admin-usuarios':  `${BASE}/usuarios`,
  'admin-reportes':  `${BASE}/reportes`,
  'admin-integridad': `${BASE}/integridad`,
  'admin-datos':     `${BASE}/datos`,
  'admin-catalogo':  `${BASE}/catalogo`,
}

const SECTION_BY_SEGMENT: Record<string, string> = {
  '':          'admin-home',
  panorama:    'admin-panorama',
  programas:   'admin-programas',
  fichas:      'admin-fichas',
  asignacion:  'admin-asignacion',
  instructores: 'admin-usuarios',
  centros:     'admin-centros',
  usuarios:    'admin-usuarios',
  reportes:    'admin-reportes',
  integridad:  'admin-integridad',
  datos:       'admin-datos',
  catalogo:    'admin-catalogo',
}

const ADMIN_TITLES: Record<string, string> = {
  'admin-home':      'Dashboard',
  'admin-panorama':  'Panorama',
  'admin-programas': 'Programas de formación',
  'admin-fichas':    'Fichas en etapa productiva',
  'admin-asignacion': 'Asignación de instructores',
  'admin-centros':   'Centros y coordinaciones',
  'admin-usuarios':  'Gestión de usuarios',
  'admin-reportes':  'Reportes ejecutivos',
  'admin-integridad': 'Integridad de datos',
  'admin-datos':     'Datos',
  'admin-catalogo':  'Catálogo del centro',
}

function sectionFor(pathname: string): string {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname
  const seg = rest.replace(/^\/+/, '').split('/')[0]
  return SECTION_BY_SEGMENT[seg] ?? 'admin-home'
}

// Las rutas viejas de SofiaPlus (/sofia, /sofia/:id) viven ahora dentro de Integridad.
function SofiaRedirect() {
  const { pathname } = useLocation()
  return <Navigate to={pathname.replace(`${BASE}/sofia`, `${BASE}/integridad/sofia`)} replace/>
}

export function SuperAdminDashboard() {
  "use no memo"
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const navItem = sectionFor(pathname)
  const title = ADMIN_TITLES[navItem] ?? navItem
  const esSubdirector = useAuthStore(s => s.user?.rol) === 'SUBDIRECTOR'
  const raiz = esSubdirector ? 'SUBDIRECCIÓN' : 'SUPER ADMIN'
  const breadcrumb = navItem === 'admin-home' ? [esSubdirector ? 'Mi centro' : 'Regional Atlántico'] : [raiz, title]

  function onNav(id: string) {
    navigate(SECTION_PATH[id] ?? BASE)
  }

  return (
    <Shell current={navItem} onNav={onNav} title={title} breadcrumb={breadcrumb}>
      <Routes>
        <Route index element={
          <DashboardHome
            onNav={onNav}
            onOpenFicha={id => navigate(`${BASE}/fichas/${id}`)}
          />
        }/>
        <Route path="panorama" element={
          <Panorama rutaEtapa={(f, e) => `${BASE}/fichas/${f}/etapa/${e}`} rutaAsignacion={`${BASE}/asignacion`}/>
        }/>
        <Route path="programas/*" element={<ProgramasFormacion/>}/>
        <Route path="disenos" element={<Navigate to={`${BASE}/integridad/disenos`} replace/>}/>
        <Route path="fichas/*" element={<FichasAdmin/>}/>
        <Route path="asignacion" element={<Asignacion rutaFicha={id => `${BASE}/fichas/${id}`}/>}/>
        {/* Los instructores se ven ahora en Usuarios (con su actividad y detalle). */}
        <Route path="instructores/*" element={<Navigate to={`${BASE}/usuarios`} replace/>}/>
        <Route path="centros/*" element={<CentrosCoord/>}/>
        <Route path="usuarios/*" element={<UsuariosAdmin/>}/>
        <Route path="reportes" element={<ReportesAdmin/>}/>
        <Route path="integridad/*" element={<Integridad/>}/>
        <Route path="datos" element={<Datos rutaIntegridad={esSubdirector ? undefined : `${BASE}/integridad`}/>}/>
        <Route path="catalogo" element={<Catalogo deCentro/>}/>
        <Route path="sofia/*" element={<SofiaRedirect/>}/>
        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}
