import { useState, useEffect } from 'react'
import { Ic, Card, Ava, Btn, Tag, Pager } from '../../components/ui'
import api from '../../lib/api'
import { FichaForm } from './FichaForm'
import type { FichaEdit } from './FichaForm'
import { jornadaLabel, diasHasta } from './parts'
import { AprendicesPracticaTable } from './AprendicesPractica'
import type { AprendizPractica, InstructorPracticaInfo } from './AprendicesPractica'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'

export interface FichaRow {
  id:                        number
  numero_ficha:              string
  programa_id:               number
  programa_nombre:           string
  programa_codigo:           string
  centro_formacion_id:       number
  coordinacion_academica_id: number | null
  coordinador_nombre:        string | null
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

const ESTADO_PILL: Record<string, { label: string; dot: string; bg: string; fg: string; bd: string }> = {
  EN_EJECUCION: { label: 'En ejecución', dot: '#16a34a', bg: '#dcfce7', fg: '#15803d', bd: '#86efac' },
  FINALIZADA:   { label: 'Finalizada',   dot: '#16a34a', bg: '#d1fae5', fg: '#065f46', bd: '#a7f3d0' },
  SUSPENDIDA:   { label: 'Suspendida',   dot: '#dc2626', bg: '#fee2e2', fg: '#b91c1c', bd: '#fecaca' },
}

const ETAPA_PILL: Record<string, { icon: 'briefcase' | 'layers'; color: string; bd: string }> = {
  PRACTICA:   { icon: 'briefcase', color: '#4f46e5', bd: '#c7d2fe' },
  LECTIVA:    { icon: 'layers',    color: '#52525b', bd: '#e4e4e7' },
}

function EtapaPill({ etapa }: { etapa: string | null }) {
  if (!etapa) return <span style={{ color: '#a1a1aa', fontSize: 12 }}>—</span>
  const p = ETAPA_PILL[etapa] ?? { icon: 'layers' as const, color: '#52525b', bd: '#e4e4e7' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 6, background: '#fff',
      border: `1px solid ${p.bd}`, fontSize: 10.5, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.03em', color: p.color,
    }}>
      <Ic n={p.icon} s={11}/>
      {etapa}
    </span>
  )
}

// Urgencia de fecha: la característica pedida para el catálogo -- de un
// vistazo, qué fichas ya debieron cerrar (vencidas en práctica), cuáles
// cierran pronto, y cuáles todavía en lectiva están por pasar a práctica
// (o ya deberían haber pasado y siguen ahí). Solo aplica a EN_EJECUCION.
function UrgenciaBadge({ f }: { f: FichaRow }) {
  if (f.estado !== 'EN_EJECUCION') return <span style={{ color: '#d4d4d8', fontSize: 12 }}>—</span>

  const enPractica = f.etapa_actual_teorica === 'PRACTICA'
  const fecha = enPractica ? f.fecha_fin_productiva : (f.fecha_inicio_productiva ?? f.fecha_fin_lectiva)
  const dias = diasHasta(fecha)
  if (dias == null) return <span style={{ color: '#d4d4d8', fontSize: 12 }}>—</span>

  const chip = (label: string, fg: string, bg: string) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 20,
      fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap', color: fg, background: bg,
      fontFamily: '"JetBrains Mono", monospace',
    }}>{label}</span>
  )

  if (enPractica) {
    if (dias < 0)  return chip(`${Math.abs(dias)}d vencida`, '#b91c1c', '#fee2e2')
    if (dias <= 30) return chip(`Cierra en ${dias}d`, '#c2410c', '#ffedd5')
    return <span style={{ color: '#d4d4d8', fontSize: 12 }}>—</span>
  }
  if (dias < 0)  return chip(`Debió pasar hace ${Math.abs(dias)}d`, '#a16207', '#fef9c3')
  if (dias <= 30) return chip(`Pasa a práctica en ${dias}d`, '#4338ca', '#eef2ff')
  return <span style={{ color: '#d4d4d8', fontSize: 12 }}>—</span>
}

function EstadoPill({ estado }: { estado: string }) {
  const s = ESTADO_PILL[estado] ?? { label: estado, dot: '#a1a1aa', bg: '#f1f1f3', fg: '#52525b', bd: '#e4e4e7' }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 9px', borderRadius: 20, background: s.bg,
      border: `1px solid ${s.bd}`, fontSize: 10.5, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.04em', color: s.fg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }}/>
      {s.label}
    </span>
  )
}

