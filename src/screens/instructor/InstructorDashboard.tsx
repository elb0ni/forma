import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { Shell } from '../../components/Shell'
import api from '../../lib/api'
import { InstFichas } from './InstFichas'
import type { TabEtapa } from './types'
import { InstReportes } from './InstReportes'
import { CrearEtapaProductivaForm } from '../productiva/EtapaProductivaList'
import type { Aprendiz } from '../productiva/types'
import { Hoy } from '../hoy/Hoy'
import { Aprendices } from '../hoy/Aprendices'
import { esFiltro } from '../hoy/comun'
import { Bitacoras } from '../hoy/Bitacoras'
import { Calendario } from '../hoy/Calendario'
import { Expediente } from '../expediente/Expediente'
import type { AbrirEn } from '../expediente/Expediente'
import { Lienzo, Frase } from '../../ui'

const BASE = '/dashboard/instructor'

// Menú del instructor (Fase 19): Hoy · Aprendices · Bitácoras · Calendario · Reportes.
const SECTION_PATH: Record<string, string> = {
  'inst-home':             BASE,
  'inst-etapa-productiva': `${BASE}/etapa-productiva`,
  'inst-bitacoras':        `${BASE}/bitacoras`,
  'inst-calendario':       `${BASE}/calendario`,
  'inst-reportes':         `${BASE}/reportes`,
}

// Sección activa + título de página según la URL actual: cada patrón
// corresponde a una pantalla real.
const TITLE_RULES: { re: RegExp; title: string; section: string }[] = [
  { re: /^\/calendario\/?$/,               title: 'Calendario',        section: 'inst-calendario' },
  { re: /^\/bitacoras\/?$/,                title: 'Bitácoras',         section: 'inst-bitacoras' },
  { re: /^\/fichas\/[^/]+\/etapa\/[^/]+$/, title: 'Etapa productiva',  section: 'inst-etapa-productiva' },
  { re: /^\/fichas(\/[^/]+)?$/,            title: 'Ficha',             section: 'inst-etapa-productiva' },
  { re: /^\/etapa-productiva\/nueva$/,     title: 'Registrar etapa',   section: 'inst-etapa-productiva' },
  { re: /^\/etapa-productiva\/[^/]+$/,      title: 'Etapa productiva',  section: 'inst-etapa-productiva' },
  { re: /^\/etapa-productiva\/?$/,          title: 'Aprendices',        section: 'inst-etapa-productiva' },
  { re: /^\/historial\/[^/]+$/,            title: 'Etapa productiva',  section: 'inst-reportes' },
  { re: /^\/reportes\/?$/,                 title: 'Reportes',          section: 'inst-reportes' },
]

function headerFor(pathname: string): { title: string; section: string } {
  const rest = pathname.slice(BASE.length) || '/'
  const rule = TITLE_RULES.find(r => r.re.test(rest))
  return rule ?? { title: 'Hoy', section: 'inst-home' }
}

type Desde = 'hoy' | 'aprendices' | 'agenda' | 'bitacoras' | 'reportes'

