import { useState, useEffect } from 'react'
import axios from 'axios'
import { Ic, Card, Ava, Btn, Pager, Modal, Bdg, Prog } from '../../components/ui'
import api from '../../lib/api'
import { UsuarioForm } from './UsuarioForm'
import type { UsuarioEdit } from './UsuarioForm'
import { Pill, Donut, SM, fd } from '../instructor/parts'
import type { StatusTone } from '../instructor/parts'
import { descargarGuiaSesion } from '../instructor/guia'
import { FirmaModal } from '../../components/FirmaModal'

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

type UsuarioView =
  | { mode: 'list' }
  | { mode: 'form'; usuario: UsuarioEdit | null }
  | { mode: 'progreso'; u: UsuarioRow }

type UsuarioModal =
  | null
  | { kind: 'desactivar'; u: UsuarioRow }
  | { kind: 'activar';    u: UsuarioRow }
  | { kind: 'reset';      u: UsuarioRow }
  | { kind: 'reset-done'; u: UsuarioRow; password: string }

function IconBtn({ icon, title, onClick, color = '#71717a' }: {
  icon: 'edit' | 'key' | 'x' | 'check' | 'eye'; title: string; onClick: () => void; color?: string
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
  { label: 'Persona' }, { label: 'Documento' }, { label: 'Rol' },
  { label: 'Estado' }, { label: 'Último acceso' }, { label: 'Acciones', right: true },
]
const TH_S = { padding: '10px 16px', fontWeight: 600 }
const TD_S = { padding: '12px 16px' }

// ─── Monitoreo completo de un instructor (read-only) ────────────────────────────

interface MonRA { id: number; numero: string; descripcion: string; avance: number; status: StatusTone; completado: boolean }
interface MonComp {
  asignacion_id: number; ficha_id: number; numero_ficha: string; programa_codigo: string
  competencia_id: number; codigo_norma: string; nombre: string; tipo: string
  horas_maximas: number; horas_asignadas: number; horas_ejecutadas: number
  avance: number; status: StatusTone; ra_completados: number; ra_total: number
  resultados_aprendizaje: MonRA[]
}
interface MonFicha {
  id: number; numero_ficha: string; estado: string; programa_nombre: string; programa_codigo: string
  jornada: string | null; avance: number; status: StatusTone; dias_restantes: number
  competencias_asignadas: number; competencias_completas: number
}
interface MonSesion {
  id: number; fecha: string; horas_ejecutadas: number; tipo_sesion: string; estado_sesion: string
  numero_ficha: string; competencia_nombre: string; codigo_norma: string
  ras: number; conocimientos: number; criterios: number
}
interface MonitorData {
  instructor: {
    id: string; nombre_completo: string; email: string; numero_documento: string
    activo: boolean; ultimo_acceso: string | null; centro_nombre: string | null; coordinacion_nombre: string | null
  }
  resumen: {
    sesiones_semana: number; horas_semana: number; avance_promedio: number
    ras_cerrados: number; ras_total: number; por_validar: number; competencias_asignadas: number
  }
  fichas: MonFicha[]
  competencias: MonComp[]
  sesiones: MonSesion[]
}

type ProgState =
  | { status: 'loading' }
  | { status: 'ok'; data: MonitorData }
  | { status: 'error' }

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

// Acordeón de competencia: avance + RAs (read-only).
function CompCard({ comp }: { comp: MonComp }) {
  "use no memo"
  const [open, setOpen] = useState(false)
  return (
    <Card style={{ overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
        background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}>
        <Donut value={comp.avance} size={38} stroke={5} color={SM[comp.status].dot}>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600 }}>{comp.avance}</span>
        </Donut>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{comp.codigo_norma}</span>
            <Pill status={comp.status} size="sm"/>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b', lineHeight: 1.35 }}>{comp.nombre}</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 4, fontFamily: '"JetBrains Mono", monospace' }}>
            {comp.ra_completados}/{comp.ra_total} RA · {comp.horas_ejecutadas.toFixed(0)}/{comp.horas_maximas} h
          </div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #f1f1f3' }}>
          {comp.resultados_aprendizaje.length === 0 ? (
            <div style={{ padding: '12px 14px', fontSize: 12, color: '#71717a' }}>Sin resultados de aprendizaje cargados.</div>
          ) : comp.resultados_aprendizaje.map((ra, i) => (
            <div key={ra.id} style={{ padding: '11px 14px', display: 'flex', gap: 12, borderBottom: i < comp.resultados_aprendizaje.length - 1 ? '1px solid #f7f7f8' : 'none' }}>
              <div style={{ width: 26, height: 26, borderRadius: 6, background: '#f7f7f8', border: '1px solid #e4e4e7', display: 'grid', placeItems: 'center', fontSize: 10.5, flexShrink: 0, fontFamily: '"JetBrains Mono", monospace' }}>RA{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{ra.numero}</div>
                    <div style={{ fontSize: 12, color: '#18181b', lineHeight: 1.4, marginTop: 2 }}>{ra.descripcion}</div>
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

export function InstructorDetalle({ id, nombre, email, documento, activo, onBack }: {
  id: string; nombre: string; email: string; documento: string; activo: boolean; onBack: () => void
}) {
  "use no memo"
  const [state, setState] = useState<ProgState>({ status: 'loading' })

  useEffect(() => {
    setState({ status: 'loading' })
    api.get<MonitorData>(`/dashboard/instructor/monitor/${id}`)
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [id])

  const back = (
    <button onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16 }}>
      <Ic n="arrowLeft" s={14}/> Usuarios
    </button>
  )

  const header = (extra?: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
      <Ava name={nombre} size={52}/>
      <div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>{nombre}</h2>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, height: 20, padding: '0 7px',
            fontSize: 10.5, fontWeight: 600, borderRadius: 4, textTransform: 'uppercase',
            background: activo ? '#dcfce7' : '#f1f1f3', color: activo ? '#15803d' : '#52525b',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: activo ? '#16a34a' : '#a1a1aa' }}/>
            {activo ? 'Activo' : 'Inactivo'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#52525b', marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Bdg tone="neutral">Instructor</Bdg>
          <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fmtDoc(documento)}</span>
          <span style={{ color: '#a1a1aa' }}>·</span>
          <span>{email}</span>
          {extra}
        </div>
      </div>
    </div>
  )

  if (state.status === 'loading') return <div>{back}{header()}<Card style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Sk w={220} h={16}/></Card></div>
  if (state.status === 'error') return (
    <div>{back}{header()}
      <Card style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Ic n="alert" s={15} style={{ color: '#b91c1c' }}/>
          <span style={{ fontSize: 13.5, color: '#b91c1c' }}>No se pudo cargar el monitoreo del instructor.</span>
        </div>
      </Card>
    </div>
  )

  const { instructor, resumen, fichas, competencias, sesiones } = state.data
  const ubic = [instructor.centro_nombre, instructor.coordinacion_nombre].filter(Boolean).join(' · ')

  return (
    <div style={{ maxWidth: 1200 }}>
      {back}
      {header(ubic ? <><span style={{ color: '#a1a1aa' }}>·</span><span>{ubic}</span></> : undefined)}

      {/* KPIs de monitoreo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <Card style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          <Donut value={resumen.avance_promedio} size={48} stroke={5} color="#4f46e5">
            <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600 }}>{resumen.avance_promedio}%</span>
          </Donut>
          <div>
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b' }}>Avance promedio</div>
            <div style={{ fontSize: 11.5, color: '#3f3f46', marginTop: 2, fontFamily: '"JetBrains Mono", monospace' }}>
              {fichas.length} ficha{fichas.length === 1 ? '' : 's'} · {resumen.competencias_asignadas} comp.
            </div>
          </div>
        </Card>
        <KpiBox label="Sesiones (semana)" value={String(resumen.sesiones_semana)} sub={`${resumen.horas_semana.toFixed(0)} h registradas`} icon="calendar"/>
        <KpiBox label="RAs cerrados" value={String(resumen.ras_cerrados)} sub={`de ${resumen.ras_total}`} icon="target"/>
        <KpiBox label="Por validar" value={String(resumen.por_validar)} sub="sesiones registradas" icon="clock"/>
      </div>

      {/* Contenido: fichas+competencias | sesiones */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>
            Fichas y competencias asignadas
          </div>
          {competencias.length === 0 ? (
            <Card>
              <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Ic n="briefcase" s={26} style={{ color: '#a1a1aa' }}/>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>Sin asignaciones</div>
                <div style={{ fontSize: 12.5, color: '#71717a' }}>Este instructor aún no tiene competencias asignadas en ninguna ficha.</div>
              </div>
            </Card>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {fichas.map(f => {
                const comps = competencias.filter(c => c.ficha_id === f.id)
                if (comps.length === 0) return null
                return (
                  <div key={f.id}>
                    {/* Banner de ficha */}
                    <Card style={{ padding: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, background: '#fafafa' }}>
                      <Donut value={f.avance} size={42} stroke={5} color={SM[f.status].dot}>
                        <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600 }}>{f.avance}%</span>
                      </Donut>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10.5, color: '#71717a' }}>{f.programa_codigo}</span>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
                          <Pill status={f.status} size="sm"/>
                        </div>
                        <div style={{ fontSize: 12, color: '#3f3f46', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.programa_nombre}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>
                        <div>{f.competencias_completas}/{f.competencias_asignadas} comp.</div>
                        {f.estado === 'EN_EJECUCION' && <div style={{ color: f.dias_restantes < 60 ? '#dc2626' : '#71717a' }}>{f.dias_restantes}d</div>}
                      </div>
                    </Card>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 8 }}>
                      {comps.map(c => <CompCard key={c.asignacion_id} comp={c}/>)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sesiones recientes */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b', marginBottom: 14 }}>Sesiones recientes</div>
          {sesiones.length === 0 ? (
            <Card style={{ padding: 16 }}><div style={{ fontSize: 12, color: '#71717a' }}>Este instructor no ha registrado sesiones.</div></Card>
          ) : (
            <Card>
              {sesiones.map((s, i) => (
                <div key={s.id} style={{ padding: '10px 14px', borderBottom: i < sesiones.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#52525b', alignItems: 'center' }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha)}</span>
                    <span>·</span>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{s.horas_ejecutadas.toFixed(1)} h</span>
                    <span style={{ marginLeft: 'auto' }}>
                      <Bdg tone={s.estado_sesion === 'VALIDADA' ? 'accent' : 'neutral'}>{s.estado_sesion}</Bdg>
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#18181b', marginTop: 4, lineHeight: 1.3 }}>
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#71717a', fontSize: 10.5 }}># {s.numero_ficha}</span> · {s.competencia_nombre}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#52525b', marginTop: 3, fontFamily: '"JetBrains Mono", monospace' }}>
                    {s.ras} RA · {s.conocimientos} con · {s.criterios} crit.
                  </div>
                  <button onClick={() => descargarGuiaSesion(s.id)}
                    style={{ marginTop: 6, fontSize: 11, color: '#4f46e5', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                    <Ic n="download" s={11}/> Guía de aprendizaje
                  </button>
                </div>
              ))}
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

export function UsuariosAdmin() {
  "use no memo"
  const [grupo, setGrupo] = useState<Grupo>('todos')
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [page,  setPage]  = useState(0)
  const [view,  setView]  = useState<UsuarioView>({ mode: 'list' })
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

  useEffect(() => { setPage(0) }, [grupo])

  if (view.mode === 'form') {
    return (
      <UsuarioForm
        usuario={view.usuario}
        onCancel={() => setView({ mode: 'list' })}
        onSaved={() => { setView({ mode: 'list' }); setReloadKey(k => k + 1) }}
      />
    )
  }

  if (view.mode === 'progreso') {
    const u = view.u
    return (
      <InstructorDetalle
        id={u.id}
        nombre={u.nombre_completo}
        email={u.email}
        documento={u.numero_documento}
        activo={isActivo(u)}
        onBack={() => setView({ mode: 'list' })}
      />
    )
  }

  const all       = state.status === 'ok' ? state.data : []
  const activos   = all.filter(isActivo).length
  const inactivos = all.length - activos

  const TABS: { key: Grupo; label: string; count: number }[] = [
    { key: 'todos',       label: 'Todos',         count: all.length },
    { key: 'instructor',  label: 'Instructores',  count: all.filter(u => rolGrupo(u.rol) === 'instructor').length },
    { key: 'coordinador', label: 'Coordinadores', count: all.filter(u => rolGrupo(u.rol) === 'coordinador').length },
    { key: 'admin',       label: 'Admins',        count: all.filter(u => rolGrupo(u.rol) === 'admin').length },
  ]

  const filtered  = grupo === 'todos' ? all : all.filter(u => rolGrupo(u.rol) === grupo)
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b' }}>Usuarios</h2>
          <div style={{ fontSize: 13, color: '#52525b', marginTop: 4 }}>
            {state.status === 'ok' ? `${activos} activos · ${inactivos} inactivos` : ' '}
          </div>
        </div>
        <Btn variant="accent" icon="plus" onClick={() => setView({ mode: 'form', usuario: null })}>Crear usuario</Btn>
      </div>

      {/* Tabs por rol (segmented control) */}
      {state.status === 'ok' && (
        <div style={{ display: 'inline-flex', background: '#f1f1f3', borderRadius: 8, padding: 2, border: '1px solid #e4e4e7', marginBottom: 16 }}>
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
                    onClick={esInstructor ? () => setView({ mode: 'progreso', u }) : undefined}
                    style={{ borderBottom: '1px solid #f1f1f3', cursor: esInstructor ? 'pointer' : 'default' }}
                  >
                    <td style={TD_S}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Ava name={u.nombre_completo} size={30}/>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 500, color: '#0a0a0b' }}>{u.nombre_completo}</div>
                          <div style={{ fontSize: 11, color: '#52525b', marginTop: 2 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', color: '#27272a' }}>
                      {fmtDoc(u.numero_documento)}
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
                        {esInstructor && <IconBtn icon="eye" title="Ver progreso" color="#4f46e5" onClick={() => setView({ mode: 'progreso', u })}/>}
                        {(u.rol === 'INSTRUCTOR' || u.rol === 'COORD_ACADEMICO') &&
                          <IconBtn icon="fileText" title="Firma" color="#7c3aed" onClick={() => setFirmaUser(u)}/>}
                        <IconBtn icon="edit" title="Editar" onClick={() => setView({ mode: 'form', usuario: toUsuarioEdit(u) })}/>
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
