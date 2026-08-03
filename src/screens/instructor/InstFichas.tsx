import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, useParams } from 'react-router-dom'
import { Ic, Card, Btn, Tag, Bdg, Prog } from '../../components/ui'
import api from '../../lib/api'
import { Pill, Donut, fd, jornadaLabel, LoadingBlock, CenterState, SM } from '../shared/parts'
import type { FichaInstructor, FichaDetalle, CompetenciaDetalle } from './types'
import { InstFichaPractica } from './InstFichaPractica'
import { EtapaProductivaDetalle } from '../productiva/EtapaProductivaDetalle'
import './instructor.css'

// ─── Lista de fichas ─────────────────────────────────────────────────────────────

type EstadoFilt = 'TODAS' | 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: 'TODAS', label: 'Todas' },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA', label: 'Finalizadas' },
  { key: 'SUSPENDIDA', label: 'Suspendidas' },
]

// Tarjeta compacta de una ficha (lectiva o práctica) -- se usa tanto en el
// listado "Mis fichas" como en el resumen del Home del instructor, para que
// ambas vistas monitoreen las dos etapas con el mismo criterio visual.
export function FichaCard({ f, onClick }: { f: FichaInstructor; onClick: () => void }) {
  return (
    <Card onClick={onClick} style={{ padding: 18, display: 'flex', gap: 16, alignItems: 'center' }}>
      {f.es_lectiva ? (
        <Donut value={f.avance} size={56} stroke={6} color={SM[f.status].dot}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600 }}>{f.avance}%</span>
        </Donut>
      ) : (
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#eef2ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Ic n="briefcase" s={22} style={{ color: '#4f46e5' }}/>
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
          <Tag>{f.programa_codigo}</Tag>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
          <Pill status={f.status} size="sm"/>
          {f.es_practica && <Bdg tone="accent">Práctica</Bdg>}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {f.programa_nombre}
        </div>
        <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {f.es_lectiva && (
            <span><strong style={{ fontFamily: '"JetBrains Mono", monospace', color: '#3f3f46' }}>{f.competencias_completas}/{f.competencias_asignadas}</strong> comp.</span>
          )}
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
        Monitorea el avance de cada competencia en todas tus fichas.
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
        <Card><CenterState icon="folder" title="Sin fichas" sub="No hay fichas que coincidan con el filtro."/></Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 14 }}>
          {view.map(f => <FichaCard key={f.id} f={f} onClick={() => onOpen(f)}/>)}
        </div>
      )}
    </div>
  )
}

// ─── Tarjeta de competencia (acordeón con sus RAs) ───────────────────────────────

