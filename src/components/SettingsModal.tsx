import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal, Btn, Ic, Ava } from './ui'
import type { IcName } from './ui'
import { FirmaPad } from './FirmaModal'
import { useAuthStore } from '../store/auth'
import { getTheme, applyTheme } from '../lib/theme'
import type { Theme } from '../lib/theme'
import api from '../lib/api'
import { soloDigitos } from '../lib/input'

type Tab = 'perfil' | 'firma' | 'apariencia' | 'seguridad'

const ROL_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Administración',
  SUBDIRECTOR: 'Subdirección',
  COORD_ACADEMICO: 'Coordinador',
  INSTRUCTOR: 'Instructor',
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
  "use no memo"
  const user = useAuthStore(s => s.user)!
  const [tab, setTab] = useState<Tab>('perfil')

  const TABS: { key: Tab; label: string; icon: IcName }[] = [
    { key: 'perfil',     label: 'Perfil',     icon: 'user' },
    { key: 'firma',      label: 'Mi firma',   icon: 'edit' },
    { key: 'apariencia', label: 'Apariencia', icon: 'sparkles' },
    { key: 'seguridad',  label: 'Seguridad',  icon: 'lock' },
  ]

  return (
    <Modal title="Ajustes" icon="cog" onClose={onClose} width={620}>
      <div style={{ display: 'flex', gap: 18, minHeight: 320 }}>
        {/* Tabs laterales */}
        <div style={{ flexShrink: 0, width: 150, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TABS.map(t => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
                background: active ? 'var(--fx-morado-suave)' : 'transparent', color: active ? 'var(--fx-morado-tinta)' : 'var(--fx-tinta-2)',
                fontWeight: active ? 600 : 400,
              }}>
                <Ic n={t.icon} s={15} style={{ color: active ? 'var(--fx-morado)' : 'var(--fx-tinta-4)' }}/>
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, minWidth: 0, borderLeft: '1px solid var(--fx-superficie-2)', paddingLeft: 18 }}>
          {tab === 'perfil'     && <PerfilTab user={user}/>}
          {tab === 'firma'      && <FirmaTab/>}
          {tab === 'apariencia' && <AparienciaTab/>}
          {tab === 'seguridad'  && <SeguridadTab/>}
        </div>
      </div>
    </Modal>
  )
}

// ─── Perfil ──────────────────────────────────────────────────────────────────────
// Casi todo es de solo lectura (lo administra super admin). La excepción es el
// teléfono: el GFPI-F-023 lo pide en "Datos del instructor de seguimiento", y
// es un dato de la persona -- se escribe una vez aquí y sale en cada formato,
// en vez de retipearlo por aprendiz.

