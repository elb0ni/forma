import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Ic, Card, Tag } from '../../components/ui'
import api from '../../lib/api'
import { Pill, jornadaLabel, LoadingBlock, CenterState } from '../shared/parts'
import type { FichaInstructor } from './types'
import { InstFichaPractica } from './InstFichaPractica'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'
import './instructor.css'

// ─── Lista de fichas (solo las de práctica: el instructor es su instructor de
// seguimiento a etapa productiva) ────────────────────────────────────────────

type EstadoFilt = 'TODAS' | 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA', label: 'Finalizadas' },
  { key: 'SUSPENDIDA', label: 'Suspendidas' },
]

// Tarjeta compacta de una ficha en práctica -- se usa tanto en el listado
// "Mis fichas" como en el resumen del Home del instructor.
export function FichaCard({ f, onClick }: { f: FichaInstructor; onClick: () => void }) {
  return (
    <Card onClick={onClick} style={{ padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
      <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eef2ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <Ic n="briefcase" s={22} style={{ color: '#4f46e5' }}/>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
          <Tag>{f.programa_codigo}</Tag>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
          <Pill status={f.status} size="sm"/>
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {f.programa_nombre}
        </div>
        <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span>{jornadaLabel(f.jornada)}</span>
          {f.estado === 'EN_EJECUCION' && (
            <span style={{ fontFamily: '"JetBrains Mono", monospace', color: f.dias_restantes < 60 ? '#dc2626' : '#52525b' }}>
              {f.dias_restantes}d
            </span>
          )}
        </div>
      </div>
      <Ic n="chevronRight" s={16} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
    </Card>
  )
}

function FichasList({ onOpen }: { onOpen: (f: FichaInstructor) => void }) {
  "use no memo"
  const [fichas, setFichas] = useState<FichaInstructor[] | null>(null)
  const [error, setError] = useState(false)
  const [filt, setFilt] = useState<EstadoFilt>('TODAS')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.get<FichaInstructor[]>('/dashboard/instructor/fichas')
      .then(r => setFichas(r.data.filter(f => f.es_practica)))
      .catch(() => setError(true))
  }, [])

  if (error) return <Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudieron cargar tus fichas" sub="Verifica la conexión con el servidor."/></Card>
  if (!fichas) return <LoadingBlock/>

  const counts: Record<EstadoFilt, number> = {
    TODAS: fichas.length,
    EN_EJECUCION: fichas.filter(f => f.estado === 'EN_EJECUCION').length,
    FINALIZADA: fichas.filter(f => f.estado === 'FINALIZADA').length,
    SUSPENDIDA: fichas.filter(f => f.estado === 'SUSPENDIDA').length,
  }

  const ql = q.trim().toLowerCase()
  const view = fichas.filter(f => {
    if (filt !== 'TODAS' && f.estado !== filt) return false
    if (ql && !f.numero_ficha.toLowerCase().includes(ql) && !f.programa_nombre.toLowerCase().includes(ql)) return false
    return true
  })

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 4, fontSize: 13.5, color: '#52525b' }}>
        Fichas donde haces seguimiento a la etapa productiva de sus aprendices.
      </div>

      <div className="inst-toolbar" style={{ marginTop: 18 }}>
        <div className="inst-chips">
          {ESTADO_CHIPS.map(c => (
            <button key={c.key} onClick={() => setFilt(c.key)}
              className={`inst-chip${filt === c.key ? ' inst-chip--active' : ''}`}>
              {c.label}<span className="inst-chip__count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
        <div className="inst-search">
          <Ic n="search" s={14} className="inst-search__icon" style={{ color: '#a1a1aa' }}/>
          <input className="inst-search__input" placeholder="Buscar ficha o programa…" value={q} onChange={e => setQ(e.target.value)}/>
        </div>
      </div>

      {view.length === 0 ? (
        <Card><CenterState icon="folder" title="Sin fichas" sub={fichas.length === 0 ? 'Todavía no eres instructor de práctica de ninguna ficha.' : 'No hay fichas que coincidan con el filtro.'}/></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14 }}>
          {view.map(f => <FichaCard key={f.id} f={f} onClick={() => onOpen(f)}/>)}
        </div>
      )}
    </div>
  )
}

// ─── Wrapper: lista ↔ detalle (rutas) ────────────────────────────────────────────
// Con la lista ya acotada a fichas de práctica, el detalle siempre es el
// roster de aprendices (InstFichaPractica) -- ya no hace falta resolver si la
// ficha es lectiva o de práctica.

export function InstFichas() {
  "use no memo"
  const navigate = useNavigate()

  return (
    <Routes>
      <Route index element={<FichasList onOpen={f => navigate(String(f.id))}/>}/>
      <Route path=":fichaId/*" element={<FichaRoute/>}/>
    </Routes>
  )
}

function FichaRoute() {
  "use no memo"
  const { fichaId } = useParams()
  const navigate = useNavigate()
  const id = Number(fichaId)
  const back = () => navigate('/dashboard/instructor/fichas')

  return (
    <Routes>
      <Route index element={<InstFichaPractica fichaId={id} onBack={back} onOpenEtapa={etapaId => navigate(`etapa/${etapaId}`)}/>}/>
      <Route path="etapa/:etapaId" element={<FichaEtapaRoute/>}/>
    </Routes>
  )
}

function FichaEtapaRoute() {
  "use no memo"
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return <EtapaProductivaDetalle etapaId={Number(etapaId)} onBack={() => navigate('..')}/>
}
