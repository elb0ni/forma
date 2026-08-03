import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { InstructorHome } from './InstructorHome'
import { InstFichas } from './InstFichas'
import type { FichaInstructor } from './types'
import { InstSesionesList, InstSesionDetalle } from './InstSesiones'
import { SesionWizard } from './SesionWizard'
import { InstReportes } from './InstReportes'
import { EtapaProductivaList, NuevoRegistro } from '../productiva/EtapaProductivaList'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'

const BASE = '/dashboard/instructor'

const SECTION_PATH: Record<string, string> = {
  'inst-home':             BASE,
  'inst-fichas':           `${BASE}/fichas`,
  'inst-sesiones':         `${BASE}/sesiones`,
  'inst-etapa-productiva': `${BASE}/etapa-productiva`,
  'inst-reportes':         `${BASE}/reportes`,
}

// Sección activa + título de página según la URL actual (reemplaza el switch
// por useState de antes: cada patrón corresponde a una pantalla real).
const TITLE_RULES: { re: RegExp; title: string; section: string }[] = [
  { re: /^\/fichas\/[^/]+\/etapa\/[^/]+$/, title: 'Etapa productiva',  section: 'inst-fichas' },
  { re: /^\/fichas(\/[^/]+)?$/,            title: 'Mis fichas',        section: 'inst-fichas' },
  { re: /^\/sesiones\/nueva\/[^/]+$/,      title: 'Registrar sesión',  section: 'inst-sesiones' },
  { re: /^\/sesiones\/[^/]+$/,             title: 'Detalle de sesión', section: 'inst-sesiones' },
  { re: /^\/sesiones\/?$/,                 title: 'Sesiones',          section: 'inst-sesiones' },
  { re: /^\/etapa-productiva\/nueva$/,     title: 'Nuevo registro',    section: 'inst-etapa-productiva' },
  { re: /^\/etapa-productiva(\/[^/]+)?$/,  title: 'Etapa productiva',  section: 'inst-etapa-productiva' },
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

  function openReporte(fichaId: number) {
    navigate(`${BASE}/reportes?ficha=${fichaId}`)
  }

  function openFicha(f: FichaInstructor) {
    navigate(`${BASE}/fichas/${f.id}`, { state: { esPractica: f.es_practica } })
  }

  return (
    <Shell current={section} onNav={onNav} title={title} breadcrumb={['Instructor', title]}>
      <Routes>
        <Route index element={
          <InstructorHome
            onRegistrar={id => navigate(`${BASE}/sesiones/nueva/${id}`)}
            onOpenSesion={id => navigate(`${BASE}/sesiones/${id}`)}
            onOpenFicha={openFicha}
            onVerFichas={() => navigate(`${BASE}/fichas`)}
          />
        }/>

        <Route path="fichas/*" element={
          <InstFichas
            onRegistrar={id => navigate(`${BASE}/sesiones/nueva/${id}`)}
            onOpenSesion={id => navigate(`${BASE}/sesiones/${id}`)}
            onReporte={openReporte}
          />
        }/>

        <Route path="sesiones" element={<Outlet/>}>
          <Route index element={
            <InstSesionesList onOpen={id => navigate(String(id))} onNueva={() => navigate('nueva/0')}/>
          }/>
          <Route path="nueva/:asignacionId" element={<SesionWizardRoute/>}/>
          <Route path=":sesionId" element={<InstSesionDetalleRoute/>}/>
        </Route>

        <Route path="etapa-productiva" element={<Outlet/>}>
          <Route index element={
            <EtapaProductivaList onOpen={id => navigate(String(id))} onNuevo={() => navigate('nueva')}/>
          }/>
          <Route path="nueva" element={
            <NuevoRegistro onCancel={() => navigate('..')} onCreated={id => navigate(`../${id}`, { replace: true })}/>
          }/>
          <Route path=":etapaId" element={<EtapaProductivaDetalleRoute/>}/>
        </Route>

        <Route path="reportes" element={<InstReportesRoute/>}/>

        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}

function SesionWizardRoute() {
  const { asignacionId } = useParams()
  const navigate = useNavigate()
  return (
    <SesionWizard
      asignacionId={Number(asignacionId)}
      onCancel={() => navigate('..')}
      onSaved={id => navigate(`../${id}`, { replace: true, state: { justSaved: true } })}
    />
  )
}

function InstSesionDetalleRoute() {
  const { sesionId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const justSaved = !!(location.state as { justSaved?: boolean } | null)?.justSaved
  return <InstSesionDetalle sesionId={Number(sesionId)} justSaved={justSaved} onBack={() => navigate('..')}/>
}

function EtapaProductivaDetalleRoute() {
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return <EtapaProductivaDetalle etapaId={Number(etapaId)} onBack={() => navigate('..')}/>
}

function InstReportesRoute() {
  const [params] = useSearchParams()
  const ficha = params.get('ficha')
  return <InstReportes initialFichaId={ficha ? Number(ficha) : undefined}/>
}