function PerfilTab({ user }: { user: ReturnType<typeof useAuthStore.getState>['user'] }) {
  const setUser = useAuthStore(s => s.setUser)
  const [tel, setTel] = useState(user?.telefono ?? '')
  const [busy, setBusy] = useState(false)
  const [ok, setOk] = useState(false)

  if (!user) return null

  const rows: [string, string][] = [
    ['Correo', user.email],
    ['Rol', ROL_LABEL[user.rol] ?? user.rol],
    ['Centro', user.centro_formacion || '—'],
    ['Último acceso', user.ultimo_acceso ? new Date(user.ultimo_acceso).toLocaleString('es-CO') : '—'],
  ]

  const cambiado = tel.trim() !== (user.telefono ?? '')

  async function guardar() {
    setBusy(true); setOk(false)
    try {
      await api.patch('/usuarios/me/perfil', { telefono: tel.trim() })
      setUser({ ...user!, telefono: tel.trim() || null })
      setOk(true)
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Ava name={user.nombre_completo} size={44}/>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fx-tinta)' }}>{user.nombre_completo}</div>
          <div style={{ fontSize: 12, color: 'var(--fx-tinta-3)' }}>{ROL_LABEL[user.rol] ?? user.rol}</div>
        </div>
      </div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--fx-superficie-2)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--fx-tinta-2)' }}>{k}</span>
          <span style={{ fontSize: 12.5, color: 'var(--fx-tinta)', fontWeight: 500, textAlign: 'right' }}>{v}</span>
        </div>
      ))}

      <div style={{ padding: '14px 0 0' }}>
        <div style={{ fontSize: 12.5, color: 'var(--fx-tinta-2)', marginBottom: 6 }}>Contacto telefónico</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="nx-input"
            value={tel}
            inputMode="numeric"
            onChange={e => { setTel(soloDigitos(e.target.value)); setOk(false) }}
            placeholder="Para el formato GFPI-F-023"
            style={{ flex: 1 }}
          />
          <Btn size="sm" variant="accent" disabled={!cambiado || busy} onClick={() => void guardar()}>
            {busy ? 'Guardando…' : 'Guardar'}
          </Btn>
        </div>
        <div style={{ fontSize: 11, color: ok ? 'var(--fx-ok)' : 'var(--fx-tinta-4)', marginTop: 6 }}>
          {ok ? 'Guardado.' : 'Aparece en el formato de seguimiento de tus aprendices.'}
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--fx-tinta-4)', marginTop: 14 }}>
        Para cambiar el resto de tus datos, contacta a un administrador.
      </div>
    </div>
  )
}

// ─── Mi firma ────────────────────────────────────────────────────────────────────

function FirmaTab() {
  "use no memo"
  const [firma, setFirma] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    api.get<{ firma: string | null }>('/usuarios/me/firma')
      .then(r => setFirma(r.data.firma))
      .catch(() => setFirma(null))
      .finally(() => setLoading(false))
  }, [])

  async function guardar() {
    setBusy(true); setErr(null); setMsg(null)
    try {
      await api.patch('/usuarios/me/firma', { firma: firma ?? '' })
      setMsg('Firma guardada.')
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar la firma.')
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fx-tinta)', marginBottom: 4 }}>Mi firma</div>
      <div style={{ fontSize: 12, color: 'var(--fx-tinta-2)', marginBottom: 14 }}>
        Aparece en las guías de aprendizaje y reportes que se descargan. Un documento es válido cuando
        lleva la firma del instructor <strong>y</strong> la del coordinador.
      </div>
      {loading
        ? <div style={{ height: 180, display: 'grid', placeItems: 'center', color: 'var(--fx-tinta-4)', fontSize: 13 }}>Cargando…</div>
        : <FirmaPad value={firma} onChange={v => { setFirma(v); setMsg(null) }}/>}
      {err && <div style={{ fontSize: 12, color: 'var(--fx-atraso)', marginTop: 10 }}>{err}</div>}
      {msg && <div style={{ fontSize: 12, color: 'var(--fx-ok)', marginTop: 10 }}>{msg}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <Btn variant="accent" icon="check" onClick={guardar} disabled={busy || loading}>{busy ? 'Guardando…' : 'Guardar firma'}</Btn>
      </div>
    </div>
  )
}

// ─── Apariencia: tema claro / oscuro (preferencia en el navegador) ───────────────

