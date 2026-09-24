import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { Ic, Card, Ava, Btn, Pager, Modal } from '../../components/ui'
import api from '../../lib/api'
import { UsuarioForm } from './UsuarioForm'
import type { UsuarioEdit } from './UsuarioForm'
import { FirmaModal } from '../../components/FirmaModal'
import { InstructorDetalleRoute } from '../shared/InstructorDetalle'
import { LoadingBlock, CenterState, centroLabel } from '../shared/parts'

interface UsuarioRow {
  id:                        string
  nombre_completo:           string
  email:                     string
  tipo_documento:            string
  numero_documento:          string
  rol:                       string
  activo:                    boolean | number
  ultimo_acceso:             string | null
  centro_formacion_id:       number | null
  coordinacion_academica_id: number | null
  centro_nombre:             string | null
  coordinacion_nombre:       string | null
  // Solo instructores (null en el resto): carga de seguimiento a práctica.
  fichas_practica:           number | null   // asignaciones de práctica activas (fichas)
  etapas_activas:            number | null   // aprendices con etapa productiva en ejecución
  seguimientos:              number | null   // seguimientos registrados en total
}

type ListState =
  | { status: 'loading' }
  | { status: 'ok'; data: UsuarioRow[] }
  | { status: 'error' }

type Grupo = 'todos' | 'instructor' | 'coordinador' | 'admin'

const PAGE_SIZE = 10
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Sk({ w, h, r = 5 }: { w: string | number; h: number; r?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r }}/>
}

function rolGrupo(rol: string): Exclude<Grupo, 'todos'> | 'otro' {
  if (rol === 'INSTRUCTOR')  return 'instructor'
  if (rol === 'SUPER_ADMIN') return 'admin'
  if (rol === 'COORD_ACADEMICO' || rol === 'COORD_MISIONAL' || rol === 'SUBDIRECTOR') return 'coordinador'
  return 'otro'
}

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN:     'Super Admin',
  SUBDIRECTOR:     'Subdirector',
  COORD_MISIONAL:  'Coord. Misional',
  COORD_ACADEMICO: 'Coordinador',
  INSTRUCTOR:      'Instructor',
}

function rolBadgeStyle(rol: string) {
  const g = rolGrupo(rol)
  if (g === 'admin')       return { bg: '#0a0a0b', fg: '#ffffff' }
  if (g === 'coordinador') return { bg: '#eef2ff', fg: '#312e81' }
  return { bg: '#f1f1f3', fg: '#27272a' }
}

function fmtDoc(d: string): string {
  return /^\d+$/.test(d) ? Number(d).toLocaleString('es-CO') : d
}

