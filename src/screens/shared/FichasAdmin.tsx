import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Ic, Card, Ava, Btn, Tag, Pager, Tip } from '../../components/ui'
import api from '../../lib/api'
import { FichaForm } from './FichaForm'
import type { FichaEdit } from './FichaForm'
import { jornadaLabel, centroLabel } from './parts'
import { FiltroGrupo, FiltrosBar, FiltrosResumen, SortCaret } from './filtros'
import type { FiltroOpcion, SortDir } from './filtros'
import { AprendicesPracticaTable, EstadoAprendicesResumen } from './AprendicesPractica'
import type { AprendizPractica, InstructorPracticaInfo, KpiAprendicesPractica } from './AprendicesPractica'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'
import { faseFicha, FASE_META } from './fichaFase'
import type { FaseFicha } from './fichaFase'
import './filtros.css'

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

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "25 jul 2025" -- compacto y sin "de X de Y", tomando el día del string ISO
// para no correrlo por la conversión de timezone (igual que fdISO).
function fd(s: string | null): string {
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${Number(m[3])} ${MES_CORTO[Number(m[2]) - 1]} ${m[1]}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? '—' : `${d.getDate()} ${MES_CORTO[d.getMonth()]} ${d.getFullYear()}`
}

// Fecha en formato aaaa-mm-dd, tomada directo del ISO string (sin pasar por Date, que
// podría correr el día por la conversión de timezone del navegador).
function fdISO(s: string | null): string {
  if (!s) return '—'
  return s.slice(0, 10)
}

