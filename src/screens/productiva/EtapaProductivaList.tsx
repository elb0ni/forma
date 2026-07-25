import { useState } from 'react'
import { Ic, Card, Btn, Tag, Bdg } from '../../components/ui'
import { fd, CenterState } from '../shared/parts'
import { estadoDe } from './types'
import type { EtapaProductivaRecord, EstadoEtapaProductiva } from './types'
import { ESTADO_META } from './parts'

type Filtro = 'TODAS' | EstadoEtapaProductiva

const CHIPS: { key: Filtro; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'PLANEACION_PENDIENTE', label: 'Planeación pendiente' },
  { key: 'EN_SEGUIMIENTO', label: 'En seguimiento' },
  { key: 'APROBADO', label: 'Aprobados' },
  { key: 'NO_APROBADO', label: 'No aprobados' },
]

export function EtapaProductivaList({ records, onOpen, onNuevo }: {
  records: EtapaProductivaRecord[]
  onOpen: (id: number) => void
  onNuevo: () => void
}) {
  "use no memo"
  const [filt, setFilt] = useState<Filtro>('TODAS')
  const [q, setQ] = useState('')

  const withEstado = records.map(r => ({ r, estado: estadoDe(r) }))

  const counts: Record<Filtro, number> = {
    TODAS: records.length,
    PLANEACION_PENDIENTE: withEstado.filter(x => x.estado === 'PLANEACION_PENDIENTE').length,
    EN_SEGUIMIENTO: withEstado.filter(x => x.estado === 'EN_SEGUIMIENTO').length,
    APROBADO: withEstado.filter(x => x.estado === 'APROBADO').length,
    NO_APROBADO: withEstado.filter(x => x.estado === 'NO_APROBADO').length,
  }

  const ql = q.trim().toLowerCase()
  const view = withEstado.filter(({ r, estado }) => {
    if (filt !== 'TODAS' && estado !== filt) return false
    if (ql && !r.info.aprendiz.nombreCompleto.toLowerCase().includes(ql) && !r.info.numeroFicha.toLowerCase().includes(ql) && !r.info.programaNombre.toLowerCase().includes(ql)) return false
    return true
  })

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 4, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13.5, color: '#52525b' }}>
          {view.length} aprendiz{view.length === 1 ? '' : 'es'} en etapa productiva
        </div>
        <Btn variant="accent" icon="plus" onClick={onNuevo}>Nuevo registro</Btn>
      </div>

      <div className="inst-toolbar" style={{ marginTop: 14 }}>
        <div className="inst-chips">
          {CHIPS.map(c => (
            <button key={c.key} onClick={() => setFilt(c.key)} className={`inst-chip${filt === c.key ? ' inst-chip--active' : ''}`}>
              {c.label}<span className="inst-chip__count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
        <div className="inst-search">
          <Ic n="search" s={14} className="inst-search__icon" style={{ color: '#a1a1aa' }}/>
          <input className="inst-search__input" placeholder="Buscar aprendiz, ficha o programa…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>

      {view.length === 0 ? (
        <Card><CenterState icon="briefcase" title="Sin registros" sub="No hay aprendices en etapa productiva que coincidan con el filtro."/></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {view.map(({ r, estado }) => {
            const seguimientos = r.momento2.length
            const m = ESTADO_META[estado]
            return (
              <Card key={r.id} onClick={() => onOpen(r.id)} style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: '#f1f1f3', fontSize: 13, fontWeight: 600, color: '#3f3f46',
                }}>
                  {r.info.aprendiz.nombreCompleto.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#18181b' }}>{r.info.aprendiz.nombreCompleto}</span>
                    <Bdg tone={m.tone}>{m.label}</Bdg>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 11.5, color: '#71717a', flexWrap: 'wrap' }}>
                    <Tag>{r.info.programaCodigo}</Tag>
                    <span>{r.info.programaNombre}</span>
                    <span style={{ color: '#d4d4d8' }}>·</span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>Ficha {r.info.numeroFicha}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 20, fontSize: 11.5, color: '#52525b', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: '#a1a1aa' }}>Inicio</div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3f3f46', marginTop: 2 }}>{fd(r.momento1.fechaInicio)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10, color: '#a1a1aa' }}>Seguimientos</div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3f3f46', marginTop: 2 }}>{seguimientos}</div>
                  </div>
                </div>
                <Ic n="chevronRight" s={16} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
