import { useState, useEffect } from 'react'
import { Ic, Card, Tag } from '../../components/ui'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import { diasHasta } from '../shared/parts'
import type { FichaRow } from '../shared/FichasAdmin'

// Alertas de la coordinación centradas en etapa productiva: fichas cuya
// etapa productiva cierra pronto. Antes había también "Fichas en riesgo" y
// "Programa sin digitalizar", ambos calculados sobre avance/currículo
// lectivo -- se retiraron junto con esa parte del producto.
export function CoordAlertas({ onOpenFicha }: { onOpenFicha?: (id: number) => void } = {}) {
  "use no memo"
  const user = useAuthStore(s => s.user)
  const coordId = user?.coordinacion_academica_id ?? null
  const [fichas, setFichas] = useState<FichaRow[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (coordId == null) return
    api.get<FichaRow[]>(`/fichas?coordinacion_id=${coordId}`)
      .then(r => setFichas(r.data))
      .catch(() => setError(true))
  }, [coordId])

  if (coordId == null) return <Center title="Sin coordinación asignada" sub="Pide a un administrador que te asigne una coordinación académica."/>
  if (error) return <Center title="No se pudieron cargar las alertas" sub="Verifica la conexión con el servidor."/>
  if (!fichas) return <div style={{ padding: 40 }}><div className="skeleton" style={{ height: 18, width: 240 }}/></div>

  const cierre = fichas
    .filter(f => f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA')
    .map(f => ({ f, dias: diasHasta(f.fecha_fin_productiva) }))
    .filter((x): x is { f: FichaRow; dias: number } => x.dias != null && x.dias <= 30)
    .sort((a, b) => a.dias - b.dias)

  const vacio = cierre.length === 0

  return (
    <div style={{ maxWidth: 1000 }}>
      <div style={{ fontSize: 13.5, color: '#52525b', marginBottom: 18 }}>
        Fichas de tu coordinación cuya etapa productiva requiere seguimiento.
      </div>

      {vacio ? (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Ic n="checkCircle" s={28} style={{ color: '#16a34a' }}/>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>Sin alertas</div>
          <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 4 }}>Ninguna ficha en etapa productiva cierra en los próximos 30 días.</div>
        </Card>
      ) : (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#fff7ed', border: '1px solid #fed7aa', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Ic n="clock" s={15} style={{ color: '#c2410c' }}/>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Cierran pronto (≤ 30 días) · {cierre.length}</div>
              <div style={{ fontSize: 11.5, color: '#71717a' }}>Fin de etapa productiva cercano</div>
            </div>
          </div>
          <Card style={{ overflow: 'hidden' }}>
            {cierre.map(({ f, dias }, i) => (
              <div
                key={f.id}
                className={onOpenFicha ? 'nx-row' : undefined}
                onClick={() => onOpenFicha?.(f.id)}
                style={{
                  padding: '11px 16px', borderBottom: i < cierre.length - 1 ? '1px solid #f1f1f3' : 'none',
                  cursor: onOpenFicha ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', gap: 14,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Tag>{f.programa_codigo}</Tag>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#52525b', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.programa_nombre}</div>
                </div>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#dc2626', width: 48, textAlign: 'right' }}>{dias}d</span>
              </div>
            ))}
          </Card>
        </div>
      )}
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
