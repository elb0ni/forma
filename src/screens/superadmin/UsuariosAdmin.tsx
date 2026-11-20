import { useState, useEffect } from 'react'
import type { CSSProperties } from 'react'
import { Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { Ic, Card, Ava, Btn, Pager, Modal } from '../../components/ui'
import { AprendicesSeguimiento } from './AprendicesSeguimiento'
import './UsuariosVista.css'
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
  seguimientos_30d:          number | null
  ultimo_seguimiento:        string | null
  fichas_coordinacion:       number | null   // solo coordinadores: fichas en ejecución de su coordinación
  semaforo:                  'ACTIVO' | 'TIBIO' | 'INACTIVO' | 'NUNCA_ENTRO' | null
}

type ListState =
  | { status: 'loading' }
  | { status: 'ok'; data: UsuarioRow[] }
  | { status: 'error' }

type Grupo = 'instructor' | 'coordinador' | 'admin'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rolGrupo(rol: string): Grupo | 'otro' {
  if (rol === 'INSTRUCTOR')  return 'instructor'
  if (rol === 'SUPER_ADMIN' || rol === 'SUBDIRECTOR') return 'admin'
  if (rol === 'COORD_ACADEMICO') return 'coordinador'
  return 'otro'
}

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN:     'Super Admin',
  SUBDIRECTOR:     'Subdirector',
  COORD_ACADEMICO: 'Coordinador',
  INSTRUCTOR:      'Instructor',
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

function IconBtn({ icon, title, onClick, color = 'var(--fx-tinta-3)' }: {
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
    <div style={{ display: 'flex', gap: 8, background: 'var(--fx-superficie)', border: '1px solid var(--fx-morado-linea)', borderRadius: 6, padding: '8px 10px', alignItems: 'center' }}>
      <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, fontWeight: 600, color: 'var(--fx-tinta)', flex: 1 }}>{value}</code>
      <button
        onClick={() => { try { navigator.clipboard?.writeText(value) } catch { /* noop */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fx-tinta-3)', padding: 4 }}
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

// ─── Lista ───────────────────────────────────────────────────────────────────────
// Tres vistas: instructores (con su actividad real en FORMA), coordinación y
// admins, y aprendices (que no inician sesión pero se siguen igual). Arriba, el
// pulso de la plataforma.

type Vista = 'instructores' | 'equipo' | 'aprendices'
type Semaforo = 'ACTIVO' | 'TIBIO' | 'INACTIVO' | 'NUNCA_ENTRO'

const SEMAFORO: Record<Semaforo, { label: string; color: string; sub: string }> = {
  ACTIVO:      { label: 'Activo',      color: 'var(--fx-ok)', sub: 'Entra y registra seguimientos' },
  TIBIO:       { label: 'Tibio',       color: 'var(--fx-aviso)', sub: 'Entra, pero no registra hace más de 2 semanas' },
  INACTIVO:    { label: 'Inactivo',    color: 'var(--fx-atraso)', sub: 'No entra hace un mes o tiene aprendices sin registros' },
  NUNCA_ENTRO: { label: 'Nunca entró', color: 'var(--fx-tinta-4)', sub: 'Todavía no ha iniciado sesión' },
}

interface Resumen {
  instructores: { total: number; entraron: number; activos_7d: number; con_aprendices: number }
  coordinadores: { total: number; entraron: number; activos_7d: number }
  aprendices_en_practica: number
  seguimientos_30d: number
  sin_firmar: number
  seguimientos_por_semana: { semana: string; n: number }[]
}

interface AvanceInstructor {
  instructor_id: string; aprendices: number; progreso_promedio: number
  planeacion: number; seguimiento: number; evaluacion: number; certificacion: number
}

const PAGE = 15
const num = (x: number) => x.toLocaleString('es-CO')

// "Hoy", "Ayer", "Hace 5 días", "Hace 3 semanas", o la fecha.
function hace(s: string | null): string {
  if (!s) return 'Nunca'
  const d = new Date(s)
  if (isNaN(d.getTime())) return '—'
  const dias = Math.floor((Date.now() - d.getTime()) / 864e5)
  if (dias <= 0) return 'Hoy'
  if (dias === 1) return 'Ayer'
  if (dias < 14) return `Hace ${dias} días`
  if (dias < 60) return `Hace ${Math.floor(dias / 7)} semanas`
  return `${String(d.getDate()).padStart(2, '0')} ${MESES[d.getMonth()]} ${d.getFullYear()}`
}

function AnilloMini({ valor, total, color }: { valor: number; total: number; color: string }) {
  const [listo, setListo] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setListo(true)); return () => cancelAnimationFrame(r) }, [])
  const r = 26, c = 2 * Math.PI * r, p = total ? valor / total : 0
  return (
    <svg width={64} height={64} viewBox="0 0 64 64" className="us-anillo" aria-hidden>
      <circle cx={32} cy={32} r={r} fill="none" stroke="var(--fx-linea)" strokeWidth={7}/>
      <circle cx={32} cy={32} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={listo ? c * (1 - p) : c} transform="rotate(-90 32 32)"/>
      <text x={32} y={36} textAnchor="middle">{Math.round(p * 100)}%</text>
    </svg>
  )
}

