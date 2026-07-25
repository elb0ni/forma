import { useState, useEffect } from 'react'
import { Ic, Card, Prog, Tag, Metric, Ava } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import type { CoordDetalle, FichaRow } from '../shared/types'
import './CoordinadorHome.css'

// Semáforo de una ficha de la coordinación (mismo criterio que los reportes).
type Sem = 'SINDIG' | 'CRIT' | 'RISK' | 'WARN' | 'OK'
const SM: Record<Sem, { label: string; fg: string; bg: string; dot: string }> = {
  OK:     { label: 'AL DÍA',          fg: '#15803d', bg: '#dcfce7', dot: '#16a34a' },
  WARN:   { label: 'REVISAR',         fg: '#a16207', bg: '#fef9c3', dot: '#ca8a04' },
  RISK:   { label: 'EN RIESGO',       fg: '#c2410c', bg: '#ffedd5', dot: '#ea580c' },
  CRIT:   { label: 'CRÍTICO',         fg: '#b91c1c', bg: '#fee2e2', dot: '#dc2626' },
  SINDIG: { label: 'SIN DIGITALIZAR', fg: '#52525b', bg: '#f1f1f3', dot: '#a1a1aa' },
}
const RANK: Record<Sem, number> = { CRIT: 0, RISK: 1, SINDIG: 2, WARN: 3, OK: 4 }

