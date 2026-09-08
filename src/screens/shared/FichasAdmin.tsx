import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Ic, Card, Ava, Btn, Tag, Pager } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { FichaForm } from './FichaForm'
import type { FichaEdit } from './FichaForm'
import { jornadaLabel, centroLabel } from './parts'
import { AprendicesPracticaTable, EstadoAprendicesResumen } from './AprendicesPractica'
import type { AprendizPractica, InstructorPracticaInfo, KpiAprendicesPractica } from './AprendicesPractica'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'

export interface FichaRow {
  id:                        number
  numero_ficha:              string
  programa_id:               number
  programa_nombre:           string
  programa_codigo:           string
  centro_formacion_id:       number
  centro_nombre:             string | null
  coordinacion_academica_id: number | null
  coordinacion_nombre:       string | null
  coordinador_nombre:        string | null
  instructor_practica:       string | null   // instructor de seguimiento de la ficha (asignacion_practica ACTIVA)
  aprendices:                number           // total de aprendices (reporte de juicios)
  aprendices_en_practica:    number           // de esos, con etapa productiva en ejecución
  estado:                    'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'
  fecha_inicio:              string
  fecha_fin_lectiva:         string
  fecha_inicio_productiva:   string | null
  fecha_fin_productiva:      string | null
  etapa_actual_teorica:      string | null
  sede:                      string | null
  jornada:                   string | null
}

type ListState =
  | { status: 'loading' }
  | { status: 'ok'; data: FichaRow[] }
  | { status: 'error' }

const PAGE_SIZE = 10

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Sk({ w, h, r = 5 }: { w: string | number; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }}/>
}

function fd(s: string | null): string {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Fecha en formato aaaa-mm-dd, tomada directo del ISO string (sin pasar por Date, que
// podría correr el día por la conversión de timezone del navegador).
function fdISO(s: string | null): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

// Sigla derivada del nombre para el recuadro del programa (p. ej. "ADS")
const SHORT_STOPWORDS = new Set(['de', 'del', 'y', 'e', 'la', 'el', 'en', 'los', 'las', 'para', 'con', 'a'])
function programaShort(nombre: string): string {
  const sigla = nombre
    .split(/\s+/)
    .filter(w => w && !SHORT_STOPWORDS.has(w.toLowerCase()))
    .map(w => w[0])
    .join('')
    .toUpperCase()
  return sigla.slice(0, 4) || nombre.slice(0, 2).toUpperCase()
}

// ─── Fase operativa de la ficha ─────────────────────────────────────────────────
// FORMA no razona por "estado" (En ejecución / Finalizada de Sofía) ni por
// "etapa lectiva/práctica" -- razona por en qué punto del proceso productivo
// está la ficha. Se deriva de las fechas de etapa productiva + el estado:
//   PRÓXIMA      la etapa productiva todavía no arranca -> preparar (instructor)
//   EN PRÁCTICA  arrancó, la fecha de fin no llegó -> seguimiento en curso
//   EN CIERRE    la fecha de fin ya pasó pero la ficha sigue abierta ->
//                seguimientos y evaluación final pendientes. NO es un error:
//                la práctica dura hasta 6 meses y Sofía marca "Terminada por
//                fecha" mientras los aprendices siguen en la empresa.
//   FINALIZADA   cerrada de verdad -> solo historial
export type FaseFicha = 'PROXIMA' | 'EN_PRACTICA' | 'EN_CIERRE' | 'FINALIZADA'

export function faseFicha(f: {
  estado: string
  fecha_inicio_productiva: string | null
  fecha_fin_productiva: string | null
}): FaseFicha {
  const hoy = new Date().toISOString().slice(0, 10)
  const ini = f.fecha_inicio_productiva ? f.fecha_inicio_productiva.slice(0, 10) : null
  const fin = f.fecha_fin_productiva ? f.fecha_fin_productiva.slice(0, 10) : null
  if (ini && ini > hoy) return 'PROXIMA'
  if (!fin || fin >= hoy) return 'EN_PRACTICA'
  return f.estado === 'FINALIZADA' ? 'FINALIZADA' : 'EN_CIERRE'
}

const FASE_META: Record<FaseFicha, {
  label: string; icon: IcName; fg: string; bg: string; bd: string; dot: string
}> = {
  PROXIMA:     { label: 'Próxima a práctica', icon: 'calendar',    fg: '#3730a3', bg: '#eef2ff', bd: '#c7d2fe', dot: '#6366f1' },
  EN_PRACTICA: { label: 'En práctica',        icon: 'briefcase',   fg: '#4338ca', bg: '#e0e7ff', bd: '#a5b4fc', dot: '#4f46e5' },
  EN_CIERRE:   { label: 'En cierre',          icon: 'clock',       fg: '#a16207', bg: '#fef9c3', bd: '#fde68a', dot: '#ca8a04' },
  FINALIZADA:  { label: 'Finalizada',         icon: 'checkCircle', fg: '#52525b', bg: '#f1f1f3', bd: '#e4e4e7', dot: '#a1a1aa' },
}

function FasePill({ fase }: { fase: FaseFicha }) {
  const m = FASE_META[fase]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 20, background: m.bg,
      border: `1px solid ${m.bd}`, fontSize: 10.5, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.03em', color: m.fg, whiteSpace: 'nowrap',
    }}>
      <Ic n={m.icon} s={11}/>
      {m.label}
    </span>
  )
}

