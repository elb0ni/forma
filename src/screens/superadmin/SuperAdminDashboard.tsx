import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { DashboardHome } from './DashboardHome'
import { ProgramasFormacion } from './ProgramasFormacion'
import { DisenosCurriculares } from './DisenosCurriculares'
import { FichasAdmin } from '../shared/FichasAdmin'
import { CentrosCoord } from './CentrosCoord'
import { UsuariosAdmin } from './UsuariosAdmin'
import { ReportesAdmin } from '../shared/ReportesAdmin'
import { SofiaSync } from './SofiaSync'

const BASE = '/dashboard/superadmin'

// id de nav (para resaltar el sidebar) ↔ segmento de URL
const SECTION_PATH: Record<string, string> = {
  'admin-home':      BASE,
  'admin-programas': `${BASE}/programas`,
  'admin-disenos':   `${BASE}/disenos`,
  'admin-fichas':    `${BASE}/fichas`,
  'admin-centros':   `${BASE}/centros`,
  'admin-usuarios':  `${BASE}/usuarios`,
  'admin-reportes':  `${BASE}/reportes`,
  'admin-sofia':     `${BASE}/sofia`,
}

const SECTION_BY_SEGMENT: Record<string, string> = {
  '':          'admin-home',
  programas:   'admin-programas',
  disenos:     'admin-disenos',
  fichas:      'admin-fichas',
  centros:     'admin-centros',
  usuarios:    'admin-usuarios',
  reportes:    'admin-reportes',
  sofia:       'admin-sofia',
}

const ADMIN_TITLES: Record<string, string> = {
  'admin-home':      'Dashboard',
  'admin-programas': 'Programas de formación',
  'admin-disenos':   'Diseños curriculares',
  'admin-fichas':    'Fichas en etapa productiva',
  'admin-centros':   'Centros y coordinaciones',
  'admin-usuarios':  'Gestión de usuarios',
  'admin-reportes':  'Reportes ejecutivos',
  'admin-sofia':     'Sincronización SofiaPlus',
}

function sectionFor(pathname: string): string {
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname
  const seg = rest.replace(/^\/+/, '').split('/')[0]
  return SECTION_BY_SEGMENT[seg] ?? 'admin-home'
}

export function SuperAdminDashboard() {
  "use no memo"
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const navItem = sectionFor(pathname)
  const title = ADMIN_TITLES[navItem] ?? navItem
  const breadcrumb = navItem === 'admin-home' ? ['Regional Atlántico'] : ['SUPER ADMIN', title]

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
        <Route path="programas/*" element={<ProgramasFormacion/>}/>
        <Route path="disenos" element={<DisenosCurriculares/>}/>
        <Route path="fichas/*" element={<FichasAdmin/>}/>
        <Route path="centros/*" element={<CentrosCoord/>}/>
        <Route path="usuarios/*" element={<UsuariosAdmin/>}/>
        <Route path="reportes" element={<ReportesAdmin/>}/>
        <Route path="sofia/*" element={<SofiaSync/>}/>
        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}
