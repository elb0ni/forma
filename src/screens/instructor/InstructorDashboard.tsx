import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { InstructorHome } from './InstructorHome'
import { InstFichas } from './InstFichas'
import type { FichaInstructor } from './types'
import { InstReportes } from './InstReportes'
import { InstHistorial } from './InstHistorial'
import { InstAgenda } from './InstAgenda'
import { EtapaProductivaList, NuevoRegistro } from '../productiva/EtapaProductivaList'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'

const BASE = '/dashboard/instructor'

const SECTION_PATH: Record<string, string> = {
  'inst-home':             BASE,
  'inst-agenda':           `${BASE}/agenda`,
  'inst-fichas':           `${BASE}/fichas`,
  'inst-etapa-productiva': `${BASE}/etapa-productiva`,
  'inst-historial':        `${BASE}/historial`,
  'inst-reportes':         `${BASE}/reportes`,
}

// Sección activa + título de página según la URL actual: cada patrón
// corresponde a una pantalla real.
const TITLE_RULES: { re: RegExp; title: string; section: string }[] = [
  { re: /^\/agenda\/?$/,                   title: 'Agenda',            section: 'inst-agenda' },
  { re: /^\/fichas\/[^/]+\/etapa\/[^/]+$/, title: 'Etapa productiva',  section: 'inst-fichas' },
  { re: /^\/fichas(\/[^/]+)?$/,            title: 'Mis fichas',        section: 'inst-fichas' },
  { re: /^\/etapa-productiva\/nueva$/,     title: 'Nuevo registro',    section: 'inst-etapa-productiva' },
  { re: /^\/etapa-productiva(\/[^/]+)?$/,  title: 'Etapa productiva',  section: 'inst-etapa-productiva' },
  { re: /^\/historial\/[^/]+$/,            title: 'Etapa productiva',  section: 'inst-historial' },
  { re: /^\/historial\/?$/,                title: 'Historial',         section: 'inst-historial' },
  { re: /^\/reportes\/?$/,                 title: 'Reportes',          section: 'inst-reportes' },
]

function headerFor(pathname: string): { title: string; section: string } {
  const rest = pathname.slice(BASE.length) || '/'
  const rule = TITLE_RULES.find(r => r.re.test(rest))
  return rule ?? { title: 'Inicio', section: 'inst-home' }
}

export function InstructorDashboard() {
  "use no memo"
  const navigate = useNavigate()
  const location = useLocation()
  const { title, section } = headerFor(location.pathname)

  function onNav(id: string) {
    navigate(SECTION_PATH[id] ?? BASE)
  }

  function openFicha(f: FichaInstructor) {
    navigate(`${BASE}/fichas/${f.id}`)
  }

  return (
    <Shell current={section} onNav={onNav} title={title} breadcrumb={['Instructor', title]}>
      <Routes>
        <Route index element={
          <InstructorHome
            onOpenFicha={openFicha}
            onVerFichas={() => navigate(`${BASE}/fichas`)}
            onVerEtapaProductiva={id => navigate(`${BASE}/etapa-productiva/${id}`)}
            onVerAgenda={() => navigate(`${BASE}/agenda`)}
            onVerHistorial={() => navigate(`${BASE}/historial`)}
          />
        }/>

        <Route path="fichas/*" element={<InstFichas/>}/>

        <Route path="etapa-productiva" element={<Outlet/>}>
          <Route index element={
            <EtapaProductivaList onOpen={id => navigate(String(id))} onNuevo={() => navigate('nueva')}/>
          }/>
          <Route path="nueva" element={
            <NuevoRegistro onCancel={() => navigate('..')} onCreated={id => navigate(`../${id}`, { replace: true })}/>
          }/>
          <Route path=":etapaId" element={<EtapaProductivaDetalleRoute/>}/>
        </Route>

        <Route path="agenda" element={
          <InstAgenda onVerEtapaProductiva={id => navigate(`${BASE}/etapa-productiva/${id}`)}/>
        }/>

        <Route path="historial" element={<InstHistorial onOpenEtapa={id => navigate(`${BASE}/historial/${id}`)}/>}/>
        <Route path="historial/:etapaId" element={<HistorialEtapaRoute/>}/>

        <Route path="reportes" element={<InstReportes/>}/>

        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}

function EtapaProductivaDetalleRoute() {
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return <EtapaProductivaDetalle etapaId={Number(etapaId)} onBack={() => navigate('..')}/>
}

function HistorialEtapaRoute() {
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return <EtapaProductivaDetalle etapaId={Number(etapaId)} backLabel="Historial" onBack={() => navigate('..')}/>
}
