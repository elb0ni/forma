import { useState, useEffect, Fragment } from 'react'
import type { ReactNode } from 'react'
import axios from 'axios'
import { Ic, Card, Btn } from '../../components/ui'
import api from '../../lib/api'

type Rol = 'INSTRUCTOR' | 'COORD_ACADEMICO' | 'SUPER_ADMIN'

export interface UsuarioEdit {
  id:                        string
  nombre_completo:           string
  tipo_documento:            string
  numero_documento:          string
  email:                     string
  rol:                       string
  activo:                    boolean | number
  centro_formacion_id:       number | null
  coordinacion_academica_id: number | null
}

interface CentroOpt { id: number; nombre: string; codigo: string }
interface CoordOpt  { id: number; nombre: string; centro_formacion_id: number | null }

const ROL_OPCIONES: { value: Rol; label: string; icon: 'user' | 'target' | 'shield' }[] = [
  { value: 'INSTRUCTOR',      label: 'Instructor',  icon: 'user'   },
  { value: 'COORD_ACADEMICO', label: 'Coordinador', icon: 'target' },
  { value: 'SUPER_ADMIN',     label: 'Admin',       icon: 'shield' },
]

const TIPO_DOC = ['CC', 'CE', 'TI', 'PP']

function needsCoordinacion(rol: string): boolean {
  return rol === 'INSTRUCTOR' || rol === 'COORD_ACADEMICO'
}

function genPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < 7; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return `Fx-${s}!`
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

// ─── Primitivos de formulario ───────────────────────────────────────────────────