export function InstructorDashboard() {
  "use no memo"
  const navigate = useNavigate()
  const location = useLocation()
  const { title, section } = headerFor(location.pathname)
  // La vista Calendario vivía dentro de Hoy (?vista=calendario).
  const vistaCalendario = new URLSearchParams(location.search).get('vista') === 'calendario'

  function onNav(id: string) {
    navigate(SECTION_PATH[id] ?? BASE)
  }

  // Al expediente, recordando de dónde se vino para el botón "volver".
  const abrirEtapa = (desde: Desde) => (id: number, tab?: TabEtapa | null) =>
    navigate(`${BASE}/etapa-productiva/${id}${tab ? `?tab=${tab}` : ''}`, { state: { desde } })
  const verFicha = (id: number) => navigate(`${BASE}/fichas/${id}`)

  return (
    <Shell current={section} onNav={onNav} title={title} breadcrumb={['Instructor', title]}>
      <Routes>
        <Route index element={
          vistaCalendario ? <Navigate to={`${BASE}/calendario`} replace/> : (
            <Hoy
              onAbrir={abrirEtapa('hoy')}
              onFicha={verFicha}
              onPorRegistrar={fichaId => navigate(`${BASE}/etapa-productiva?ficha=${fichaId}`)}
              onBitacora={(etapa, n) => navigate(`${BASE}/bitacoras?etapa=${etapa}&n=${n}`)}
              onBitacoras={() => navigate(`${BASE}/bitacoras`)}
              onAprendices={filtro => navigate(`${BASE}/etapa-productiva${filtro ? `?filtro=${filtro}` : ''}`)}
            />
          )
        }/>

        <Route path="fichas/*" element={<InstFichas/>}/>

        <Route path="etapa-productiva" element={<Outlet/>}>
          <Route index element={<AprendicesRoute abrir={abrirEtapa('aprendices')} verFicha={verFicha}/>}/>
          <Route path="nueva" element={<RegistrarEtapaRoute/>}/>
          <Route path=":etapaId" element={<EtapaProductivaDetalleRoute/>}/>
        </Route>

        <Route path="bitacoras" element={<Bitacoras onAbrir={abrirEtapa('bitacoras')}/>}/>
        <Route path="calendario" element={
          <Calendario onAbrir={abrirEtapa('agenda')} onFicha={verFicha} onHoy={() => navigate(BASE)}/>
        }/>
        <Route path="agenda" element={<Navigate to={`${BASE}/calendario`} replace/>}/>

        <Route path="reportes" element={
          <InstReportes
            onAbrir={id => abrirEtapa('reportes')(id)}
            onDocumento={id => navigate(`${BASE}/etapa-productiva/${id}?tab=documento`, { state: { desde: 'reportes' } })}
          />
        }/>
        {/* El historial vive ahora en Reportes ("Lo que hiciste"). */}
        <Route path="historial" element={<Navigate to={`${BASE}/reportes`} replace/>}/>
        <Route path="historial/:etapaId" element={<HistorialEtapaRoute/>}/>

        <Route path="*" element={<Navigate to={BASE} replace/>}/>
      </Routes>
    </Shell>
  )
}

function AprendicesRoute({ abrir, verFicha }: {
  abrir: (id: number, tab?: TabEtapa | null) => void
  verFicha: (id: number) => void
}) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const filtro = params.get('filtro')
  const ficha = Number(params.get('ficha')) || null
  return (
    <Aprendices
      key={`${filtro ?? ''}-${ficha ?? ''}`}
      onAbrir={abrir}
      onFicha={verFicha}
      onRegistrar={id => navigate(`${BASE}/etapa-productiva/nueva?aprendiz=${id}`)}
      fichaFoco={ficha}
      filtroInicial={esFiltro(filtro) ? filtro : undefined}
    />
  )
}

// Registrar la etapa de un aprendiz que ya es del instructor: dos pasos (el
// aprendiz, que llega en la URL, y sus datos). No se escoge ficha.
function RegistrarEtapaRoute() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const id = Number(params.get('aprendiz')) || null
  const [aprendiz, setAprendiz] = useState<Aprendiz | null>(null)
  const [err, setErr] = useState<string | null>(id ? null : 'Escoge el aprendiz desde "Por registrar", en Aprendices.')

  useEffect(() => {
    if (!id) return
    let vivo = true
    api.get<Aprendiz>(`/aprendices/${id}`)
      .then(r => { if (vivo) setAprendiz(r.data) })
      .catch(e => { if (vivo) setErr(e?.response?.data?.message ?? 'No se pudo abrir el aprendiz.') })
    return () => { vivo = false }
  }, [id])

  const volver = () => navigate(`${BASE}/etapa-productiva`)
  if (err) return <Lienzo><Frase tono="atraso">{err}</Frase></Lienzo>
  if (!aprendiz) return <Lienzo><p className="fx-texto-3">Abriendo el aprendiz…</p></Lienzo>
  return (
    <div style={{ maxWidth: 720 }}>
      <CrearEtapaProductivaForm
        aprendiz={aprendiz}
        onBack={volver}
        onCreated={etapaId => navigate(`${BASE}/etapa-productiva/${etapaId}`, { replace: true })}
      />
    </div>
  )
}

// Pestañas a las que se puede entrar directo (?tab=), más el documento oficial.
const ABRIR_EN: AbrirEn[] = ['cronograma', 'planeacion', 'seguimientos', 'evaluacion', 'bitacoras', 'documento']
const VOLVER: Record<string, string> = {
  hoy: 'Hoy', agenda: 'Calendario', aprendices: 'Aprendices', bitacoras: 'Bitácoras', reportes: 'Reportes',
}

function EtapaProductivaDetalleRoute() {
  const { etapaId } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const tab = ABRIR_EN.find(t => t === params.get('tab'))
  // "Volver" regresa a donde se vino: Hoy, el calendario, la bandeja o la lista.
  const desde = (location.state as { desde?: string } | null)?.desde
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
  return <Expediente etapaId={Number(etapaId)} backLabel="Reportes" onBack={() => navigate(`${BASE}/reportes`)}/>
}
