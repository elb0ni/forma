import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Ic, Card, Bdg, Btn } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { FirmaPad } from '../../components/FirmaModal'
import api from '../../lib/api'
import type { EstadoCalculado, FactorItem, ValorFactor } from './types'
import { ESTADO_META } from './types'

// ─── Estado global del registro (para la lista y el encabezado de detalle) ──────

export function EstadoBdg({ estado }: { estado: EstadoCalculado }) {
  const m = ESTADO_META[estado]
  return <Bdg tone={m.tone}>{m.label}</Bdg>
}

// ─── Field (label + control) ────────────────────────────────────────────────────

export function Field({ label, hint, required, children, style }: {
  label: string; hint?: string; required?: boolean; children: ReactNode; style?: CSSProperties
}) {
  return (
    <div style={style}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: '#27272a' }}>{label}{required && <span style={{ color: '#b91c1c' }}> *</span>}</span>
        {hint && <span style={{ fontSize: 11, color: '#71717a' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── Encabezado de sección (título + descripción, igual al resto de la app) ─────

export function SectionIntro({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
      {sub && <div style={{ fontSize: 12.5, color: '#52525b', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Toggle compacto Satisfactorio / Por mejorar ────────────────────────────────

export function ValoracionToggle({ value, onChange, disabled }: {
  value: ValorFactor | null; onChange?: (v: ValorFactor | null) => void; disabled?: boolean
}) {
  const BtnV = ({ v, label, active, bg, fg, line }: { v: ValorFactor; label: string; active: boolean; bg: string; fg: string; line: string }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(active ? null : v)}
      style={{
        flex: 1, height: 28, fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: disabled ? 'default' : 'pointer',
        border: `1px solid ${active ? line : '#e4e4e7'}`, background: active ? bg : '#fff', color: active ? fg : '#71717a',
        fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '0 8px',
      }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ display: 'flex', gap: 6, minWidth: 190 }}>
      <BtnV v="SATISFACTORIO" label="Satisfactorio" active={value === 'SATISFACTORIO'} bg="#dcfce7" fg="#15803d" line="#86efac"/>
      <BtnV v="POR_MEJORAR"   label="Por mejorar"    active={value === 'POR_MEJORAR'}   bg="#fef9c3" fg="#a16207" line="#fde68a"/>
    </div>
  )
}

// ─── Bloque de factores técnicos / actitudinales (tabla del formato) ────────────

export function FactoresBlock({ titulo, items, onChange, readOnly }: {
  titulo: string
  items: FactorItem[]
  onChange?: (next: FactorItem[]) => void
  readOnly?: boolean
}) {
  function setValor(i: number, v: ValorFactor | null) {
    if (!onChange) return
    onChange(items.map((f, idx) => idx === i ? { ...f, valor: v } : f))
  }
  function setObs(i: number, obs: string) {
    if (!onChange) return
    onChange(items.map((f, idx) => idx === i ? { ...f, observacion: obs } : f))
  }
  const completos = items.filter(f => f.valor !== null).length

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f1f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b' }}>{titulo}</div>
        <span style={{ fontSize: 11, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{completos}/{items.length}</span>
      </div>
      {items.map((f, i) => (
        <div key={f.variable} style={{
          display: 'grid', gridTemplateColumns: '1.3fr 200px 1.6fr', gap: 14, alignItems: 'start',
          padding: '12px 16px', borderBottom: i < items.length - 1 ? '1px solid #f7f7f8' : 'none',
        }}>
          <div style={{ fontSize: 12.5, color: '#18181b', paddingTop: 4 }}>{f.label}</div>
          {readOnly ? (
            f.valor ? (
              <span style={{ alignSelf: 'start' }}>
                <Bdg tone={f.valor === 'SATISFACTORIO' ? 'ok' : 'warn'}>
                  {f.valor === 'SATISFACTORIO' ? 'Satisfactorio' : 'Por mejorar'}
                </Bdg>
              </span>
            ) : <span style={{ fontSize: 11.5, color: '#a1a1aa' }}>Sin valorar</span>
          ) : (
            <ValoracionToggle value={f.valor} onChange={v => setValor(i, v)}/>
          )}
          {readOnly ? (
            <div style={{ fontSize: 12, color: f.observacion ? '#27272a' : '#a1a1aa' }}>{f.observacion || '—'}</div>
          ) : (
            <input className="nx-input" placeholder="Observaciones / compromisos de mejora" value={f.observacion}
              onChange={e => setObs(i, e.target.value)} style={{ padding: '6px 10px', fontSize: 12.5 }}/>
          )}
        </div>
      ))}
    </Card>
  )
}

// ─── Fila meta (label / valor) reutilizada en varias tarjetas de resumen ───────

export function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f1f1f3', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#52525b', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12.5, color: '#18181b', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  )
}

// ─── Icono + texto para vacíos dentro de una tarjeta (más chico que CenterState) ─

export function EmptyHint({ icon, text }: { icon: IcName; text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '28px 16px', textAlign: 'center' }}>
      <Ic n={icon} s={20} style={{ color: '#c4c4c8' }}/>
      <span style={{ fontSize: 12.5, color: '#71717a', maxWidth: 320 }}>{text}</span>
    </div>
  )
}

// ─── Firma real (captura + subida) de un momento de seguimiento ────────────────

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(',')
  const mime = /data:(.*);base64/.exec(meta)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

export type Firmante = 'instructor' | 'jefe' | 'aprendiz'

// Sube una firma ya dibujada (data URL) contra un momento que YA existe --
// usado tanto por FirmaSlot (firmar un momento existente) como por
// FirmasCaptura (firmar en el mismo formulario, justo después de crearlo).
export async function subirFirma(seguimientoId: number, firmante: Firmante, dataUrl: string): Promise<void> {
  const fd = new FormData()
  fd.append('firma', dataUrlToFile(dataUrl, `${firmante}.png`))
  await api.post(`/seguimientos-productivos/${seguimientoId}/firma?firmante=${firmante}`, fd)
}

function FirmaSlot({ seguimientoId, firmante, label, rutaActual, onUploaded }: {
  seguimientoId: number; firmante: Firmante; label: string; rutaActual: string | null; onUploaded: () => void
}) {
  "use no memo"
  const [abierto, setAbierto] = useState(false)
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function guardar() {
    if (!dataUrl) { setErr('Dibuja o sube la firma antes de guardar.'); return }
    setBusy(true); setErr(null)
    try {
      await subirFirma(seguimientoId, firmante, dataUrl)
      setAbierto(false); setDataUrl(null); onUploaded()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar la firma.')
    } finally { setBusy(false) }
  }

  if (rutaActual && !abierto) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Ic n="checkCircle" s={14} style={{ color: '#15803d' }}/>
        <span style={{ fontSize: 12, color: '#3f3f46' }}>{label}</span>
        <button onClick={() => setAbierto(true)} style={{ fontSize: 11, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>Volver a firmar</button>
      </div>
    )
  }

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>
        <Ic n="clock" s={14} style={{ color: '#a1a1aa' }}/>
        <span style={{ fontSize: 12, color: '#3f3f46' }}>{label}</span>
        <span style={{ fontSize: 11, color: '#4f46e5' }}>Firmar</span>
      </button>
    )
  }

  return (
    <div style={{ border: '1px solid #c7d2fe', borderRadius: 8, padding: 12, minWidth: 320 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#27272a', marginBottom: 8 }}>{label}</div>
      <FirmaPad value={dataUrl} onChange={setDataUrl}/>
      {err && <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Btn variant="ghost" size="sm" onClick={() => { setAbierto(false); setDataUrl(null); setErr(null) }} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={guardar} disabled={busy}>{busy ? 'Guardando…' : 'Guardar firma'}</Btn>
      </div>
    </div>
  )
}

// ─── Captura de firmas dentro del propio formulario (antes de crear el momento) ─
// A diferencia de FirmasYUbicacion (que sube contra un id de seguimiento que ya
// existe), este bloque solo dibuja y guarda en memoria -- el formulario que lo usa
// sube cada firma (vía subirFirma) justo después de crear el registro y conocer su id.

export interface FirmasEstado { instructor: string | null; aprendiz: string | null; jefe: string | null }

export function firmasVacias(): FirmasEstado {
  return { instructor: null, aprendiz: null, jefe: null }
}

export function firmasCompletas(f: FirmasEstado, requiereJefe: boolean): boolean {
  return !!f.instructor && !!f.aprendiz && (!requiereJefe || !!f.jefe)
}

export function FirmasCaptura({ requiereJefe, value, onChange }: {
  requiereJefe: boolean
  value: FirmasEstado
  onChange: (next: FirmasEstado) => void
}) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 12 }}>
        Firmas
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <FirmaCampo label="Instructor de seguimiento" value={value.instructor} onChange={v => onChange({ ...value, instructor: v })}/>
        <FirmaCampo label="Aprendiz" value={value.aprendiz} onChange={v => onChange({ ...value, aprendiz: v })}/>
        {requiereJefe && (
          <FirmaCampo label="Ente co-formador" value={value.jefe} onChange={v => onChange({ ...value, jefe: v })}/>
        )}
      </div>
    </Card>
  )
}