function Pulso({ r }: { r: Resumen }) {
  const max = Math.max(1, ...r.seguimientos_por_semana.map(s => s.n))
  return (
    <div className="us-pulso">
      <div className="us-pulso__card" style={{ animationDelay: '0ms' }}>
        <AnilloMini valor={r.instructores.entraron} total={r.instructores.total} color="var(--fx-morado)"/>
        <div>
          <div className="us-pulso__titulo">Instructores que han entrado</div>
          <div className="us-pulso__valor">{num(r.instructores.entraron)} <small>de {num(r.instructores.total)}</small></div>
          <div className="us-pulso__sub">{num(r.instructores.activos_7d)} activos esta semana</div>
        </div>
      </div>
      <div className="us-pulso__card" style={{ animationDelay: '70ms' }}>
        <AnilloMini valor={r.coordinadores.entraron} total={r.coordinadores.total} color="var(--fx-info)"/>
        <div>
          <div className="us-pulso__titulo">Coordinadores que han entrado</div>
          <div className="us-pulso__valor">{num(r.coordinadores.entraron)} <small>de {num(r.coordinadores.total)}</small></div>
          <div className="us-pulso__sub">{num(r.coordinadores.activos_7d)} activos esta semana</div>
        </div>
      </div>
      <div className="us-pulso__card" style={{ animationDelay: '140ms' }}>
        <span className="us-pulso__icono"><Ic n="briefcase" s={20}/></span>
        <div>
          <div className="us-pulso__titulo">Aprendices en práctica</div>
          <div className="us-pulso__valor">{num(r.aprendices_en_practica)}</div>
          <div className="us-pulso__sub">con {num(r.instructores.con_aprendices)} instructores asignados</div>
        </div>
      </div>
      <div className="us-pulso__card" style={{ animationDelay: '210ms' }}>
        <div className="us-spark" aria-hidden>
          {r.seguimientos_por_semana.map(s => <span key={s.semana} style={{ height: `${Math.max(6, (s.n / max) * 100)}%` }} title={`Semana del ${s.semana}: ${s.n}`}/>)}
        </div>
        <div>
          <div className="us-pulso__titulo">Seguimientos · 30 días</div>
          <div className="us-pulso__valor">{num(r.seguimientos_30d)}</div>
          <div className="us-pulso__sub">{r.sin_firmar ? `${num(r.sin_firmar)} realizados sin firmar` : 'Todos firmados'}</div>
        </div>
      </div>
    </div>
  )
}

