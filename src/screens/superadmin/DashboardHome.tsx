import { useState, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Ic, Bdg, Card, Ava, Btn, Prog, Pager } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import './DashboardHome.css'

// ─── Types ─────────────────────────────────────────────────────────────────────

type EstadoCentro = 'AL_DIA' | 'REVISAR' | 'URGENTE'

interface ResumenKPI {
  programas_digitalizados:       number
  programas_total:               number
  fichas_cierre_60_dias:         number
  fichas_cierre_60_en_riesgo:    number
  instructores_activos_semana:   number
  instructores_total_asignados:  number
  instructores_inactivos_7_dias: number
}

interface CentroItem {
  id:                       number
  nombre:                   string
  codigo:                   string
  fichas_activas:           number
  programas_digitalizados:  number
  programas_total:          number
  coordinaciones_academicas: number
  cobertura_pct:            number
  fichas_en_riesgo:         number
  estado:                   EstadoCentro
}

interface ProgramaPend {
  id:                     number
  codigo:                 string
  nombre:                 string
  nivel_formacion:        string
  fichas_activas:         number
  dias_al_cierre_proximo: number
}

interface ProgramaCentro {
  id:                 number
  codigo:            string
  nombre:            string
  version:           number
  nivel_formacion:   string
  horas:             number
  digitalizado:      boolean
  fichas_activas:    number
  total_competencias: number
  total_ra:          number
  total_conocimientos: number
  total_criterios:   number
}

interface CoordItem {
  id:                      string
  nombre_completo:         string
  coordinacion_nombre:     string
  fichas_activas:          number
  programas_digitalizados: number
  programas_total:         number
  cobertura_pct:           number
  estado:                  EstadoCentro
}

interface CentroDetData {
  centro: { id: number; nombre: string; codigo: string }
  kpi: {
    programas_pendientes:   number
    mas_urgente:            { nombre: string; codigo: string; fichas_activas: number } | null
    fichas_activas:         number
    cobertura_promedio_pct: number
  }
  programas_pendientes: ProgramaPend[]
  programas:            ProgramaCentro[]
  coordinaciones:       CoordItem[]
}

interface FichaRiesgoItem {
  id:                  number
  numero_ficha:        string
  programa_nombre:     string
  programa_codigo:     string
  centro_nombre:       string
  coordinador_nombre:  string
  coordinacion_nombre: string
  dias_restantes:      number
  avance:              number
  estado_badge:        'CRITICO' | 'REVISAR'
}

interface CoberturaCentroItem {
  centro:        string
  nombre:        string
  al_dia:        number
  revisar:       number
  riesgo:        number
  sin_dig:       number
  digitalizados: number
}

interface CompRezItem {
  nombre:    string
  centro:    string
  fichas:    number
  avance:    number
  tendencia: number[]
  estado:    'CRITICO' | 'REVISAR' | 'OK'
}

interface AnaliticaData {
  evolucion_semanal:      number[]
  semanas:                string[]
  cobertura_por_centro:   CoberturaCentroItem[]
  competencias_rezagadas: CompRezItem[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function estadoTone(e: EstadoCentro): 'ok' | 'warn' | 'err' {
  return e === 'AL_DIA' ? 'ok' : e === 'REVISAR' ? 'warn' : 'err'
}

function estadoLabel(e: EstadoCentro): string {
  return e === 'AL_DIA' ? 'Al día' : e === 'REVISAR' ? 'Revisar' : 'Urgente'
}

function diasColor(d: number): string {
  return d < 60 ? '#dc2626' : d < 120 ? '#d97706' : '#16a34a'
}

function safePct(a: number, b: number): number {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}

function nivelStyle(nivel: string) {
  const n = nivel.toUpperCase()
  if (n.includes('TECNÓLOGO'))       return { bg: '#dbeafe', fg: '#1d4ed8' }
  if (n.includes('TÉCNICO'))         return { bg: '#dcfce7', fg: '#15803d' }
  if (n.includes('ESPECIALIZACIÓN')) return { bg: '#f3e8ff', fg: '#6b21a8' }
  return { bg: '#f1f1f3', fg: '#52525b' }
}

function digBarColor(pct: number): string {
  return pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'
}

// Versión del programa con el formato de FORMA (V102, V001, …)
function fmtVersion(v: number): string {
  return `V${String(v).padStart(3, '0')}`
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

// ─── Primitives ───────────────────────────────────────────────────────────────

function Sk({ w, h, r = 5, delay = 0, style }: { w: string | number; h: number; r?: number; delay?: number; style?: CSSProperties }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, animationDelay: `${delay}ms`, ...style }}
    />
  )
}

function PendingMsg({ text }: { text: string }) {
  return (
    <div className="pending-msg">
      <Ic n="clock" s={14} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      {text}
    </div>
  )
}

function EmptyState({ icon, title, sub }: { icon: IcName; title: string; sub: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">
        <Ic n={icon} s={20} style={{ color: '#a1a1aa' }}/>
      </div>
      <div>
        <div className="empty-state__title">{title}</div>
        <div className="empty-state__sub">{sub}</div>
      </div>
    </div>
  )
}

// ─── Actividad — helpers ────────────────────────────────────────────────────────

interface ActividadDia { fecha: string; count: number }

function isoKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const HEAT = ['#ebedf0', '#c7d2fe', '#a5b4fc', '#818cf8', '#4f46e5']

