import { useState, useEffect } from 'react'
import axios from 'axios'
import { Ic, Bdg, Card, Btn, Modal, Prog } from '../../components/ui'
import api from '../../lib/api'
import { CoordinacionDetalle } from './CoordinacionDetalle'

interface CentroItem {
  id:                        number
  nombre:                    string
  codigo:                    string
  ciudad:                    string
  regional:                  string
  activo:                    number
  fichas_activas:            number
  programas_digitalizados:   number
  programas_total:           number
  coordinaciones_academicas: number
  estado:                    'AL_DIA' | 'REVISAR' | 'URGENTE'
}

interface CoordRow {
  id:                  number
  nombre:              string
  centro_formacion_id: number
  activa:              number
}

type ListState =
  | { status: 'loading' }
  | { status: 'ok'; centros: CentroItem[]; coords: CoordRow[] }
  | { status: 'error' }

type ModalState =
  | null
  | { kind: 'crear-coord';  centro: CentroItem }
  | { kind: 'editar-coord'; coord: CoordRow }
  | { kind: 'crear-centro' }
  | { kind: 'editar-centro'; centro: CentroItem }

function Sk({ w, h, r = 5, delay = 0 }: { w: string | number; h: number; r?: number; delay?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, animationDelay: `${delay}ms` }}/>
}

function estadoTone(e: string): 'ok' | 'warn' | 'err' {
  return e === 'AL_DIA' ? 'ok' : e === 'REVISAR' ? 'warn' : 'err'
}
function estadoLabel(e: string): string {
  return e === 'AL_DIA' ? 'Al día' : e === 'REVISAR' ? 'Revisar' : 'Urgente'
}
function safePct(a: number, b: number) {
  return b === 0 ? 0 : Math.round((a / b) * 100)
}
function digStatus(pct: number): 'ok' | 'warn' | 'crit' {
  return pct >= 70 ? 'ok' : pct >= 40 ? 'warn' : 'crit'
}
function digColor(pct: number): string {
  return pct >= 70 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626'
}