// Contenido del tooltip de la columna "Fin productiva": las 3 fechas clave de
// la ficha. `fecha_inicio_productiva` = misma columna que `fecha_fin_lectiva`
// en el backend (la lectiva termina donde arranca la productiva).
function FechasFicha({ f }: { f: FichaRow }) {
  const rows: [string, string | null][] = [
    ['Inicio de la ficha', f.fecha_inicio],
    ['Inicio etapa productiva', f.fecha_inicio_productiva],
    ['Fin etapa productiva', f.fecha_fin_productiva],
  ]
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {rows.map(([label, iso]) => (
        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
          <span style={{ color: '#a1a1aa' }}>{label}</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#f4f4f5' }}>{fd(iso)}</span>
        </div>
      ))}
    </div>
  )
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
// El modelo (faseFicha / FASE_META / FaseFicha) vive en ./fichaFase -- aquí solo
// la píldora visual.
export function FasePill({ fase }: { fase: FaseFicha }) {
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

// Orden en que aparecen las fases dentro del panel de filtros.
const FASE_FILT_OPTS: { key: FaseFilt; label: string }[] = [
  { key: 'ACTIVAS',     label: 'Activas'             },
  { key: 'EN_PRACTICA', label: 'En práctica'         },
  { key: 'EN_CIERRE',   label: 'En cierre'           },
  { key: 'PROXIMA',     label: 'Próximas a práctica' },
  { key: 'FINALIZADA',  label: 'Finalizadas'         },
  { key: '',            label: 'Todas las fichas'    },
]

const FASE_FILT_LABEL: Record<FaseFilt, string> = {
  '':           'Todas',
  ACTIVAS:      'Activas',
  PROXIMA:      'Próximas a práctica',
  EN_PRACTICA:  'En práctica',
  EN_CIERRE:    'En cierre',
  FINALIZADA:   'Finalizadas',
}

const FECHA_CAMPO_LABEL: Record<FechaCampo, string> = {
  fecha_inicio:            'Inicio lectiva',
  fecha_inicio_productiva: 'Inicio productiva',
  fecha_fin_productiva:    'Fin productiva',
}

const SEL = {
  height: 34, padding: '0 10px', border: '1px solid #e4e4e7', borderRadius: 8,
  fontSize: 12.5, background: '#fff', color: '#18181b',
  fontFamily: 'Inter, sans-serif', cursor: 'pointer', outline: 'none',
}

// ─── Orden de la tabla ─────────────────────────────────────────────────────────
// Se controla haciendo clic en el encabezado de cada columna: el primer clic
// ordena con la dirección natural de la columna, el segundo la invierte.
type FichaSortCol = 'numero' | 'programa' | 'coordinador' | 'instructor' | 'aprendices' | 'cierre' | 'fase'

const FICHA_COLS: { key: FichaSortCol; label: string; defDir: SortDir }[] = [
  { key: 'numero',      label: 'Número',                 defDir: 'asc'  },
  { key: 'programa',    label: 'Programa',               defDir: 'asc'  },
  { key: 'coordinador', label: 'Coordinador',            defDir: 'asc'  },
  { key: 'instructor',  label: 'Instructor de práctica', defDir: 'asc'  },
  { key: 'aprendices',  label: 'Aprendices',             defDir: 'desc' },
  { key: 'cierre',      label: 'Fin productiva',         defDir: 'asc'  },
  { key: 'fase',        label: 'Fase',                   defDir: 'asc'  },
]

const FASE_ORDEN: Record<FaseFicha, number> = { PROXIMA: 0, EN_PRACTICA: 1, EN_CIERRE: 2, FINALIZADA: 3 }

// Compara dos fichas por una columna en su dirección ascendente. Los valores
// vacíos (ver VACIO_AL_FINAL) se resuelven antes de llamar aquí para que siempre
// queden al final, ordene como ordene.
function cmpFichaAsc(a: FichaRow, b: FichaRow, col: FichaSortCol): number {
  const tie = a.numero_ficha.localeCompare(b.numero_ficha, 'es', { numeric: true })
  switch (col) {
    case 'programa':    return a.programa_nombre.localeCompare(b.programa_nombre, 'es') || tie
    case 'coordinador': return (a.coordinador_nombre ?? '').localeCompare(b.coordinador_nombre ?? '', 'es') || tie
    case 'instructor':  return (a.instructor_practica ?? '').localeCompare(b.instructor_practica ?? '', 'es') || tie
    case 'aprendices':  return (a.aprendices_en_practica - b.aprendices_en_practica) || (a.aprendices - b.aprendices) || tie
    case 'cierre':      return (a.fecha_fin_productiva ?? '').localeCompare(b.fecha_fin_productiva ?? '') || tie
    case 'fase':        return (FASE_ORDEN[faseFicha(a)] - FASE_ORDEN[faseFicha(b)]) || tie
    default:            return tie   // 'numero'
  }
}

// Columnas cuyo valor vacío debe hundirse siempre (no invertirse con la dirección).
const VACIO_AL_FINAL: Partial<Record<FichaSortCol, (f: FichaRow) => boolean>> = {
  instructor: f => !f.instructor_practica,
  cierre:     f => !f.fecha_fin_productiva,
}

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
  // `fecha_fin_lectiva` que devuelve el backend es, de hecho,
  // `fecha_inicio_productiva` (misma columna: la lectiva termina donde empieza
  // la productiva). Ver ficha.service.ts en forma_server.
  const meta: [string, string][] = [
    ['Coordinador', ficha.coordinador_nombre],
    ['Coordinación', ficha.coordinacion_nombre],
    ['Inicio de la ficha', fd(ficha.fecha_inicio)],
    ['Inicio etapa productiva', fd(ficha.fecha_fin_lectiva)],
    ['Fin etapa productiva', fd(ficha.fecha_fin_productiva)],
    ['Sede', ficha.sede ?? '—'],
    ['Jornada', jornadaLabel(ficha.jornada)],
  ]

  return (
    <div style={{ maxWidth: 1360 }}>
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

      {/* Contenido: roster de aprendices (prioridad, ocupa el espacio libre) +
          lateral fijo con la meta de la ficha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 248px', gap: 24, alignItems: 'start' }}>
        <AprendicesPracticaTable
          aprendices={aprendices}
          soloConEtapa
          onOpen={a => { if (a.etapa_id != null) onOpenEtapa(a.etapa_id) }}
        />

        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Coordinación</div>
          <Card style={{ padding: 16 }}>
            {meta.map(([l, v], i) => (
              <div key={l} style={{ padding: '7px 0', borderBottom: i < meta.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                <div style={{ fontSize: 10.5, color: '#71717a', marginBottom: 2 }}>{l}</div>
                <div style={{ fontSize: 12.5, color: '#18181b', fontWeight: 500 }}>{v || '—'}</div>
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
  // FORMA gestiona a diario. Próximas y finalizadas quedan a un clic dentro del
  // panel de filtros.
  const [faseFilt,     setFaseFilt]     = useState<FaseFilt>('ACTIVAS')
  const [centroFilt,   setCentroFilt]   = useState('')                // centro_nombre
  const [coordFilt,    setCoordFilt]    = useState<number | ''>('')   // coordinacion_academica_id
  const [soloSinInstr, setSoloSinInstr] = useState(false)
  const [fechaCampo,   setFechaCampo]   = useState<FechaCampo>('fecha_inicio')
  const [fechaDesde,   setFechaDesde]   = useState('')
  const [fechaHasta,   setFechaHasta]   = useState('')
  const [sortCol,      setSortCol]      = useState<FichaSortCol>('aprendices')
  const [sortDir,      setSortDir]      = useState<SortDir>('desc')
  const [search,       setSearch]       = useState('')
  const [panelOpen,    setPanelOpen]    = useState(false)
  const [state,        setState]        = useState<ListState>({ status: 'loading' })
  const [page,         setPage]         = useState(0)

  const coordScope = scope?.coordinacionId ?? null

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<FichaRow[]>(coordScope != null ? `/fichas?coordinacion_id=${coordScope}` : '/fichas')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [coordScope])

  useEffect(() => { setPage(0) }, [faseFilt, centroFilt, coordFilt, soloSinInstr, fechaCampo, fechaDesde, fechaHasta, search, sortCol, sortDir])

  const onSort = (col: FichaSortCol, defDir: SortDir) => {
    if (col === sortCol) { setSortDir(d => (d === 'asc' ? 'desc' : 'asc')); return }
    setSortCol(col); setSortDir(defDir)
  }

  const all = state.status === 'ok' ? state.data : []
  const q   = search.trim().toLowerCase()
  const fechaActiva = !!(fechaDesde || fechaHasta)

  // "Sin instructor" = ficha que ya debería tenerlo (en práctica o en cierre) y
  // no lo tiene -- la alerta de cobertura de toda la app.
  const esSinInstructor = (f: FichaRow) => {
    const fs = faseFicha(f)
    return (fs === 'EN_PRACTICA' || fs === 'EN_CIERRE') && !f.instructor_practica
  }

  // ─── Predicados de filtro (cada dimensión es independiente) ─────────────────
  const mFase = (f: FichaRow): boolean => {
    if (!faseFilt) return true
    const fs = faseFicha(f)
    if (faseFilt === 'ACTIVAS') return fs === 'EN_PRACTICA' || fs === 'EN_CIERRE'
    return fs === faseFilt
  }
  const mCentro = (f: FichaRow) => !centroFilt || f.centro_nombre === centroFilt
  const mCoord  = (f: FichaRow) => coordFilt === '' || f.coordinacion_academica_id === coordFilt
  const mInstr  = (f: FichaRow) => !soloSinInstr || esSinInstructor(f)
  const mFecha  = (f: FichaRow): boolean => {
    if (!fechaActiva) return true
    const raw = f[fechaCampo]
    if (!raw) return false
    const val = raw.slice(0, 10)
    if (fechaDesde && val < fechaDesde) return false
    if (fechaHasta && val > fechaHasta) return false
    return true
  }
  const mSearch = (f: FichaRow): boolean => !q || [
    f.numero_ficha, f.programa_nombre, f.programa_codigo,
    f.coordinador_nombre, f.instructor_practica, f.centro_nombre, f.coordinacion_nombre,
  ].some(s => (s ?? '').toLowerCase().includes(q))

  // Conteo "faceteado": para cada dimensión, cuántas fichas quedarían al elegir
  // cada opción dejando el resto de filtros como están.
  type Dim = 'fase' | 'centro' | 'coord' | 'instr' | 'fecha'
  const passExcept = (f: FichaRow, except: Dim) =>
    (except === 'fase'   || mFase(f))   &&
    (except === 'centro' || mCentro(f)) &&
    (except === 'coord'  || mCoord(f))  &&
    (except === 'instr'  || mInstr(f))  &&
    (except === 'fecha'  || mFecha(f))  &&
    mSearch(f)

  const countFase = (list: FichaRow[], k: FaseFilt): number => {
    if (k === '') return list.length
    if (k === 'ACTIVAS') return list.filter(f => { const x = faseFicha(f); return x === 'EN_PRACTICA' || x === 'EN_CIERRE' }).length
    return list.filter(f => faseFicha(f) === k).length
  }

  // Overview del encabezado -- siempre sobre el total, sin filtros aplicados.
  const enPracticaCount = countFase(all, 'EN_PRACTICA')
  const enCierreCount   = countFase(all, 'EN_CIERRE')
  const proximasCount   = countFase(all, 'PROXIMA')
  const activasCount    = countFase(all, 'ACTIVAS')
  const sinInstrCount   = all.filter(esSinInstructor).length

  // ─── Opciones del panel (con conteo faceteado) ─────────────────────────────
  const faseBase   = all.filter(f => passExcept(f, 'fase'))
  const centroBase = all.filter(f => passExcept(f, 'centro'))
  const coordBase  = all.filter(f => passExcept(f, 'coord'))
  const sinInstrDisponibles = all.filter(f => passExcept(f, 'instr') && esSinInstructor(f)).length

  const centrosDisponibles = [...new Set(all.map(f => f.centro_nombre).filter((n): n is string => !!n))]
    .sort((a, b) => a.localeCompare(b, 'es'))

  const coordsDisponibles = [...new Map(
    all
      .filter(f => f.coordinacion_academica_id != null && (!centroFilt || f.centro_nombre === centroFilt))
      .map(f => [f.coordinacion_academica_id as number, {
        id: f.coordinacion_academica_id as number,
        nombre: f.coordinacion_nombre ?? '—',
        centro: f.centro_nombre,
      }]),
  ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))

  const coordSel = coordFilt === ''
    ? null
    : coordsDisponibles.find(c => c.id === coordFilt)
      ?? { id: coordFilt, nombre: all.find(f => f.coordinacion_academica_id === coordFilt)?.coordinacion_nombre ?? 'Coordinación', centro: null as string | null }

  const faseOpts: FiltroOpcion[] = FASE_FILT_OPTS.map(o => ({ ...o, count: countFase(faseBase, o.key) }))
  const centroOpts: FiltroOpcion[] = [
    { key: '', label: 'Todos los centros', count: centroBase.length },
    ...centrosDisponibles.map(c => ({ key: c, label: centroLabel(c), count: centroBase.filter(f => f.centro_nombre === c).length })),
  ]
  const coordOpts: FiltroOpcion[] = [
    { key: '', label: 'Todas las coordinaciones', count: coordBase.length },
    ...coordsDisponibles.map(c => ({
      key: String(c.id),
      label: c.nombre,
      hint: !centroFilt && c.centro ? centroLabel(c.centro) : undefined,
      count: coordBase.filter(f => f.coordinacion_academica_id === c.id).length,
    })),
  ]
  const filtrosActivos =
    (faseFilt !== 'ACTIVAS' ? 1 : 0) +
    (centroFilt ? 1 : 0) +
    (coordFilt !== '' ? 1 : 0) +
    (soloSinInstr ? 1 : 0) +
    (fechaActiva ? 1 : 0)
  const algoQueLimpiar = filtrosActivos > 0 || sortCol !== 'aprendices' || sortDir !== 'desc'

  const resumen: string[] = []
  if (faseFilt !== 'ACTIVAS') resumen.push(FASE_FILT_LABEL[faseFilt])
  if (!scope && centroFilt) resumen.push(centroLabel(centroFilt))
  if (!scope && coordSel) resumen.push(coordSel.nombre)
  if (soloSinInstr) resumen.push('Sin instructor')
  if (fechaActiva) resumen.push(`${FECHA_CAMPO_LABEL[fechaCampo]} ${fechaDesde || '…'}–${fechaHasta || '…'}`)

  const limpiarFiltros = () => {
    setFaseFilt('ACTIVAS'); setCentroFilt(''); setCoordFilt(''); setSoloSinInstr(false)
    setFechaCampo('fecha_inicio'); setFechaDesde(''); setFechaHasta('')
    setSortCol('aprendices'); setSortDir('desc')
  }

  const vacio = VACIO_AL_FINAL[sortCol]
  const filtered = all
    .filter(f => mFase(f) && mCentro(f) && mCoord(f) && mInstr(f) && mFecha(f) && mSearch(f))
    .sort((a, b) => {
      if (vacio) {
        const va = vacio(a), vb = vacio(b)
        if (va !== vb) return va ? 1 : -1   // los vacíos siempre al final
      }
      const r = cmpFichaAsc(a, b, sortCol)
      return sortDir === 'asc' ? r : -r
    })

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)

  const theadRow = (
    <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
      {FICHA_COLS.map(c => {
        const on = sortCol === c.key
        return (
          <th
            key={c.key}
            className={`ff-sort-th${on ? ' ff-sort-th--on' : ''}`}
            onClick={() => onSort(c.key, c.defDir)}
            title={`Ordenar por ${c.label.toLowerCase()}`}
            style={TH_S}
          >
            {c.label}
            <SortCaret active={on} dir={sortDir}/>
          </th>
        )
      })}
      <th style={TH_S}/>
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

      {/* Barra: búsqueda siempre visible + botón que despliega el panel de filtros */}
      {state.status === 'ok' && all.length > 0 && (
        <FiltrosBar
          search={search}
          onSearch={setSearch}
          placeholder="Buscar ficha, programa, coordinador, instructor…"
          activeCount={filtrosActivos}
          open={panelOpen}
          onToggle={() => setPanelOpen(o => !o)}
        />
      )}

      {/* Resumen de lo que está filtrando (con el panel cerrado) */}
      {state.status === 'ok' && all.length > 0 && !panelOpen && (
        <FiltrosResumen items={resumen} onClear={limpiarFiltros}/>
      )}

      {/* Panel de filtros desplegable */}
      {state.status === 'ok' && all.length > 0 && panelOpen && (
        <div className="ff-panel pop-in">
          <div className="ff-panel__grid">
            <FiltroGrupo
              title="Estado" icon="briefcase"
              options={faseOpts} value={faseFilt}
              onPick={k => setFaseFilt(k as FaseFilt)}
            />
            {!scope && centrosDisponibles.length > 1 && (
              <FiltroGrupo
                title="Centro de formación" icon="home"
                options={centroOpts} value={centroFilt}
                onPick={k => { setCentroFilt(k); setCoordFilt('') }}
              />
            )}
            {!scope && coordsDisponibles.length > 1 && (
              <FiltroGrupo
                title="Coordinación" icon="users"
                options={coordOpts} value={coordFilt === '' ? '' : String(coordFilt)}
                onPick={k => setCoordFilt(k === '' ? '' : Number(k))}
              />
            )}
          </div>

          <div className="ff-panel__foot">
            <div className="ff-field">
              <span className="ff-field__label">Rango de fechas</span>
              <div className="ff-dates">
                <select
                  value={fechaCampo}
                  onChange={e => setFechaCampo(e.target.value as FechaCampo)}
                  style={{ ...SEL, height: 34 }}
                >
                  {(Object.keys(FECHA_CAMPO_LABEL) as FechaCampo[]).map(k => (
                    <option key={k} value={k}>{FECHA_CAMPO_LABEL[k]}</option>
                  ))}
                </select>
                <input type="date" className="nx-input" value={fechaDesde} max={fechaHasta || undefined} onChange={e => setFechaDesde(e.target.value)} style={{ width: 150, padding: '7px 8px' }}/>
                <span className="ff-dates__sep">→</span>
                <input type="date" className="nx-input" value={fechaHasta} min={fechaDesde || undefined} onChange={e => setFechaHasta(e.target.value)} style={{ width: 150, padding: '7px 8px' }}/>
                {fechaActiva && (
                  <button className="ff-summary__clear" onClick={() => { setFechaDesde(''); setFechaHasta('') }} aria-label="Limpiar fechas">
                    <Ic n="x" s={12}/>
                  </button>
                )}
              </div>
            </div>

            <div className="ff-field">
              <span className="ff-field__label">Cobertura</span>
              <button
                type="button"
                onClick={() => setSoloSinInstr(v => !v)}
                className={`ff-instr${soloSinInstr ? ' ff-instr--on' : ''}`}
              >
                <Ic n="alert" s={12}/>
                Solo fichas sin instructor
                <span className="ff-instr__count">{sinInstrDisponibles}</span>
              </button>
            </div>

            <div className="ff-foot__spacer"/>

            <div className="ff-foot__actions">
              <button className="ff-clear" onClick={limpiarFiltros} disabled={!algoQueLimpiar}>
                <Ic n="refresh" s={12}/> Limpiar todo
              </button>
              <Btn variant="secondary" size="sm" onClick={() => setPanelOpen(false)}>Listo</Btn>
            </div>
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
                  <td style={{ ...TD_S, fontSize: 12, color: '#27272a', whiteSpace: 'nowrap' }}>
                    <Tip
                      style={{ fontFamily: '"JetBrains Mono", monospace' }}
                      content={<FechasFicha f={f}/>}
                    >
                      {fdISO(f.fecha_fin_productiva)}
                    </Tip>
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
