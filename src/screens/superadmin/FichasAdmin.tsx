import { useState, useEffect } from 'react'
import { Ic, Card, Ava, Btn, Tag, Pager, Bdg, Prog, DigBadge } from '../../components/ui'
import api from '../../lib/api'
import { FichaForm } from './FichaForm'
import type { FichaEdit } from './FichaForm'
import { Pill, Donut, SM, jornadaLabel } from '../instructor/parts'
import type { StatusTone } from '../instructor/parts'
import { descargarGuiaSesion } from '../instructor/guia'

interface FichaRow {
  id:                        number
  numero_ficha:              string
  programa_id:               number
  programa_nombre:           string
  programa_codigo:           string
  tiene_disenio_curricular:  number
  centro_formacion_id:       number
  coordinacion_academica_id: number | null
  coordinador_nombre:        string | null
  estado:                    'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'
  fecha_inicio:              string
  fecha_fin_lectiva:         string
  fecha_fin_productiva:      string | null
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
type FichaSort  = 'inicio_reciente' | 'cierre_proximo' | 'numero' | 'programa'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: '',             label: 'Todas'        },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA',   label: 'Finalizadas'  },
  { key: 'SUSPENDIDA',   label: 'Suspendidas'  },
]

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

const THEAD = ['Número', 'Programa', 'Coordinador', 'Inicio', 'Fin', 'Avance', 'Estado', '']
const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px' }

type View =
  | { mode: 'list' }
  | { mode: 'form'; ficha: FichaEdit | null }
  | { mode: 'detalle'; id: number }

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
  }
}

// ─── Detalle de ficha (read-only: avance por competencia, instructor, sesiones) ──

interface CompDetalle {
  asignacion_id:      number
  competencia_id:     number
  codigo_norma:       string
  nombre:             string
  tipo:               string
  horas_maximas:      number
  horas_ejecutadas:   number
  avance:             number
  status:             StatusTone
  ra_completados:     number
  ra_total:           number
  instructor_id:      string
  instructor_nombre:  string
  resultados_aprendizaje: { id: number; numero: string; descripcion: string; avance: number; status: StatusTone; completado: boolean }[]
}

interface SesionRow {
  id: number; fecha: string; horas_ejecutadas: number; tipo_sesion: string; estado_sesion: string
  competencia_nombre: string; instructor_nombre: string; ras: number; conocimientos: number; criterios: number
}