function UsuariosList() {
  "use no memo"
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const vista = (params.get('vista') as Vista | null) ?? 'instructores'
  const [semaforo, setSemaforo] = useState<Semaforo | ''>('')
  const [search, setSearch] = useState('')
  const [centroFilt, setCentroFilt] = useState('')
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [resumen, setResumen] = useState<Resumen | null>(null)
  // Rendimiento visto desde sus aprendices: avance promedio de su proceso.
  const [avance, setAvance] = useState<Map<string, AvanceInstructor>>(new Map())
  const [page,  setPage]  = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [modal, setModal] = useState<UsuarioModal>(null)
  const [firmaUser, setFirmaUser] = useState<UsuarioRow | null>(null)
  const [busy,  setBusy]  = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    api.get<UsuarioRow[]>('/usuarios')
      .then(r => setState({ status: 'ok', data: r.data }))
      .catch(() => setState({ status: 'error' }))
  }, [reloadKey])
  useEffect(() => {
    api.get<Resumen>('/usuarios/resumen').then(r => setResumen(r.data)).catch(() => setResumen(null))
    api.get<AvanceInstructor[]>('/aprendices/avance-instructores')
      .then(r => setAvance(new Map(r.data.map(x => [x.instructor_id, x]))))
      .catch(() => setAvance(new Map()))
  }, [reloadKey])

  function reload() { setReloadKey(k => k + 1) }
  function irA(v: Vista) { setParams(v === 'instructores' ? {} : { vista: v }); setPage(0); setSearch('') }

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

  const all = state.status === 'ok' ? state.data : []
  const instructores = all.filter(u => u.rol === 'INSTRUCTOR')
  const equipo = all.filter(u => u.rol !== 'INSTRUCTOR')
  const base = vista === 'instructores' ? instructores : equipo
  const centrosDisponibles = [...new Set(base.map(u => u.centro_nombre).filter((c): c is string => !!c))]
    .sort((a, b) => a.localeCompare(b, 'es'))
  const cuentaSem = (s: Semaforo) => instructores.filter(u => isActivo(u) && u.semaforo === s).length

  const q = search.trim().toLowerCase()
  const filtered = base
    .filter(u => vista !== 'instructores' || !semaforo || (isActivo(u) && u.semaforo === semaforo))
    .filter(u => !centroFilt || u.centro_nombre === centroFilt)
    .filter(u => !q
      || u.nombre_completo.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || u.numero_documento.toLowerCase().includes(q)
      || (u.coordinacion_nombre ?? '').toLowerCase().includes(q))
    .sort((a, b) => Number(isActivo(b)) - Number(isActivo(a))
      || (vista === 'instructores' ? (b.etapas_activas ?? 0) - (a.etapas_activas ?? 0) : 0)
      || a.nombre_completo.localeCompare(b.nombre_completo, 'es'))
  const pageCount = Math.ceil(filtered.length / PAGE)
  const curPage   = Math.min(page, Math.max(0, pageCount - 1))
  const pageItems = filtered.slice(curPage * PAGE, (curPage + 1) * PAGE)

  const acciones = (u: UsuarioRow) => (
    <div className="us-acciones" onClick={e => e.stopPropagation()}>
      {u.rol === 'INSTRUCTOR' && avance.has(u.id) &&
        <IconBtn icon="eye" title="Ver sus aprendices" color="var(--fx-morado)" onClick={() => { setParams({ vista: 'aprendices', instructor: u.id }); setPage(0) }}/>}
      {(u.rol === 'INSTRUCTOR' || u.rol === 'COORD_ACADEMICO') &&
        <IconBtn icon="fileText" title="Firma" color="var(--fx-morado)" onClick={() => setFirmaUser(u)}/>}
      <IconBtn icon="edit" title="Editar" onClick={() => navigate(`${u.id}/editar`, { relative: 'path' })}/>
      <IconBtn icon="key" title="Restablecer contraseña" onClick={() => { setActionError(null); setModal({ kind: 'reset', u }) }}/>
      {isActivo(u)
        ? <IconBtn icon="x" title="Desactivar" color="var(--fx-atraso)" onClick={() => { setActionError(null); setModal({ kind: 'desactivar', u }) }}/>
        : <IconBtn icon="check" title="Activar" color="var(--fx-ok)" onClick={() => { setActionError(null); setModal({ kind: 'activar', u }) }}/>}
    </div>
  )

  return (
    <div className="us">
      {firmaUser && (
        <FirmaModal userId={firmaUser.id} nombre={firmaUser.nombre_completo} onClose={() => setFirmaUser(null)}/>
      )}
      {modal?.kind === 'desactivar' && (
        <Modal title="Desactivar usuario" icon="alert" onClose={() => setModal(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</Btn>
            <Btn variant="danger" onClick={() => doDesactivar(modal.u)} disabled={busy}>{busy ? 'Desactivando…' : 'Desactivar'}</Btn>
          </>}>
          <p className="us-modal-txt"><strong>{modal.u.nombre_completo}</strong> ya no podrá iniciar sesión. Puedes reactivarlo después.</p>
          {actionError && <div className="us-modal-err">{actionError}</div>}
        </Modal>
      )}
      {modal?.kind === 'activar' && (
        <Modal title="Activar usuario" icon="checkCircle" onClose={() => setModal(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</Btn>
            <Btn variant="accent" onClick={() => doActivar(modal.u)} disabled={busy}>{busy ? 'Activando…' : 'Activar'}</Btn>
          </>}>
          <p className="us-modal-txt">Se reactivará el acceso de <strong>{modal.u.nombre_completo}</strong>.</p>
          {actionError && <div className="us-modal-err">{actionError}</div>}
        </Modal>
      )}
      {modal?.kind === 'reset' && (
        <Modal title="Restablecer contraseña" icon="key" onClose={() => setModal(null)}
          footer={<>
            <Btn variant="ghost" onClick={() => setModal(null)} disabled={busy}>Cancelar</Btn>
            <Btn variant="accent" onClick={() => doReset(modal.u)} disabled={busy}>{busy ? 'Generando…' : 'Generar contraseña'}</Btn>
          </>}>
          <p className="us-modal-txt">Se generará una contraseña temporal para <strong>{modal.u.nombre_completo}</strong>. Deberá cambiarla en su primer acceso.</p>
          {actionError && <div className="us-modal-err">{actionError}</div>}
        </Modal>
      )}
      {modal?.kind === 'reset-done' && (
        <Modal title="Contraseña temporal generada" icon="checkCircle" onClose={() => setModal(null)}
          footer={<Btn variant="accent" onClick={() => setModal(null)}>Listo</Btn>}>
          <p className="us-modal-txt" style={{ marginBottom: 12 }}>Comparte esta contraseña con <strong>{modal.u.nombre_completo}</strong>. No volverá a mostrarse.</p>
          <CopyField value={modal.password}/>
        </Modal>
      )}

      <header className="us-cab">
        <div>
          <h2>Usuarios</h2>
          <p>Quién usa FORMA, cómo va su trabajo y cómo van los aprendices.</p>
        </div>
        <Btn variant="accent" icon="plus" onClick={() => navigate('nuevo', { relative: 'path' })}>Crear usuario</Btn>
      </header>

      {resumen && <Pulso r={resumen}/>}

      <nav className="us-vistas">
        {([
          ['instructores', 'Instructores', instructores.length, 'user'],
          ['equipo', 'Coordinación y admins', equipo.length, 'shield'],
          ['aprendices', 'Aprendices', null, 'users'],
        ] as const).map(([id, label, cuenta, icon]) => (
          <button key={id} type="button" className={`us-vista${vista === id ? ' us-vista--activa' : ''}`} onClick={() => irA(id)}>
            <Ic n={icon} s={14}/> {label}{cuenta != null && state.status === 'ok' && <span>{cuenta}</span>}
          </button>
        ))}
      </nav>

      {vista === 'aprendices' ? <AprendicesSeguimiento/> : (
        <>
          {vista === 'instructores' && state.status === 'ok' && (
            <div className="us-semaforos">
              {(Object.keys(SEMAFORO) as Semaforo[]).map(s => (
                <button key={s} type="button" title={SEMAFORO[s].sub}
                  className={`us-sem${semaforo === s ? ' us-sem--activo' : ''}`}
                  style={{ '--c': SEMAFORO[s].color } as CSSProperties}
                  onClick={() => { setSemaforo(semaforo === s ? '' : s); setPage(0) }}>
                  <i/> {SEMAFORO[s].label} <b>{cuentaSem(s)}</b>
                </button>
              ))}
            </div>
          )}

          <div className="us-barra">
            <label className="us-buscar">
              <Ic n="search" s={14}/>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Nombre, correo, documento o coordinación"/>
            </label>
            {centrosDisponibles.length > 1 && (
              <select className="us-select" value={centroFilt} onChange={e => { setCentroFilt(e.target.value); setPage(0) }}>
                <option value="">Todos los centros</option>
                {centrosDisponibles.map(c => <option key={c} value={c}>{centroLabel(c)}</option>)}
              </select>
            )}
          </div>

          {state.status === 'loading' && <LoadingBlock/>}
          {state.status === 'error' && <CenterState icon="alert" title="No se pudo cargar la lista de usuarios"/>}
          {state.status === 'ok' && (
            <div className="us-lista">
              {filtered.length === 0 && <div className="us-vacio">Nadie en este filtro.</div>}
              {pageItems.map((u, i) => {
                const activo = isActivo(u)
                if (vista === 'instructores') {
                  const s = SEMAFORO[(u.semaforo ?? 'NUNCA_ENTRO') as Semaforo]
                  return (
                    <div key={u.id} className={`us-fila us-fila--instr${activo ? '' : ' us-fila--off'}`} style={{ animationDelay: `${i * 25}ms` }}
                      onClick={() => navigate(String(u.id), { relative: 'path' })}>
                      <div className="us-fila__quien">
                        <Ava name={u.nombre_completo} size={34}/>
                        <div>
                          <div className="us-fila__nombre">{u.nombre_completo}</div>
                          <div className="us-fila__meta">{u.coordinacion_nombre ? u.coordinacion_nombre.replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '') : (u.centro_nombre ? centroLabel(u.centro_nombre) : u.email)}</div>
                        </div>
                      </div>
                      <div className="us-dato">
                        <b>{num(u.etapas_activas ?? 0)}</b>
                        <span>aprendices{u.fichas_practica ? ` · ${u.fichas_practica} ficha${u.fichas_practica === 1 ? '' : 's'}` : ''}</span>
                      </div>
                      {(() => {
                        const av = avance.get(u.id)
                        return av ? (
                          <div className="us-avance" title={`De ${av.aprendices} aprendices: ${av.planeacion} con planeación, ${av.seguimiento} con seguimiento, ${av.evaluacion} con evaluación, ${av.certificacion} certificados`}>
                            <div className="us-avance__barra"><span style={{ width: `${av.progreso_promedio}%` }}/></div>
                            <span><b>{av.progreso_promedio}%</b> avance de sus aprendices</span>
                          </div>
                        ) : (
                          <div className="us-dato"><b className="us-gris">—</b><span>sin aprendices a cargo</span></div>
                        )
                      })()}
                      <div className="us-dato">
                        <b>{num(u.seguimientos_30d ?? 0)}</b>
                        <span>seguimientos · 30 días</span>
                      </div>
                      <div className="us-dato">
                        <b className={u.ultimo_acceso ? '' : 'us-gris'}>{hace(u.ultimo_acceso)}</b>
                        <span>última conexión</span>
                      </div>
                      {activo
                        ? <span className="us-sem-chip" style={{ '--c': s.color } as CSSProperties} title={s.sub}><i/>{s.label}</span>
                        : <span className="us-sem-chip us-sem-chip--off">Desactivado</span>}
                      {acciones(u)}
                    </div>
                  )
                }
                return (
                  <div key={u.id} className={`us-fila us-fila--equipo${activo ? '' : ' us-fila--off'}`} style={{ animationDelay: `${i * 25}ms` }}>
                    <div className="us-fila__quien">
                      <Ava name={u.nombre_completo} size={34}/>
                      <div>
                        <div className="us-fila__nombre">{u.nombre_completo}</div>
                        <div className="us-fila__meta">{u.email}</div>
                      </div>
                    </div>
                    <span className={`us-rol us-rol--${rolGrupo(u.rol)}`}>{ROL_LABEL[u.rol] ?? u.rol}</span>
                    <div className="us-dato us-dato--texto">
                      <b>{u.coordinacion_nombre ? u.coordinacion_nombre.replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '') : (u.centro_nombre ? centroLabel(u.centro_nombre) : 'Toda la regional')}</b>
                      <span>{u.fichas_coordinacion != null ? `${num(u.fichas_coordinacion)} fichas en ejecución` : (u.centro_nombre ? centroLabel(u.centro_nombre) : '')}</span>
                    </div>
                    <div className="us-dato">
                      <b className={u.ultimo_acceso ? '' : 'us-gris'}>{hace(u.ultimo_acceso)}</b>
                      <span>última conexión</span>
                    </div>
                    {activo
                      ? <span className="us-sem-chip" style={{ '--c': 'var(--fx-ok)' } as CSSProperties}><i/>Activo</span>
                      : <span className="us-sem-chip us-sem-chip--off">Desactivado</span>}
                    {acciones(u)}
                  </div>
                )
              })}
            </div>
          )}
          <Pager page={curPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE} onPage={setPage} noun={vista === 'instructores' ? 'instructores' : 'usuarios'}/>
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