function heatLevel(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

const MONTHS_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DOW_ABBR    = ['Lun', '', 'Mié', '', 'Vie', '', '']

// ─── Tarjeta "Hoy" (azul, abre el calendario de actividad) ──────────────────────

function TodayCard({ open, onToggle, actividad }: { open: boolean; onToggle: () => void; actividad: ActividadDia[] }) {
  "use no memo"
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onToggle()
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onToggle])

  const today     = new Date()
  const dayNum    = today.getDate()
  const weekday   = today.toLocaleDateString('es-CO', { weekday: 'long' })
  const monthYear = today.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })

  return (
    <div className="today-wrap" ref={ref}>
      <Card style={{ padding: 20, background: 'rgba(238,242,255,.7)', border: '1px solid #c7d2fe', display: 'flex', flexDirection: 'column' }}>
        <div className="kpi2-head">
          <div className="kpi2-label" style={{ color: '#312e81' }}>Hoy</div>
          <Ic n="calendar" s={16} style={{ color: '#4f46e5' }}/>
        </div>

        <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 28, fontWeight: 600, lineHeight: 1, color: '#312e81' }}>
            {dayNum}
          </span>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#312e81', textTransform: 'capitalize' }}>{weekday}</div>
            <div style={{ fontSize: 11.5, color: '#6366f1', textTransform: 'capitalize' }}>{monthYear}</div>
          </div>
        </div>

        <button onClick={onToggle} className="today-btn" style={{ marginTop: 'auto' }}>
          <Ic n="trend" s={13}/>
          {open ? 'Ocultar actividad' : 'Ver actividad'}
        </button>
      </Card>

      {open && (
        <div className="activity-pop">
          <ActivityCalendar actividad={actividad}/>
        </div>
      )}
    </div>
  )
}

// ─── Calendario de actividad (estilo GitHub) ────────────────────────────────────