interface FichaDetalleData {
  ficha: {
    id: number; numero_ficha: string; estado: 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'
    fecha_inicio: string; fecha_fin_lectiva: string; fecha_fin_productiva: string | null
    sede: string | null; jornada: string | null
    centro_formacion_id: number; coordinacion_academica_id: number | null
    programa_id: number; programa_nombre: string; programa_codigo: string; programa_version: number
    nivel_formacion: string; horas_programa: number
    coordinador_nombre: string; coordinacion_nombre: string; dias_restantes: number
  }
  kpi: { avance: number; horas_ejecutadas: number; ras_cerrados: number; ras_total: number; instructores: number; sesiones_total: number }
  competencias: CompDetalle[]
  sesiones: SesionRow[]
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

// Acordeón de competencia: avance + instructor + RAs (read-only).
function CompCard({ comp, defaultOpen }: { comp: CompDetalle; defaultOpen?: boolean }) {
  "use no memo"
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <Card style={{ overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <Donut value={comp.avance} size={40} stroke={5} color={SM[comp.status].dot}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600 }}>{comp.avance}</span>
        </Donut>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{comp.codigo_norma}</span>
            <Pill status={comp.status} size="sm"/>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', lineHeight: 1.35 }}>{comp.nombre}</div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <Ava name={comp.instructor_nombre} size={20}/>
              <span style={{ fontSize: 11.5, color: '#3f3f46' }}>{comp.instructor_nombre}</span>
            </span>
            <span style={{ fontSize: 11, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>
              {comp.ra_completados}/{comp.ra_total} RA · {comp.horas_ejecutadas.toFixed(0)}/{comp.horas_maximas} h
            </span>
          </div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #f1f1f3' }}>
          {comp.resultados_aprendizaje.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 12, color: '#71717a' }}>Esta competencia no tiene resultados de aprendizaje cargados.</div>
          ) : comp.resultados_aprendizaje.map((ra, i) => (
            <div key={ra.id} style={{ padding: '12px 16px', display: 'flex', gap: 12, borderBottom: i < comp.resultados_aprendizaje.length - 1 ? '1px solid #f7f7f8' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f7f7f8', border: '1px solid #e4e4e7', display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                RA{i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{ra.numero}</div>
                    <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.4, marginTop: 2 }}>{ra.descripcion}</div>
                  </div>
                  <Pill status={ra.status} size="sm"/>
                </div>
                <Prog value={ra.avance} status={ra.status} showLabel/>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

export function FichaDetalle({ id, onBack, onEditar }: {
  id: number; onBack: () => void; onEditar: (f: FichaEdit) => void
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

  const { ficha, kpi, competencias, sesiones } = state.data
  const meta: [string, string][] = [
    ['Coordinador', ficha.coordinador_nombre],
    ['Coordinación', ficha.coordinacion_nombre],
    ['Inicio', fd(ficha.fecha_inicio)],
    ['Fin lectiva', fd(ficha.fecha_fin_lectiva)],
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
          </div>
        </div>
        <Btn variant="accent" icon="users" onClick={() => onEditar(detalleToEdit(ficha))}>Editar ficha y asignaciones</Btn>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Card style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Donut value={kpi.avance} size={48} stroke={5} color="#4f46e5">
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600 }}>{kpi.avance}%</span>
          </Donut>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>Avance</div>
            <div style={{ fontSize: 11.5, color: '#3f3f46', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
              {competencias.filter(c => c.avance >= 100).length}/{competencias.length} comp.
            </div>
          </div>
        </Card>
        <KpiBox label="Horas ejec." value={kpi.horas_ejecutadas.toFixed(0)} sub="registradas" icon="clock"/>
        <KpiBox label="Días restantes" value={ficha.estado === 'EN_EJECUCION' ? String(ficha.dias_restantes) : '—'} sub="cierre lectiva" icon="calendar"/>
        <KpiBox label="RAs cerrados" value={String(kpi.ras_cerrados)} sub={`de ${kpi.ras_total}`} icon="target"/>
      </div>

      {/* Contenido: competencias + lateral */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>
              Competencias · {competencias.length}
              <span style={{ color: '#a1a1aa', fontWeight: 400 }}> · {kpi.instructores} instructor{kpi.instructores === 1 ? '' : 'es'}</span>
            </div>
            <Btn variant="ghost" size="sm" icon="edit" onClick={() => onEditar(detalleToEdit(ficha))}>Gestionar asignaciones</Btn>
          </div>
          {competencias.length === 0 ? (
            <Card>
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Ic n="users" s={26} style={{ color: '#a1a1aa' }}/>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>Sin asignaciones</div>
                <div style={{ fontSize: 12.5, color: '#71717a' }}>Esta ficha aún no tiene instructores asignados a sus competencias.</div>
                <Btn variant="accent" size="sm" icon="users" onClick={() => onEditar(detalleToEdit(ficha))}>Asignar instructores</Btn>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {competencias.map((c, i) => <CompCard key={c.asignacion_id} comp={c} defaultOpen={i === 0}/>)}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Sesiones recientes</div>
            {sesiones.length === 0 ? (
              <Card style={{ padding: 16 }}><div style={{ fontSize: 12, color: '#71717a' }}>Sin sesiones registradas en esta ficha.</div></Card>
            ) : (
              <Card>
                {sesiones.map((s, i) => (
                  <div key={s.id} style={{ padding: '10px 14px', borderBottom: i < sesiones.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#52525b', alignItems: 'center' }}>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha)}</span>
                      <span>·</span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{s.horas_ejecutadas.toFixed(1)} h</span>
                      <span style={{ marginLeft: 'auto' }}>
                        <Bdg tone={s.estado_sesion === 'VALIDADA' ? 'accent' : 'neutral'}>{s.estado_sesion}</Bdg>
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 5 }}>
                      <Ava name={s.instructor_nombre} size={18}/>
                      <span style={{ fontSize: 11.5, color: '#3f3f46', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.instructor_nombre}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#18181b', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
                      {s.ras} RA · {s.conocimientos} con · {s.criterios} crit.
                    </div>
                    <button onClick={() => descargarGuiaSesion(s.id)}
                      style={{ marginTop: 6, fontSize: 11, color: '#4f46e5', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                      <Ic n="download" s={11}/> Guía de aprendizaje
                    </button>
                  </div>
                ))}
              </Card>
            )}
          </div>

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
    </div>
  )
}

// scope: cuando lo usa un coordinador, ve y crea solo fichas de su coordinación.
export function FichasAdmin({ scope, onDetailChange, onDigitalizar }: {
  scope?: { coordinacionId: number; centroId: number }
  onDetailChange?: (inDetail: boolean) => void
  onDigitalizar?: () => void
} = {}) {
  "use no memo"
  const [estadoFilt, setEstadoFilt] = useState<EstadoFilt>('')
  const [search,     setSearch]     = useState('')
  const [sort,       setSort]       = useState<FichaSort>('inicio_reciente')
  const [soloPendientes, setSoloPendientes] = useState(false)
  const [state,      setState]      = useState<ListState>({ status: 'loading' })
  const [page,       setPage]       = useState(0)
  const [view,       setView]       = useState<View>({ mode: 'list' })
  const [reloadKey,  setReloadKey]  = useState(0)
  // Ficha cuyo programa no está digitalizado y a la que se intentó entrar: muestra el aviso.
  const [bloqueada,  setBloqueada]  = useState<FichaRow | null>(null)

  const coordScope = scope?.coordinacionId ?? null

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<FichaRow[]>(coordScope != null ? `/fichas?coordinacion_id=${coordScope}` : '/fichas')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [reloadKey, coordScope])

  useEffect(() => { setPage(0); setBloqueada(null) }, [estadoFilt, search, sort, soloPendientes])

  // Avisa al contenedor (p. ej. CoordinacionDetalle) cuando se entra/sale del detalle/edición de una
  // ficha, para que pueda enfocar solo la ficha y ocultar su propio encabezado.
  useEffect(() => { onDetailChange?.(view.mode !== 'list') }, [view.mode])

  if (view.mode === 'form') {
    return (
      <FichaForm
        ficha={view.ficha}
        lockScope={scope ? { centroId: scope.centroId, coordinacionId: scope.coordinacionId } : undefined}
        onCancel={() => setView({ mode: 'list' })}
        onSaved={() => { setView({ mode: 'list' }); setReloadKey(k => k + 1) }}
      />
    )
  }

  if (view.mode === 'detalle') {
    return (
      <FichaDetalle
        id={view.id}
        onBack={() => setView({ mode: 'list' })}
        onEditar={ficha => setView({ mode: 'form', ficha })}
      />
    )
  }

  const all = state.status === 'ok' ? state.data : []
  const q   = search.trim().toLowerCase()
  const pendientesCount = all.filter(f => !f.tiene_disenio_curricular).length
  const filtered = all
    .filter(f => {
      if (estadoFilt && f.estado !== estadoFilt) return false
      if (soloPendientes && f.tiene_disenio_curricular) return false
      if (q
        && !f.numero_ficha.toLowerCase().includes(q)
        && !f.programa_nombre.toLowerCase().includes(q)
        && !f.programa_codigo.toLowerCase().includes(q)
        && !(f.coordinador_nombre ?? '').toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      // Las fichas con programa digitalizado (monitoreables) van siempre primero.
      const da = a.tiene_disenio_curricular ? 1 : 0
      const db = b.tiene_disenio_curricular ? 1 : 0
      if (da !== db) return db - da
      switch (sort) {
        case 'numero':         return a.numero_ficha.localeCompare(b.numero_ficha, 'es')
        case 'programa':       return a.programa_nombre.localeCompare(b.programa_nombre, 'es')
        case 'cierre_proximo': return (a.fecha_fin_lectiva || '').localeCompare(b.fecha_fin_lectiva || '')
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Fichas</h2>
          <div style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            {scope ? 'Fichas de tu coordinación académica' : 'Todas las fichas del sistema'}
          </div>
        </div>
        <Btn variant="accent" icon="plus" onClick={() => setView({ mode: 'form', ficha: null })}>Crear ficha</Btn>
      </div>

      {/* Toolbar: chips de estado + búsqueda + orden */}
      {state.status === 'ok' && all.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ESTADO_CHIPS.map(c => {
              const active = estadoFilt === c.key
              const count = c.key === '' ? all.length : all.filter(f => f.estado === c.key).length
              return (
                <button
                  key={c.key}
                  onClick={() => setEstadoFilt(c.key)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    border: active ? '1.5px solid #4f46e5' : '1.5px solid #e4e4e7',
                    background: active ? '#eef2ff' : '#fff',
                    color: active ? '#4f46e5' : '#52525b',
                    fontSize: 12.5, fontWeight: active ? 600 : 400, fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {c.label}
                  <span style={{
                    fontSize: 11, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                    background: active ? '#c7d2fe' : '#f1f1f3', color: active ? '#4338ca' : '#71717a',
                    padding: '1px 6px', borderRadius: 10,
                  }}>{count}</span>
                </button>
              )
            })}

            {/* Filtro independiente: fichas con programa sin digitalizar */}
            {pendientesCount > 0 && (
              <button
                onClick={() => setSoloPendientes(v => !v)}
                title="Fichas cuyo programa aún no está digitalizado"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                  marginLeft: 4,
                  border: soloPendientes ? '1.5px solid #d97706' : '1.5px solid #fde68a',
                  background: soloPendientes ? '#fef3c7' : '#fffbeb',
                  color: '#a16207', fontSize: 12.5, fontWeight: soloPendientes ? 600 : 400,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <Ic n="alert" s={12}/>
                Sin digitalizar
                <span style={{
                  fontSize: 11, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                  background: soloPendientes ? '#fde68a' : '#fef9c3', color: '#a16207',
                  padding: '1px 6px', borderRadius: 10,
                }}>{pendientesCount}</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
                  <td style={TD_S}><Sk w={100} h={12}/></td>
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
        {bloqueada && (
          <Card style={{ padding: 14, marginBottom: 12, background: '#fffbeb', border: '1px solid #fde68a' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Ic n="alert" s={16} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#92400e' }}>
                  Ficha {bloqueada.numero_ficha} no disponible
                </div>
                <div style={{ fontSize: 12.5, color: '#a16207', marginTop: 2 }}>
                  No puedes ver el detalle porque el programa «{bloqueada.programa_nombre}» todavía no está digitalizado.
                  Digitaliza su diseño curricular para habilitar la ficha.
                </div>
                {onDigitalizar && (
                  <div style={{ marginTop: 10 }}>
                    <Btn variant="accent" size="sm" icon="upload" onClick={onDigitalizar}>Ir a digitalizar</Btn>
                  </div>
                )}
              </div>
              <button onClick={() => setBloqueada(null)} aria-label="Cerrar aviso" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a16207', display: 'grid', placeItems: 'center', width: 22, height: 22, flexShrink: 0 }}>
                <Ic n="x" s={14}/>
              </button>
            </div>
          </Card>
        )}
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>{theadRow}</thead>
            <tbody>
              {pageItems.map(f => {
                const dig = !!f.tiene_disenio_curricular
                return (
                <tr
                  key={f.id}
                  className={dig ? 'nx-row' : undefined}
                  onClick={() => dig ? setView({ mode: 'detalle', id: f.id }) : setBloqueada(f)}
                  title={dig ? undefined : 'El programa de formación de esta ficha aún no está digitalizado'}
                  aria-disabled={!dig}
                  style={{ borderBottom: '1px solid #f1f1f3', cursor: dig ? 'pointer' : 'not-allowed', background: dig ? undefined : '#fafafa' }}
                >
                  <td style={TD_S}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: ESTADO_PILL[f.estado]?.dot ?? '#a1a1aa', flexShrink: 0 }}/>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: dig ? '#0a0a0b' : '#71717a' }}>{f.numero_ficha}</span>
                    </div>
                  </td>
                  <td style={TD_S}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Tag>{programaShort(f.programa_nombre)}</Tag>
                      <span style={{ color: dig ? '#18181b' : '#71717a', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.programa_nombre}
                      </span>
                      {!dig && <DigBadge dig={false}/>}
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
                    {fd(f.fecha_inicio)}
                  </td>
                  <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#27272a', whiteSpace: 'nowrap' }}>
                    {fd(f.fecha_fin_lectiva)}
                  </td>
                  <td style={{ ...TD_S, color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace', fontSize: 12 }}>—</td>
                  <td style={TD_S}><EstadoPill estado={f.estado}/></td>
                  <td style={{ ...TD_S, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                    <button
                      title="Editar ficha"
                      onClick={() => setView({ mode: 'form', ficha: toFichaEdit(f) })}
                      style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#71717a' }}
                    >
                      <Ic n="edit" s={13}/>
                    </button>
                  </td>
                </tr>
                )
              })}
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
