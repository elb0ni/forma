import { useState, useEffect } from 'react'
import { Ic, Card, Bdg, Ava, Pager } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { FichasAdmin } from '../shared/FichasAdmin'
import { InstructorDetalle } from '../shared/InstructorDetalle'
import type { InstructorBasico } from '../shared/InstructorDetalle'
import { diasHasta } from '../shared/parts'
import type { CoordDetalle } from '../shared/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────────

function fmtAcceso(s: string | null): string {
  if (!s) return 'Nunca'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  const now = new Date()
  const hh = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: false })
  const sameDay = d.toDateString() === now.toDateString()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (sameDay) return `Hoy · ${hh}`
  if (d.toDateString() === yest.toDateString()) return `Ayer · ${hh}`
  return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} · ${hh}`
}

function Sk({ w, h, r = 5, delay = 0 }: { w: string | number; h: number; r?: number; delay?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, animationDelay: `${delay}ms` }}/>
}

// Solo lo necesario de `GET /fichas?coordinacion_id=` para el KPI de cierre
// de etapa productiva (mismo shape que el `FichaRow` de FichasAdmin.tsx).
interface FichaMin {
  estado: string
  etapa_actual_teorica: string | null
  fecha_fin_productiva: string | null
}

// ─── Componente ──────────────────────────────────────────────────────────────────

type CoordView =
  | { mode: 'main' }
  | { mode: 'instructor'; u: InstructorBasico }

export function CoordinacionDetalle({ coordId, onBack }: { coordId: number; onBack: () => void }) {
  "use no memo"
  const [data, setData] = useState<CoordDetalle | null>(null)
  const [instructores, setInstructores] = useState<InstructorBasico[] | null>(null)
  const [fichas, setFichas] = useState<FichaMin[] | null>(null)
  const [error, setError] = useState(false)
  const [view, setView] = useState<CoordView>({ mode: 'main' })
  const [tab, setTab] = useState<'instructores' | 'fichas'>('fichas')
  const [fichaFocused, setFichaFocused] = useState(false)
  const [instPage, setInstPage] = useState(0)

  useEffect(() => {
    setData(null); setInstructores(null); setFichas(null); setError(false)
    Promise.all([
      api.get<CoordDetalle>(`/coordinaciones/${coordId}/detalle`),
      api.get<InstructorBasico[]>(`/usuarios?rol=INSTRUCTOR&coordinacion_id=${coordId}`),
      api.get<FichaMin[]>(`/fichas?coordinacion_id=${coordId}`),
    ])
      .then(([d, u, f]) => { setData(d.data); setInstructores(u.data); setFichas(f.data) })
      .catch(() => setError(true))
  }, [coordId])

  const back = (
    <button onClick={onBack} className="back-btn" style={{
      fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none',
      cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'Inter, sans-serif',
    }}>
      <Ic n="arrowLeft" s={14}/>Volver a centros
    </button>
  )

  if (error) return (
    <div>{back}<Card style={{ padding: 24 }}><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
      <span style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudo cargar el detalle de la coordinación.</span>
    </div></Card></div>
  )

  if (!data || !instructores || !fichas) return (
    <div>{back}
      <Sk w={260} h={20}/>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginTop: 20 }}>
        {[0, 1, 2].map(i => <Card key={i} style={{ padding: 16 }}><Sk w="60%" h={9} delay={i * 40}/><div style={{ marginTop: 10 }}><Sk w="40%" h={22} delay={i * 40 + 20}/></div></Card>)}
      </div>
      <Card style={{ padding: 20, marginTop: 16 }}><Sk w="40%" h={14}/><div style={{ marginTop: 14 }}><Sk w="100%" h={40}/></div></Card>
    </div>
  )

  const { coordinacion: c, coordinador, kpi } = data

  const cierranPronto = fichas.filter(f => {
    if (f.estado !== 'EN_EJECUCION' || f.etapa_actual_teorica !== 'PRACTICA') return false
    const d = diasHasta(f.fecha_fin_productiva)
    return d != null && d <= 30
  }).length

  // Drill-down: detalle de un instructor de práctica (reutiliza la vista de detalle del Super Admin)
  if (view.mode === 'instructor') {
    return <InstructorDetalle instructor={view.u} onBack={() => setView({ mode: 'main' })}/>
  }

  const INST_PAGE = 10
  const instPageCount = Math.ceil(instructores.length / INST_PAGE)
  const instCur       = Math.min(instPage, Math.max(0, instPageCount - 1))
  const instItems     = instructores.slice(instCur * INST_PAGE, (instCur + 1) * INST_PAGE)

  const kpis: { label: string; value: string | number; icon: IcName; color?: string; sub?: string }[] = [
    { label: 'Fichas activas', value: kpi.fichas_activas, icon: 'briefcase', color: '#4f46e5', sub: `${kpi.fichas_total} en total` },
    { label: 'Instructores', value: kpi.instructores, icon: 'users', color: '#4f46e5', sub: `${kpi.instructores_activos_semana} activos esta semana` },
    { label: 'Cierran en ≤30 días', value: cierranPronto, icon: 'clock', color: cierranPronto > 0 ? '#c2410c' : '#4f46e5', sub: 'etapa productiva' },
  ]

  return (
    <div>
      {!fichaFocused && (
      <>
      {back}

      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11.5, color: '#71717a', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
            <Ic n="shield" s={13} style={{ color: '#a1a1aa' }}/>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{c.centro.codigo}</span>
            <span>·</span><span>{c.centro.nombre}</span><span>·</span><span>{c.centro.ciudad}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{c.nombre}</h2>
            <Bdg tone={c.activa ? 'ok' : 'neutral'}>{c.activa ? 'Activa' : 'Inactiva'}</Bdg>
          </div>
        </div>
      </div>

      {/* Coordinador académico */}
      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 12 }}>
          Coordinador académico
        </div>
        {coordinador ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <Ava name={coordinador.nombre_completo} size={44}/>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>{coordinador.nombre_completo}</span>
                <Bdg tone={coordinador.activo ? 'ok' : 'neutral'}>{coordinador.activo ? 'Activo' : 'Inactivo'}</Bdg>
              </div>
              <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 2 }}>{coordinador.email}</div>
            </div>
            <div style={{ display: 'flex', gap: 28 }}>
              <MetaInline label="Documento" value={coordinador.numero_documento} mono/>
              <MetaInline label="Último acceso" value={fmtAcceso(coordinador.ultimo_acceso)}/>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0' }}>
            <Ic n="alert" s={15} style={{ color: '#d97706' }}/>
            <span style={{ fontSize: 13, color: '#a16207' }}>Esta coordinación no tiene un coordinador académico asignado.</span>
          </div>
        )}
      </Card>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}>
        {kpis.map(k => (
          <Card key={k.label} style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{k.label}</div>
              <Ic n={k.icon} s={15} style={{ color: k.color ?? '#a1a1aa' }}/>
            </div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 26, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>{k.sub}</div>}
          </Card>
        ))}
      </div>

      {/* Pestañas: fichas · instructores */}
      <div style={{ display: 'inline-flex', background: '#f1f1f3', borderRadius: 8, padding: 2, border: '1px solid #e4e4e7', marginBottom: 18 }}>
        {([
          { key: 'fichas',       label: 'Fichas',       icon: 'briefcase', count: kpi.fichas_total },
          { key: 'instructores', label: 'Instructores', icon: 'users',     count: instructores.length },
        ] as const).map(t => {
          const active = tab === t.key
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              height: 30, padding: '0 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: active ? '#fff' : 'transparent', color: active ? '#0a0a0b' : '#52525b',
              fontSize: 12.5, fontWeight: 500, fontFamily: 'Inter, sans-serif',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,.05)' : undefined,
              display: 'inline-flex', alignItems: 'center', gap: 7,
            }}>
              <Ic n={t.icon} s={14} style={{ color: active ? '#4f46e5' : '#a1a1aa' }}/>
              {t.label}
              <span style={{ fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', color: active ? '#4338ca' : '#a1a1aa', background: active ? '#eef2ff' : '#e4e4e7', padding: '1px 6px', borderRadius: 10 }}>{t.count}</span>
            </button>
          )
        })}
      </div>
      </>
      )}

      {tab === 'instructores' && (
      <>
      {instructores.length === 0 ? (
        <EmptyBox text="Esta coordinación aún no tiene instructores asignados."/>
      ) : (
        <div style={{ marginBottom: 24 }}>
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e4e4e7', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>
                {['Instructor', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instItems.map(u => (
                <tr key={u.id} className="nx-row" onClick={() => setView({ mode: 'instructor', u })} style={{ borderBottom: '1px solid #f1f1f3', opacity: u.activo ? 1 : 0.6, cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Ava name={u.nombre_completo} size={30}/>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre_completo}</div>
                        <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px' }}><Bdg tone={u.activo ? 'ok' : 'neutral'}>{u.activo ? 'Activo' : 'Inactivo'}</Bdg></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Pager page={instCur} pageCount={instPageCount} total={instructores.length} pageSize={INST_PAGE} onPage={setInstPage} noun="instructores"/>
        </div>
      )}
      </>
      )}

      {/* Fichas — misma tabla, toolbar, paginación y gestión que la pantalla de Fichas, acotada a esta coordinación */}
      {tab === 'fichas' && (
        <FichasAdmin onDetailChange={setFichaFocused} scope={{ coordinacionId: c.id, centroId: c.centro.id }}/>
      )}
    </div>
  )
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────────

function MetaInline({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#a1a1aa' }}>{label}</div>
      <div style={{ fontSize: 12.5, color: '#27272a', marginTop: 2, fontFamily: mono ? '"JetBrains Mono", monospace' : 'inherit' }}>{value}</div>
    </div>
  )
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12.5, color: '#a1a1aa', padding: '18px 0', textAlign: 'center', border: '1px dashed #e4e4e7', borderRadius: 8, marginBottom: 24 }}>
      {text}
    </div>
  )
}