function CompetenciaCard({ comp, defaultOpen }: { comp: CompetenciaDetalle; defaultOpen?: boolean }) {
  "use no memo"
  const [open, setOpen] = useState(!!defaultOpen)
  return (
    <Card style={{ overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <Donut value={comp.avance} size={40} stroke={5} color={SM[comp.status].dot}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600 }}>{comp.avance}</span>
        </Donut>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{comp.codigo_norma}</span>
            <Pill status={comp.status} size="sm"/>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#18181b', lineHeight: 1.35 }}>{comp.nombre}</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
            {comp.ra_completados}/{comp.ra_total} RA · {comp.horas_ejecutadas.toFixed(0)}/{comp.horas_maximas} h
          </div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #f1f1f3' }}>
          {comp.resultados_aprendizaje.length === 0 ? (
            <div style={{ padding: '14px 16px', fontSize: 12, color: '#71717a' }}>Esta competencia no tiene resultados de aprendizaje cargados.</div>
          ) : comp.resultados_aprendizaje.map((ra, i) => (
            <div key={ra.id} style={{ padding: '12px 16px', display: 'flex', gap: 12, borderBottom: i < comp.resultados_aprendizaje.length - 1 ? '1px solid #f7f7f8' : 'none' }}>
              <div style={{ width: 28, height: 28, borderRadius: 6, background: '#f7f7f8', border: '1px solid #e4e4e7', display: 'grid', placeItems: 'center', fontSize: 11, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                RA{i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10.5, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{ra.numero}</div>
                    <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.4, marginTop: 2 }}>{ra.descripcion}</div>
                  </div>
                  <Pill status={ra.status} size="sm"/>
                </div>
                <Prog value={ra.avance} status={ra.status} showLabel/>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// ─── Detalle de ficha (basado en forma.html S4) ──────────────────────────────────

function FichaDetalleView({ fichaId, onBack, onRegistrar, onOpenSesion, onReporte }: {
  fichaId: number
  onBack: () => void
  onRegistrar: (asignacionId: number) => void
  onOpenSesion: (sesionId: number) => void
  onReporte: (fichaId: number) => void
}) {
  "use no memo"
  const [data, setData] = useState<FichaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(null); setError(null)
    api.get<FichaDetalle>(`/dashboard/instructor/fichas/${fichaId}`)
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.message ?? 'No se pudo cargar la ficha'))
  }, [fichaId])

  const back = (
    <button onClick={onBack} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
      <Ic n="arrowLeft" s={14}/>Volver a mis fichas
    </button>
  )

  if (error) return <div style={{ maxWidth: 1200 }}>{back}<Card style={{ padding: 24 }}><CenterState icon="alert" title="Ficha no disponible" sub={error}/></Card></div>
  if (!data) return <div style={{ maxWidth: 1200 }}>{back}<LoadingBlock/></div>

  const { ficha, kpi, competencias, sesiones } = data
  const firstAsg = competencias[0]?.asignacion_id

  const meta: [string, string][] = [
    ['Coordinador', ficha.coordinador_nombre],
    ['Coordinación', ficha.coordinacion_nombre],
    ['Inicio', fd(ficha.fecha_inicio)],
    ['Fin lectiva', fd(ficha.fecha_fin_lectiva)],
    ['Sede', ficha.sede ?? '—'],
    ['Jornada', jornadaLabel(ficha.jornada)],
  ]

  return (
    <div style={{ maxWidth: 1200 }}>
      {back}

      {/* Encabezado */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <div style={{ fontSize: 12, color: '#52525b', marginBottom: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{ficha.programa_codigo}</span>
            <span>·</span><span>{ficha.nivel_formacion}</span>
            <span>·</span><span style={{ fontFamily: '"JetBrains Mono", monospace' }}>V{String(ficha.programa_version).padStart(3, '0')}</span>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{ficha.programa_nombre}</h2>
          <div style={{ marginTop: 4, display: 'flex', gap: 10, fontSize: 13, color: '#3f3f46', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 600, color: '#18181b' }}>Ficha {ficha.numero_ficha}</span>
            <span style={{ color: '#a1a1aa' }}>·</span>
            <span>{jornadaLabel(ficha.jornada)}{ficha.sede ? ` · ${ficha.sede}` : ''}</span>
            <span style={{ color: '#a1a1aa' }}>·</span>
            <Pill status={data.kpi.avance >= 100 ? 'done' : ficha.estado === 'EN_EJECUCION' ? 'ok' : 'off'}
              label={ficha.estado === 'EN_EJECUCION' ? 'EN EJECUCIÓN' : ficha.estado} size="sm"/>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignSelf: 'flex-start' }}>
          <Btn variant="secondary" icon="download" size="sm" onClick={() => onReporte(ficha.id)}>Reporte</Btn>
          {firstAsg != null && <Btn variant="accent" icon="plus" onClick={() => onRegistrar(firstAsg)}>Nueva sesión</Btn>}
        </div>
      </div>

      {/* KPIs de la ficha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Card style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Donut value={kpi.avance} size={48} stroke={5} color="#4f46e5">
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600 }}>{kpi.avance}%</span>
          </Donut>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>Avance</div>
            <div style={{ fontSize: 11.5, color: '#3f3f46', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
              {competencias.filter(c => c.avance >= 100).length}/{competencias.length} comp.
            </div>
          </div>
        </Card>
        <KpiBox label="Horas ejec." value={kpi.horas_ejecutadas.toFixed(0)} sub="registradas" icon="clock"/>
        <KpiBox label="Días restantes" value={ficha.estado === 'EN_EJECUCION' ? String(ficha.dias_restantes) : '—'} sub="cierre lectiva" icon="calendar"/>
        <KpiBox label="RAs cerrados" value={String(kpi.ras_cerrados)} sub={`de ${kpi.ras_total}`} icon="target"/>
      </div>

      {/* Contenido: competencias + lateral */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>
            Competencias asignadas · {competencias.length}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {competencias.map((c, i) => <CompetenciaCard key={c.competencia_id} comp={c} defaultOpen={i === 0}/>)}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Sesiones recientes</div>
            {sesiones.length === 0 ? (
              <Card style={{ padding: 16 }}><div style={{ fontSize: 12, color: '#71717a' }}>Sin sesiones registradas en esta ficha.</div></Card>
            ) : (
              <Card>
                {sesiones.map((s, i) => (
                  <div key={s.id} onClick={() => onOpenSesion(s.id)}
                    style={{ padding: '10px 14px', borderBottom: i < sesiones.length - 1 ? '1px solid #f1f1f3' : 'none', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#52525b', alignItems: 'center' }}>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha)}</span>
                      <span>·</span>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{s.horas_ejecutadas.toFixed(1)} h</span>
                      <span style={{ marginLeft: 'auto' }}>
                        <Bdg tone={s.estado_sesion === 'VALIDADA' ? 'accent' : 'neutral'}>{s.estado_sesion}</Bdg>
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#18181b', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
                      {s.ras} RA · {s.conocimientos} con · {s.criterios} crit.
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Coordinación</div>
            <Card style={{ padding: 16 }}>
              {meta.map(([l, v], i) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: i < meta.length - 1 ? '1px solid #f1f1f3' : 'none', gap: 12 }}>
                  <span style={{ fontSize: 12, color: '#52525b', flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 12.5, color: '#18181b', fontWeight: 500, textAlign: 'right' }}>{v}</span>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

function KpiBox({ label, value, sub, icon }: { label: string; value: string; sub: string; icon: any }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600 }}>{label}</div>
        <Ic n={icon} s={14} style={{ color: '#a1a1aa' }}/>
      </div>
      <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 24, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 4 }}>{sub}</div>
    </Card>
  )
}

// ─── Wrapper: lista ↔ detalle (rutas) ────────────────────────────────────────────

export function InstFichas({ onRegistrar, onOpenSesion, onReporte }: {
  onRegistrar: (asignacionId: number) => void
  onOpenSesion: (sesionId: number) => void
  onReporte: (fichaId: number) => void
}) {
  "use no memo"
  const navigate = useNavigate()

  function abrir(f: FichaInstructor) {
    // Si el instructor es el de práctica de esta ficha, esa es la vista
    // relevante (aunque también tenga asignaciones lectivas ahí); si no,
    // se abre la vista de competencias de siempre. Se pasa el flag por
    // location.state para no tener que resolverlo de nuevo al abrir.
    navigate(String(f.id), { state: { esPractica: f.es_practica } })
  }

  return (
    <Routes>
      <Route index element={<FichasList onOpen={abrir}/>}/>
      <Route path=":fichaId/*" element={<FichaRoute onRegistrar={onRegistrar} onOpenSesion={onOpenSesion} onReporte={onReporte}/>}/>
    </Routes>
  )
}

// Resuelve si la ficha es de práctica para elegir la vista: usa el flag recibido
// por navegación desde la lista, o -- en refresh/deep link, sin location.state --
// hace un fetch de resolución contra el mismo listado.
function FichaRoute({ onRegistrar, onOpenSesion, onReporte }: {
  onRegistrar: (asignacionId: number) => void
  onOpenSesion: (sesionId: number) => void
  onReporte: (fichaId: number) => void
}) {
  "use no memo"
  const { fichaId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const id = Number(fichaId)
  const stateFlag = (location.state as { esPractica?: boolean } | null)?.esPractica
  const [resolved, setResolved] = useState<boolean | null>(null)

  useEffect(() => {
    if (stateFlag !== undefined) return
    api.get<FichaInstructor[]>('/dashboard/instructor/fichas')
      .then(r => setResolved(r.data.find(f => f.id === id)?.es_practica ?? false))
      .catch(() => setResolved(false))
  }, [id, stateFlag])

  const esPractica = stateFlag ?? resolved
  const back = () => navigate('/dashboard/instructor/fichas')

  if (esPractica === null) return <LoadingBlock/>

  if (esPractica) {
    return (
      <Routes>
        <Route index element={<InstFichaPractica fichaId={id} onBack={back} onOpenEtapa={etapaId => navigate(`etapa/${etapaId}`)}/>}/>
        <Route path="etapa/:etapaId" element={<FichaEtapaRoute/>}/>
      </Routes>
    )
  }
  return <FichaDetalleView fichaId={id} onBack={back} onRegistrar={onRegistrar} onOpenSesion={onOpenSesion} onReporte={onReporte}/>
}

function FichaEtapaRoute() {
  "use no memo"
  const { etapaId } = useParams()
  const navigate = useNavigate()
  return <EtapaProductivaDetalle etapaId={Number(etapaId)} onBack={() => navigate('..')}/>
}