function FirmaCampo({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Ic n={value ? 'checkCircle' : 'clock'} s={13} style={{ color: value ? '#15803d' : '#a1a1aa' }}/>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#27272a' }}>{label}</span>
      </div>
      <FirmaPad value={value} onChange={onChange}/>
    </div>
  )
}

// ─── Ubicación (geolocalización del navegador) al momento de firmar ────────────

function UbicacionSlot({ seguimientoId, lat, lng, precision, distancia, alerta, onCaptured }: {
  seguimientoId: number
  lat: number | null; lng: number | null; precision: number | null
  distancia: number | null; alerta: boolean
  onCaptured: () => void
}) {
  "use no memo"
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  function capturar() {
    if (!navigator.geolocation) { setErr('Este navegador no soporta geolocalización.'); return }
    setBusy(true); setErr(null)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          await api.post(`/seguimientos-productivos/${seguimientoId}/ubicacion`, {
            lat: pos.coords.latitude, lng: pos.coords.longitude, precision_m: Math.round(pos.coords.accuracy),
          })
          onCaptured()
        } catch (e: any) {
          setErr(e?.response?.data?.message ?? 'No se pudo guardar la ubicación.')
        } finally { setBusy(false) }
      },
      () => { setErr('No se pudo obtener la ubicación (permiso denegado o sin señal).'); setBusy(false) },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  if (lat != null && lng != null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#3f3f46' }}>
          <Ic n="pin" s={14} style={{ color: '#15803d' }}/>
          Ubicación capturada · precisión ±{precision ?? '—'} m
        </div>
        {distancia != null && (
          <div style={{ fontSize: 11.5, color: alerta ? '#b91c1c' : '#71717a', marginLeft: 22 }}>
            {distancia} m de la empresa {alerta && '· fuera del rango esperado'}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <button onClick={capturar} disabled={busy} style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', padding: 0,
      }}>
        <Ic n="pin" s={14} style={{ color: '#a1a1aa' }}/>
        <span style={{ fontSize: 12, color: '#3f3f46' }}>{busy ? 'Obteniendo ubicación…' : 'Capturar ubicación'}</span>
      </button>
      {err && <div style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 6 }}>{err}</div>}
    </div>
  )
}

