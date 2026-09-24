import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Ic, Card } from '../../components/ui'
import api from '../../lib/api'
import { LoadingBlock, CenterState } from '../shared/parts'
import type { FichaInstructor } from './types'
import { FichasInstructorTable } from './FichasInstructorTable'
import { InstFichaPractica } from './InstFichaPractica'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'
import { CrearEtapaProductivaForm } from '../productiva/EtapaProductivaList'
import type { Aprendiz } from '../productiva/types'
import './instructor.css'

// ─── Lista de fichas: donde el instructor hace seguimiento a la etapa
// productiva de sus aprendices (GET /instructores/mi/fichas) ──────────────────

type EstadoFilt = 'TODAS' | 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA', label: 'Finalizadas' },
  { key: 'SUSPENDIDA', label: 'Suspendidas' },
]

function FichasList({ onOpen }: { onOpen: (f: FichaInstructor) => void }) {
  "use no memo"
  const [fichas, setFichas] = useState<FichaInstructor[] | null>(null)
  const [error, setError] = useState(false)
  const [filt, setFilt] = useState<EstadoFilt>('TODAS')
  const [q, setQ] = useState('')

  useEffect(() => {
    api.get<FichaInstructor[]>('/instructores/mi/fichas')
      .then(r => setFichas(r.data))
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
        <FichasInstructorTable fichas={view} onOpen={onOpen} paginate/>
      )}
    </div>
  )
}

// ─── Wrapper: lista ↔ detalle (rutas) ────────────────────────────────────────────

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
      <Route index element={
        <InstFichaPractica
          fichaId={id}
          onBack={back}
          onOpenEtapa={etapaId => navigate(`etapa/${etapaId}`)}
          onCrear={aprendizId => navigate(`crear/${aprendizId}`)}
        />
      }/>
      <Route path="crear/:aprendizId" element={<FichaCrearRoute/>}/>
      <Route path="etapa/:etapaId" element={<FichaEtapaRoute/>}/>
    </Routes>
  )
}

function FichaCrearRoute() {
  "use no memo"
  const { aprendizId } = useParams()
  const navigate = useNavigate()
  const [aprendiz, setAprendiz] = useState<Aprendiz | null | undefined>(undefined)

  useEffect(() => {
    let live = true
    api.get<Aprendiz>(`/aprendices/${aprendizId}`)
      .then(r => { if (live) setAprendiz(r.data) })
      .catch(() => { if (live) navigate('../..', { relative: 'path', replace: true }) })
    return () => { live = false }
  }, [aprendizId, navigate])

  if (aprendiz === undefined) return <LoadingBlock/>
  if (!aprendiz) return null
  return (
    <div style={{ maxWidth: 720 }}>
      <button onClick={() => navigate('../..', { relative: 'path' })} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
        <Ic n="arrowLeft" s={14}/>Volver a la ficha
      </button>
      <CrearEtapaProductivaForm
        aprendiz={aprendiz}
        onBack={() => navigate('../..', { relative: 'path' })}
        onCreated={etapaId => navigate(`../../etapa/${etapaId}`, { relative: 'path' })}
      />
    </div>
  )
}

function FichaEtapaRoute() {
  "use no memo"
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return <EtapaProductivaDetalle etapaId={Number(etapaId)} onBack={() => navigate('..')}/>
}