function semaforo(f: FichaRow): Sem {
  if (!f.tiene_disenio_curricular) return 'SINDIG'
  if (f.dias_restantes <= 30 && f.avance < 70) return 'CRIT'
  if (f.avance < 40) return 'RISK'
  if (f.avance < 70) return 'WARN'
  return 'OK'
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

export function CoordinadorHome({ onNav }: { onNav?: (id: string) => void }) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const coordId = user?.coordinacion_academica_id ?? null
  const [data, setData] = useState<CoordDetalle | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (coordId == null) return
    api.get<CoordDetalle>(`/coordinaciones/${coordId}/detalle`)
      .then(r => setData(r.data))
      .catch(() => setError(true))
  }, [coordId])

  if (coordId == null) return (
    <CenterMsg title="Sin coordinación asignada"
      sub="Tu usuario no tiene una coordinación académica asignada. Pide a un administrador que te la asigne."/>
  )
  if (error) return <CenterMsg title="No se pudo cargar tu coordinación" sub="Verifica la conexión con el servidor."/>
  if (!data) return <div style={{ padding: 40 }}><div className="skeleton" style={{ height: 18, width: 260 }}/></div>

  const { coordinacion: c, kpi } = data
  const fichas = data.fichas.filter(f => f.estado === 'EN_EJECUCION')
  const conSem = fichas.map(f => ({ f, sem: semaforo(f) }))

  const enRiesgo = conSem.filter(x => x.sem === 'CRIT' || x.sem === 'RISK').length
  const sinDig   = conSem.filter(x => x.sem === 'SINDIG').length
  const cierre   = fichas.filter(f => f.estado === 'EN_EJECUCION' && f.dias_restantes <= 30).length

  const atencion = [...conSem]
    .filter(x => x.sem !== 'OK')
    .sort((a, b) => RANK[a.sem] - RANK[b.sem] || a.f.dias_restantes - b.f.dias_restantes)
    .slice(0, 6)

  const topInstructores = [...data.instructores].sort((a, b) => a.avance - b.avance).slice(0, 5)

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 11.5, color: '#71717a', display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
          <Ic n="shield" s={13} style={{ color: '#a1a1aa' }}/>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{c.centro.codigo}</span>
          <span>·</span><span>{c.centro.nombre}</span>
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#0a0a0b' }}>{saludo()}.</div>
        <div style={{ fontSize: 13.5, color: '#52525b', marginTop: 4 }}>
          Coordinación <strong style={{ color: '#18181b' }}>{c.nombre}</strong> · {fichas.length} fichas en ejecución.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Metric label="Fichas activas" value={kpi.fichas_activas} sub={`${kpi.fichas_total} en total`} icon="briefcase"/>
        <Metric label="Instructores" value={kpi.instructores} sub={`${kpi.instructores_activos_semana} activos esta semana`} icon="users"/>
        <Metric label="Avance promedio" value={`${kpi.avance_promedio}%`} sub={`${kpi.ras_cerrados} RAs cerrados`} icon="trend"/>
        <Metric label="Sesiones (semana)" value={kpi.sesiones_semana} sub={`${kpi.programas} programas`} icon="calendar"/>
      </div>

      {/* Tira de alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <AlertCard n={enRiesgo} label="Fichas en riesgo" color="#dc2626" bg="#fef2f2" bd="#fecaca" icon="alert" onClick={() => onNav?.('coord-alertas')}/>
        <AlertCard n={cierre} label="Cierran en ≤30 días" color="#c2410c" bg="#fff7ed" bd="#fed7aa" icon="clock" onClick={() => onNav?.('coord-alertas')}/>
        <AlertCard n={sinDig} label="Programa sin digitalizar" color="#a16207" bg="#fffbeb" bd="#fde68a" icon="layers" onClick={() => onNav?.('coord-alertas')}/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Fichas que requieren atención */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Fichas que requieren atención</div>
            <button onClick={() => onNav?.('coord-fichas')} style={linkBtn}>Ver todas <Ic n="arrowRight" s={12}/></button>
          </div>
          {atencion.length === 0 ? (
            <Card style={{ padding: 28, textAlign: 'center' }}>
              <Ic n="checkCircle" s={24} style={{ color: '#16a34a' }}/>
              <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 8 }}>Ninguna ficha requiere atención. ¡Todo al día!</div>
            </Card>
          ) : (
            <Card style={{ overflow: 'hidden' }}>
              {atencion.map((x, i) => {
                const sm = SM[x.sem]
                return (
                  <div key={x.f.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: i < atencion.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: sm.dot, flexShrink: 0 }}/>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Tag>{x.f.programa_codigo}</Tag>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {x.f.numero_ficha}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#52525b', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.f.programa_nombre}</div>
                    </div>
                    {x.f.tiene_disenio_curricular
                      ? <div style={{ width: 90 }}><Prog value={x.f.avance} status={x.f.avance >= 70 ? 'ok' : x.f.avance >= 40 ? 'warn' : 'crit'}/></div>
                      : <span style={{ fontSize: 11, color: '#a16207' }}>sin digitalizar</span>}
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: x.f.dias_restantes <= 30 ? '#dc2626' : '#52525b', width: 44, textAlign: 'right' }}>{x.f.dias_restantes}d</span>
                    <span className="coord-chip" style={{ background: sm.bg, color: sm.fg }}>{sm.label}</span>
                  </div>
                )
              })}
            </Card>
          )}
        </div>

        {/* Instructores con menor avance */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Instructores a seguir</div>
            <button onClick={() => onNav?.('coord-instructores')} style={linkBtn}>Ver todos <Ic n="arrowRight" s={12}/></button>
          </div>
          {topInstructores.length === 0 ? (
            <Card style={{ padding: 20 }}><div style={{ fontSize: 12.5, color: '#71717a' }}>Sin instructores asignados.</div></Card>
          ) : (
            <Card>
              {topInstructores.map((u, i) => (
                <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: i < topInstructores.length - 1 ? '1px solid #f1f1f3' : 'none', opacity: u.activo ? 1 : 0.6 }}>
                  <Ava name={u.nombre_completo} size={28}/>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre_completo}</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>{u.competencias_asignadas} comp · {u.sesiones} ses.</div>
                  </div>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 600, color: u.avance >= 70 ? '#15803d' : u.avance >= 40 ? '#a16207' : '#dc2626' }}>{u.avance}%</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
}

function AlertCard({ n, label, color, bg, bd, icon, onClick }: {
  n: number; label: string; color: string; bg: string; bd: string; icon: any; onClick?: () => void
}) {
  return (
    <Card onClick={onClick} style={{ padding: 16, background: bg, border: `1px solid ${bd}`, cursor: onClick ? 'pointer' : 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Ic n={icon} s={20} style={{ color }}/>
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{n}</div>
          <div style={{ fontSize: 12, color: '#52525b', marginTop: 4 }}>{label}</div>
        </div>
      </div>
    </Card>
  )
}

function CenterMsg({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#71717a', maxWidth: 380 }}>{sub}</div>
    </div>
  )
}