function Field({ label, hint, required, full, children }: {
  label: string; hint?: string; required?: boolean; full?: boolean; children: ReactNode
}) {
  return (
    <div style={full ? { gridColumn: '1 / -1' } : undefined}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#27272a' }}>
          {label}{required && <span style={{ color: '#b91c1c' }}> *</span>}
        </span>
        {hint && <span style={{ fontSize: 11, color: '#71717a' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Seg({ name, value, onChange, options }: {
  name: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string; icon?: 'user' | 'target' | 'shield' }[]
}) {
  return (
    <div className="seg" style={{ display: 'inline-flex', padding: 2, background: '#f1f1f3', borderRadius: 8, border: '1px solid #e4e4e7' }}>
      {options.map(o => (
        <Fragment key={o.value}>
          <input type="radio" name={name} id={`${name}-${o.value}`} checked={value === o.value} onChange={() => onChange(o.value)}/>
          <label htmlFor={`${name}-${o.value}`}>{o.icon && <Ic n={o.icon} s={12}/>} {o.label}</label>
        </Fragment>
      ))}
    </div>
  )
}

// ─── Pantalla ───────────────────────────────────────────────────────────────────

export function UsuarioForm({ usuario, onCancel, onSaved }: {
  usuario: UsuarioEdit | null; onCancel: () => void; onSaved: () => void
}) {
  "use no memo"
  const editando = usuario !== null

  const [centros, setCentros] = useState<CentroOpt[]>([])
  const [coords,  setCoords]  = useState<CoordOpt[]>([])

  const [nombre,    setNombre]    = useState(usuario?.nombre_completo ?? '')
  const [tipoDoc,   setTipoDoc]   = useState(usuario?.tipo_documento ?? 'CC')
  const [numeroDoc, setNumeroDoc] = useState(usuario?.numero_documento ?? '')
  const [email,     setEmail]     = useState(usuario?.email ?? '')
  const [rol,       setRol]       = useState<Rol>((usuario?.rol as Rol) ?? 'INSTRUCTOR')
  const [centroId,  setCentroId]  = useState<number | null>(usuario?.centro_formacion_id ?? null)
  const [coordId,   setCoordId]   = useState<number | null>(usuario?.coordinacion_academica_id ?? null)
  const [activo,    setActivo]    = useState<boolean>(usuario ? !!usuario.activo : true)

  const [password] = useState(genPassword)
  const [copied, setCopied] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    api.get<CentroOpt[]>('/dashboard/super-admin/centros').then(r => setCentros(r.data)).catch(() => {})
    api.get<CoordOpt[]>('/coordinaciones').then(r => setCoords(r.data)).catch(() => {})
  }, [])

  const requiereCoord = needsCoordinacion(rol)

  // Si las coordinaciones tienen centro, las filtramos por el centro elegido.
  const coordsVisibles = (centroId != null && coords.some(c => c.centro_formacion_id != null))
    ? coords.filter(c => c.centro_formacion_id === centroId)
    : coords

  async function handleSave() {
    setError(null)
    if (!nombre.trim() || !numeroDoc.trim() || !email.trim()) {
      setError('Completa nombre, documento y correo.')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('El correo no tiene un formato válido.')
      return
    }
    if (requiereCoord && (centroId == null || coordId == null)) {
      setError('Los instructores y coordinadores deben tener centro y coordinación académica.')
      return
    }
    setSaving(true)
    try {
      if (editando) {
        await api.patch(`/usuarios/${usuario!.id}`, {
          nombre_completo:           nombre.trim(),
          email:                     email.trim(),
          rol,
          centro_formacion_id:       centroId ?? undefined,
          coordinacion_academica_id: requiereCoord ? coordId! : undefined,
          activo,
        })
      } else {
        await api.post('/usuarios', {
          nombre_completo:           nombre.trim(),
          tipo_documento:            tipoDoc,
          numero_documento:          numeroDoc.trim(),
          email:                     email.trim(),
          password,
          rol,
          centro_formacion_id:       centroId ?? undefined,
          coordinacion_academica_id: requiereCoord ? coordId! : undefined,
        })
      }
      onSaved()
    } catch (e) {
      const msg = axios.isAxiosError(e) ? (e.response?.data?.message ?? e.message) : 'No se pudo guardar el usuario.'
      setError(Array.isArray(msg) ? msg.join(' · ') : String(msg))
      setSaving(false)
    }
  }

  const permisos: [string, boolean][] = [
    ['Registrar sesiones propias', true],
    ['Ver fichas asignadas', true],
    ['Validar correlaciones IA', rol !== 'INSTRUCTOR'],
    ['Ver todas las fichas', rol === 'COORD_ACADEMICO' || rol === 'SUPER_ADMIN'],
    ['Cargar programas', rol === 'SUPER_ADMIN'],
    ['Gestionar usuarios', rol === 'SUPER_ADMIN'],
  ]

  return (
    <div style={{ maxWidth: 960, paddingBottom: 48 }}>
      <button
        onClick={onCancel}
        style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center' }}
      >
        <Ic n="arrowLeft" s={14}/>Usuarios
      </button>

      <h2 style={{ fontSize: 22, fontWeight: 600, color: '#0a0a0b', marginBottom: 4 }}>
        {editando ? 'Editar usuario' : 'Crear usuario'}
      </h2>
      <div style={{ fontSize: 13, color: '#52525b', marginBottom: 24 }}>
        {editando ? 'Actualiza los datos y la asignación del usuario.' : 'Se generará una contraseña temporal.'}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Columna principal */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 24 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 16 }}>
              Información personal
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Nombre completo" required full>
                <input className="nx-input" placeholder="ej. María Camila Restrepo Vélez" value={nombre} onChange={e => setNombre(e.target.value)}/>
              </Field>
              <Field label="Documento" required hint={editando ? 'no editable' : undefined}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="nx-input" value={tipoDoc} onChange={e => setTipoDoc(e.target.value)} disabled={editando} style={{ width: 80 }}>
                    {TIPO_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input className="nx-input" placeholder="1018452901" value={numeroDoc} onChange={e => setNumeroDoc(e.target.value)} disabled={editando} style={{ fontFamily: '"JetBrains Mono", monospace' }}/>
                </div>
              </Field>
              <Field label="Correo institucional" required>
                <input className="nx-input" type="email" placeholder="usuario@sena.edu.co" value={email} onChange={e => setEmail(e.target.value)}/>
              </Field>
            </div>

            <div style={{ borderTop: '1px solid #e4e4e7', marginTop: 20, paddingTop: 20 }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 16 }}>
                Asignación
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <Field label="Rol" required>
                  <Seg name="rol" value={rol} onChange={v => setRol(v as Rol)} options={ROL_OPCIONES}/>
                </Field>
                <Field label="Centro" required={requiereCoord}>
                  <select className="nx-input" value={centroId ?? ''} onChange={e => { setCentroId(e.target.value ? Number(e.target.value) : null); setCoordId(null) }}>
                    <option value="">Sin centro</option>
                    {centros.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
                  </select>
                </Field>
                {requiereCoord && (
                  <Field label="Coordinación académica" required full hint="obligatoria para instructores y coordinadores">
                    <select className="nx-input" value={coordId ?? ''} onChange={e => setCoordId(e.target.value ? Number(e.target.value) : null)} disabled={centroId == null}>
                      <option value="">{centroId == null ? 'Elige un centro primero…' : 'Selecciona una coordinación…'}</option>
                      {coordsVisibles.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </Field>
                )}
                {editando && (
                  <Field label="Estado">
                    <Seg
                      name="activo"
                      value={activo ? 'activo' : 'inactivo'}
                      onChange={v => setActivo(v === 'activo')}
                      options={[{ value: 'activo', label: 'Activo' }, { value: 'inactivo', label: 'Inactivo' }]}
                    />
                  </Field>
                )}
              </div>
            </div>
          </Card>

          {error && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8 }}>
              <Ic n="alert" s={15} style={{ color: '#b91c1c', flexShrink: 0 }}/>
              <span style={{ fontSize: 12.5, color: '#b91c1c' }}>{error}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Btn variant="ghost" onClick={onCancel} disabled={saving}>Cancelar</Btn>
            <Btn variant="accent" icon={editando ? 'check' : 'plus'} onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear usuario'}
            </Btn>
          </div>
        </div>

        {/* Columna lateral */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!editando && (
            <Card style={{ padding: 20, background: 'rgba(238,242,255,.7)', border: '1px solid #c7d2fe' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <Ic n="key" s={15} style={{ color: '#312e81' }}/>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#312e81' }}>Contraseña temporal</div>
              </div>
              <div style={{ fontSize: 11.5, color: '#312e81', opacity: 0.8, marginBottom: 10 }}>
                El usuario debe cambiarla en su primer acceso.
              </div>
              <div style={{ display: 'flex', gap: 8, background: '#fff', border: '1px solid #c7d2fe', borderRadius: 6, padding: '6px 10px', alignItems: 'center' }}>
                <code style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 14, fontWeight: 600, color: '#0a0a0b', flex: 1 }}>{password}</code>
                <button
                  onClick={() => { try { navigator.clipboard?.writeText(password) } catch { /* noop */ } setCopied(true); setTimeout(() => setCopied(false), 1500) }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717a', padding: 4 }}
                >
                  <Ic n={copied ? 'check' : 'copy'} s={14}/>
                </button>
              </div>
            </Card>
          )}

          <Card style={{ padding: 20 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71717a', fontWeight: 600, marginBottom: 12 }}>
              Permisos del rol
            </div>
            {permisos.map(([l, on]) => (
              <div key={l} style={{ display: 'flex', gap: 8, marginBottom: 8, fontSize: 12.5, color: on ? '#18181b' : '#71717a' }}>
                <Ic n={on ? 'check' : 'x'} s={13} style={{ color: on ? '#15803d' : '#a1a1aa', flexShrink: 0, marginTop: 1 }}/>
                {l}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  )
}