// ─── Bloque combinado: firmas + ubicación de un momento ya creado ─────────────

export function FirmasYUbicacion({ seguimiento, requiereJefe, onChanged }: {
  seguimiento: {
    id: number
    firma_instructor_ruta: string | null; firma_aprendiz_ruta: string | null; firma_jefe_ruta: string | null
    ubicacion_lat: number | null; ubicacion_lng: number | null; ubicacion_precision_m: number | null
    distancia_empresa_m: number | null; ubicacion_alerta: boolean; firmado_at: string | null
  }
  requiereJefe: boolean
  onChanged: () => void
}) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>
        Firmas y ubicación {seguimiento.firmado_at && <span style={{ color: '#15803d' }}>· completas</span>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <FirmaSlot seguimientoId={seguimiento.id} firmante="instructor" label="Instructor de seguimiento" rutaActual={seguimiento.firma_instructor_ruta} onUploaded={onChanged}/>
        <FirmaSlot seguimientoId={seguimiento.id} firmante="aprendiz" label="Aprendiz" rutaActual={seguimiento.firma_aprendiz_ruta} onUploaded={onChanged}/>
        {requiereJefe && (
          <FirmaSlot seguimientoId={seguimiento.id} firmante="jefe" label="Ente co-formador" rutaActual={seguimiento.firma_jefe_ruta} onUploaded={onChanged}/>
        )}
        <div style={{ borderTop: '1px solid #f1f1f3', paddingTop: 10, marginTop: 4 }}>
          <UbicacionSlot
            seguimientoId={seguimiento.id}
            lat={seguimiento.ubicacion_lat} lng={seguimiento.ubicacion_lng} precision={seguimiento.ubicacion_precision_m}
            distancia={seguimiento.distancia_empresa_m} alerta={seguimiento.ubicacion_alerta}
            onCaptured={onChanged}
          />
        </div>
      </div>
    </Card>
  )
}
