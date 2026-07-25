import { useState, useEffect } from 'react'
import { Ic, Card, Tag, Prog } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import type { CoordDetalle, FichaRow } from '../shared/types'

export function CoordAlertas() {
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

  if (coordId == null) return <Center title="Sin coordinación asignada" sub="Pide a un administrador que te asigne una coordinación académica."/>
  if (error) return <Center title="No se pudieron cargar las alertas" sub="Verifica la conexión con el servidor."/>
  if (!data) return <div style={{ padding: 40 }}><div className="skeleton" style={{ height: 18, width: 240 }}/></div>

  const fichas = data.fichas.filter(f => f.estado === 'EN_EJECUCION')
  const riesgo = fichas.filter(f => f.tiene_disenio_curricular && ((f.dias_restantes <= 30 && f.avance < 70) || f.avance < 40))
    .sort((a, b) => a.avance - b.avance)
  const cierre = fichas.filter(f => f.dias_restantes <= 30).sort((a, b) => a.dias_restantes - b.dias_restantes)
  const sinDig = fichas.filter(f => !f.tiene_disenio_curricular)

  const vacio = riesgo.length === 0 && cierre.length === 0 && sinDig.length === 0

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ fontSize: 13.5, color: '#52525b', marginBottom: 18 }}>
        Situaciones de tu coordinación que requieren seguimiento.
      </div>

      {vacio ? (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Ic n="checkCircle" s={28} style={{ color: '#16a34a' }}/>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>Sin alertas</div>
          <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 4 }}>Ninguna ficha en riesgo, próxima a cerrar ni sin digitalizar.</div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Grupo
            titulo="Fichas en riesgo"
            sub="Avance bajo para el tiempo que llevan"
            color="#dc2626" bg="#fef2f2" bd="#fecaca" icon="alert"
            fichas={riesgo}
            render={f => <RiesgoRow f={f}/>}
          />
          <Grupo
            titulo="Cierran pronto (≤ 30 días)"
            sub="Fin de etapa lectiva cercano"
            color="#c2410c" bg="#fff7ed" bd="#fed7aa" icon="clock"
            fichas={cierre}
            render={f => <CierreRow f={f}/>}
          />
          <Grupo
            titulo="Programa sin digitalizar"
            sub="No se pueden monitorear hasta digitalizar su diseño curricular"
            color="#a16207" bg="#fffbeb" bd="#fde68a" icon="layers"
            fichas={sinDig}
            render={f => <SinDigRow f={f}/>}
          />
        </div>
      )}
    </div>
  )
}

function Grupo({ titulo, sub, color, bg, bd, icon, fichas, render }: {
  titulo: string; sub: string; color: string; bg: string; bd: string; icon: any
  fichas: FichaRow[]; render: (f: FichaRow) => React.ReactNode
}) {
  if (fichas.length === 0) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: bg, border: `1px solid ${bd}`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Ic n={icon} s={15} style={{ color }}/>
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>{titulo} · {fichas.length}</div>
          <div style={{ fontSize: 11.5, color: '#71717a' }}>{sub}</div>
        </div>
      </div>
      <Card style={{ overflow: 'hidden' }}>
        {fichas.map((f, i) => (
          <div key={f.id} style={{ padding: '11px 16px', borderBottom: i < fichas.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
            {render(f)}
          </div>
        ))}
      </Card>
    </div>
  )
}

function FichaHead({ f }: { f: FichaRow }) {
  return (
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Tag>{f.programa_codigo}</Tag>
        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
      </div>
      <div style={{ fontSize: 12, color: '#52525b', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.programa_nombre}</div>
    </div>
  )
}

function RiesgoRow({ f }: { f: FichaRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <FichaHead f={f}/>
      <div style={{ width: 110 }}><Prog value={f.avance} status={f.avance >= 40 ? 'warn' : 'crit'} showLabel/></div>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: f.dias_restantes <= 30 ? '#dc2626' : '#52525b', width: 48, textAlign: 'right' }}>{f.dias_restantes}d</span>
    </div>
  )
}
function CierreRow({ f }: { f: FichaRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <FichaHead f={f}/>
      {f.tiene_disenio_curricular
        ? <div style={{ width: 110 }}><Prog value={f.avance} status={f.avance >= 70 ? 'ok' : f.avance >= 40 ? 'warn' : 'crit'} showLabel/></div>
        : <span style={{ fontSize: 11, color: '#a16207', width: 110, textAlign: 'right' }}>sin digitalizar</span>}
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#dc2626', width: 48, textAlign: 'right' }}>{f.dias_restantes}d</span>
    </div>
  )
}
function SinDigRow({ f }: { f: FichaRow }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <FichaHead f={f}/>
      <span style={{ fontSize: 11.5, color: '#a16207' }}>Pídele al administrador digitalizar este programa</span>
    </div>
  )
}

function Center({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#71717a', maxWidth: 380 }}>{sub}</div>
    </div>
  )
}
