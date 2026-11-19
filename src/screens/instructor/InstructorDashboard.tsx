import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import { InstFichas } from './InstFichas'
import type { TabEtapa } from './types'
import { InstReportes } from './InstReportes'
import { InstHistorial } from './InstHistorial'
import { InstAgenda } from './InstAgenda'
import { NuevoRegistro } from '../productiva/EtapaProductivaList'
import { Hoy } from '../hoy/Hoy'
import { Aprendices } from '../hoy/Aprendices'
import { Expediente } from '../expediente/Expediente'

const BASE = '/dashboard/instructor'

const SECTION_PATH: Record<string, string> = {
  'inst-home':             BASE,
  'inst-agenda':           `${BASE}/agenda?vista=calendario`,
  'inst-fichas':           `${BASE}/fichas`,
  'inst-etapa-productiva': `${BASE}/etapa-productiva`,
  'inst-historial':        `${BASE}/historial`,
  'inst-reportes':         `${BASE}/reportes`,
}

// Sección activa + título de página según la URL actual: cada patrón
// corresponde a una pantalla real.
const TITLE_RULES: { re: RegExp; title: string; section: string }[] = [
  { re: /^\/agenda\/?$/,                   title: 'Calendario',        section: 'inst-agenda' },
  { re: /^\/fichas\/[^/]+\/etapa\/[^/]+$/, title: 'Etapa productiva',  section: 'inst-fichas' },
  { re: /^\/fichas(\/[^/]+)?$/,            title: 'Mis fichas',        section: 'inst-fichas' },
  { re: /^\/etapa-productiva\/nueva$/,     title: 'Nuevo registro',    section: 'inst-etapa-productiva' },
  { re: /^\/etapa-productiva\/[^/]+$/,      title: 'Etapa productiva',  section: 'inst-etapa-productiva' },
  { re: /^\/etapa-productiva\/?$/,          title: 'Aprendices',        section: 'inst-etapa-productiva' },
  { re: /^\/historial\/[^/]+$/,            title: 'Etapa productiva',  section: 'inst-historial' },
  { re: /^\/historial\/?$/,                title: 'Historial',         section: 'inst-historial' },
  { re: /^\/reportes\/?$/,                 title: 'Reportes',          section: 'inst-reportes' },
]

function headerFor(pathname: string): { title: string; section: string } {
  const rest = pathname.slice(BASE.length) || '/'
  const rule = TITLE_RULES.find(r => r.re.test(rest))
  return rule ?? { title: 'Hoy', section: 'inst-home' }
}

export function InstructorDashboard() {
  "use no memo"
  const navigate = useNavigate()
  const location = useLocation()
  const { title, section } = headerFor(location.pathname)

  function onNav(id: string) {
    navigate(SECTION_PATH[id] ?? BASE)
  }

  // Al expediente, recordando de dónde se vino para el botón "volver".
  const abrirEtapa = (desde: 'hoy' | 'aprendices' | 'agenda') => (id: number, tab?: TabEtapa | null) =>
    navigate(`${BASE}/etapa-productiva/${id}${tab ? `?tab=${tab}` : ''}`, { state: { desde } })

  return (
    <Shell current={section} onNav={onNav} title={title} breadcrumb={['Instructor', title]}>
      <Routes>
        <Route index element={
          <Hoy
            onAbrir={abrirEtapa('hoy')}
            onFicha={id => navigate(`${BASE}/fichas/${id}`)}
            onNuevo={() => navigate(`${BASE}/etapa-productiva/nueva`)}
            onCalendario={() => navigate(`${BASE}/agenda?vista=calendario`)}
            onAprendices={() => navigate(`${BASE}/etapa-productiva`)}
          />
        }/>

        <Route path="fichas/*" element={<InstFichas/>}/>

        <Route path="etapa-productiva" element={<Outlet/>}>
          <Route index element={
            <Aprendices onAbrir={abrirEtapa('aprendices')} onNuevo={() => navigate('nueva')} onHistorial={() => navigate(`${BASE}/historial`)}/>
          }/>
          <Route path="nueva" element={
            <NuevoRegistro onCancel={() => navigate('..')} onCreated={id => navigate(`../${id}`, { replace: true })}/>
          }/>
          <Route path=":etapaId" element={<EtapaProductivaDetalleRoute/>}/>
        </Route>

        <Route path="agenda" element={
          <InstAgenda
            onVerEtapaProductiva={abrirEtapa('agenda')}
            onVerFicha={id => navigate(`${BASE}/fichas/${id}`)}
          />
        }/>

        <Route path="historial" element={<InstHistorial onOpenEtapa={id => navigate(`${BASE}/historial/${id}`)}/>}/>
        <Route path="historial/:etapaId" element={<HistorialEtapaRoute/>}/>

        <Route path="reportes" element={<InstReportes/>}/>

        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}

// Pestañas a las que se puede entrar directo (?tab=), p. ej. desde la Agenda.
const TABS_ETAPA: TabEtapa[] = ['cronograma', 'planeacion', 'seguimientos', 'evaluacion', 'bitacoras']

function EtapaProductivaDetalleRoute() {
  const { etapaId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const tab = TABS_ETAPA.find(t => t === params.get('tab'))
  // "Volver" regresa a donde se vino: Hoy, el calendario o la lista.
  const desde = (location.state as { desde?: string } | null)?.desde
  const VOLVER: Record<string, string> = { hoy: 'Hoy', agenda: 'Calendario', aprendices: 'Aprendices' }
  // La key remonta el detalle si cambia la pestaña pedida en la URL.
  return (
    <Expediente
      key={`${etapaId}-${tab ?? ''}`}
      etapaId={Number(etapaId)}
      abrir={tab}
      backLabel={VOLVER[desde ?? ''] ?? 'Aprendices'}
      onBack={() => (desde ? navigate(-1) : navigate('..'))}
    />
  )
}

function HistorialEtapaRoute() {
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return <Expediente etapaId={Number(etapaId)} backLabel="Historial" onBack={() => navigate('..')}/>
}