// '' = todas · 'ACTIVAS' = en práctica + en cierre (lo que FORMA gestiona a diario)
type FaseFilt   = '' | 'ACTIVAS' | FaseFicha
type FechaCampo = 'fecha_inicio' | 'fecha_inicio_productiva' | 'fecha_fin_productiva'
type FichaSort  = 'inicio_reciente' | 'cierre_proximo' | 'mas_aprendices' | 'sin_instructor' | 'numero' | 'programa'

const FASE_CHIPS: { key: FaseFilt; label: string }[] = [
  { key: 'ACTIVAS',     label: 'Activas'      },
  { key: 'EN_PRACTICA', label: 'En práctica' },
  { key: 'EN_CIERRE',   label: 'En cierre'   },
  { key: 'PROXIMA',     label: 'Próximas'    },
  { key: 'FINALIZADA',  label: 'Finalizadas' },
  { key: '',            label: 'Todas'       },
]

const FECHA_CAMPO_LABEL: Record<FechaCampo, string> = {
  fecha_inicio:            'Inicio',
  fecha_inicio_productiva: 'Inicio productiva',
  fecha_fin_productiva:    'Fin productiva',
}

const FICHA_SORT_LABEL: Record<FichaSort, string> = {
  inicio_reciente: 'Inicio más reciente',
  cierre_proximo:  'Cierre más próximo',
  mas_aprendices:  'Más aprendices en práctica',
  sin_instructor:  'Sin instructor primero',
  numero:          'Número de ficha',
  programa:        'Programa (A–Z)',
}

const SEL = {
  height: 34, padding: '0 10px', border: '1px solid #e4e4e7', borderRadius: 8,
  fontSize: 12.5, background: '#fff', color: '#18181b',
  fontFamily: 'Inter, sans-serif', cursor: 'pointer', outline: 'none',
}

const THEAD = ['Número', 'Programa', 'Coordinador', 'Instructor de práctica', 'Aprendices', 'Fin productiva', 'Fase', '']
const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px' }

// ─── Detalle de ficha (read-only: instructor de práctica + roster de aprendices) ─
// Independientemente de si la ficha ya entró a etapa productiva o todavía
// está en lectiva, el detalle solo muestra lo relativo a práctica -- si
// todavía no hay aprendices en esa etapa, AprendicesPracticaTable ya resuelve
// el estado vacío ("Sin reporte de juicios").