function fmtAcceso(s: string | null): string {
  if (!s) return 'Nunca'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const now = new Date()
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString())  return `Hoy · ${hm}`
  if (d.toDateString() === yest.toDateString()) return `Ayer · ${hm}`
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} · ${hm}`
}

function isActivo(u: UsuarioRow): boolean {
  return u.activo === true || u.activo === 1
}

type UsuarioModal =
  | null
  | { kind: 'desactivar'; u: UsuarioRow }
  | { kind: 'activar';    u: UsuarioRow }
  | { kind: 'reset';      u: UsuarioRow }
  | { kind: 'reset-done'; u: UsuarioRow; password: string }

function IconBtn({ icon, title, onClick, color = '#71717a' }: {
  icon: 'edit' | 'key' | 'x' | 'check' | 'eye' | 'fileText'; title: string; onClick: () => void; color?: string
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: 28, height: 28, borderRadius: 6, background: 'none', border: 'none', cursor: 'pointer', display: 'grid', placeItems: 'center', color }}
    >
      <Ic n={icon} s={13}/>
    </button>
  )
}

function CopyField({ value }: { value: string }) {
  "use no memo"
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ display: 'flex', gap: 8, background: '#fff', border: '1px solid #c7d2fe', borderRadius: 6, padding: '8px 10px', alignItems: 'center' }}>
      <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, fontWeight: 600, color: '#0a0a0b', flex: 1 }}>{value}</code>
      <button
        onClick={() => { try { navigator.clipboard?.writeText(value) } catch { /* noop */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 4 }}
        aria-label="Copiar"
      >
        <Ic n={copied ? 'check' : 'copy'} s={15}/>
      </button>
    </div>
  )
}

function toUsuarioEdit(u: UsuarioRow): UsuarioEdit {
  return {
    id:                        u.id,
    nombre_completo:           u.nombre_completo,
    tipo_documento:            u.tipo_documento,
    numero_documento:          u.numero_documento,
    email:                     u.email,
    rol:                       u.rol,
    activo:                    u.activo,
    centro_formacion_id:       u.centro_formacion_id,
    coordinacion_academica_id: u.coordinacion_academica_id,
  }
}

const THEAD: { label: string; right?: boolean }[] = [
  { label: 'Persona' }, { label: 'Centro · coordinación' }, { label: 'Rol' },
  { label: 'Estado' }, { label: 'Último acceso' }, { label: 'Acciones', right: true },
]
const TH_S = { padding: '10px 16px', fontWeight: 600 }
const TD_S = { padding: '12px 16px' }

// ─── Lista ───────────────────────────────────────────────────────────────────────

function UsuariosList() {
  "use no memo"
  const navigate = useNavigate()
  const [grupo, setGrupo] = useState<Grupo>('todos')
  const [search, setSearch] = useState('')
  const [centroFilt, setCentroFilt] = useState('')
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [page,  setPage]  = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [modal, setModal] = useState<UsuarioModal>(null)
  const [firmaUser, setFirmaUser] = useState<UsuarioRow | null>(null)
  const [busy,  setBusy]  = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<UsuarioRow[]>('/usuarios')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [reloadKey])

  function reload() { setReloadKey(k => k + 1) }

  async function runAction(fn: () => Promise<void>) {
    setBusy(true); setActionError(null)
    try {
      await fn()
    } catch (e) {
      const msg = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : 'No se pudo completar la acción.'
      setActionError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
    } finally {
      setBusy(false)
    }
  }

  async function doDesactivar(u: UsuarioRow) {
    await runAction(async () => {
      await api.delete(`/usuarios/${u.id}`)
      setModal(null); reload()
    })
  }
  async function doActivar(u: UsuarioRow) {
    await runAction(async () => {
      await api.patch(`/usuarios/${u.id}`, { activo: true })
      setModal(null); reload()
    })
  }
  async function doReset(u: UsuarioRow) {
    await runAction(async () => {
      const r = await api.patch<{ password: string }>(`/usuarios/${u.id}/reset-password`, {})
      setModal({ kind: 'reset-done', u, password: r.data.password })
    })
  }

  useEffect(() => { setPage(0) }, [grupo, search, centroFilt])

  const all       = state.status === 'ok' ? state.data : []
  const activos   = all.filter(isActivo).length
  const inactivos = all.length - activos
  const instrConPractica = all.filter(u => (u.fichas_practica ?? 0) > 0).length
  const [corte30d] = useState(() => Date.now() - 30 * 86400000)
  const sinAcceso = all.filter(u => isActivo(u) && (!u.ultimo_acceso || new Date(u.ultimo_acceso).getTime() < corte30d)).length

  const centrosDisponibles = [...new Set(all.map(u => u.centro_nombre).filter((n): n is string => !!n))]
    .sort((a, b) => a.localeCompare(b, 'es'))

  const TABS: { key: Grupo; label: string; count: number }[] = [
    { key: 'todos',       label: 'Todos',         count: all.length },
    { key: 'instructor',  label: 'Instructores',  count: all.filter(u => rolGrupo(u.rol) === 'instructor').length },
    { key: 'coordinador', label: 'Coordinadores', count: all.filter(u => rolGrupo(u.rol) === 'coordinador').length },
    { key: 'admin',       label: 'Admins',        count: all.filter(u => rolGrupo(u.rol) === 'admin').length },
  ]

  const q = search.trim().toLowerCase()
  const filtered = all.filter(u => {
    if (grupo !== 'todos' && rolGrupo(u.rol) !== grupo) return false
    if (centroFilt && u.centro_nombre !== centroFilt) return false
    if (q
      && !u.nombre_completo.toLowerCase().includes(q)
      && !u.email.toLowerCase().includes(q)
      && !u.numero_documento.toLowerCase().includes(q)) return false
    return true
  })
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PAGE_SIZE, (curPage + 1) * PAGE_SIZE)

  const theadRow = (
    <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
      {THEAD.map(h => <th key={h.label} style={{ ...TH_S, textAlign: h.right ? 'right' : 'left' }}>{h.label}</th>)}
    </tr>
  )

  return (
    <div>
      {firmaUser && (
        <FirmaModal userId={firmaUser.id} nombre={firmaUser.nombre_completo} onClose={() => setFirmaUser(null)}/>
      )}
      {/* Modales de acciones */}
      {modal?.kind === 'desactivar' && (
        <Modal title="Desactivar usuario" icon="alert" onClose={() => setModal(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => doDesactivar(modal.u)} disabled={busy}>{busy ? 'Desactivando…' : 'Desactivar'}</Btn>
          </>}>
          <p style={{ fontSize: 13.5, color: '#3f3f46', lineHeight: 1.5 }}>
            <strong>{modal.u.nombre_completo}</strong> ya no podrá iniciar sesión. Puedes reactivarlo después.
          </p>
          {actionError && <div style={{ marginTop: 10, fontSize: 12.5, color: '#b91c1c' }}>{actionError}</div>}
        </Modal>
      )}

      {modal?.kind === 'activar' && (
        <Modal title="Activar usuario" icon="checkCircle" onClose={() => setModal(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</Btn>
            <Btn variant="accent" onClick={() => doActivar(modal.u)} disabled={busy}>{busy ? 'Activando…' : 'Activar'}</Btn>
          </>}>
          <p style={{ fontSize: 13.5, color: '#3f3f46', lineHeight: 1.5 }}>
            Se reactivará el acceso de <strong>{modal.u.nombre_completo}</strong>.
          </p>
          {actionError && <div style={{ marginTop: 10, fontSize: 12.5, color: '#b91c1c' }}>{actionError}</div>}
        </Modal>
      )}

      {modal?.kind === 'reset' && (
        <Modal title="Restablecer contraseña" icon="key" onClose={() => setModal(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</Btn>
            <Btn variant="accent" onClick={() => doReset(modal.u)} disabled={busy}>{busy ? 'Generando…' : 'Generar contraseña'}</Btn>
          </>}>
          <p style={{ fontSize: 13.5, color: '#3f3f46', lineHeight: 1.5 }}>
            Se generará una contraseña temporal para <strong>{modal.u.nombre_completo}</strong>. Deberá cambiarla en su primer acceso.
          </p>
          {actionError && <div style={{ marginTop: 10, fontSize: 12.5, color: '#b91c1c' }}>{actionError}</div>}
        </Modal>
      )}

      {modal?.kind === 'reset-done' && (
        <Modal title="Contraseña temporal generada" icon="checkCircle" onClose={() => setModal(null)}
          footer={<Btn variant="accent" onClick={() => setModal(null)}>Listo</Btn>}>
          <p style={{ fontSize: 13, color: '#52525b', lineHeight: 1.5, marginBottom: 12 }}>
            Comparte esta contraseña con <strong>{modal.u.nombre_completo}</strong>. No volverá a mostrarse.
          </p>
          <CopyField value={modal.password}/>
        </Modal>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Usuarios</h2>
          <div style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            {state.status === 'ok' ? `${activos} activos · ${inactivos} inactivos` : ' '}
          </div>
        </div>
        <Btn variant="accent" icon="plus" onClick={() => navigate('nuevo', { relative: 'path' })}>Crear usuario</Btn>
      </div>

      {/* KPIs */}
      {state.status === 'ok' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 18 }}>
          {([
            ['Activos', activos, '#15803d', 'usuarios que pueden iniciar sesión'],
            ['Inactivos', inactivos, '#71717a', 'sin acceso a la plataforma'],
            ['Instructores con práctica', instrConPractica, '#4f46e5', 'con ficha de seguimiento asignada'],
            ['Sin acceso ≥30 días', sinAcceso, sinAcceso > 0 ? '#c2410c' : '#71717a', 'activos que no entran hace un mes'],
          ] as const).map(([label, value, color, sub]) => (
            <Card key={label} style={{ padding: 13 }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#71717a', fontWeight: 600 }}>{label}</div>
              <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 22, fontWeight: 600, color, marginTop: 5 }}>{value}</div>
              <div style={{ fontSize: 10.5, color: '#a1a1aa', marginTop: 2 }}>{sub}</div>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs por rol + búsqueda + centro */}
      {state.status === 'ok' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', background: '#f1f1f3', borderRadius: 8, padding: 2, border: '1px solid #e4e4e7' }}>
          {TABS.map(t => {
            const active = grupo === t.key
            return (
              <button
                key={t.key}
                onClick={() => setGrupo(t.key)}
                style={{
                  height: 28, padding: '0 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: active ? '#fff' : 'transparent',
                  color: active ? '#0a0a0b' : '#52525b',
                  fontSize: 12.5, fontWeight: 500, fontFamily: 'Inter, sans-serif',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,.05)' : undefined,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                {t.label}
                <span style={{ fontSize: 10.5, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{t.count}</span>
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Ic n="search" s={14} style={{ position: 'absolute', left: 10, color: '#a1a1aa', pointerEvents: 'none' }}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar nombre, correo o documento…"
              style={{ width: 240, maxWidth: '100%', height: 32, padding: '0 10px 0 30px', border: '1px solid #e4e4e7', borderRadius: 8, fontSize: 12.5, color: '#18181b', fontFamily: 'Inter, sans-serif', outline: 'none', background: '#fff' }}
            />
          </div>
          {centrosDisponibles.length > 1 && (
            <select
              value={centroFilt}
              onChange={e => setCentroFilt(e.target.value)}
              style={{ height: 32, padding: '0 10px', borderRadius: 8, fontSize: 12.5, background: '#fff', color: centroFilt ? '#4f46e5' : '#3f3f46', fontFamily: 'Inter, sans-serif', cursor: 'pointer', outline: 'none', border: centroFilt ? '1.5px solid #4f46e5' : '1px solid #e4e4e7' }}
            >
              <option value="">Todos los centros</option>
              {centrosDisponibles.map(c => <option key={c} value={c}>{centroLabel(c)}</option>)}
            </select>
          )}
        </div>
        </div>
      )}

      {state.status === 'loading' && (
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>{theadRow}</thead>
            <tbody>
              {[0, 1, 2, 3, 4].map(i => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f1f3' }}>
                  <td style={TD_S}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Sk w={30} h={30} r={15}/>
                      <Sk w={150} h={12}/>
                    </div>
                  </td>
                  <td style={TD_S}><Sk w={100} h={12}/></td>
                  <td style={TD_S}><Sk w={80} h={18} r={4}/></td>
                  <td style={TD_S}><Sk w={64} h={18} r={4}/></td>
                  <td style={TD_S}><Sk w={90} h={12}/></td>
                  <td style={TD_S}/>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {state.status === 'error' && (
        <Card style={{ padding: 24 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
            <span style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudo cargar la lista de usuarios.</span>
          </div>
        </Card>
      )}

      {state.status === 'ok' && filtered.length === 0 && (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <Ic n="users" s={28} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0b' }}>Sin usuarios</div>
            <div style={{ fontSize: 12.5, color: '#71717a' }}>No hay usuarios en esta categoría.</div>
          </div>
        </Card>
      )}

      {state.status === 'ok' && filtered.length > 0 && (
        <>
        <Card style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>{theadRow}</thead>
            <tbody>
              {pageItems.map(u => {
                const rb           = rolBadgeStyle(u.rol)
                const activo       = isActivo(u)
                const esInstructor = rolGrupo(u.rol) === 'instructor'
                return (
                  <tr
                    key={u.id}
                    className="nx-row"
                    onClick={esInstructor ? () => navigate(String(u.id), { relative: 'path' }) : undefined}
                    style={{ borderBottom: '1px solid #f1f1f3', cursor: esInstructor ? 'pointer' : 'default' }}
                  >
                    <td style={TD_S}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Ava name={u.nombre_completo} size={30}/>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: '#0a0a0b' }}>{u.nombre_completo}</div>
                          <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>
                            {u.email}
                            <span style={{ color: '#c4c4c8' }}> · </span>
                            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fmtDoc(u.numero_documento)}</span>
                          </div>
                          {esInstructor && (u.fichas_practica != null) && (
                            <div style={{ fontSize: 10.5, color: '#a1a1aa', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
                              {u.fichas_practica} ficha{u.fichas_practica === 1 ? '' : 's'} · {u.etapas_activas ?? 0} en curso · {u.seguimientos ?? 0} seguimiento{(u.seguimientos ?? 0) === 1 ? '' : 's'}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={TD_S}>
                      {u.centro_nombre || u.coordinacion_nombre ? (
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, color: '#27272a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                            {u.centro_nombre ? centroLabel(u.centro_nombre) : '—'}
                          </div>
                          {u.coordinacion_nombre && (
                            <div style={{ fontSize: 10.5, color: '#a1a1aa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                              {u.coordinacion_nombre}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: '#c4c4c8' }}>—</span>
                      )}
                    </td>
                    <td style={TD_S}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', height: 20, padding: '0 6px',
                        fontSize: 10.5, fontWeight: 700, borderRadius: 4, background: rb.bg, color: rb.fg,
                        textTransform: 'uppercase', letterSpacing: '0.03em',
                      }}>
                        {ROL_LABEL[u.rol] ?? u.rol}
                      </span>
                    </td>
                    <td style={TD_S}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 7px',
                        fontSize: 10.5, fontWeight: 600, borderRadius: 4, textTransform: 'uppercase',
                        background: activo ? '#dcfce7' : '#f1f1f3', color: activo ? '#15803d' : '#52525b',
                      }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: activo ? '#16a34a' : '#a1a1aa' }}/>
                        {activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#52525b', whiteSpace: 'nowrap' }}>
                      {fmtAcceso(u.ultimo_acceso)}
                    </td>
                    <td style={{ ...TD_S, textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: 4 }}>
                        {esInstructor && <IconBtn icon="eye" title="Ver progreso" color="#4f46e5" onClick={() => navigate(String(u.id), { relative: 'path' })}/>}
                        {(u.rol === 'INSTRUCTOR' || u.rol === 'COORD_ACADEMICO') &&
                          <IconBtn icon="fileText" title="Firma" color="#7c3aed" onClick={() => setFirmaUser(u)}/>}
                        <IconBtn icon="edit" title="Editar" onClick={() => navigate(`${u.id}/editar`, { relative: 'path' })}/>
                        <IconBtn icon="key" title="Restablecer contraseña" onClick={() => { setActionError(null); setModal({ kind: 'reset', u }) }}/>
                        {activo
                          ? <IconBtn icon="x" title="Desactivar" color="#b91c1c" onClick={() => { setActionError(null); setModal({ kind: 'desactivar', u }) }}/>
                          : <IconBtn icon="check" title="Activar" color="#15803d" onClick={() => { setActionError(null); setModal({ kind: 'activar', u }) }}/>
                        }
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
        <Pager
          page={curPage}
          pageCount={pageCount}
          total={filtered.length}
          pageSize={PAGE_SIZE}
          onPage={setPage}
          noun="usuarios"
        />
        </>
      )}
    </div>
  )
}

// ─── Wrappers de ruta ────────────────────────────────────────────────────────────

function UsuarioCrearRoute() {
  "use no memo"
  const navigate = useNavigate()
  return (
    <UsuarioForm
      usuario={null}
      onCancel={() => navigate('..', { relative: 'path' })}
      onSaved={() => navigate('..', { relative: 'path' })}
    />
  )
}

function UsuarioEditarRoute() {
  "use no memo"
  const { usuarioId } = useParams()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState<UsuarioEdit | null | undefined>(undefined)
  const [error, setError] = useState(false)

  useEffect(() => {
    let live = true
    api.get<UsuarioRow>(`/usuarios/${usuarioId}`)
      .then(r => { if (live) setUsuario(toUsuarioEdit(r.data)) })
      .catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [usuarioId])

  if (error) return <Card style={{ padding: 24 }}><CenterState icon="alert" title="No se pudo cargar el usuario"/></Card>
  if (usuario === undefined) return <LoadingBlock/>
  return (
    <UsuarioForm
      usuario={usuario}
      onCancel={() => navigate('../..', { relative: 'path' })}
      onSaved={() => navigate('../..', { relative: 'path' })}
    />
  )
}

export function UsuariosAdmin() {
  "use no memo"
  return (
    <Routes>
      <Route index element={<UsuariosList/>}/>
      <Route path="nuevo" element={<UsuarioCrearRoute/>}/>
      <Route path=":usuarioId/editar" element={<UsuarioEditarRoute/>}/>
      <Route path=":usuarioId/*" element={<InstructorDetalleRoute/>}/>
    </Routes>
  )
}
