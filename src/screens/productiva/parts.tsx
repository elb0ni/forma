import type { CSSProperties, ReactNode } from 'react'
import { Ic, Card, Bdg } from '../../components/ui'
import type { IcName } from '../../components/ui'
import type { EstadoEtapaProductiva, FactorItem, Valoracion } from './types'

// ─── Estado global del registro (para la lista y el encabezado de detalle) ──────

export const ESTADO_META: Record<EstadoEtapaProductiva, { label: string; tone: 'warn' | 'accent' | 'ok' | 'err' }> = {
  PLANEACION_PENDIENTE: { label: 'Planeación pendiente', tone: 'warn' },
  EN_SEGUIMIENTO:        { label: 'En seguimiento',       tone: 'accent' },
  APROBADO:              { label: 'Aprobado',             tone: 'ok' },
  NO_APROBADO:           { label: 'No aprobado',          tone: 'err' },
}

export function EstadoBdg({ estado }: { estado: EstadoEtapaProductiva }) {
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
  value: Valoracion; onChange?: (v: Valoracion) => void; disabled?: boolean
}) {
  const Btn = ({ v, label, active, bg, fg, line }: { v: Exclude<Valoracion, null>; label: string; active: boolean; bg: string; fg: string; line: string }) => (
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
      <Btn v="SATISFACTORIO" label="Satisfactorio" active={value === 'SATISFACTORIO'} bg="#dcfce7" fg="#15803d" line="#86efac"/>
      <Btn v="POR_MEJORAR"   label="Por mejorar"    active={value === 'POR_MEJORAR'}   bg="#fef9c3" fg="#a16207" line="#fde68a"/>
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
  function setValoracion(i: number, v: Valoracion) {
    if (!onChange) return
    onChange(items.map((f, idx) => idx === i ? { ...f, valoracion: v } : f))
  }
  function setObs(i: number, obs: string) {
    if (!onChange) return
    onChange(items.map((f, idx) => idx === i ? { ...f, observaciones: obs } : f))
  }
  const completos = items.filter(f => f.valoracion !== null).length

  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f1f3', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b' }}>{titulo}</div>
        <span style={{ fontSize: 11, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{completos}/{items.length}</span>
      </div>
      {items.map((f, i) => (
        <div key={f.clave} style={{
          display: 'grid', gridTemplateColumns: '1.3fr 200px 1.6fr', gap: 14, alignItems: 'start',
          padding: '12px 16px', borderBottom: i < items.length - 1 ? '1px solid #f7f7f8' : 'none',
        }}>
          <div style={{ fontSize: 12.5, color: '#18181b', paddingTop: 4 }}>{f.label}</div>
          {readOnly ? (
            f.valoracion ? (
              <span style={{ alignSelf: 'start' }}>
                <Bdg tone={f.valoracion === 'SATISFACTORIO' ? 'ok' : 'warn'}>
                  {f.valoracion === 'SATISFACTORIO' ? 'Satisfactorio' : 'Por mejorar'}
                </Bdg>
              </span>
            ) : <span style={{ fontSize: 11.5, color: '#a1a1aa' }}>Sin valorar</span>
          ) : (
            <ValoracionToggle value={f.valoracion} onChange={v => setValoracion(i, v)}/>
          )}
          {readOnly ? (
            <div style={{ fontSize: 12, color: f.observaciones ? '#27272a' : '#a1a1aa' }}>{f.observaciones || '—'}</div>
          ) : (
            <input className="nx-input" placeholder="Observaciones / compromisos de mejora" value={f.observaciones}
              onChange={e => setObs(i, e.target.value)} style={{ padding: '6px 10px', fontSize: 12.5 }}/>
          )}
        </div>
      ))}
    </Card>
  )
}

// ─── Fila de firma (checkbox de "firmado" — no hay firma digital todavía) ───────

export function FirmaRow({ items }: { items: { label: string; firmado: boolean }[] }) {
  return (
    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
      {items.map(it => (
        <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ic n={it.firmado ? 'checkCircle' : 'clock'} s={14} style={{ color: it.firmado ? '#15803d' : '#a1a1aa' }}/>
          <span style={{ fontSize: 12, color: '#3f3f46' }}>{it.label}</span>
        </div>
      ))}
    </div>
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