interface FichaDetalleData {
  ficha: {
    id: number; numero_ficha: string; estado: 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'
    fecha_inicio: string; fecha_fin_lectiva: string; fecha_fin_productiva: string | null
    etapa_actual: 'LECTIVA' | 'PRACTICA'
    sede: string | null; jornada: string | null
    centro_formacion_id: number; coordinacion_academica_id: number | null
    programa_id: number; programa_nombre: string; programa_codigo: string; programa_version: number
    nivel_formacion: string
    coordinador_nombre: string; coordinacion_nombre: string
  }
  kpi: KpiAprendicesPractica
  aprendices: AprendizPractica[]
  instructor_practica: InstructorPracticaInfo | null
}

type DetState =
  | { status: 'loading' }
  | { status: 'ok'; data: FichaDetalleData }
  | { status: 'error' }

function detalleToEdit(f: FichaDetalleData['ficha']): FichaEdit {
  return {
    id:                        f.id,
    numero_ficha:              f.numero_ficha,
    programa_id:               f.programa_id,
    programa_nombre:           f.programa_nombre,
    centro_formacion_id:       f.centro_formacion_id,
    coordinacion_academica_id: f.coordinacion_academica_id,
    estado:                    f.estado,
    fecha_inicio:              f.fecha_inicio,
    fecha_fin_lectiva:         f.fecha_fin_lectiva,
    fecha_fin_productiva:      f.fecha_fin_productiva,
    sede:                      f.sede,
    jornada:                   f.jornada,
    etapa_actual:              f.etapa_actual,
  }
}