function ActivityCalendar({ actividad }: { actividad: ActividadDia[] }) {
  const counts = new Map(actividad.map(a => [a.fecha.slice(0, 10), a.count]))
  const at = (d: Date) => counts.get(isoKey(d)) ?? 0

  const WEEKS = 26
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7)

  const cols: { date: Date; count: number; future: boolean }[][] = []
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: Date; count: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      const future = date > today
      col.push({ date, count: future ? -1 : at(date), future })
    }
    cols.push(col)
  }

  let total = 0
  cols.forEach(c => c.forEach(x => { if (x.count > 0) total += x.count }))

  let streak = 0
  const cur = new Date(today)
  while (streak < 400 && at(cur) > 0) {
    streak++
    cur.setDate(cur.getDate() - 1)
  }

  const monthLabels = cols.map((c, i) => {
    const month = c[0].date.getMonth()
    const prev  = i > 0 ? cols[i - 1][0].date.getMonth() : -1
    return month !== prev ? MONTHS_ABBR[month] : ''
  })

  return (
    <Card style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="chart-title" style={{ marginBottom: 2 }}>Seguimiento de actividad</div>
        <div className="streak-badge">
          <Ic n="flame" s={12} style={{ color: '#ea580c' }}/>
          {streak} {streak === 1 ? 'día' : 'días'} de racha
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: '#71717a', marginBottom: 16 }}>
        Sesiones y cargas registradas por día · últimos 6 meses
      </div>

      <div className="heat-scroll">
        <div className="heat-months">
          {monthLabels.map((lbl, i) => (
            <div key={i} className="heat-month">{lbl}</div>
          ))}
        </div>
        <div className="heat-body">
          <div className="heat-dow">
            {DOW_ABBR.map((d, i) => (
              <div key={i} className="heat-dow-cell">{d}</div>
            ))}
          </div>
          <div className="heat-cols">
            {cols.map((col, wi) => (
              <div key={wi} className="heat-col">
                {col.map((cell, di) => (
                  <div
                    key={di}
                    className="heat-cell"
                    style={{ background: cell.future ? 'transparent' : HEAT[heatLevel(cell.count)] }}
                    title={cell.future
                      ? ''
                      : `${cell.count === 0 ? 'Sin' : cell.count} actividad${cell.count === 1 ? '' : 'es'} · ${cell.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="heat-footer">
        <span className="heat-total">
          <strong>{total.toLocaleString('es-CO')}</strong> actividades en los últimos 6 meses
        </span>
        <div className="heat-legend">
          Menos
          {HEAT.map((c, i) => (
            <span key={i} className="heat-cell" style={{ background: c }}/>
          ))}
          Más
        </div>
      </div>
    </Card>
  )
}

// ─── Acciones rápidas ───────────────────────────────────────────────────────────

const QUICK_ACTIONS: [IcName, string, string, string][] = [
  ['upload',    'Cargar programa',    'Digitaliza un PDF de diseño curricular', 'admin-dig'],
  ['layers',    'Ver programas',      'Catálogo regional de formación',          'admin-programas'],
  ['users',     'Gestionar usuarios', 'Instructores y coordinadores',            'admin-usuarios'],
  ['briefcase', 'Gestionar fichas',   'Fichas activas por centro',               'admin-fichas'],
]

function QuickActions({ onNav }: { onNav?: (id: string) => void }) {
  return (
    <Card style={{ overflow: 'hidden' }}>
      <div className="qa-card-header">Acciones rápidas</div>
      {QUICK_ACTIONS.map(([ic, label, hint, dest], i) => (
        <button
          key={dest}
          onClick={() => onNav?.(dest)}
          className="qa-row"
          style={{ borderBottom: i < QUICK_ACTIONS.length - 1 ? '1px solid #f1f1f3' : 'none' }}
        >
          <div className="qa-icon"><Ic n={ic} s={16}/></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="qa-label">{label}</div>
            <div className="qa-hint">{hint}</div>
          </div>
          <Ic n="chevronRight" s={14} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
        </button>
      ))}
    </Card>
  )
}

// ─── KPI Section (siempre visible, polling 60s) ───────────────────────────────

function KpiSection() {
  "use no memo"
  const [data,    setData]    = useState<ResumenKPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [showActivity, setShowActivity] = useState(false)
  const [actividad, setActividad] = useState<ActividadDia[]>([])

  useEffect(() => {
    let live = true
    function doFetch() {
      api.get<ResumenKPI>('/dashboard/super-admin/resumen')
        .then(r => { if (live) { setData(r.data); setLoading(false) } })
        .catch(() => { if (live) setLoading(false) })
    }
    doFetch()
    api.get<ActividadDia[]>('/dashboard/super-admin/actividad')
      .then(r => { if (live) setActividad(r.data) })
      .catch(() => {})
    const id = setInterval(doFetch, 60_000)
    return () => { live = false; clearInterval(id) }
  }, [])

  return (
    <div className="kpi-grid">
      {loading || !data
        ? [0, 1, 2].map(i => (
            <Card key={i} style={{ padding: 20 }}>
              <Sk w="55%" h={9} delay={i * 40}/>
              <div style={{ marginTop: 14 }}><Sk w="42%" h={26} delay={i * 40 + 20}/></div>
              <div style={{ marginTop: 8  }}><Sk w="60%" h={10} delay={i * 40 + 35}/></div>
            </Card>
          ))
        : <KpiCards data={data}/>}
      <TodayCard open={showActivity} onToggle={() => setShowActivity(v => !v)} actividad={actividad}/>
    </div>
  )
}

// ─── KPI cards (3 indicadores regionales) ──────────────────────────────────────

function KpiCards({ data }: { data: ResumenKPI }) {
  const pendientes = data.programas_total - data.programas_digitalizados
  const progPct    = safePct(data.programas_digitalizados, data.programas_total)

  const activePct = data.instructores_total_asignados > 0
    ? Math.round((data.instructores_activos_semana / data.instructores_total_asignados) * 100)
    : 0

  return (
    <>
      {/* Programas digitalizados */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Programas digitalizados</div>
          <Ic n="layers" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {data.programas_digitalizados}
          <span className="kpi2-value-sub"> / {data.programas_total}</span>
        </div>
        <Prog value={progPct} style={{ marginTop: 10 }}/>
        <div className="kpi2-sub">
          <strong>{progPct}%</strong> digitalizados · {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
        </div>
      </Card>

      {/* Fichas cierran en 60 días */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Fichas cierran en 60 días</div>
          <Ic n="clock" s={16} style={{ color: '#a1a1aa' }}/>
        </div>
        <div className="kpi2-value">
          {data.fichas_cierre_60_dias}
          <span className="kpi2-value-sub"> fichas</span>
        </div>
        <div className="kpi2-sub">
          {data.fichas_cierre_60_en_riesgo > 0
            ? `${data.fichas_cierre_60_en_riesgo} en riesgo de no completarse`
            : data.fichas_cierre_60_dias === 0
              ? 'Sin fichas próximas a cerrar'
              : 'Sin fichas en riesgo identificadas'}
        </div>
      </Card>

      {/* Instructores activos */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Instructores activos</div>
          <Ic n="users" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {data.instructores_activos_semana}
          <span className="kpi2-value-sub"> / {data.instructores_total_asignados}</span>
        </div>
        <Prog value={activePct} style={{ marginTop: 10 }}/>
        <div className="kpi2-sub">
          {data.instructores_inactivos_7_dias > 0
            ? `${data.instructores_inactivos_7_dias} sin sesiones en 7 días`
            : 'Todos activos esta semana'}
        </div>
      </Card>
    </>
  )
}

// ─── Tab nav ──────────────────────────────────────────────────────────────────

type TabId = 'digitalizacion' | 'operativo' | 'analitica'

const TABS: { id: TabId; label: string; icon: IcName }[] = [
  { id: 'digitalizacion', label: 'Digitalización', icon: 'layers'    },
  { id: 'operativo',      label: 'Operativo',       icon: 'briefcase' },
  { id: 'analitica',      label: 'Analítica',        icon: 'trend'     },
]

function TabBar({ active, onSwitch }: { active: TabId; onSwitch: (t: TabId) => void }) {
  return (
    <div className="tab-bar">
      {TABS.map(t => {
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            onClick={() => onSwitch(t.id)}
            className={`tab-btn${isActive ? ' tab-btn--active' : ' tab-btn--inactive'}`}
          >
            <Ic n={t.icon} s={14} style={{ color: isActive ? '#0a0a0b' : '#a1a1aa' }}/>
            {t.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Tab Digitalización ───────────────────────────────────────────────────────

type CentrosState =
  | { status: 'loading' }
  | { status: 'ok'; data: CentroItem[] }
  | { status: 'error' }

function CentrosList({ onSelect }: { onSelect: (id: number, nombre: string) => void }) {
  "use no memo"
  const [state, setState] = useState<CentrosState>({ status: 'loading' })

  useEffect(() => {
    api.get<CentroItem[]>('/dashboard/super-admin/centros')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [])

  if (state.status === 'loading') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        {[0, 1, 2, 3].map(i => (
          <Card key={i} style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <Sk w={48} h={16} r={4} delay={i * 50}/>
              <Sk w="55%" h={14} delay={i * 50 + 10}/>
              <Sk w={52} h={18} r={4} delay={i * 50 + 20} style={{ marginLeft: 'auto' }}/>
            </div>
            <Sk w="70%" h={10} delay={i * 50 + 25}/>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <Sk w="100%" h={4} r={2} delay={i * 50 + 35}/>
              <Sk w="100%" h={4} r={2} delay={i * 50 + 45}/>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <Card style={{ padding: 24 }}>
        <div className="error-card">
          <div className="error-card__icon">
            <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
          </div>
          <div>
            <div className="error-card__title">No se pudo cargar la lista de centros</div>
            <div className="error-card__sub">Verifica la conexión con el servidor.</div>
          </div>
        </div>
      </Card>
    )
  }

  if (state.data.length === 0) {
    return <EmptyState icon="briefcase" title="Sin centros asignados" sub="No hay centros de formación registrados en el sistema."/>
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
      {state.data.map(c => {
        const digPct = safePct(c.programas_digitalizados, c.programas_total)
        return (
          <Card
            key={c.id}
            onClick={() => onSelect(c.id, c.nombre)}
            style={{
              padding: '14px 16px', cursor: 'pointer',
              transition: 'box-shadow 120ms',
            }}
          >
            {/* Fila: código + nombre + estado + chevron */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{
                fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700,
                background: '#f1f1f3', color: '#52525b', padding: '2px 6px', borderRadius: 4,
                letterSpacing: '0.04em', flexShrink: 0,
              }}>
                {c.codigo}
              </span>
              <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#0a0a0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                {c.nombre}
              </span>
              <Bdg tone={estadoTone(c.estado)}>{estadoLabel(c.estado)}</Bdg>
              <Ic n="chevronRight" s={12} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
            </div>

            {/* Stats en línea */}
            <div style={{ fontSize: 11, color: '#71717a', marginBottom: 10 }}>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3f3f46', fontWeight: 600 }}>{c.fichas_activas}</span>
              {' fichas · '}
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3f3f46', fontWeight: 600 }}>
                {c.programas_digitalizados}/{c.programas_total}
              </span>
              {' prog. · '}
              <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3f3f46', fontWeight: 600 }}>{c.coordinaciones_academicas}</span>
              {' coord.'}
            </div>

            {/* Barras compactas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#a1a1aa' }}>Digitalización</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: digBarColor(digPct), fontFamily: '"JetBrains Mono", monospace' }}>{digPct}%</span>
                </div>
                <div style={{ height: 4, background: '#f1f1f3', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${digPct}%`, background: digBarColor(digPct), borderRadius: 2 }}/>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: '#a1a1aa' }}>Cobertura</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4f46e5', fontFamily: '"JetBrains Mono", monospace' }}>{c.cobertura_pct}%</span>
                </div>
                <div style={{ height: 4, background: '#f1f1f3', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${c.cobertura_pct}%`, background: '#4f46e5', borderRadius: 2 }}/>
                </div>
              </div>
            </div>
          </Card>
        )
      })}
    </div>
  )
}

type DetState =
  | { status: 'loading' }
  | { status: 'ok'; data: CentroDetData }
  | { status: 'error' }

type ProgDigFilt = 'todos' | 'digitalizados' | 'pendientes'
type ProgSort    = 'fichas' | 'nombre' | 'codigo' | 'digitalizados_primero' | 'pendientes_primero' | 'competencias' | 'criterios'

const PROG_SORT_LABEL: Record<ProgSort, string> = {
  fichas:                'Más fichas activas',
  nombre:                'Nombre (A–Z)',
  codigo:                'Código',
  digitalizados_primero: 'Digitalizados primero',
  pendientes_primero:    'Pendientes primero',
  competencias:          'Más competencias',
  criterios:             'Más criterios',
}

function CentroDetalleView({ centroId, onBack, onNav }: { centroId: number; onBack: () => void; onNav?: (id: string) => void }) {
  "use no memo"
  const [state,      setState]      = useState<DetState>({ status: 'loading' })
  const [progSearch, setProgSearch] = useState('')
  const [progFilt,   setProgFilt]   = useState<ProgDigFilt>('todos')
  const [progSort,   setProgSort]   = useState<ProgSort>('fichas')
  const [progPage,   setProgPage]   = useState(0)

  const PROG_PAGE_SIZE = 10

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<CentroDetData>(`/dashboard/super-admin/centros/${centroId}`)
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [centroId])

  // Volver a la primera página cuando cambian filtros/búsqueda/orden
  useEffect(() => { setProgPage(0) }, [progSearch, progFilt, progSort])

  const backBtn = (
    <button onClick={onBack} className="back-btn">
      <Ic n="arrowLeft" s={14}/>
      Volver a todos los centros
    </button>
  )

  if (state.status === 'loading') {
    return (
      <div>
        <div style={{ height: 28, marginBottom: 20 }}><Sk w={180} h={13}/></div>
        <div className="det-kpi-grid">
          {[0, 1, 2, 3].map(i => (
            <Card key={i} style={{ padding: 16 }}>
              <Sk w="65%" h={9} delay={i * 40}/>
              <div style={{ marginTop: 10 }}><Sk w="40%" h={22} delay={i * 40 + 20}/></div>
            </Card>
          ))}
        </div>
        <Card style={{ padding: 20 }}>
          <Sk w="45%" h={12} delay={0}/>
          <div style={{ marginTop: 16 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 0', borderBottom: i < 3 ? '1px solid #f1f1f3' : 'none' }}>
                <Sk w={28} h={28} r={4} delay={i * 50}/>
                <div style={{ flex: 1 }}><Sk w={`${50 + i * 8}%`} h={13} delay={i * 50 + 15}/></div>
                <Sk w={64} h={10} delay={i * 50 + 25}/>
              </div>
            ))}
          </div>
        </Card>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div>
        {backBtn}
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
            <div style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudo cargar el detalle del centro.</div>
          </div>
        </Card>
      </div>
    )
  }

  const { kpi, programas, coordinaciones } = state.data

  // ── Filtros + orden de la tabla de programas ──────────────────────────────
  const digCount = programas.filter(p => p.digitalizado).length
  const progChips: { key: ProgDigFilt; label: string; count: number }[] = [
    { key: 'todos',          label: 'Todos',         count: programas.length },
    { key: 'digitalizados',  label: 'Digitalizados', count: digCount },
    { key: 'pendientes',     label: 'Pendientes',    count: programas.length - digCount },
  ]
  const q = progSearch.trim().toLowerCase()
  const programasView = programas
    .filter(p => {
      if (progFilt === 'digitalizados' && !p.digitalizado) return false
      if (progFilt === 'pendientes'    &&  p.digitalizado) return false
      if (q && !p.nombre.toLowerCase().includes(q) && !p.codigo.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      switch (progSort) {
        case 'nombre':                return a.nombre.localeCompare(b.nombre, 'es')
        case 'codigo':                return a.codigo.localeCompare(b.codigo, 'es')
        case 'digitalizados_primero': return (Number(b.digitalizado) - Number(a.digitalizado)) || (b.fichas_activas - a.fichas_activas)
        case 'pendientes_primero':    return (Number(a.digitalizado) - Number(b.digitalizado)) || (b.fichas_activas - a.fichas_activas)
        case 'competencias':          return b.total_competencias - a.total_competencias
        case 'criterios':             return b.total_criterios - a.total_criterios
        default:                      return b.fichas_activas - a.fichas_activas
      }
    })

  const progPageCount = Math.ceil(programasView.length / PROG_PAGE_SIZE)
  const progCurPage   = Math.min(progPage, Math.max(0, progPageCount - 1))
  const programasPage = programasView.slice(progCurPage * PROG_PAGE_SIZE, (progCurPage + 1) * PROG_PAGE_SIZE)

  const centroKpis: { label: string; value: string | number; icon: IcName; color: string; sub?: string }[] = [
    {
      label: 'Programas pendientes',
      value: kpi.programas_pendientes,
      icon: 'layers',
      color: kpi.programas_pendientes > 0 ? '#d97706' : '#16a34a',
    },
    {
      label: 'Más urgente',
      value: kpi.mas_urgente ? kpi.mas_urgente.fichas_activas : '—',
      icon: 'flame',
      color: '#dc2626',
      sub: kpi.mas_urgente?.nombre,
    },
    {
      label: 'Fichas activas',
      value: kpi.fichas_activas,
      icon: 'briefcase',
      color: '#4f46e5',
    },
    {
      label: 'Cobertura promedio',
      value: `${kpi.cobertura_promedio_pct}%`,
      icon: 'target',
      color: digBarColor(kpi.cobertura_promedio_pct),
    },
  ]

  return (
    <div>
      {backBtn}

      <div className="det-kpi-grid">
        {centroKpis.map(k => (
          <Card key={k.label} style={{ padding: 16 }}>
            <div className="det-kpi__header">
              <div className="det-kpi__label">{k.label}</div>
              <Ic n={k.icon} s={13} style={{ color: k.color, flexShrink: 0 }}/>
            </div>
            <div className="det-kpi__value">{k.value}</div>
            {k.sub && <div className="det-kpi__sub">{k.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="pend-section">
        <div className="section-title">Programas del centro</div>
        {programas.length === 0 ? (
          <Card>
            <EmptyState
              icon="layers"
              title="Sin programas asociados"
              sub="Este centro de formación no tiene programas vigentes registrados."
            />
          </Card>
        ) : (
          <>
            <div className="prog-toolbar">
              <div className="prog-chips">
                {progChips.map(c => {
                  const active = progFilt === c.key
                  return (
                    <button
                      key={c.key}
                      onClick={() => setProgFilt(c.key)}
                      className={`prog-chip${active ? ' prog-chip--active' : ''}`}
                    >
                      {c.label}
                      <span className="prog-chip__count">{c.count}</span>
                    </button>
                  )
                })}
              </div>
              <div className="prog-toolbar__right">
                <div className="prog-search">
                  <Ic n="search" s={14} className="prog-search__icon" style={{ color: '#a1a1aa' }}/>
                  <input
                    value={progSearch}
                    onChange={e => setProgSearch(e.target.value)}
                    placeholder="Buscar por código o nombre…"
                    className="prog-search__input"
                  />
                  {progSearch && (
                    <button onClick={() => setProgSearch('')} className="prog-search__clear" aria-label="Limpiar búsqueda">
                      <Ic n="x" s={12}/>
                    </button>
                  )}
                </div>
                <select
                  value={progSort}
                  onChange={e => setProgSort(e.target.value as ProgSort)}
                  className="operativo-select"
                >
                  {(Object.keys(PROG_SORT_LABEL) as ProgSort[]).map(k => (
                    <option key={k} value={k}>Ordenar: {PROG_SORT_LABEL[k]}</option>
                  ))}
                </select>
              </div>
            </div>

            {programasView.length === 0 ? (
              <Card>
                <EmptyState
                  icon="search"
                  title="Sin resultados"
                  sub={`Ningún programa coincide con los filtros${q ? ` para "${progSearch.trim()}"` : ''}.`}
                />
              </Card>
            ) : (
            <Card style={{ overflow: 'hidden' }}>
            <div className="prog-centro-scroll">
            <table className="prog-centro-table">
              <thead>
                <tr className="data-table__head-row">
                  <th className="data-table__th">Programa</th>
                  <th className="data-table__th">Código</th>
                  <th className="data-table__th">Versión</th>
                  <th className="data-table__th data-table__th--num">Fichas</th>
                  <th className="data-table__th data-table__th--num">Comp.</th>
                  <th className="data-table__th data-table__th--num">RA</th>
                  <th className="data-table__th data-table__th--num">Conoc.</th>
                  <th className="data-table__th data-table__th--num">Crit.</th>
                  <th className="data-table__th">Acción</th>
                </tr>
              </thead>
              <tbody>
                {programasPage.map(p => {
                  const ns = nivelStyle(p.nivel_formacion)
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
                      <td className="data-table__td">
                        <div className="prog-centro__name-cell">
                          <div className="prog-centro__badge">{programaShort(p.nombre)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="prog-centro__name">{p.nombre}</div>
                            <div className="prog-centro__meta">
                              <span className="nivel-badge" style={{ background: ns.bg, color: ns.fg }}>
                                {p.nivel_formacion}
                              </span>
                              <span>{p.horas.toLocaleString('es-CO')} h</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="data-table__td">
                        <span className="code-span">{p.codigo}</span>
                      </td>
                      <td className="data-table__td">
                        <span className="code-span">{fmtVersion(p.version)}</span>
                      </td>
                      <td className="data-table__td--num">{p.fichas_activas.toLocaleString('es-CO')}</td>
                      <td className="data-table__td--num">{p.digitalizado ? p.total_competencias.toLocaleString('es-CO') : '—'}</td>
                      <td className="data-table__td--num">{p.digitalizado ? p.total_ra.toLocaleString('es-CO') : '—'}</td>
                      <td className="data-table__td--num">{p.digitalizado ? p.total_conocimientos.toLocaleString('es-CO') : '—'}</td>
                      <td className="data-table__td--num">{p.digitalizado ? p.total_criterios.toLocaleString('es-CO') : '—'}</td>
                      <td className="data-table__td">
                        {p.digitalizado ? (
                          <Btn variant="secondary" size="sm" icon="check" disabled>Digitalizado</Btn>
                        ) : (
                          <Btn variant="accent" size="sm" icon="upload" onClick={() => onNav?.('admin-dig')}>Digitalizar</Btn>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </Card>
            )}
            <Pager
              page={progCurPage}
              pageCount={progPageCount}
              total={programasView.length}
              pageSize={PROG_PAGE_SIZE}
              onPage={setProgPage}
              noun="programas"
            />
          </>
        )}
      </div>

      <div>
        <div className="section-title">Coordinaciones académicas</div>
        {coordinaciones.length === 0 ? (
          <EmptyState icon="users" title="Sin coordinaciones" sub="No hay coordinaciones académicas registradas para este centro."/>
        ) : (
          <div className="coord-list">
            {coordinaciones.map(coord => {
              const digPct = safePct(coord.programas_digitalizados, coord.programas_total)
              return (
                <Card key={coord.id} style={{ padding: '14px 16px' }}>
                  <div className="coord-card__inner">
                    <Ava name={coord.nombre_completo} size={36}/>
                    <div className="coord-card__info">
                      <div className="coord-card__name">{coord.nombre_completo}</div>
                      <div className="coord-card__sub">{coord.coordinacion_nombre}</div>
                    </div>
                    <div className="coord-card__right">
                      <div className="coord-card__stats">
                        <span className="coord-card__stats-text">
                          {coord.fichas_activas} fichas · {coord.programas_digitalizados}/{coord.programas_total} prog.
                        </span>
                        <Bdg tone={estadoTone(coord.estado)}>{estadoLabel(coord.estado)}</Bdg>
                      </div>
                      <div className="coord-card__bar-row">
                        <div className="coord-card__bar-track">
                          <div className="coord-card__bar-fill" style={{ width: `${digPct}%`, background: digBarColor(digPct) }}/>
                        </div>
                        <span className="coord-card__pct">{digPct}%</span>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function TabDigitalizacion({ onDrillDown, onNav }: { onDrillDown: (name: string | null) => void; onNav?: (id: string) => void }) {
  "use no memo"
  const [centroId, setCentroId] = useState<number | null>(null)

  function select(id: number, nombre: string) {
    setCentroId(id)
    onDrillDown(nombre)
  }

  function back() {
    setCentroId(null)
    onDrillDown(null)
  }

  return centroId === null
    ? <CentrosList onSelect={select}/>
    : <CentroDetalleView centroId={centroId} onBack={back} onNav={onNav}/>
}

// ─── Tab Operativo ────────────────────────────────────────────────────────────

type FichasState =
  | { status: 'loading' }
  | { status: 'ok'; data: FichaRiesgoItem[] }
  | { status: 'error' }

function TabOperativo() {
  "use no memo"
  const [filtCentro, setFiltCentro] = useState('')
  const [filtEstado, setFiltEstado] = useState('')
  const [state,      setState]      = useState<FichasState>({ status: 'loading' })

  useEffect(() => {
    setState({ status: 'loading' })
    const params = new URLSearchParams()
    if (filtCentro) params.set('centro_id', filtCentro)
    if (filtEstado) params.set('estado', filtEstado)
    const qs = params.toString()
    api.get<FichaRiesgoItem[]>(`/dashboard/super-admin/fichas-riesgo${qs ? '?' + qs : ''}`)
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [filtCentro, filtEstado])

  const alerts = state.status === 'ok'
    ? state.data.filter(f => f.dias_restantes < 60).map(f => ({
        tipo:  f.estado_badge,
        texto: `Ficha ${f.numero_ficha} — ${f.programa_nombre} cierra en ${f.dias_restantes} días`,
        sub:   `${f.centro_nombre} · ${f.coordinacion_nombre}`,
      }))
    : []

  return (
    <div>
      <div className="operativo-header">
        <div className="operativo-title">Fichas en riesgo</div>
        <div className="operativo-filters">
          <select value={filtCentro} onChange={e => setFiltCentro(e.target.value)} className="operativo-select">
            <option value="">Todos los centros</option>
            <option value="1">CEDAGRO · 9103</option>
            <option value="2">CCS · 9302</option>
            <option value="3">CIA · 9208</option>
            <option value="4">CNCA · 9207</option>
          </select>
          <select value={filtEstado} onChange={e => setFiltEstado(e.target.value)} className="operativo-select">
            <option value="">Todos los estados</option>
            <option value="CRITICO">Crítico</option>
            <option value="REVISAR">Revisar</option>
          </select>
        </div>
      </div>

      {state.status === 'loading' && (
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>
                {['Ficha', 'Programa', 'Centro', 'Coordinación', 'Avance', 'Días', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[0, 1, 2, 3, 4].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f1f3' }}>
                  {[52, 160, 110, 100, 80, 48, 56].map((w, j) => (
                    <td key={j} style={{ padding: '12px 14px' }}><Sk w={w} h={12} delay={i * 50 + j * 10}/></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {state.status === 'error' && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
            <div style={{ fontSize: 13.5, color: '#b91c1c' }}>Error al cargar las fichas en riesgo.</div>
          </div>
        </Card>
      )}

      {state.status === 'ok' && state.data.length === 0 && (
        <Card>
          <EmptyState
            icon="check"
            title="Sin fichas en riesgo esta semana"
            sub="No hay fichas con riesgo de no completarse según los filtros seleccionados."
          />
        </Card>
      )}

      {state.status === 'ok' && state.data.length > 0 && (
        <Card style={{ overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr className="data-table__head-row">
                {['Ficha', 'Programa', 'Centro', 'Coordinación', 'Avance', 'Días', 'Estado'].map(h => (
                  <th key={h} className="data-table__th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {state.data.map(f => (
                <tr key={f.id} className="nx-row" style={{ borderBottom: '1px solid #f1f1f3' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <span className="code-span">{f.numero_ficha}</span>
                  </td>
                  <td style={{ padding: '12px 14px', maxWidth: 180 }}>
                    <div className="programa-nombre">{f.programa_nombre}</div>
                    <div className="programa-codigo">{f.programa_codigo}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#52525b' }}>{f.centro_nombre}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontSize: 12, color: '#52525b' }}>{f.coordinacion_nombre}</div>
                    <div style={{ fontSize: 10.5, color: '#a1a1aa', marginTop: 1 }}>{f.coordinador_nombre}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <div className="ficha-avance">
                      <div className="ficha-avance__track">
                        <div className="ficha-avance__fill" style={{ width: `${f.avance}%`, background: digBarColor(f.avance) }}/>
                      </div>
                      <span className="ficha-avance__pct">{f.avance}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 700, color: diasColor(f.dias_restantes) }}>
                      {f.dias_restantes}d
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <Bdg tone={f.estado_badge === 'CRITICO' ? 'err' : 'warn'}>{f.estado_badge}</Bdg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="alertas-section">
        <div className="section-title">Alertas</div>
        {state.status === 'loading' && <PendingMsg text="Cargando alertas..."/>}
        {state.status === 'ok' && alerts.length === 0 && (
          <PendingMsg text="Sin alertas activas según los datos disponibles."/>
        )}
        {state.status === 'ok' && alerts.length > 0 && (
          <Card style={{ overflow: 'hidden' }}>
            {alerts.map((a, i) => (
              <div
                key={i}
                className="alerta-row"
                style={{ borderBottom: i < alerts.length - 1 ? '1px solid #f1f1f3' : 'none' }}
              >
                <div className="alerta-dot" style={{ background: a.tipo === 'CRITICO' ? '#dc2626' : '#d97706' }}/>
                <div>
                  <div className="alerta-texto">{a.texto}</div>
                  <div className="alerta-sub">{a.sub}</div>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── Tab Analítica ────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data, 1)
  const W = 52, H = 22, bW = 9, gap = 3
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {data.map((v, i) => {
        const h = Math.max(2, (v / max) * H)
        return (
          <rect
            key={i}
            x={i * (bW + gap)} y={H - h} width={bW} height={h} rx={2}
            fill={i === data.length - 1 ? '#4f46e5' : '#e4e4e7'}
          />
        )
      })}
    </svg>
  )
}

function StackedBarChart({ data }: { data: CoberturaCentroItem[] }) {
  if (!data || data.length === 0) {
    return <PendingMsg text="Sin datos de cobertura por centro."/>
  }

  return (
    <div>
      <div className="stacked-rows">
        {data.map(d => {
          const hasCobertura = d.al_dia + d.revisar + d.riesgo > 0
          const total = hasCobertura
            ? d.al_dia + d.revisar + d.riesgo + d.sin_dig
            : d.digitalizados + d.sin_dig

          return (
            <div key={d.centro} className="stacked-row">
              <div className="stacked-label">{d.centro}</div>
              <div className="stacked-track">
                {hasCobertura ? (
                  <>
                    {d.al_dia  > 0 && <div title={`Al día: ${d.al_dia}`}  style={{ width: `${(d.al_dia  / total) * 100}%`, background: '#16a34a' }}/>}
                    {d.revisar > 0 && <div title={`Revisar: ${d.revisar}`} style={{ width: `${(d.revisar / total) * 100}%`, background: '#d97706' }}/>}
                    {d.riesgo  > 0 && <div title={`En riesgo: ${d.riesgo}`} style={{ width: `${(d.riesgo  / total) * 100}%`, background: '#dc2626' }}/>}
                    {d.sin_dig > 0 && <div title={`Sin digitalizar: ${d.sin_dig}`} style={{ width: `${(d.sin_dig / total) * 100}%`, background: '#d4d4d8' }}/>}
                  </>
                ) : (
                  <>
                    {d.digitalizados > 0 && <div title={`Digitalizados: ${d.digitalizados}`} style={{ width: `${(d.digitalizados / total) * 100}%`, background: '#4f46e5' }}/>}
                    {d.sin_dig > 0       && <div title={`Sin digitalizar: ${d.sin_dig}`}      style={{ width: `${(d.sin_dig / total) * 100}%`,       background: '#d4d4d8' }}/>}
                  </>
                )}
              </div>
              <div className="stacked-pct">
                {total > 0 ? `${Math.round((d.digitalizados / total) * 100)}%` : '0%'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="legend">
        {[
          { color: '#16a34a', label: 'Al día'           },
          { color: '#d97706', label: 'Revisar'          },
          { color: '#dc2626', label: 'En riesgo'        },
          { color: '#4f46e5', label: 'Dig. sin cobertura' },
          { color: '#d4d4d8', label: 'Sin digitalizar'  },
        ].map(s => (
          <div key={s.label} className="legend-item">
            <div className="legend-dot" style={{ background: s.color }}/>
            {s.label}
          </div>
        ))}
      </div>
    </div>
  )
}

function AreaLineChart({ data, semanas }: { data: number[]; semanas: string[] }) {
  if (!data || data.length < 2) {
    return (
      <PendingMsg text="La evolución semanal estará disponible cuando se registren sesiones con contenido."/>
    )
  }

  const W = 560, H = 150
  const pT = 12, pB = 28, pL = 34, pR = 8
  const cW = W - pL - pR, cH = H - pT - pB
  const n   = data.length
  const pts = data.map((v, i) => ({
    x: pL + (i / (n - 1)) * cW,
    y: pT + (1 - v / 100) * cH,
  }))
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[n-1].x.toFixed(1)},${(pT + cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(pT + cH).toFixed(1)}Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#4f46e5" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="#4f46e5" stopOpacity="0"/>
        </linearGradient>
      </defs>

      {[0, 25, 50, 75, 100].map(v => {
        const y = pT + (1 - v / 100) * cH
        return (
          <g key={v}>
            <line x1={pL} y1={y} x2={pL + cW} y2={y} stroke="#f1f1f3" strokeWidth="1"/>
            <text x={pL - 4} y={y + 3.5} textAnchor="end" fontSize="9" fill="#a1a1aa">{v}</text>
          </g>
        )
      })}

      <path d={areaPath} fill="url(#area-grad)"/>
      <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill="#4f46e5" stroke="#fff" strokeWidth="1.5"/>
      ))}

      {semanas.map((s, i) => (
        <text key={i} x={pts[i]?.x ?? 0} y={H - 5} textAnchor="middle" fontSize="9" fill="#a1a1aa">{s}</text>
      ))}
    </svg>
  )
}

type AnaliticaState =
  | { status: 'loading' }
  | { status: 'ok'; data: AnaliticaData }
  | { status: 'error' }

function TabAnalitica() {
  "use no memo"
  const [state, setState] = useState<AnaliticaState>({ status: 'loading' })

  useEffect(() => {
    api.get<AnaliticaData>('/dashboard/super-admin/analitica')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [])

  if (state.status === 'loading') {
    return (
      <div>
        <div className="analitica-charts">
          {[0, 1].map(i => (
            <Card key={i} style={{ padding: 20 }}>
              <Sk w="50%" h={12} delay={i * 40}/>
              <div style={{ marginTop: 16 }}><Sk w="100%" h={140} r={8} delay={i * 40 + 20}/></div>
            </Card>
          ))}
        </div>
        <Card style={{ padding: 20, marginBottom: 20 }}>
          <Sk w="45%" h={12}/>
          <div style={{ marginTop: 12 }}><Sk w="100%" h={120} r={8} delay={30}/></div>
        </Card>
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px' }}><Sk w="40%" h={12}/></div>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 16px', borderTop: '1px solid #f1f1f3' }}>
              <Sk w={24} h={12} delay={i * 40}/>
              <Sk w={160} h={12} delay={i * 40 + 15}/>
              <Sk w={60} h={12} delay={i * 40 + 25}/>
            </div>
          ))}
        </Card>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
          <div style={{ fontSize: 13.5, color: '#b91c1c' }}>Error al cargar los datos de analítica.</div>
        </div>
      </Card>
    )
  }

  const d = state.data

  return (
    <div>
      <div className="analitica-charts">
        <Card style={{ padding: 20 }}>
          <div className="chart-title">Cobertura curricular por centro</div>
          <StackedBarChart data={d.cobertura_por_centro}/>
        </Card>
        <Card style={{ padding: 20 }}>
          <div className="chart-title">Evolución semanal regional</div>
          <AreaLineChart data={d.evolucion_semanal} semanas={d.semanas}/>
        </Card>
      </div>

      <Card style={{ padding: 20, marginBottom: 20 }}>
        <div className="chart-title">Mapa de calor — avance por coordinación × semana</div>
        <PendingMsg text="El mapa de calor estará disponible cuando se implemente mv_avance_fichas (seguimiento de avance por sesión registrada)."/>
      </Card>

      <Card style={{ overflow: 'hidden' }}>
        <div className="comp-rez-header">
          <div className="comp-rez-title">Competencias con mayor rezago</div>
        </div>
        {!d.competencias_rezagadas || d.competencias_rezagadas.length === 0 ? (
          <EmptyState
            icon="checkCircle"
            title="Sin competencias rezagadas"
            sub="Los datos de rezago estarán disponibles cuando se implemente el seguimiento de avance por sesión."
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr className="data-table__head-row">
                {['#', 'Competencia', 'Centro', 'Fichas', 'Avance prom.', 'Tendencia', 'Estado'].map(h => (
                  <th key={h} className="data-table__th">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.competencias_rezagadas.slice(0, 10).map((c, i) => (
                <tr key={i} className="nx-row" style={{ borderBottom: '1px solid #f1f1f3' }}>
                  <td className="data-table__td--mono">{String(i + 1).padStart(2, '0')}</td>
                  <td className="data-table__td--name">{c.nombre}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: '#52525b' }}>{c.centro}</td>
                  <td style={{ padding: '12px 16px', fontFamily: '"JetBrains Mono", monospace', color: '#27272a' }}>{c.fichas}</td>
                  <td className="data-table__td">
                    <div className="comp-rez-avance">
                      <div className="comp-rez-track">
                        <div className="comp-rez-fill" style={{ width: `${c.avance}%`, background: c.avance < 35 ? '#dc2626' : c.avance < 60 ? '#d97706' : '#16a34a' }}/>
                      </div>
                      <span className="comp-rez-pct">{c.avance}%</span>
                    </div>
                  </td>
                  <td className="data-table__td">
                    <Sparkline data={c.tendencia}/>
                  </td>
                  <td className="data-table__td">
                    <Bdg tone={c.estado === 'CRITICO' ? 'err' : c.estado === 'REVISAR' ? 'warn' : 'ok'}>
                      {c.estado}
                    </Bdg>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}

// ─── DashboardHome ─────────────────────────────────────────────────────────────

export function DashboardHome({ onDrillDown, onNav }: { onDrillDown: (name: string | null) => void; onNav?: (id: string) => void }) {
  "use no memo"
  const [activeTab, setActiveTab] = useState<TabId>('digitalizacion')

  function switchTab(tab: TabId) {
    if (tab !== activeTab) {
      setActiveTab(tab)
      onDrillDown(null)
    }
  }

  return (
    <div>
      <div className="dash-header">
        <div>
          <div className="dash-header__eyebrow">Dirección General</div>
          <h2 className="dash-header__title">Operación de la plataforma</h2>
        </div>
        <Btn variant="accent" icon="upload" onClick={() => onNav?.('admin-dig')}>Cargar programa</Btn>
      </div>
      <KpiSection/>
      <div className="dash-lower">
        <div className="dash-lower__main">
          <TabBar active={activeTab} onSwitch={switchTab}/>
          {activeTab === 'digitalizacion' && <TabDigitalizacion onDrillDown={onDrillDown} onNav={onNav}/>}
          {activeTab === 'operativo'      && <TabOperativo/>}
          {activeTab === 'analitica'      && <TabAnalitica/>}
        </div>
        <aside className="dash-lower__side">
          <QuickActions onNav={onNav}/>
        </aside>
      </div>
    </div>
  )
}