export function CentrosCoord({ onDigitalizar }: { onDigitalizar?: () => void } = {}) {
  "use no memo"
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [viewCoordId, setViewCoordId] = useState<number | null>(null)

  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm] = useState({ nombre: '', codigo: '', ciudad: '', regional: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setState({ status: 'loading' })
    Promise.all([
      api.get<CentroItem[]>('/dashboard/super-admin/centros'),
      api.get<CoordRow[]>('/coordinaciones?incluir_inactivas=1'),
    ])
      .then(([c, co]) => setState({ status: 'ok', centros: c.data, coords: co.data }))
      .catch(() => setState({ status: 'error' }))
  }, [reloadKey])

  function openCrearCentro()             { setForm({ nombre: '', codigo: '', ciudad: '', regional: '' }); setError(null); setModal({ kind: 'crear-centro' }) }
  function openEditarCentro(c: CentroItem) { setForm({ nombre: c.nombre, codigo: c.codigo, ciudad: c.ciudad, regional: c.regional }); setError(null); setModal({ kind: 'editar-centro', centro: c }) }
  function openCrearCoord(c: CentroItem)   { setForm({ ...form, nombre: '' }); setError(null); setModal({ kind: 'crear-coord', centro: c }) }
  function openEditarCoord(co: CoordRow)   { setForm({ ...form, nombre: co.nombre }); setError(null); setModal({ kind: 'editar-coord', coord: co }) }

  async function guardar() {
    if (!form.nombre.trim()) { setError('Escribe un nombre.'); return }
    if ((modal?.kind === 'crear-centro' || modal?.kind === 'editar-centro') && !form.codigo.trim()) {
      setError('El código del centro es obligatorio.'); return
    }
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
      setModal(null); setReloadKey(k => k + 1)
    } catch (e) {
      const msg = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : 'No se pudo guardar.'
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
    } finally {
      setBusy(false)
    }
  }

  async function toggleCoord(coord: CoordRow) {
    setBusy(true)
    try { await api.patch(`/coordinaciones/${coord.id}`, { activa: !coord.activa }); setReloadKey(k => k + 1) }
    catch { /* noop */ } finally { setBusy(false) }
  }
  async function toggleCentro(c: CentroItem) {
    setBusy(true)
    try { await api.patch(`/centros/${c.id}`, { activo: !c.activo }); setReloadKey(k => k + 1) }
    catch { /* noop */ } finally { setBusy(false) }
  }

  // Drill-down: detalle completo de una coordinación académica
  if (viewCoordId !== null) {
    return <CoordinacionDetalle coordId={viewCoordId} onBack={() => setViewCoordId(null)} onDigitalizar={onDigitalizar}/>
  }

  if (state.status === 'loading') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[0, 1, 2, 3].map(i => <Card key={i} style={{ padding: 14 }}><Sk w="70%" h={13} delay={i * 50}/><div style={{ marginTop: 8 }}><Sk w="50%" h={10} delay={i * 50 + 20}/></div></Card>)}
        </div>
        <Card style={{ padding: 24 }}><Sk w="40%" h={16}/><div style={{ marginTop: 16 }}><Sk w="100%" h={40}/></div></Card>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
          <span style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudieron cargar los centros.</span>
        </div>
      </Card>
    )
  }

  const selected  = state.centros.find(c => c.id === selectedId) ?? state.centros[0] ?? null
  const coordsSel = selected ? state.coords.filter(co => co.centro_formacion_id === selected.id) : []
  const esCentroModal = modal?.kind === 'crear-centro' || modal?.kind === 'editar-centro'

  return (
    <div>
      {/* Modal */}
      {modal && (
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
          {modal.kind === 'crear-coord' && (
            <div style={{ fontSize: 12.5, color: '#71717a', marginBottom: 12 }}>
              Centro: <strong style={{ color: '#3f3f46' }}>{modal.centro.nombre}</strong>
            </div>
          )}
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#27272a', marginBottom: 6 }}>Nombre</div>
              <input className="nx-input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder={esCentroModal ? 'ej. CFTAM Cazucá' : 'ej. Coordinación de Teleinformática'} autoFocus
                onKeyDown={e => { if (e.key === 'Enter' && !esCentroModal) guardar() }}/>
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
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Centros y coordinaciones</h2>
          <div style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            {state.centros.length} centros · gestiona las coordinaciones de cada centro. Haz clic en una coordinación para ver su detalle (coordinador, instructores y fichas).
          </div>
        </div>
        <Btn variant="accent" icon="plus" onClick={openCrearCentro}>Nuevo centro</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Lista compacta de centros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.centros.map(c => {
            const active = selected?.id === c.id
            const nCoord = state.coords.filter(co => co.centro_formacion_id === c.id).length
            const digPct = safePct(c.programas_digitalizados, c.programas_total)
            const inactivo = !c.activo
            return (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  textAlign: 'left', width: '100%', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: active ? '1.5px solid #4f46e5' : '1px solid #e4e4e7',
                  background: active ? '#eef2ff' : '#fff', fontFamily: 'Inter, sans-serif',
                  display: 'flex', flexDirection: 'column', gap: 6, transition: 'all 120ms', opacity: inactivo ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#0a0a0b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</span>
                  {inactivo && <Bdg tone="neutral">Inactivo</Bdg>}
                </div>
                <div style={{ fontSize: 11, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>
                  {c.codigo} · {nCoord} coord · {c.fichas_activas} fichas
                </div>
                <div style={{ height: 4, background: '#f1f1f3', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${digPct}%`, background: digColor(digPct), borderRadius: 2 }}/>
                </div>
              </button>
            )
          })}
        </div>

        {/* Detalle del centro seleccionado */}
        {selected && (
          <Card style={{ padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>{selected.nombre}</span>
                  {!selected.activo && <Bdg tone="neutral">Inactivo</Bdg>}
                </div>
                <div style={{ fontSize: 11.5, color: '#71717a', marginTop: 2 }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{selected.codigo}</span> · {selected.ciudad} · Regional {selected.regional}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <Bdg tone={estadoTone(selected.estado)}>{estadoLabel(selected.estado)}</Bdg>
                <button title="Editar centro" onClick={() => openEditarCentro(selected)} style={iconBtn}><Ic n="edit" s={14}/></button>
                <button title={selected.activo ? 'Desactivar centro' : 'Activar centro'} onClick={() => toggleCentro(selected)} disabled={busy}
                  style={{ ...iconBtn, color: selected.activo ? '#b91c1c' : '#15803d' }}>
                  <Ic n={selected.activo ? 'x' : 'check'} s={14}/>
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 14 }}>
              {([
                ['Fichas activas', selected.fichas_activas],
                ['Coordinaciones', coordsSel.length],
              ] as const).map(([l, v]) => (
                <div key={l} style={{ background: '#fafafa', border: '1px solid #f1f1f3', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a' }}>{l}</div>
                  <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 18, fontWeight: 600, color: '#0a0a0b', marginTop: 4 }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Barra de digitalización */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#71717a', marginBottom: 6 }}>
                <span>Digitalización de programas</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontWeight: 700, color: digColor(safePct(selected.programas_digitalizados, selected.programas_total)) }}>
                  {selected.programas_digitalizados}/{selected.programas_total} · {safePct(selected.programas_digitalizados, selected.programas_total)}%
                </span>
              </div>
              <Prog value={safePct(selected.programas_digitalizados, selected.programas_total)} status={digStatus(safePct(selected.programas_digitalizados, selected.programas_total))} height={8}/>
            </div>

            {/* Coordinaciones */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600 }}>
                Coordinaciones académicas
              </div>
              <Btn size="sm" variant="ghost" icon="plus" onClick={() => openCrearCoord(selected)}>Nueva</Btn>
            </div>

            {coordsSel.length === 0 ? (
              <div style={{ fontSize: 12.5, color: '#a1a1aa', padding: '16px 0', textAlign: 'center', border: '1px dashed #e4e4e7', borderRadius: 8 }}>
                Este centro aún no tiene coordinaciones. Crea la primera para abrir fichas y asignar instructores.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {coordsSel.map(co => {
                  const activa = !!co.activa
                  return (
                    <div key={co.id} className="coord-row" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: '1px solid #f1f1f3', background: activa ? '#fff' : '#fafafa' }}>
                      <button
                        onClick={() => setViewCoordId(co.id)}
                        title="Ver detalle de la coordinación"
                        style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: 'Inter, sans-serif' }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: activa ? '#16a34a' : '#a1a1aa', flexShrink: 0 }}/>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: activa ? '#18181b' : '#a1a1aa', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.nombre}</span>
                        {!activa && <Bdg tone="neutral">Inactiva</Bdg>}
                        <Ic n="chevronRight" s={14} style={{ color: '#c4c4cc', flexShrink: 0 }}/>
                      </button>
                      <button title="Editar" onClick={() => openEditarCoord(co)} style={iconBtn}><Ic n="edit" s={13}/></button>
                      <button title={activa ? 'Desactivar' : 'Activar'} onClick={() => toggleCoord(co)} disabled={busy}
                        style={{ ...iconBtn, color: activa ? '#b91c1c' : '#15803d' }}>
                        <Ic n={activa ? 'x' : 'check'} s={13}/>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

const iconBtn = {
  width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none',
  cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#71717a',
} as const
