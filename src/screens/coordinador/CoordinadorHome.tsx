import { useState, useEffect } from 'react'
import { Ic, Card, Tag, Metric } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { diasHasta } from '../shared/parts'
import type { FichaRow } from '../shared/FichasAdmin'
import type { CoordDetalle } from '../shared/types'
import './CoordinadorHome.css'

function saludo(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

interface InstructorMin { id: string; activo: boolean | number }

export function CoordinadorHome({ onNav, onOpenFicha }: { onNav?: (id: string) => void; onOpenFicha?: (id: number) => void }) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const coordId = user?.coordinacion_academica_id ?? null
  const [coord, setCoord] = useState<CoordDetalle | null>(null)
  const [fichas, setFichas] = useState<FichaRow[] | null>(null)
  const [instructores, setInstructores] = useState<InstructorMin[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (coordId == null) return
    Promise.all([
      api.get<CoordDetalle>(`/coordinaciones/${coordId}/detalle`),
      api.get<FichaRow[]>(`/fichas?coordinacion_id=${coordId}`),
      api.get<InstructorMin[]>(`/usuarios?rol=INSTRUCTOR&coordinacion_id=${coordId}`),
    ])
      .then(([c, f, i]) => { setCoord(c.data); setFichas(f.data); setInstructores(i.data) })
      .catch(() => setError(true))
  }, [coordId])

  if (coordId == null) return (
    <CenterMsg title="Sin coordinación asignada"
      sub="Tu usuario no tiene una coordinación académica asignada. Pide a un administrador que te la asigne."/>
  )
  if (error) return <CenterMsg title="No se pudo cargar tu coordinación" sub="Verifica la conexión con el servidor."/>
  if (!coord || !fichas || !instructores) return <div style={{ padding: 40 }}><div className="skeleton" style={{ height: 18, width: 260 }}/></div>

  const { coordinacion: c } = coord
  const enEjecucion = fichas.filter(f => f.estado === 'EN_EJECUCION')
  const enPractica  = enEjecucion.filter(f => f.etapa_actual_teorica === 'PRACTICA')
  const cierranPronto = enPractica
    .map(f => ({ f, dias: diasHasta(f.fecha_fin_productiva) }))
    .filter((x): x is { f: FichaRow; dias: number } => x.dias != null && x.dias <= 30)
    .sort((a, b) => a.dias - b.dias)
  const instructoresActivos = instructores.filter(i => !!i.activo).length

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
          Coordinación <strong style={{ color: '#18181b' }}>{c.nombre}</strong> · {enEjecucion.length} fichas en ejecución.
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <Metric label="Fichas en práctica" value={enPractica.length} sub={`${enEjecucion.length} en ejecución`} icon="briefcase"/>
        <Metric label="Instructores" value={instructores.length} sub={`${instructoresActivos} activos`} icon="users"/>
        <Metric label="Cierran en ≤30 días" value={cierranPronto.length} sub="etapa productiva" icon="clock"/>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Fichas que cierran pronto */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Fichas que cierran pronto</div>
            <button onClick={() => onNav?.('coord-fichas')} style={linkBtn}>Ver todas <Ic n="arrowRight" s={12}/></button>
          </div>
          {cierranPronto.length === 0 ? (
            <Card style={{ padding: 28, textAlign: 'center' }}>
              <Ic n="checkCircle" s={24} style={{ color: '#16a34a' }}/>
              <div style={{ fontSize: 13, color: '#3f3f46', marginTop: 8 }}>Ninguna ficha en práctica cierra en los próximos 30 días.</div>
            </Card>
          ) : (
            <Card style={{ overflow: 'hidden' }}>
              {cierranPronto.map(({ f, dias }, i) => (
                <div
                  key={f.id}
                  className={onOpenFicha ? 'nx-row' : undefined}
                  onClick={() => onOpenFicha?.(f.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                    borderBottom: i < cierranPronto.length - 1 ? '1px solid #f1f1f3' : 'none',
                    cursor: onOpenFicha ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Tag>{f.programa_codigo}</Tag>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#52525b', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.programa_nombre}</div>
                  </div>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: '#dc2626', width: 44, textAlign: 'right' }}>{dias}d</span>
                </div>
              ))}
            </Card>
          )}
        </div>

        {/* Acceso a instructores */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Instructores de práctica</div>
            <button onClick={() => onNav?.('coord-instructores')} style={linkBtn}>Ver todos <Ic n="arrowRight" s={12}/></button>
          </div>
          <Card style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 28, fontWeight: 700, color: '#0a0a0b' }}>{instructores.length}</div>
            <div style={{ fontSize: 12.5, color: '#71717a' }}>{instructoresActivos} activos esta semana</div>
          </Card>
        </div>
      </div>
    </div>
  )
}

const linkBtn: React.CSSProperties = {
  fontSize: 12, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit',
}

function CenterMsg({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
      <div style={{ fontSize: 13, color: '#71717a', maxWidth: 380 }}>{sub}</div>
    </div>
  )
}
