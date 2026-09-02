import { useState, useEffect } from 'react'
import { Ic, Card, Bdg } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { fd, LoadingBlock, CenterState } from '../shared/parts'
import type { FichaInstructor } from './types'
import { FichaCard } from './InstFichas'
import { tonoEtapa } from '../productiva/types'
import type { EtapaProductiva } from '../productiva/types'
import './instructor.css'

const linkBtn: React.CSSProperties = {
  fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
}

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function KpiTile({ label, value, icon, color }: { label: string; value: number; icon: any; color: string }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <Ic n={icon} s={15} style={{ color }}/>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 28, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{value}</div>
    </Card>
  )
}

export function InstructorHome({ onOpenFicha, onVerFichas, onVerEtapaProductiva }: {
  onOpenFicha: (f: FichaInstructor) => void
  onVerFichas: () => void
  onVerEtapaProductiva: (etapaId: number) => void
}) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const [fichas, setFichas] = useState<FichaInstructor[]>([])
  const [etapas, setEtapas] = useState<EtapaProductiva[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let live = true
    Promise.all([
      api.get<FichaInstructor[]>('/dashboard/instructor/fichas'),
      api.get<EtapaProductiva[]>(`/etapas-productivas?instructor_id=${user.id}`),
    ]).then(([fic, etp]) => {
      if (!live) return
      setFichas(fic.data.filter(f => f.es_practica))
      setEtapas(etp.data)
      setLoading(false)
    }).catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [user])

  if (loading) return <LoadingBlock minHeight={400}/>

  const nombre = user?.nombre_completo?.split(' ')[0] ?? 'Instructor'
  const today = new Date()
  const conTono = etapas.map(e => ({ e, tono: tonoEtapa(e) }))
  const enCurso    = conTono.filter(x => x.tono.caso === 'EN_CURSO').length
  const sinJuicio  = conTono.filter(x => x.tono.caso === 'SIN_JUICIO').length
  const aprobadas  = conTono.filter(x => x.tono.caso === 'APROBADO').length
  const noAprobadas = conTono.filter(x => x.tono.caso === 'NO_APROBADO').length

  const recientes = [...etapas]
    .sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
    .slice(0, 6)

  return (
    <div style={{ maxWidth: 1200 }}>
      {/* Encabezado */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 12, color: '#52525b', textTransform: 'capitalize' }}>
          {today.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <div style={{ fontSize: 24, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{saludo()}, {nombre}.</div>
        <div style={{ fontSize: 13.5, color: '#52525b', marginTop: 4 }}>
          Haces seguimiento a <strong style={{ color: '#18181b' }}>{etapas.length} aprendiz{etapas.length === 1 ? '' : 'es'}</strong> en etapa productiva
          {fichas.length > 0 && <> en <strong style={{ color: '#18181b' }}>{fichas.length} ficha{fichas.length === 1 ? '' : 's'}</strong></>}.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
        <KpiTile label="En curso" value={enCurso} icon="briefcase" color="#4f46e5"/>
        <KpiTile label="Falta juicio Sofia" value={sinJuicio} icon="alert" color="#a16207"/>
        <KpiTile label="Aprobadas" value={aprobadas} icon="checkCircle" color="#16a34a"/>
        <KpiTile label="No aprobadas" value={noAprobadas} icon="x" color="#dc2626"/>
      </div>

      {/* Mis fichas en práctica */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Mis fichas</div>
        <button onClick={onVerFichas} style={linkBtn}>Ver todas <Ic n="arrowRight" s={12}/></button>
      </div>
      {fichas.length === 0 ? (
        <Card style={{ marginBottom: 28 }}>
          <CenterState icon="folder" title="Sin fichas asignadas"
            sub="Todavía no eres instructor de práctica de ninguna ficha. Pide a tu coordinador que te asigne una."/>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14, marginBottom: 28 }}>
          {fichas.map(f => <FichaCard key={f.id} f={f} onClick={() => onOpenFicha(f)}/>)}
        </div>
      )}

      {/* Aprendices recientes en etapa productiva */}
      <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Aprendices en etapa productiva</div>
      {recientes.length === 0 ? (
        <Card><CenterState icon="briefcase" title="Sin registros todavía"
          sub="Cuando crees un registro de etapa productiva aparecerá aquí."/></Card>
      ) : (
        <Card>
          {recientes.map((e, i) => {
            const t = tonoEtapa(e)
            return (
              <div key={e.id}
                onClick={() => onVerEtapaProductiva(e.id)}
                className="nx-row"
                style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
                  borderBottom: i < recientes.length - 1 ? '1px solid #f1f1f3' : 'none',
                }}>
                <div style={{ width: 84, fontSize: 11, color: '#52525b', fontFamily: '"JetBrains Mono", monospace' }}>{fd(e.fecha_inicio)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.aprendiz_nombre ?? `Aprendiz #${e.aprendiz_id}`}
                  </div>
                  <div style={{ fontSize: 11, color: '#52525b', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>{e.aprendiz_documento}</div>
                </div>
                <Bdg tone={t.tone}>{t.label}</Bdg>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}