type EstadoFilt = '' | 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'
type EtapaFilt  = '' | 'LECTIVA' | 'PRACTICA'
type FechaCampo = 'fecha_inicio' | 'fecha_inicio_productiva' | 'fecha_fin_productiva'
type FichaSort  = 'inicio_reciente' | 'cierre_proximo' | 'numero' | 'programa'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: '',             label: 'Todas'        },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA',   label: 'Finalizadas'  },
  { key: 'SUSPENDIDA',   label: 'Suspendidas'  },
]

const ETAPA_CHIPS: { key: EtapaFilt; label: string }[] = [
  { key: '',           label: 'Todas'       },
  { key: 'LECTIVA',    label: 'Lectiva'     },
  { key: 'PRACTICA',   label: 'Práctica'    },
]

const FECHA_CAMPO_LABEL: Record<FechaCampo, string> = {
  fecha_inicio:            'Inicio',
  fecha_inicio_productiva: 'Inicio productiva',
  fecha_fin_productiva:    'Fin productiva',
}

const FICHA_SORT_LABEL: Record<FichaSort, string> = {
  inicio_reciente: 'Inicio más reciente',
  cierre_proximo:  'Cierre más próximo',
  numero:          'Número de ficha',
  programa:        'Programa (A–Z)',
}

const SEL = {
  height: 34, padding: '0 10px', border: '1px solid #e4e4e7', borderRadius: 8,
  fontSize: 12.5, background: '#fff', color: '#18181b',
  fontFamily: 'Inter, sans-serif', cursor: 'pointer', outline: 'none',
}

const THEAD = ['Número', 'Programa', 'Coordinador', 'Inicio', 'Inicio productiva', 'Fin productiva', 'Etapa teórica', 'Urgencia', 'Estado', '']
const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px' }

function toFichaEdit(f: FichaRow): FichaEdit {
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
    etapa_actual:              f.etapa_actual_teorica as 'LECTIVA' | 'PRACTICA' | null,
  }
}

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
  kpi: {
    aprendices_total: number; listos_para_iniciar: number; en_curso: number; concluidos: number
  }
  aprendices_practica: AprendizPractica[]
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

function KpiBox({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: any }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <Ic n={icon} s={14} style={{ color: '#a1a1aa' }}/>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>{sub}</div>
    </Card>
  )
}