export function FichaDetalle({ id, onBack, onEditar, onOpenEtapa }: {
  id: number; onBack: () => void; onEditar: () => void; onOpenEtapa: (etapaId: number) => void
}) {
  "use no memo"
  const [state, setState] = useState<DetState>({ status: 'loading' })

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<FichaDetalleData>(`/fichas/${id}/detalle`)
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [id])

  const back = (
    <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
      <Ic n="arrowLeft" s={14}/> Fichas
    </button>
  )

  if (state.status === 'loading') return <div>{back}<Card style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Sk w={220} h={16}/></Card></div>
  if (state.status === 'error') return (
    <div>{back}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
          <span style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudo cargar la ficha.</span>
        </div>
      </Card>
    </div>
  )

  const { ficha, kpi, aprendices, instructor_practica } = state.data
  const meta: [string, string][] = [
    ['Coordinador', ficha.coordinador_nombre],
    ['Coordinación', ficha.coordinacion_nombre],
    ['Inicio', fd(ficha.fecha_inicio)],
    ['Fin etapa productiva', fd(ficha.fecha_fin_productiva)],
    ['Sede', ficha.sede ?? '—'],
    ['Jornada', jornadaLabel(ficha.jornada)],
  ]

  return (
    <div style={{ maxWidth: 1200 }}>
      {back}

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24, marginBottom: 22, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 12, color: '#52525b', marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{ficha.programa_codigo}</span>
            <span>·</span><span>{ficha.nivel_formacion}</span>
            <span>·</span><span style={{ fontFamily: '"JetBrains Mono", monospace' }}>V{String(ficha.programa_version).padStart(3, '0')}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{ficha.programa_nombre}</h2>
          <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 13, color: '#3f3f46', alignItems: 'center', flexWrap: 'wrap' }}>
            <Tag>{programaShort(ficha.programa_nombre)}</Tag>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#18181b' }}>Ficha {ficha.numero_ficha}</span>
            <span style={{ color: '#a1a1aa' }}>·</span>
            <span>{jornadaLabel(ficha.jornada)}{ficha.sede ? ` · ${ficha.sede}` : ''}</span>
            <FasePill fase={faseFicha({
              estado: ficha.estado,
              fecha_inicio_productiva: ficha.fecha_fin_lectiva,
              fecha_fin_productiva: ficha.fecha_fin_productiva,
            })}/>
          </div>
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Ic n="user" s={13} style={{ color: instructor_practica ? '#15803d' : '#a16207' }}/>
            {instructor_practica ? (
              <span style={{ color: '#3f3f46' }}>Instructor de práctica: <strong>{instructor_practica.nombre}</strong> · desde {fd(instructor_practica.fecha_inicio)}</span>
            ) : (
              <span style={{ color: '#a16207' }}>Sin instructor de práctica asignado -- asígnalo desde "Editar ficha y asignaciones".</span>
            )}
          </div>
        </div>
        <Btn variant="accent" icon="users" onClick={onEditar}>Editar ficha y asignaciones</Btn>
      </div>

      {/* Distribución de los aprendices entre los 5 estados de práctica */}
      <EstadoAprendicesResumen kpi={kpi}/>

      {/* Contenido: roster de aprendices en práctica + lateral con la meta de la ficha */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <AprendicesPracticaTable
          aprendices={aprendices}
          soloConEtapa
          onOpen={a => { if (a.etapa_id != null) onOpenEtapa(a.etapa_id) }}
        />

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Coordinación</div>
          <Card style={{ padding: 16 }}>
            {meta.map(([l, v], i) => (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < meta.length - 1 ? '1px solid #f1f1f3' : 'none', gap: 12 }}>
                <span style={{ fontSize: 12, color: '#52525b', flexShrink: 0 }}>{l}</span>
                <span style={{ fontSize: 12.5, color: '#18181b', fontWeight: 500, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}

// ─── Lista de fichas ─────────────────────────────────────────────────────────────
// scope: cuando lo usa un coordinador, ve y crea solo fichas de su coordinación.

function FichasList({ scope }: { scope?: { coordinacionId: number; centroId: number } }) {
  "use no memo"
  const navigate = useNavigate()
  // Por defecto se ven las fichas "activas" (en práctica + en cierre) -- lo que
  // FORMA gestiona a diario. Próximas y finalizadas quedan a un chip de distancia.
  const [faseFilt, setFaseFilt] = useState<FaseFilt>('ACTIVAS')
  const [centroFilt, setCentroFilt] = useState('')
  const [soloSinInstr, setSoloSinInstr] = useState(false)
  const [fechaCampo, setFechaCampo] = useState<FechaCampo>('fecha_inicio')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<FichaSort>('inicio_reciente')
  const [state,      setState]      = useState<ListState>({ status: 'loading' })
  const [page,       setPage]       = useState(0)

  const coordScope = scope?.coordinacionId ?? null

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<FichaRow[]>(coordScope != null ? `/fichas?coordinacion_id=${coordScope}` : '/fichas')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [coordScope])

  useEffect(() => { setPage(0) }, [faseFilt, centroFilt, soloSinInstr, fechaCampo, fechaDesde, fechaHasta, search, sort])

  const all = state.status === 'ok' ? state.data : []
  const q   = search.trim().toLowerCase()
  const fechaActiva = !!(fechaDesde || fechaHasta)
  // Solo la fecha queda dentro del dropdown "Filtros" -- la fase ahora son chips
  // visibles en la propia pantalla (ver debajo).
  const filtrosExtraCount = fechaActiva ? 1 : 0

  const fasesAll = all.map(f => faseFicha(f))

  // "Sin instructor" = ficha que ya debería tenerlo (en práctica o en cierre) y
  // no lo tiene -- la alerta de cobertura de toda la app.
  const esSinInstructor = (f: FichaRow) => {
    const fs = faseFicha(f)
    return (fs === 'EN_PRACTICA' || fs === 'EN_CIERRE') && !f.instructor_practica
  }

  const centrosDisponibles = [...new Set(all.map(f => f.centro_nombre).filter((n): n is string => !!n))]
    .sort((a, b) => a.localeCompare(b, 'es'))

  const faseCount = (k: FaseFilt): number => {
    if (k === '') return all.length
    if (k === 'ACTIVAS') return fasesAll.filter(x => x === 'EN_PRACTICA' || x === 'EN_CIERRE').length
    return fasesAll.filter(x => x === k).length
  }
  const enPracticaCount = faseCount('EN_PRACTICA')
  const enCierreCount   = faseCount('EN_CIERRE')
  const proximasCount   = faseCount('PROXIMA')
  const activasCount    = faseCount('ACTIVAS')
  const sinInstrCount   = all.filter(esSinInstructor).length

  const filtered = all
    .filter(f => {
      const fs = faseFicha(f)
      if (faseFilt === 'ACTIVAS' && fs !== 'EN_PRACTICA' && fs !== 'EN_CIERRE') return false
      if (faseFilt && faseFilt !== 'ACTIVAS' && fs !== faseFilt) return false
      if (centroFilt && f.centro_nombre !== centroFilt) return false
      if (soloSinInstr && !esSinInstructor(f)) return false
      if (fechaActiva) {
        const raw = f[fechaCampo]
        if (!raw) return false
        const val = raw.slice(0, 10)
        if (fechaDesde && val < fechaDesde) return false
        if (fechaHasta && val > fechaHasta) return false
      }
      if (q
        && !f.numero_ficha.toLowerCase().includes(q)
        && !f.programa_nombre.toLowerCase().includes(q)
        && !f.programa_codigo.toLowerCase().includes(q)
        && !(f.coordinador_nombre ?? '').toLowerCase().includes(q)
        && !(f.instructor_practica ?? '').toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      switch (sort) {
        case 'numero':         return a.numero_ficha.localeCompare(b.numero_ficha, 'es')
        case 'programa':       return a.programa_nombre.localeCompare(b.programa_nombre, 'es')
        case 'cierre_proximo': return (a.fecha_fin_productiva || a.fecha_fin_lectiva || '').localeCompare(b.fecha_fin_productiva || b.fecha_fin_lectiva || '')
        case 'mas_aprendices': return (b.aprendices_en_practica - a.aprendices_en_practica) || (b.aprendices - a.aprendices) || a.numero_ficha.localeCompare(b.numero_ficha, 'es')
        case 'sin_instructor': return (esSinInstructor(b) ? 1 : 0) - (esSinInstructor(a) ? 1 : 0) || (a.fecha_fin_productiva || '').localeCompare(b.fecha_fin_productiva || '')
        default:               return (b.fecha_inicio || '').localeCompare(a.fecha_inicio || '')
      }
    })

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)

  const theadRow = (
    <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
      {THEAD.map((h, i) => <th key={i} style={TH_S}>{h}</th>)}
    </tr>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Fichas</h2>
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 26, fontWeight: 700, color: '#4f46e5', lineHeight: 1 }}>
              {activasCount.toLocaleString('es-CO')}
            </span>
            <span style={{ fontSize: 13, color: '#52525b' }}>
              fichas activas {scope ? 'en tu coordinación' : 'en la regional'}
              {' · '}<span>{enPracticaCount.toLocaleString('es-CO')} en práctica</span>
              {enCierreCount > 0 && <> · <span style={{ color: '#a16207' }}>{enCierreCount.toLocaleString('es-CO')} en cierre</span></>}
              {proximasCount > 0 && <> · <span style={{ color: '#6366f1' }}>{proximasCount.toLocaleString('es-CO')} próxima{proximasCount === 1 ? '' : 's'}</span></>}
              {' · '}<span style={{ color: '#a1a1aa' }}>{all.length.toLocaleString('es-CO')} en total</span>
              {sinInstrCount > 0 && <> · <strong style={{ color: '#c2410c', fontWeight: 600 }}>{sinInstrCount} sin instructor</strong></>}
            </span>
          </div>
        </div>
        <Btn variant="accent" icon="plus" onClick={() => navigate('nueva', { relative: 'path' })}>Crear ficha</Btn>
      </div>

      {/* Chips de fase -- filtro principal, siempre visible */}
      {state.status === 'ok' && all.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {FASE_CHIPS.map(c => {
              const active = faseFilt === c.key
              return (
                <button
                  key={c.key || 'todas-fase'}
                  onClick={() => setFaseFilt(c.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                    border: active ? '1.5px solid #4f46e5' : '1.5px solid #e4e4e7',
                    background: active ? '#eef2ff' : '#fff',
                    color: active ? '#4f46e5' : '#3f3f46',
                    fontSize: 12.5, fontWeight: active ? 600 : 500, fontFamily: 'Inter, sans-serif',
                    transition: 'all 120ms',
                  }}
                >
                  {c.label}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                    background: active ? '#c7d2fe' : '#f1f1f3', color: active ? '#4338ca' : '#71717a',
                    padding: '1px 6px', borderRadius: 10,
                  }}>{faseCount(c.key)}</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {sinInstrCount > 0 && (
              <button
                onClick={() => setSoloSinInstr(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                  border: soloSinInstr ? '1.5px solid #c2410c' : '1px solid #fed7aa',
                  background: soloSinInstr ? '#c2410c' : '#fff7ed',
                  color: soloSinInstr ? '#fff' : '#c2410c',
                  fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif', transition: 'all 120ms',
                }}
              >
                <Ic n="user" s={12}/>
                Sin instructor
                <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: soloSinInstr ? 'rgba(255,255,255,.85)' : '#c2410c' }}>{sinInstrCount}</span>
              </button>
            )}

            {!scope && centrosDisponibles.length > 1 && (
              <select
                value={centroFilt}
                onChange={e => setCentroFilt(e.target.value)}
                style={{ ...SEL, height: 30, border: centroFilt ? '1.5px solid #4f46e5' : '1px solid #e4e4e7', color: centroFilt ? '#4f46e5' : '#3f3f46' }}
              >
                <option value="">Todos los centros</option>
                {centrosDisponibles.map(c => <option key={c} value={c}>{centroLabel(c)}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Toolbar: búsqueda + orden + filtro de fecha */}
      {state.status === 'ok' && all.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Ic n="search" s={14} style={{ position: 'absolute', left: 10, color: '#a1a1aa', pointerEvents: 'none' }}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar ficha, programa, coordinador o instructor…"
              style={{
                width: 260, maxWidth: '100%', height: 34, padding: '0 30px 0 32px',
                border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12.5, color: '#18181b',
                fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                aria-label="Limpiar búsqueda"
                style={{ position: 'absolute', right: 8, display: 'grid', placeItems: 'center', width: 18, height: 18, border: 'none', borderRadius: '50%', background: '#f1f1f3', color: '#71717a', cursor: 'pointer' }}
              >
                <Ic n="x" s={12}/>
              </button>
            )}
          </div>
          <select value={sort} onChange={e => setSort(e.target.value as FichaSort)} style={SEL}>
            {(Object.keys(FICHA_SORT_LABEL) as FichaSort[]).map(k => (
              <option key={k} value={k}>Ordenar: {FICHA_SORT_LABEL[k]}</option>
            ))}
          </select>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setFiltrosOpen(o => !o)}
              style={{
                ...SEL, display: 'inline-flex', alignItems: 'center', gap: 7,
                border: filtrosExtraCount ? '1.5px solid #4f46e5' : SEL.border as string,
                color: filtrosExtraCount ? '#4f46e5' : '#3f3f46',
                fontWeight: filtrosExtraCount ? 600 : 400,
              }}
            >
              <Ic n="calendar" s={13}/>
              Fecha
              {filtrosExtraCount > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                  background: '#c7d2fe', color: '#4338ca', padding: '1px 6px', borderRadius: 10,
                }}>{filtrosExtraCount}</span>
              )}
              <Ic n="chevronDown" s={12} style={{ color: '#a1a1aa' }}/>
            </button>

            {filtrosOpen && (
              <>
                <div onClick={() => setFiltrosOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }}/>
                <div className="pop-in" style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
                  width: 280, maxWidth: 'calc(100vw - 32px)', background: '#fff', border: '1px solid #e4e4e7', borderRadius: 12,
                  boxShadow: '0 8px 24px -8px rgba(0,0,0,.18)', padding: 16,
                  display: 'flex', flexDirection: 'column', gap: 16, boxSizing: 'border-box',
                }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#71717a', marginBottom: 8 }}>
                      Filtrar por fecha
                    </div>
                    <select
                      value={fechaCampo}
                      onChange={e => setFechaCampo(e.target.value as FechaCampo)}
                      style={{ ...SEL, width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
                    >
                      {(Object.keys(FECHA_CAMPO_LABEL) as FechaCampo[]).map(k => (
                        <option key={k} value={k}>{FECHA_CAMPO_LABEL[k]}</option>
                      ))}
                    </select>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <label style={{ display: 'block', fontSize: 10.5, color: '#a1a1aa', marginBottom: 3 }}>Desde</label>
                        <input type="date" className="nx-input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 8px' }}/>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <label style={{ display: 'block', fontSize: 10.5, color: '#a1a1aa', marginBottom: 3 }}>Hasta</label>
                        <input type="date" className="nx-input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', padding: '8px 8px' }}/>
                      </div>
                    </div>
                  </div>

                  {filtrosExtraCount > 0 && (
                    <button
                      onClick={() => { setFechaDesde(''); setFechaHasta('') }}
                      style={{
                        alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        fontSize: 12, color: '#4f46e5', fontWeight: 600, fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <Ic n="x" s={11}/> Limpiar fecha
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {state.status === 'loading' && (
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>{theadRow}</thead>
            <tbody>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f1f3' }}>
                  <td style={TD_S}><Sk w={56} h={12}/></td>
                  <td style={TD_S}><Sk w={170} h={12}/></td>
                  <td style={TD_S}><Sk w={130} h={12}/></td>
                  <td style={TD_S}><Sk w={120} h={12}/></td>
                  <td style={TD_S}><Sk w={50} h={12}/></td>
                  <td style={TD_S}><Sk w={90} h={12}/></td>
                  <td style={TD_S}><Sk w={110} h={20} r={20}/></td>
                  <td style={TD_S}/>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {state.status === 'error' && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
            <span style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudieron cargar las fichas.</span>
          </div>
        </Card>
      )}

      {state.status === 'ok' && all.length === 0 && (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Ic n="folder" s={28} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0b' }}>Sin fichas</div>
            <div style={{ fontSize: 12.5, color: '#71717a' }}>Aún no hay fichas registradas en el sistema.</div>
          </div>
        </Card>
      )}

      {state.status === 'ok' && all.length > 0 && filtered.length === 0 && (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ic n={q ? 'search' : 'folder'} s={26} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>
              {q ? `Sin resultados para "${search.trim()}"` : 'Sin fichas en esta categoría'}
            </div>
          </div>
        </Card>
      )}

      {state.status === 'ok' && filtered.length > 0 && (
        <>
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>{theadRow}</thead>
            <tbody>
              {pageItems.map(f => (
                <tr
                  key={f.id}
                  className="nx-row"
                  onClick={() => navigate(String(f.id), { relative: 'path' })}
                  style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }}
                >
                  <td style={TD_S}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: FASE_META[faseFicha(f)].dot, flexShrink: 0 }}/>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#0a0a0b' }}>{f.numero_ficha}</span>
                    </div>
                    {(f.centro_nombre || f.coordinacion_nombre) && (
                      <div style={{ fontSize: 10.5, color: '#a1a1aa', marginTop: 3 }}>
                        {[f.centro_nombre && centroLabel(f.centro_nombre), f.coordinacion_nombre].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td style={TD_S}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Tag>{programaShort(f.programa_nombre)}</Tag>
                      <span style={{ color: '#18181b', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.programa_nombre}
                      </span>
                    </div>
                    <div style={{ fontSize: 10.5, color: '#52525b', marginTop: 3 }}>
                      {[f.jornada, f.sede].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </td>
                  <td style={TD_S}>
                    {f.coordinador_nombre ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Ava name={f.coordinador_nombre} size={22}/>
                        <span style={{ fontSize: 12, color: '#27272a', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.coordinador_nombre}
                        </span>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: '#a1a1aa' }}>Sin coordinador</span>
                    )}
                  </td>
                  <td style={TD_S}>
                    {f.instructor_practica ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Ava name={f.instructor_practica} size={22}/>
                        <span style={{ fontSize: 12, color: '#27272a', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.instructor_practica}
                        </span>
                      </div>
                    ) : esSinInstructor(f) ? (
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: '#c2410c', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Ic n="alert" s={12}/>Sin asignar
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#d4d4d8' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...TD_S, whiteSpace: 'nowrap' }}>
                    {f.aprendices_en_practica > 0 || faseFicha(f) !== 'PROXIMA' ? (
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12.5 }}>
                        <strong style={{ color: '#4f46e5' }}>{f.aprendices_en_practica}</strong>
                        <span style={{ color: '#a1a1aa' }}>/{f.aprendices}</span>
                      </span>
                    ) : (
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#a1a1aa' }}>{f.aprendices || '—'}</span>
                    )}
                  </td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a', whiteSpace: 'nowrap' }}>
                    {fdISO(f.fecha_fin_productiva)}
                  </td>
                  <td style={TD_S}><FasePill fase={faseFicha(f)}/></td>
                  <td style={{ ...TD_S, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button
                      title="Editar ficha"
                      onClick={() => navigate(`${f.id}/editar`, { relative: 'path' })}
                      style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#71717a' }}
                    >
                      <Ic n="edit" s={13}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Pager
          page={curPage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="fichas"
        />
        </>
      )}
    </div>
  )
}

// ─── Wrappers de ruta ────────────────────────────────────────────────────────────
// FichasAdmin se monta bajo un splat (p. ej. `/dashboard/superadmin/fichas/*` o
// `/dashboard/coordinador/fichas/*`, o embebido en CoordinacionDetalle). Cada
// nivel navega con rutas relativas -- no necesita saber su ruta base.

type Scope = { coordinacionId: number; centroId: number }

export function FichasAdmin({ scope }: { scope?: Scope } = {}) {
  "use no memo"
  return (
    <Routes>
      <Route index element={<FichasList scope={scope}/>}/>
      <Route path="nueva" element={<FichaCrearRoute scope={scope}/>}/>
      <Route path=":fichaId/editar" element={<FichaEditarRoute scope={scope}/>}/>
      <Route path=":fichaId" element={<FichaDetalleRoute/>}/>
      <Route path=":fichaId/etapa/:etapaId" element={<FichaEtapaRoute/>}/>
    </Routes>
  )
}

function FichaDetalleRoute() {
  "use no memo"
  const { fichaId } = useParams()
  const navigate = useNavigate()
  return (
    <FichaDetalle
      id={Number(fichaId)}
      onBack={() => navigate('..', { relative: 'path' })}
      onEditar={() => navigate('editar', { relative: 'path' })}
      onOpenEtapa={etapaId => navigate(`etapa/${etapaId}`, { relative: 'path' })}
    />
  )
}

function FichaCrearRoute({ scope }: { scope?: Scope }) {
  "use no memo"
  const navigate = useNavigate()
  return (
    <FichaForm
      ficha={null}
      lockScope={scope ? { centroId: scope.centroId, coordinacionId: scope.coordinacionId } : undefined}
      onCancel={() => navigate('..', { relative: 'path' })}
      onSaved={() => navigate('..', { relative: 'path' })}
    />
  )
}

function FichaEditarRoute({ scope }: { scope?: Scope }) {
  "use no memo"
  const { fichaId } = useParams()
  const navigate = useNavigate()
  const [ficha, setFicha] = useState<FichaEdit | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    api.get<FichaDetalleData>(`/fichas/${fichaId}/detalle`)
      .then(r => { if (live) setFicha(detalleToEdit(r.data.ficha)) })
      .catch(() => { if (live) navigate('..', { relative: 'path', replace: true }) })
    return () => { live = false }
  }, [fichaId, navigate])

  if (ficha === undefined) {
    return <Card style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Sk w={220} h={16}/></Card>
  }
  return (
    <FichaForm
      ficha={ficha}
      lockScope={scope ? { centroId: scope.centroId, coordinacionId: scope.coordinacionId } : undefined}
      onCancel={() => navigate('..', { relative: 'path' })}
      onSaved={() => navigate('..', { relative: 'path' })}
    />
  )
}

function FichaEtapaRoute() {
  "use no memo"
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return (
    <EtapaProductivaDetalle
      etapaId={Number(etapaId)}
      backLabel="Ficha"
      onBack={() => navigate('../..', { relative: 'path' })}
    />
  )
}
