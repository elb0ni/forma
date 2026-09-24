import { useState, useEffect, useMemo } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Ic, Bdg, Card, Btn, Modal } from '../../components/ui'
import api from '../../lib/api'
import { centroLabel, centroTone, ProxPill } from '../shared/parts'
import type { CentroResumen, CoordResumen } from '../shared/types'
import { CoordinacionDetalle } from './CoordinacionDetalle'
import './CentrosCoord.css'

type ListState =
  | { status: 'loading' }
  | { status: 'ok'; centros: CentroResumen[] }
  | { status: 'error' }

type ModalState =
  | null
  | { kind: 'crear-coord';  centro: CentroResumen }
  | { kind: 'editar-coord'; centro: CentroResumen; coord: CoordResumen }
  | { kind: 'crear-centro' }
  | { kind: 'editar-centro'; centro: CentroResumen }

function Sk({ w, h, r = 5, delay = 0 }: { w: string | number; h: number; r?: number; delay?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, animationDelay: `${delay}ms` }}/>
}

const plural = (n: number, sing: string, plur = sing + 's') => `${n} ${n === 1 ? sing : plur}`

// ─── Card de centro (rail izquierdo) ─────────────────────────────────────────
function CentroCard({ c, tone, escala, active, onClick }: {
  c: CentroResumen; tone: string; escala: number; active: boolean; onClick: () => void
}) {
  const enPractica = c.fichas_en_practica
  const conInstr   = enPractica - c.fichas_sin_instructor
  const cobertura  = enPractica > 0 ? Math.round((conInstr / enPractica) * 100) : 0
  // La barra = qué parte del total de fichas en práctica de la regional lleva
  // este centro (por eso es dinámica); el color señala la cobertura de instructor.
  const share  = enPractica > 0 ? Math.round((enPractica / escala) * 100) : 0
  const barPct = enPractica > 0 ? Math.max(4, share) : 0
  const barCol = c.fichas_sin_instructor === 0 ? '#16a34a'
    : cobertura >= 60 ? '#c2410c' : '#dc2626'
  const senales = c.fichas_sin_instructor + c.etapas_por_cerrar + c.conceptos_por_resolver

  return (
    <button
      onClick={onClick}
      className={`cc-card${active ? ' cc-card--active' : ''}${c.activo ? '' : ' cc-card--off'}`}
      title={c.nombre}
    >
      <div className="cc-card__top">
        <span className="cc-card__badge" style={{ background: tone }}><Ic n="shield" s={13}/></span>
        <span className="cc-card__name">{centroLabel(c.nombre)}</span>
        {!c.activo
          ? <Bdg tone="neutral">Inactivo</Bdg>
          : senales > 0
            ? <span className="cc-card__flag" title={`${plural(senales, 'señal', 'señales')} de atención`}>{senales}</span>
            : enPractica > 0
              ? <span className="cc-card__flag cc-card__flag--ok"><Ic n="check" s={10}/></span>
              : null}
      </div>

      <div className="cc-card__stat">
        <b style={{ color: enPractica > 0 ? '#0a0a0b' : '#a1a1aa' }}>{enPractica}</b> en práctica
        <span className="cc-card__dotsep">·</span>
        <b>{c.aprendices_en_practica}</b> aprendices
      </div>

      {enPractica > 0 ? (
        <>
          <div className="cc-card__bar" title={`${share}% de las fichas en práctica de la regional`}>
            <span style={{ width: `${barPct}%`, background: barCol }}/>
          </div>
          <div className="cc-card__cov">
            {share}% de la regional
            <span className="cc-card__dotsep">·</span>
            {conInstr}/{enPractica} con instructor
          </div>
        </>
      ) : (
        <div className="cc-card__nopract">sin práctica activa</div>
      )}

      <div className="cc-card__foot">
        <span>{c.coordinaciones} coord · {plural(c.instructores_total, 'instructor', 'instructores')}</span>
        {c.proxima_a_practica && <ProxPill iso={c.proxima_a_practica}/>}
      </div>
    </button>
  )
}