function AparienciaTab() {
  "use no memo"
  const [theme, setTheme] = useState<Theme>(getTheme())

  function elegir(t: Theme) {
    setTheme(t)
    applyTheme(t)
  }

  const OPCIONES: { value: Theme; label: string; icon: IcName; sub: string; bg: string; fg: string; bd: string }[] = [
    { value: 'light', label: 'Claro',  icon: 'sparkles', sub: 'Fondo blanco, alto contraste', bg: 'var(--fx-superficie)', fg: 'var(--fx-tinta)', bd: 'var(--fx-linea)' },
    { value: 'dark',  label: 'Oscuro', icon: 'sparkles', sub: 'Reduce el brillo de noche',    bg: 'var(--fx-tinta)', fg: 'var(--fx-superficie-1)', bd: 'var(--fx-tinta-2)' },
  ]

  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fx-tinta)', marginBottom: 4 }}>Apariencia</div>
      <div style={{ fontSize: 12, color: 'var(--fx-tinta-2)', marginBottom: 16 }}>
        Elige el tema de la interfaz. Tu preferencia se guarda en este navegador.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {OPCIONES.map(o => {
          const active = theme === o.value
          return (
            <button key={o.value} onClick={() => elegir(o.value)} data-keep-color style={{
              textAlign: 'left', padding: 14, borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${active ? 'var(--fx-morado)' : 'var(--fx-linea)'}`,
              background: active ? 'color-mix(in srgb, var(--fx-morado) 4%, transparent)' : 'var(--fx-superficie)',
            }}>
              {/* Mini-preview del tema */}
              <div style={{ height: 56, borderRadius: 8, background: o.bg, border: `1px solid ${o.bd}`, padding: 8, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
                <div style={{ height: 6, width: '55%', borderRadius: 3, background: o.fg, opacity: 0.85 }}/>
                <div style={{ height: 6, width: '80%', borderRadius: 3, background: o.fg, opacity: 0.35 }}/>
                <div style={{ height: 6, width: '40%', borderRadius: 3, background: 'var(--fx-morado)' }}/>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fx-tinta)' }}>{o.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--fx-tinta-3)' }}>{o.sub}</div>
                </div>
                {active && <Ic n="checkCircle" s={18} style={{ color: 'var(--fx-morado)' }}/>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Seguridad: cambiar contraseña ───────────────────────────────────────────────

function SeguridadTab() {
  "use no memo"
  const navigate = useNavigate()
  const clearUser = useAuthStore(s => s.clearUser)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function cambiar() {
    setErr(null)
    if (nueva.length < 8) { setErr('La nueva contraseña debe tener al menos 8 caracteres.'); return }
    if (nueva !== confirm) { setErr('Las contraseñas no coinciden.'); return }
    setBusy(true)
    try {
      await api.post('/auth/change-password', { password_actual: actual, password_nuevo: nueva })
      setOk(true)
      // El backend invalida la sesión: redirigimos al login.
      setTimeout(() => { clearUser(); navigate('/login', { replace: true }) }, 1500)
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo cambiar la contraseña.')
      setBusy(false)
    }
  }

  if (ok) return (
    <div style={{ display: 'grid', placeItems: 'center', height: 260, textAlign: 'center', gap: 10 }}>
      <Ic n="checkCircle" s={28} style={{ color: 'var(--fx-ok)' }}/>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fx-tinta)' }}>Contraseña actualizada</div>
      <div style={{ fontSize: 12.5, color: 'var(--fx-tinta-3)' }}>Por seguridad, vuelve a iniciar sesión…</div>
    </div>
  )

  return (
    <div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--fx-tinta)', marginBottom: 4 }}>Cambiar contraseña</div>
      <div style={{ fontSize: 12, color: 'var(--fx-tinta-2)', marginBottom: 16 }}>
        Al cambiarla, se cerrará tu sesión y deberás iniciar de nuevo.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo label="Contraseña actual" value={actual} onChange={setActual}/>
        <Campo label="Nueva contraseña (mín. 8)" value={nueva} onChange={setNueva}/>
        <Campo label="Confirmar nueva contraseña" value={confirm} onChange={setConfirm}/>
      </div>
      {err && <div style={{ fontSize: 12, color: 'var(--fx-atraso)', marginTop: 12 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Btn variant="accent" icon="lock" onClick={cambiar} disabled={busy || !actual || !nueva || !confirm}>
          {busy ? 'Cambiando…' : 'Cambiar contraseña'}
        </Btn>
      </div>
    </div>
  )
}

function Campo({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label style={{ display: 'block' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--fx-tinta)', marginBottom: 5 }}>{label}</div>
      <input type="password" className="nx-input" value={value} onChange={e => onChange(e.target.value)} autoComplete="off"/>
    </label>
  )
}
