import { useState, useEffect, useRef } from 'react'
import { Ic, Card, Metric, Prog, Tag, Bdg } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { fd, jornadaLabel, Pill, LoadingBlock, CenterState } from '../shared/parts'
import type {
  ResumenInstructor, ActividadDia, AsignacionItem, SesionListItem,
} from './types'
import './instructor.css'

// ─── Heatmap de actividad (sesiones por día) ─────────────────────────────────────

const HEAT = ['#ebedf0', '#c7d2fe', '#a5b4fc', '#818cf8', '#4f46e5']
const MONTHS_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const DOW_ABBR = ['Lun', '', 'Mié', '', 'Vie', '', '']

function heatLevel(count: number): number {
  if (count <= 0) return 0
  if (count <= 1) return 1
  if (count <= 2) return 2
  if (count <= 3) return 3
  return 4
}

function isoKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function ActivityCalendar({ actividad }: { actividad: ActividadDia[] }) {
  const counts = new Map(actividad.map(a => [a.fecha.slice(0, 10), a.count]))
  const WEEKS = 26
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7) - (WEEKS - 1) * 7)

  const cols: { date: Date; count: number; future: boolean }[][] = []
  for (let w = 0; w < WEEKS; w++) {
    const col: { date: Date; count: number; future: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start); date.setDate(start.getDate() + w * 7 + d)
      const future = date > today
      col.push({ date, count: future ? -1 : (counts.get(isoKey(date)) ?? 0), future })
    }
    cols.push(col)
  }

  const total = actividad.reduce((a, x) => a + x.count, 0)

  const monthLabels = cols.map((c, i) => {
    const month = c[0].date.getMonth()
    const prev = i > 0 ? cols[i - 1][0].date.getMonth() : -1
    return month !== prev ? MONTHS_ABBR[month] : ''
  })

  return (
    <Card style={{ padding: 20 }}>
      <div className="chart-title" style={{ marginBottom: 2 }}>Mis sesiones registradas</div>
      <div style={{ fontSize: 11.5, color: '#71717a', marginBottom: 16 }}>
        Sesiones por día · últimos 6 meses
      </div>
      <div className="heat-scroll">
        <div className="heat-months">
          {monthLabels.map((lbl, i) => <div key={i} className="heat-month">{lbl}</div>)}
        </div>
        <div className="heat-body">
          <div className="heat-dow">
            {DOW_ABBR.map((d, i) => <div key={i} className="heat-dow-cell">{d}</div>)}
          </div>
          <div className="heat-cols">
            {cols.map((col, wi) => (
              <div key={wi} className="heat-col">
                {col.map((cell, di) => (
                  <div key={di} className="heat-cell"
                    style={{ background: cell.future ? 'transparent' : HEAT[heatLevel(cell.count)] }}
                    title={cell.future ? '' : `${cell.count === 0 ? 'Sin' : cell.count} sesión${cell.count === 1 ? '' : 'es'} · ${cell.date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}`}/>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="heat-footer">
        <span className="heat-total"><strong>{total.toLocaleString('es-CO')}</strong> sesiones en los últimos 6 meses</span>
        <div className="heat-legend">
          Menos{HEAT.map((c, i) => <span key={i} className="heat-cell" style={{ background: c }}/>)}Más
        </div>
      </div>
    </Card>
  )
}

// ─── Tarjeta KPI "Hoy" (azul, abre el calendario de sesiones) ────────────────────

function TodayCard({ actividad }: { actividad: ActividadDia[] }) {
  "use no memo"
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const today = new Date()
  const hoyKey = isoKey(today)
  const hoyCount = actividad.find(a => a.fecha.slice(0, 10) === hoyKey)?.count ?? 0

  return (
    <div className="today-wrap" ref={ref}>
      <Card style={{ padding: 20, background: 'rgba(238,242,255,.7)', border: '1px solid #c7d2fe', display: 'flex', flexDirection: 'column' }}>
        <div className="kpi2-head">
          <div className="kpi2-label" style={{ color: '#312e81' }}>Hoy</div>
          <Ic n="calendar" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16 }}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 28, fontWeight: 600, lineHeight: 1, color: '#312e81' }}>
            {today.getDate()}
          </span>
          <div style={{ lineHeight: 1.25, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#312e81', textTransform: 'capitalize' }}>
              {today.toLocaleDateString('es-CO', { weekday: 'long' })}
            </div>
            <div style={{ fontSize: 11.5, color: '#6366f1' }}>
              {hoyCount} sesi{hoyCount === 1 ? 'ón' : 'ones'} hoy
            </div>
          </div>
        </div>
        <button onClick={() => setOpen(v => !v)} className="today-btn" style={{ marginTop: 'auto' }}>
          <Ic n="trend" s={13}/>{open ? 'Ocultar actividad' : 'Ver actividad'}
        </button>
      </Card>
      {open && <div className="activity-pop"><ActivityCalendar actividad={actividad}/></div>}
    </div>
  )
}

// ─── Home ────────────────────────────────────────────────────────────────────────

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function InstructorHome({ onRegistrar, onOpenSesion }: {
  onRegistrar: (asignacionId: number) => void
  onOpenSesion: (sesionId: number) => void
}) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const [resumen, setResumen] = useState<ResumenInstructor | null>(null)
  const [actividad, setActividad] = useState<ActividadDia[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionItem[]>([])
  const [sesiones, setSesiones] = useState<SesionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [asigPage, setAsigPage] = useState(0)

  useEffect(() => {
    let live = true
    Promise.all([
      api.get<ResumenInstructor>('/dashboard/instructor/resumen'),
      api.get<ActividadDia[]>('/dashboard/instructor/actividad'),
      api.get<AsignacionItem[]>('/dashboard/instructor/asignaciones'),
      api.get<SesionListItem[]>('/dashboard/instructor/sesiones'),
    ]).then(([r, a, asg, ses]) => {
      if (!live) return
      setResumen(r.data); setActividad(a.data)
      setAsignaciones(asg.data); setSesiones(ses.data.slice(0, 6))
      setLoading(false)
    }).catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  if (loading) return <LoadingBlock minHeight={400}/>

  const nombre = user?.nombre_completo?.split(' ')[0] ?? 'Instructor'
  const today = new Date()
  const hoyKey = isoKey(today)
  const hoyCount = actividad.find(a => a.fecha.slice(0, 10) === hoyKey)?.count ?? 0
  const deltaSesiones = resumen ? resumen.sesiones_semana - resumen.sesiones_semana_anterior : 0

  // Carrusel de asignaciones: 3 visibles por página
  const ASIG_PAGE = 3
  const asigPageCount = Math.ceil(asignaciones.length / ASIG_PAGE)
  const asigCur   = Math.min(asigPage, Math.max(0, asigPageCount - 1))
  const asigItems = asignaciones.slice(asigCur * ASIG_PAGE, asigCur * ASIG_PAGE + ASIG_PAGE)
  const asigFrom  = asignaciones.length === 0 ? 0 : asigCur * ASIG_PAGE + 1
  const asigTo    = Math.min(asignaciones.length, asigCur * ASIG_PAGE + ASIG_PAGE)

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#52525b', textTransform: 'capitalize' }}>
          {today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{saludo()}, {nombre}.</div>
        <div style={{ fontSize: 13.5, color: '#52525b', marginTop: 4 }}>
          Tienes <strong style={{ color: '#18181b' }}>{resumen?.competencias_asignadas ?? 0} competencias</strong> asignadas
          {hoyCount > 0 && <> · <strong style={{ color: '#18181b' }}>{hoyCount} sesión{hoyCount === 1 ? '' : 'es'}</strong> registradas hoy</>}.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Metric
          label="Sesiones esta semana"
          value={resumen?.sesiones_semana ?? 0}
          delta={deltaSesiones !== 0 ? `${deltaSesiones > 0 ? '+' : ''}${deltaSesiones}` : undefined}
          deltaTone={deltaSesiones > 0 ? 'up' : deltaSesiones < 0 ? 'down' : 'neutral'}
          sub={`${resumen?.horas_semana ?? 0} horas`}
          icon="calendar"
        />
        <Metric
          label="Avance promedio"
          value={`${resumen?.avance_promedio ?? 0}%`}
          sub="de tus competencias"
          icon="trend"
        />
        <Metric
          label="RAs cerrados"
          value={resumen?.ras_cerrados ?? 0}
          sub={`de ${resumen?.ras_total ?? 0} en curso`}
          icon="target"
        />
        <TodayCard actividad={actividad}/>
      </div>

      {/* Registrar sesión */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Registrar sesión</div>
        {asigPageCount > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11.5, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{asigFrom}–{asigTo} de {asignaciones.length}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => setAsigPage(p => Math.max(0, p - 1))} disabled={asigCur === 0} aria-label="Ver anteriores"
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e4e4e7', background: '#fff', color: asigCur === 0 ? '#d4d4d8' : '#52525b', cursor: asigCur === 0 ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center' }}>
                <Ic n="chevronLeft" s={15}/>
              </button>
              <button onClick={() => setAsigPage(p => Math.min(asigPageCount - 1, p + 1))} disabled={asigCur >= asigPageCount - 1} aria-label="Ver siguientes"
                style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid #e4e4e7', background: '#fff', color: asigCur >= asigPageCount - 1 ? '#d4d4d8' : '#52525b', cursor: asigCur >= asigPageCount - 1 ? 'not-allowed' : 'pointer', display: 'grid', placeItems: 'center' }}>
                <Ic n="chevronRight" s={15}/>
              </button>
            </div>
          </div>
        )}
      </div>
      {asignaciones.length === 0 ? (
        <Card style={{ marginBottom: 28 }}>
          <CenterState icon="folder" title="Sin asignaciones activas"
            sub="No tienes competencias asignadas en fichas en ejecución. Pide a tu coordinador que te asigne."/>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 28 }}>
          {asigItems.map(a => (
            <Card key={a.asignacion_id} style={{ padding: 20, display: 'flex', flexDirection: 'column' }}>
              {/* Programa · ficha · estado */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                  <Tag>{a.programa_codigo}</Tag>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#71717a' }}># {a.numero_ficha}</span>
                </div>
                <Pill status={a.status} size="sm"/>
              </div>

              {/* Programa + competencia */}
              <div style={{ fontSize: 14.5, fontWeight: 600, color: '#0a0a0b', lineHeight: 1.3 }}>{a.programa_nombre}</div>
              <div style={{
                fontSize: 12.5, color: '#52525b', lineHeight: 1.35, marginTop: 4, marginBottom: 14,
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {a.competencia_nombre}
              </div>

              {/* Avance */}
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 26, fontWeight: 600, color: '#0a0a0b', lineHeight: 1 }}>
                  {a.avance}<span style={{ fontSize: 14, color: '#71717a' }}>%</span>
                </span>
                <span style={{ fontSize: 11, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>avance</span>
              </div>
              <Prog value={a.avance} status={a.status} height={6} style={{ marginBottom: 16 }}/>

              {/* Jornada · sede */}
              <div style={{ display: 'flex', gap: 20, paddingTop: 14, borderTop: '1px solid #f1f1f3', marginBottom: 16 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a1a1aa', fontWeight: 600 }}>Jornada</div>
                  <div style={{ fontSize: 12.5, color: '#27272a', marginTop: 3 }}>{jornadaLabel(a.jornada)}</div>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a1a1aa', fontWeight: 600 }}>Sede</div>
                  <div style={{ fontSize: 12.5, color: '#27272a', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.sede ?? '—'}</div>
                </div>
              </div>

              <button onClick={() => onRegistrar(a.asignacion_id)} style={{
                marginTop: 'auto', width: '100%', height: 38, background: '#4f46e5', color: '#fff',
                border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: 'inherit',
              }}>
                Registrar sesión <Ic n="arrowRight" s={13}/>
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* Historial reciente */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Historial reciente</div>
      {sesiones.length === 0 ? (
        <Card><CenterState icon="list" title="Aún no has registrado sesiones"
          sub="Cuando registres una sesión aparecerá aquí tu historial."/></Card>
      ) : (
        <Card>
          {sesiones.map((s, i) => (
            <div key={s.id}
              onClick={() => onOpenSesion(s.id)}
              style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
                borderBottom: i < sesiones.length - 1 ? '1px solid #f1f1f3' : 'none',
              }}>
              <div style={{ width: 84, fontSize: 11, color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Ficha {s.numero_ficha} · <span style={{ fontWeight: 400, color: '#52525b' }}>{s.competencia_nombre}</span>
                </div>
                <div style={{ fontSize: 11, color: '#52525b', marginTop: 4, display: 'flex', gap: 12, fontFamily: '"JetBrains Mono", monospace' }}>
                  <span>{s.horas_ejecutadas.toFixed(1)} h</span>
                  <span style={{ fontFamily: 'inherit', textTransform: 'capitalize' }}>{s.tipo_sesion.toLowerCase()}</span>
                  <span>{s.ras} RA · {s.conocimientos} con · {s.criterios} crit.</span>
                </div>
              </div>
              <Bdg tone={s.estado_sesion === 'VALIDADA' ? 'accent' : 'neutral'}>{s.estado_sesion}</Bdg>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