// ─── Panel de detalle del centro ────────────────────────────────────────────
function CentroPanel({ c, tone, busy, onEditCentro, onToggleCentro, onNuevaCoord, onEditCoord, onToggleCoord, onOpenCoord }: {
  c: CentroResumen
  tone: string
  busy: boolean
  onEditCentro: () => void
  onToggleCentro: () => void
  onNuevaCoord: () => void
  onEditCoord: (co: CoordResumen) => void
  onToggleCoord: (co: CoordResumen) => void
  onOpenCoord: (id: number) => void
}) {
  const enPractica = c.fichas_en_practica
  const conInstr   = enPractica - c.fichas_sin_instructor
  const pct        = enPractica > 0 ? Math.round((conInstr / enPractica) * 100) : 0
  const covCol     = enPractica === 0 ? '#d4d4d8'
    : c.fichas_sin_instructor === 0 ? '#16a34a'
    : pct >= 60 ? '#c2410c' : '#dc2626'

  const chips = [
    c.fichas_sin_instructor > 0 && {
      cls: 'cc-chip--warn', icon: 'user' as const,
      label: `${plural(c.fichas_sin_instructor, 'ficha')} sin instructor`,
      hint: 'Fichas en etapa práctica sin instructor de seguimiento asignado.',
    },
    c.etapas_por_cerrar > 0 && {
      cls: 'cc-chip--amber', icon: 'clock' as const,
      label: `${plural(c.etapas_por_cerrar, 'etapa')} por cerrar`,
      hint: 'La fecha estimada de fin ya pasó y la etapa productiva sigue abierta. Ciérrala o ajusta la fecha.',
    },
    c.conceptos_por_resolver > 0 && {
      cls: 'cc-chip--amber', icon: 'fileText' as const,
      label: `${plural(c.conceptos_por_resolver, 'concepto')} por resolver`,
      hint: 'Seguimientos con concepto no favorable sin plan de mejoramiento. Se resuelven con la coordinación y el instructor.',
    },
  ].filter(Boolean) as { cls: string; icon: 'user' | 'clock' | 'fileText'; label: string; hint: string }[]

  const coords = c.coordinaciones_detalle ?? []

  return (
    <div className="cc-panel">
      <div className="cc-panel__head">
        <div style={{ display: 'flex', gap: 12, minWidth: 0 }}>
          <span className="cc-panel__badge" style={{ background: tone }}><Ic n="shield" s={16}/></span>
          <div style={{ minWidth: 0 }}>
            <div className="cc-panel__title">
              {c.nombre}
              {!c.activo && <Bdg tone="neutral">Inactivo</Bdg>}
            </div>
            <div className="cc-panel__meta">
              <span className="mono">{c.codigo}</span> · {c.ciudad} · Regional {c.regional}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="cc-icon-btn" title="Editar centro" onClick={onEditCentro}><Ic n="edit" s={14}/></button>
          <button
            className="cc-icon-btn"
            title={c.activo ? 'Desactivar centro' : 'Activar centro'}
            onClick={onToggleCentro}
            disabled={busy}
            style={{ color: c.activo ? '#b91c1c' : '#15803d' }}
          >
            <Ic n={c.activo ? 'x' : 'check'} s={14}/>
          </button>
        </div>
      </div>

      {/* KPIs de práctica */}
      <div className="cc-kpis">
        <div className="cc-kpi">
          <div className="cc-kpi__label">En práctica</div>
          <div className="cc-kpi__value">{enPractica}</div>
          <div className="cc-kpi__sub">{c.fichas_activas} fichas activas · {c.fichas_total} en total</div>
        </div>
        <div className="cc-kpi">
          <div className="cc-kpi__label">Aprendices en práctica</div>
          <div className="cc-kpi__value">{c.aprendices_en_practica}</div>
          <div className="cc-kpi__sub">etapa productiva en ejecución</div>
        </div>
        <div className="cc-kpi">
          <div className="cc-kpi__label">Cobertura de instructor</div>
          <div className="cc-kpi__value">{conInstr}/{enPractica} <span className="cc-kpi__pct">{pct}%</span></div>
          <div className="cc-kpi__bar"><span style={{ width: `${pct}%`, background: covCol }}/></div>
        </div>
        <div className="cc-kpi">
          <div className="cc-kpi__label">Programas en práctica</div>
          <div className="cc-kpi__value">{c.programas_en_practica}</div>
          <div className="cc-kpi__sub">{plural(c.instructores_practica, 'instructor', 'instructores')} con asignación</div>
        </div>
        <div className="cc-kpi">
          <div className="cc-kpi__label">Próxima a práctica</div>
          <div className="cc-kpi__value" style={{ fontSize: 15 }}>
            {c.proxima_a_practica ? <ProxPill iso={c.proxima_a_practica}/> : <span style={{ color: '#c4c4cc', fontSize: 13 }}>Sin fecha próxima</span>}
          </div>
          <div className="cc-kpi__sub">siguiente ficha que entra a etapa práctica</div>
        </div>
      </div>

      {chips.length > 0 && (
        <div className="cc-alerts">
          {chips.map(ch => (
            <span key={ch.label} className={`cc-chip ${ch.cls}`} title={ch.hint}>
              <Ic n={ch.icon} s={12}/>{ch.label}
            </span>
          ))}
        </div>
      )}

      {/* Coordinaciones académicas */}
      <div className="cc-coords__head">
        <span className="cc-coords__title">Coordinaciones académicas · {coords.length}</span>
        <Btn size="sm" variant="ghost" icon="plus" onClick={onNuevaCoord}>Nueva</Btn>
      </div>

      {coords.length === 0 ? (
        <div className="cc-empty">
          Este centro aún no tiene coordinaciones. Crea la primera para abrir fichas y asignar instructores.
        </div>
      ) : (
        <div className="cc-coords__list">
          {coords.map(co => (
            <div key={co.id} className={`cc-coord${co.activa ? '' : ' cc-coord--off'}`}>
              <button className="cc-coord__main" onClick={() => onOpenCoord(co.id)} title="Ver detalle de la coordinación">
                <span className="cc-coord__dot" style={{ background: co.activa ? '#16a34a' : '#a1a1aa' }}/>
                <span className="cc-coord__body">
                  <span className="cc-coord__name">
                    {co.nombre}
                    {!co.activa && <Bdg tone="neutral">Inactiva</Bdg>}
                  </span>
                  <span className="cc-coord__who">{co.coordinador_nombre ?? 'Sin coordinador asignado'}</span>
                </span>
                <span className="cc-coord__stats">
                  <span><b>{co.fichas_en_practica}</b> práctica</span>
                  <span><b>{co.aprendices_en_practica}</b> aprend.</span>
                  {co.fichas_sin_instructor > 0 && <span className="cc-coord__warn">{co.fichas_sin_instructor} sin instr</span>}
                </span>
                <Ic n="chevronRight" s={14} style={{ color: '#c4c4cc', flexShrink: 0 }}/>
              </button>
              <button className="cc-icon-btn" title="Editar coordinación" onClick={() => onEditCoord(co)}><Ic n="edit" s={13}/></button>
              <button
                className="cc-icon-btn"
                title={co.activa ? 'Desactivar' : 'Activar'}
                onClick={() => onToggleCoord(co)}
                disabled={busy}
                style={{ color: co.activa ? '#b91c1c' : '#15803d' }}
              >
                <Ic n={co.activa ? 'x' : 'check'} s={13}/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PanelSkeleton() {
  return (
    <div className="cc-panel">
      <Sk w="45%" h={20}/>
      <div style={{ marginTop: 8 }}><Sk w="60%" h={11}/></div>
      <div className="cc-kpis" style={{ marginTop: 20 }}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="cc-kpi"><Sk w="70%" h={9} delay={i * 40}/><div style={{ marginTop: 10 }}><Sk w="40%" h={20} delay={i * 40 + 20}/></div></div>
        ))}
      </div>
      <Sk w="30%" h={12}/>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[0, 1, 2].map(i => <Sk key={i} w="100%" h={44} r={10} delay={i * 50}/>)}
      </div>
    </div>
  )
}

// ─── Lista maestra ──────────────────────────────────────────────────────────
function CentrosList() {
  "use no memo"
  const navigate = useNavigate()
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState({ nombre: '', codigo: '', ciudad: '', regional: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api.get<CentroResumen[]>('/centros/resumen')
      .then(r => { if (alive) setState({ status: 'ok', centros: r.data }) })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [reloadKey])

  const retry   = () => { setState({ status: 'loading' }); setReloadKey(k => k + 1) }
  const refetch = () => setReloadKey(k => k + 1)

  const centros = useMemo(() => (state.status === 'ok' ? state.centros : []), [state])

  // Color estable por centro: índice al ordenar por id.
  const toneById = useMemo(() => {
    const m = new Map<number, string>()
    ;[...centros].sort((a, b) => a.id - b.id).forEach((c, i) => m.set(c.id, centroTone(i)))
    return m
  }, [centros])

  // Rail: activos primero, luego por fichas en práctica.
  const rail = useMemo(() =>
    [...centros].sort((a, b) =>
      b.activo - a.activo
      || b.fichas_en_practica - a.fichas_en_practica
      || a.nombre.localeCompare(b.nombre, 'es')),
    [centros])

  // Referencia para la barra de cada card: el total de fichas en práctica de la
  // regional -- la barra muestra qué parte del total lleva ese centro.
  const totalEnPractica = useMemo(
    () => Math.max(1, centros.reduce((s, c) => s + c.fichas_en_practica, 0)),
    [centros])

  const selected = centros.find(c => c.id === selectedId) ?? rail[0] ?? null
  const esCentroModal = modal?.kind === 'crear-centro' || modal?.kind === 'editar-centro'

  function openCrearCentro()  { setForm({ nombre: '', codigo: '', ciudad: '', regional: '' }); setError(null); setModal({ kind: 'crear-centro' }) }
  function openEditarCentro(c: CentroResumen) {
    setForm({ nombre: c.nombre, codigo: c.codigo, ciudad: c.ciudad, regional: c.regional }); setError(null); setModal({ kind: 'editar-centro', centro: c })
  }
  function openCrearCoord(c: CentroResumen)   { setForm({ nombre: '', codigo: '', ciudad: '', regional: '' }); setError(null); setModal({ kind: 'crear-coord', centro: c }) }
  function openEditarCoord(c: CentroResumen, co: CoordResumen) { setForm({ nombre: co.nombre, codigo: '', ciudad: '', regional: '' }); setError(null); setModal({ kind: 'editar-coord', centro: c, coord: co }) }

  async function guardar() {
    if (!form.nombre.trim()) { setError('Escribe un nombre.'); return }
    if (esCentroModal && !form.codigo.trim()) { setError('El código del centro es obligatorio.'); return }
    setBusy(true); setError(null)
    try {
      if (modal?.kind === 'crear-coord') {
        await api.post('/coordinaciones', { centro_formacion_id: modal.centro.id, nombre: form.nombre.trim() })
      } else if (modal?.kind === 'editar-coord') {
        await api.patch(`/coordinaciones/${modal.coord.id}`, { nombre: form.nombre.trim() })
      } else if (modal?.kind === 'crear-centro') {
        const r = await api.post<{ id: number }>('/centros', {
          nombre: form.nombre.trim(), codigo: form.codigo.trim(), ciudad: form.ciudad.trim(), regional: form.regional.trim(),
        })
        setSelectedId(r.data.id)
      } else if (modal?.kind === 'editar-centro') {
        await api.patch(`/centros/${modal.centro.id}`, {
          nombre: form.nombre.trim(), codigo: form.codigo.trim(), ciudad: form.ciudad.trim(), regional: form.regional.trim(),
        })
      }
      setModal(null); refetch()
    } catch (e) {
      const msg = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : 'No se pudo guardar.'
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
    } finally {
      setBusy(false)
    }
  }

  async function toggleCoord(co: CoordResumen) {
    setBusy(true)
    try { await api.patch(`/coordinaciones/${co.id}`, { activa: !co.activa }); refetch() }
    catch { /* noop */ } finally { setBusy(false) }
  }
  async function toggleCentro(c: CentroResumen) {
    setBusy(true)
    try { await api.patch(`/centros/${c.id}`, { activo: !c.activo }); refetch() }
    catch { /* noop */ } finally { setBusy(false) }
  }

  const modalUI = modal && (
    <Modal
      title={
        modal.kind === 'crear-centro' ? 'Nuevo centro de formación'
        : modal.kind === 'editar-centro' ? 'Editar centro'
        : modal.kind === 'crear-coord' ? 'Nueva coordinación académica'
        : 'Editar coordinación'
      }
      icon={esCentroModal ? 'shield' : 'users'}
      onClose={() => setModal(null)}
      footer={<>
        <Btn variant="ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Btn>
      </>}
    >
      {(modal.kind === 'crear-coord' || modal.kind === 'editar-coord') && (
        <div style={{ fontSize: 12.5, color: '#71717a', marginBottom: 12 }}>
          Centro: <strong style={{ color: '#3f3f46' }}>{modal.centro.nombre}</strong>
        </div>
      )}
      <div style={{ display: 'grid', gap: 12 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 500, color: '#27272a', marginBottom: 6 }}>Nombre</div>
          <input
            className="nx-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            placeholder={esCentroModal ? 'ej. CFTAM Cazucá' : 'ej. Coordinación de Teleinformática'} autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && !esCentroModal) guardar() }}
          />
        </div>
        {esCentroModal && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#27272a', marginBottom: 6 }}>Código</div>
                <input className="nx-input" value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} placeholder="9203" style={{ fontFamily: '"JetBrains Mono", monospace' }}/>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#27272a', marginBottom: 6 }}>Ciudad</div>
                <input className="nx-input" value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} placeholder="Barranquilla"/>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#27272a', marginBottom: 6 }}>Regional</div>
              <input className="nx-input" value={form.regional} onChange={e => setForm(f => ({ ...f, regional: e.target.value }))} placeholder="Atlántico"/>
            </div>
          </>
        )}
      </div>
      {error && <div style={{ marginTop: 10, fontSize: 12.5, color: '#b91c1c' }}>{error}</div>}
    </Modal>
  )

  const header = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
      <div>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Centros y coordinaciones</h2>
        <div style={{ fontSize: 13, color: '#52525b', marginTop: 4, maxWidth: 640 }}>
          El estado de la etapa práctica por centro: cobertura de instructor, aprendices en práctica y alertas.
          Entra a una coordinación para ver su detalle.
        </div>
      </div>
      <Btn variant="accent" icon="plus" onClick={openCrearCentro}>Nuevo centro</Btn>
    </div>
  )

  if (state.status === 'loading') {
    return (
      <div className="cc-view">
        {header}
        <div className="cc-summary"><Sk w={280} h={12}/></div>
        <div className="cc-layout">
          <div className="cc-rail">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="cc-card" style={{ cursor: 'default' }}>
                <div className="cc-card__top"><Sk w={26} h={26} r={8}/><Sk w="55%" h={12}/></div>
                <Sk w="72%" h={10}/>
                <Sk w="100%" h={5} r={3}/>
              </div>
            ))}
          </div>
          <PanelSkeleton/>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="cc-view">
        {header}
        <Card style={{ padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Ic n="alert" s={22} style={{ color: '#b91c1c' }}/>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>No se pudieron cargar los centros</div>
          <div style={{ fontSize: 12.5, color: '#71717a' }}>Revisa la conexión con el servidor e inténtalo de nuevo.</div>
          <Btn variant="secondary" icon="refresh" onClick={retry}>Reintentar</Btn>
        </Card>
      </div>
    )
  }

  const activos    = centros.filter(c => c.activo).length
  const enPractica = centros.reduce((s, c) => s + c.fichas_en_practica, 0)
  const aprendices = centros.reduce((s, c) => s + c.aprendices_en_practica, 0)
  const sinInstr   = centros.reduce((s, c) => s + c.fichas_sin_instructor, 0)

  return (
    <div className="cc-view">
      {modalUI}
      {header}

      <div className="cc-summary">
        <span><span className="cc-summary__n">{activos}</span> centros activos{centros.length > activos ? ` · ${centros.length - activos} inactivos` : ''}</span>
        <span className="cc-summary__sep">·</span>
        <span><span className="cc-summary__n">{enPractica}</span> fichas en práctica</span>
        <span className="cc-summary__sep">·</span>
        <span><span className="cc-summary__n">{aprendices}</span> aprendices en práctica</span>
        <span className="cc-summary__sep">·</span>
        <span style={{ color: sinInstr > 0 ? '#c2410c' : '#52525b' }}>
          <span className="cc-summary__n" style={{ color: sinInstr > 0 ? '#c2410c' : undefined }}>{sinInstr}</span> sin instructor
        </span>
      </div>

      {centros.length === 0 ? (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <Ic n="shield" s={22} style={{ color: '#a1a1aa' }}/>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b', marginTop: 10 }}>Sin centros registrados</div>
          <div style={{ fontSize: 12.5, color: '#71717a', marginTop: 4 }}>Crea el primer centro de formación para empezar.</div>
        </Card>
      ) : (
        <div className="cc-layout">
          <div className="cc-rail">
            {rail.map(c => (
              <CentroCard
                key={c.id}
                c={c}
                tone={toneById.get(c.id) ?? '#4f46e5'}
                escala={totalEnPractica}
                active={selected?.id === c.id}
                onClick={() => setSelectedId(c.id)}
              />
            ))}
          </div>

          {selected && (
            <CentroPanel
              c={selected}
              tone={toneById.get(selected.id) ?? '#4f46e5'}
              busy={busy}
              onEditCentro={() => openEditarCentro(selected)}
              onToggleCentro={() => toggleCentro(selected)}
              onNuevaCoord={() => openCrearCoord(selected)}
              onEditCoord={co => openEditarCoord(selected, co)}
              onToggleCoord={toggleCoord}
              onOpenCoord={id => navigate(String(id), { relative: 'path' })}
            />
          )}
        </div>
      )}
    </div>
  )
}

export function CentrosCoord() {
  "use no memo"
  return (
    <Routes>
      <Route index element={<CentrosList/>}/>
      <Route path=":coordId/*" element={<CoordinacionDetalle/>}/>
    </Routes>
  )
}