export function FichaDetalle({ id, onBack, onEditar }: {
  id: number; onBack: () => void; onEditar: (f: FichaEdit) => void
}) {
  "use no memo"
  const [state, setState] = useState<DetState>({ status: 'loading' })
  // Aprendiz cuyo detalle de etapa productiva (planeación + seguimientos +
  // evaluación) se está viendo, en solo lectura, desde el detalle de la ficha.
  const [etapaId, setEtapaId] = useState<number | null>(null)

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

  if (etapaId != null) {
    const numero = state.status === 'ok' ? state.data.ficha.numero_ficha : ''
    return (
      <div style={{ maxWidth: 1100 }}>
        <EtapaProductivaDetalle
          etapaId={etapaId}
          backLabel={numero ? `Ficha ${numero}` : 'Ficha'}
          onBack={() => setEtapaId(null)}
        />
      </div>
    )
  }

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

  const { ficha, kpi, aprendices_practica, instructor_practica } = state.data
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
            <EstadoPill estado={ficha.estado}/>
            <EtapaPill etapa={ficha.etapa_actual}/>
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
        <Btn variant="accent" icon="users" onClick={() => onEditar(detalleToEdit(ficha))}>Editar ficha y asignaciones</Btn>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiBox label="Aprendices" value={String(kpi.aprendices_total)} sub="en la ficha" icon="users"/>
        <KpiBox label="Listos para iniciar" value={String(kpi.listos_para_iniciar)} sub="sin alternativa, al día en juicios" icon="alert"/>
        <KpiBox label="En curso" value={String(kpi.en_curso)} sub="con etapa productiva activa" icon="briefcase"/>
        <KpiBox label="Concluidos" value={String(kpi.concluidos)} sub="confirmados por Sofia" icon="checkCircle"/>
      </div>

      {/* Contenido: roster de aprendices en práctica + lateral con la meta de la ficha */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <AprendicesPracticaTable
          aprendices={aprendices_practica}
          soloConEtapa
          onOpen={a => { if (a.etapa_id != null) setEtapaId(a.etapa_id) }}
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

// scope: cuando lo usa un coordinador, ve y crea solo fichas de su coordinación.
// SuperAdminDashboard/CoordinadorDashboard/CoordinacionDetalle navegan entre
// secciones por estado interno (navItem/tab), no por rutas reales de React
// Router -- por eso el detalle de una ficha también se maneja 100% con
// estado local (focusId), sin useNavigate/useParams: no hay ninguna ruta
// ":fichaId" declarada en el router que los capture.
export function FichasAdmin({ scope, onDetailChange, initialFichaId }: {
  scope?: { coordinacionId: number; centroId: number }
  onDetailChange?: (inDetail: boolean) => void
  initialFichaId?: number
} = {}) {
  "use no memo"
  // Ficha en foco (p. ej. al abrir el detalle desde la lista, o desde el
  // dashboard/alertas vía initialFichaId); null = mostrando la lista.
  const [focusId, setFocusId] = useState<number | null>(initialFichaId ?? null)
  const detalleId = focusId
  const [estadoFilt, setEstadoFilt] = useState<EstadoFilt>('')
  // Por defecto solo se ven las fichas en etapa práctica -- FORMA se centra en
  // seguimiento productivo; "Todas"/"Lectiva" quedan disponibles para cuando
  // hace falta gestionar una ficha antes de que llegue a esa etapa (p. ej.
  // asignarle instructor de práctica con antelación).
  const [etapaFilt,  setEtapaFilt]  = useState<EtapaFilt>('PRACTICA')
  const [fechaCampo, setFechaCampo] = useState<FechaCampo>('fecha_inicio')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')
  const [filtrosOpen, setFiltrosOpen] = useState(false)
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<FichaSort>('inicio_reciente')
  const [state,      setState]      = useState<ListState>({ status: 'loading' })
  const [page,       setPage]       = useState(0)
  // Formulario de crear/editar: overlay local, independiente de si se abrió
  // desde la lista o desde el detalle de una ficha.
  const [formFicha,  setFormFicha]  = useState<FichaEdit | null | undefined>(undefined)
  const [reloadKey,  setReloadKey]  = useState(0)

  const coordScope = scope?.coordinacionId ?? null

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<FichaRow[]>(coordScope != null ? `/fichas?coordinacion_id=${coordScope}` : '/fichas')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [reloadKey, coordScope])

  useEffect(() => { setPage(0) }, [estadoFilt, etapaFilt, fechaCampo, fechaDesde, fechaHasta, search, sort])

  // Avisa al contenedor (p. ej. CoordinacionDetalle) cuando se entra/sale del detalle/edición de una
  // ficha, para que pueda enfocar solo la ficha y ocultar su propio encabezado.
  useEffect(() => { onDetailChange?.(detalleId != null || formFicha !== undefined) }, [detalleId, formFicha])

  if (formFicha !== undefined) {
    return (
      <FichaForm
        ficha={formFicha}
        lockScope={scope ? { centroId: scope.centroId, coordinacionId: scope.coordinacionId } : undefined}
        onCancel={() => setFormFicha(undefined)}
        onSaved={() => { setFormFicha(undefined); setReloadKey(k => k + 1) }}
      />
    )
  }

  if (detalleId != null) {
    return (
      <FichaDetalle
        id={detalleId}
        onBack={() => setFocusId(null)}
        onEditar={ficha => setFormFicha(ficha)}
      />
    )
  }

  const all = state.status === 'ok' ? state.data : []
  const q   = search.trim().toLowerCase()
  const fechaActiva = !!(fechaDesde || fechaHasta)
  // Solo la fecha queda dentro del dropdown "Filtros" -- estado y etapa ahora
  // son chips visibles en la propia pantalla (ver debajo).
  const filtrosExtraCount = fechaActiva ? 1 : 0

  const estadoCounts: Record<EstadoFilt, number> = {
    '':            all.length,
    EN_EJECUCION:  all.filter(f => f.estado === 'EN_EJECUCION').length,
    FINALIZADA:    all.filter(f => f.estado === 'FINALIZADA').length,
    SUSPENDIDA:    all.filter(f => f.estado === 'SUSPENDIDA').length,
  }
  const etapaCounts: Record<EtapaFilt, number> = {
    '':         all.length,
    LECTIVA:    all.filter(f => f.etapa_actual_teorica === 'LECTIVA').length,
    PRACTICA:   all.filter(f => f.etapa_actual_teorica === 'PRACTICA').length,
  }
  const vencidasCount = all.filter(f => {
    if (f.estado !== 'EN_EJECUCION' || f.etapa_actual_teorica !== 'PRACTICA') return false
    const d = diasHasta(f.fecha_fin_productiva)
    return d != null && d < 0
  }).length

  const filtered = all
    .filter(f => {
      if (estadoFilt && f.estado !== estadoFilt) return false
      if (etapaFilt && f.etapa_actual_teorica !== etapaFilt) return false
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
        && !(f.coordinador_nombre ?? '').toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      switch (sort) {
        case 'numero':         return a.numero_ficha.localeCompare(b.numero_ficha, 'es')
        case 'programa':       return a.programa_nombre.localeCompare(b.programa_nombre, 'es')
        case 'cierre_proximo': return (a.fecha_fin_productiva || a.fecha_fin_lectiva || '').localeCompare(b.fecha_fin_productiva || b.fecha_fin_lectiva || '')
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
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 26, fontWeight: 700, color: '#0a0a0b', lineHeight: 1 }}>
              {all.length.toLocaleString('es-CO')}
            </span>
            <span style={{ fontSize: 13, color: '#52525b' }}>
              {scope ? 'fichas de tu coordinación académica' : 'fichas en la regional'}
              {' · '}<strong style={{ color: '#4f46e5', fontWeight: 600 }}>{etapaCounts.PRACTICA}</strong> en práctica
              {vencidasCount > 0 && <> · <strong style={{ color: '#dc2626', fontWeight: 600 }}>{vencidasCount} vencida{vencidasCount === 1 ? '' : 's'}</strong></>}
            </span>
          </div>
        </div>
        <Btn variant="accent" icon="plus" onClick={() => setFormFicha(null)}>Crear ficha</Btn>
      </div>

      {/* Chips de Estado y Etapa -- filtros principales, siempre visibles */}
      {state.status === 'ok' && all.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {ESTADO_CHIPS.map(c => {
              const active = estadoFilt === c.key
              return (
                <button
                  key={c.key || 'todas-estado'}
                  onClick={() => setEstadoFilt(c.key)}
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
                  }}>{estadoCounts[c.key]}</span>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {ETAPA_CHIPS.map(c => {
              const active = etapaFilt === c.key
              return (
                <button
                  key={c.key || 'todas-etapa'}
                  onClick={() => setEtapaFilt(c.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '5px 11px', borderRadius: 8, cursor: 'pointer',
                    border: active ? '1.5px solid #4f46e5' : '1px solid #e4e4e7',
                    background: active ? '#4f46e5' : '#fafafa',
                    color: active ? '#fff' : '#52525b',
                    fontSize: 12, fontWeight: active ? 600 : 500, fontFamily: 'Inter, sans-serif',
                    transition: 'all 120ms',
                  }}
                >
                  {c.label}
                  <span style={{
                    fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                    color: active ? 'rgba(255,255,255,.85)' : '#a1a1aa',
                  }}>{etapaCounts[c.key]}</span>
                </button>
              )
            })}
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
              placeholder="Buscar ficha, programa o coordinador…"
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
                  <td style={TD_S}><Sk w={90} h={12}/></td>
                  <td style={TD_S}><Sk w={90} h={12}/></td>
                  <td style={TD_S}><Sk w={90} h={12}/></td>
                  <td style={TD_S}><Sk w={90} h={12}/></td>
                  <td style={TD_S}><Sk w={90} h={20} r={20}/></td>
                  <td style={TD_S}><Sk w={80} h={20} r={20}/></td>
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
                  onClick={() => setFocusId(f.id)}
                  style={{ borderBottom: '1px solid #f1f1f3', cursor: 'pointer' }}
                >
                  <td style={TD_S}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_PILL[f.estado]?.dot ?? '#a1a1aa', flexShrink: 0 }}/>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#0a0a0b' }}>{f.numero_ficha}</span>
                    </div>
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
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a', whiteSpace: 'nowrap' }}>
                    {fdISO(f.fecha_inicio)}
                  </td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a', whiteSpace: 'nowrap' }}>
                    {fdISO(f.fecha_inicio_productiva)}
                  </td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a', whiteSpace: 'nowrap' }}>
                    {fdISO(f.fecha_fin_productiva)}
                  </td>
                  <td style={TD_S}><EtapaPill etapa={f.etapa_actual_teorica}/></td>
                  <td style={TD_S}><UrgenciaBadge f={f}/></td>
                  <td style={TD_S}><EstadoPill estado={f.estado}/></td>
                  <td style={{ ...TD_S, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button
                      title="Editar ficha"
                      onClick={() => setFormFicha(toFichaEdit(f))}
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
