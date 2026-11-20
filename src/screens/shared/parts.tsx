import type { CSSProperties, ReactNode } from 'react'
import { Ic } from '../../components/ui'
import type { IcName } from '../../components/ui'

// ─── Status map (tomado de forma.html) ──────────────────────────────────────────

export type StatusTone = 'ok' | 'done' | 'warn' | 'risk' | 'crit' | 'off'

export const SM: Record<StatusTone, { label: string; fg: string; bg: string; line: string; dot: string }> = {
  ok:   { label: 'EN CAMINO',   fg: 'var(--fx-ok)', bg: 'var(--fx-ok-suave)', line: 'var(--fx-ok-linea)', dot: 'var(--fx-ok)' },
  done: { label: 'COMPLETADO',  fg: 'var(--fx-ok)', bg: 'var(--fx-ok-suave)', line: 'var(--fx-ok-linea)', dot: 'var(--fx-ok)' },
  warn: { label: 'ATENCIÓN',    fg: 'var(--fx-aviso)', bg: 'var(--fx-aviso-suave)', line: 'var(--fx-aviso-linea)', dot: 'var(--fx-aviso)' },
  risk: { label: 'RIESGO',      fg: 'var(--fx-aviso)', bg: 'var(--fx-aviso-suave)', line: 'var(--fx-aviso-linea)', dot: 'var(--fx-aviso)' },
  crit: { label: 'CRÍTICO',     fg: 'var(--fx-atraso)', bg: 'var(--fx-atraso-suave)', line: 'var(--fx-atraso-linea)', dot: 'var(--fx-atraso)' },
  off:  { label: 'SIN INICIAR', fg: 'var(--fx-tinta-2)', bg: 'var(--fx-superficie-2)', line: 'var(--fx-linea-2)', dot: 'var(--fx-tinta-4)' },
}

export function statusFromAvance(avance: number): StatusTone {
  if (avance >= 100) return 'done'
  if (avance >= 70)  return 'ok'
  if (avance >= 50)  return 'warn'
  if (avance >= 35)  return 'risk'
  if (avance > 0)    return 'crit'
  return 'off'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

export function fd(s: string | null | undefined): string {
  if (!s) return '—'
  // "2026-10-01" sola es una fecha de calendario: new Date() la leería como
  // medianoche UTC, que en Colombia (UTC-5) todavía es el día anterior.
  const soloFecha = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  const d = soloFecha ? new Date(+soloFecha[1], +soloFecha[2] - 1, +soloFecha[3]) : new Date(s)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function jornadaLabel(j: string | null): string {
  if (!j) return '—'
  const map: Record<string, string> = {
    'MAÑANA': 'Mañana', 'TARDE': 'Tarde', 'NOCHE': 'Noche', 'MIXTA': 'Mixta',
  }
  return map[j.toUpperCase()] ?? j
}

// Días de calendario hasta una fecha ISO (redondeado hacia arriba; negativo
// si ya pasó). Usado por las alertas/KPIs de cierre de etapa productiva
// (fecha_fin_productiva) en superadmin/coordinador -- reemplaza el antiguo
// `dias_restantes` que calculaba el backend sobre la etapa lectiva.
export function diasHasta(fechaISO: string | null): number | null {
  if (!fechaISO) return null
  const d = new Date(fechaISO)
  if (isNaN(d.getTime())) return null
  return Math.ceil((d.getTime() - Date.now()) / 86400000)
}

// ─── Centros de formación ────────────────────────────────────────────────────────
// Nombre corto para mostrar. El centro de desarrollo agroempresarial se muestra
// como "Cedagro"; el resto pierde el prefijo "Centro de".
export function centroLabel(nombre: string): string {
  if (/agro/i.test(nombre)) return 'Cedagro'
  return nombre.replace(/^Centro\s+(de\s+|para\s+)?/i, '').trim() || nombre
}

// Paleta estable para los (siempre pocos) centros de formación. El color se
// asigna por posición ordenando los centros por id, para que sea consistente
// entre la pantalla de Programas y la de Centros.
export const CENTRO_TONES = ['var(--fx-morado)', 'var(--fx-info)', 'var(--fx-aviso)', 'var(--fx-morado)', 'var(--fx-atraso)', 'var(--fx-info)']
export function centroTone(idx: number): string {
  return CENTRO_TONES[((idx % CENTRO_TONES.length) + CENTRO_TONES.length) % CENTRO_TONES.length]
}

// Píldora de "próxima entrada a práctica". Espera una fecha futura (o null);
// muestra los días que faltan, o el mes/año si falta bastante.
export function ProxPill({ iso }: { iso: string | null }) {
  const d = diasHasta(iso)
  if (d == null || !iso) return <span style={{ color: 'var(--fx-linea-2)', fontSize: 12 }}>—</span>

  const tone = d <= 7 ? { fg: 'var(--fx-atraso)', bg: 'var(--fx-atraso-suave)' }
    : d <= 30 ? { fg: 'var(--fx-aviso)', bg: 'var(--fx-aviso-suave)' }
    : { fg: 'var(--fx-tinta-2)', bg: 'var(--fx-superficie-2)' }

  const text = d > 60
    ? new Date(iso).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
    : d === 1 ? '1 día' : `${d} días`

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 9px 3px 7px',
      borderRadius: 20, background: tone.bg, color: tone.fg, fontSize: 11.5, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <Ic n="calendar" s={12}/>{text}
    </span>
  )
}

// ─── Pill ────────────────────────────────────────────────────────────────────────

export function Pill({ status = 'ok', size = 'md', label }: {
  status?: StatusTone; size?: 'sm' | 'md'; label?: string
}) {
  const m = SM[status] ?? SM.off
  const sz = size === 'sm'
    ? { height: 20, padding: '0 6px', fontSize: 10.5 }
    : { height: 22, padding: '0 8px', fontSize: 11 }
  return (
    <span style={{
      ...sz, background: m.bg, color: m.fg, border: `1px solid ${m.line}`,
      display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 6,
      fontWeight: 700, letterSpacing: '0.04em', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: m.dot, flexShrink: 0 }}/>
      {label || m.label}
    </span>
  )
}

// ─── Donut ───────────────────────────────────────────────────────────────────────

export function Donut({ value = 0, size = 56, stroke = 6, color = 'var(--fx-morado)', children }: {
  value?: number; size?: number; stroke?: number; color?: string; children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const off = circ - (Math.max(0, Math.min(100, value)) / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fx-superficie-2)" strokeWidth={stroke} fill="none"/>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{children}</div>
    </div>
  )
}

// ─── Stepper numérico ──────────────────────────────────────────────────────────────

export function Stepper({ value, onChange, step = 0.5, min = 0, max = 12, suffix = '' }: {
  value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; suffix?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 40, border: '1px solid var(--fx-linea)', borderRadius: 8, background: 'var(--fx-superficie)', overflow: 'hidden' }}>
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        style={{ width: 40, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--fx-tinta-2)' }}>
        <Ic n="minus" s={14}/>
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 16, fontWeight: 600, color: 'var(--fx-tinta)' }}>
        {value.toFixed(step < 1 ? 1 : 0)} <span style={{ fontSize: 11, color: 'var(--fx-tinta-3)', fontWeight: 400 }}>{suffix}</span>
      </div>
      <button onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        style={{ width: 40, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'var(--fx-tinta-2)' }}>
        <Ic n="plus" s={14}/>
      </button>
    </div>
  )
}

// ─── Segmented control ─────────────────────────────────────────────────────────────

export function Seg({ name, value, onChange, options }: {
  name: string; value: string; onChange: (v: string) => void
  options: { value: string; label: string; icon?: IcName }[]
}) {
  return (
    <div className="seg" style={{ display: 'inline-flex', padding: 2, background: 'var(--fx-superficie-2)', borderRadius: 8, border: '1px solid var(--fx-linea)' }}>
      {options.map(o => (
        <span key={o.value} style={{ display: 'contents' }}>
          <input type="radio" name={name} id={`${name}-${o.value}`} checked={value === o.value} onChange={() => onChange(o.value)}/>
          <label htmlFor={`${name}-${o.value}`}>{o.icon && <Ic n={o.icon} s={12}/>} {o.label}</label>
        </span>
      ))}
    </div>
  )
}

// ─── Inline alert ──────────────────────────────────────────────────────────────────

type AlertTone = 'info' | 'warn' | 'risk' | 'crit' | 'ok' | 'neutral'

export function InlineAlert({ tone = 'info', icon, title, children, style }: {
  tone?: AlertTone; icon?: IcName; title?: string; children?: ReactNode; style?: CSSProperties
}) {
  const ts: Record<AlertTone, CSSProperties> = {
    info:    { background: 'var(--fx-morado-suave)', border: '1px solid var(--fx-morado-linea)', color: 'var(--fx-morado-tinta)' },
    warn:    { background: 'var(--fx-aviso-suave)', border: '1px solid var(--fx-aviso-linea)', color: 'var(--fx-aviso)' },
    risk:    { background: 'var(--fx-aviso-suave)', border: '1px solid var(--fx-aviso-linea)', color: 'var(--fx-aviso)' },
    crit:    { background: 'var(--fx-atraso-suave)', border: '1px solid var(--fx-atraso-linea)', color: 'var(--fx-atraso)' },
    ok:      { background: 'var(--fx-ok-suave)', border: '1px solid var(--fx-ok-linea)', color: 'var(--fx-ok)' },
    neutral: { background: 'var(--fx-superficie-2)', border: '1px solid var(--fx-linea)', color: 'var(--fx-tinta)' },
  }
  return (
    <div style={{ ...ts[tone], display: 'flex', gap: 12, padding: 14, borderRadius: 8, ...style }}>
      {icon && <Ic n={icon} s={15} style={{ marginTop: 2, flexShrink: 0 }}/>}
      <div style={{ flex: 1, fontSize: 13 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>}
        <div style={{ opacity: 0.9 }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Wizard step indicator ─────────────────────────────────────────────────────────

export function WizSteps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {steps.map((s, i) => {
        const state = i < current ? 'done' : i === current ? 'now' : 'todo'
        return (
          <span key={i} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center',
                fontSize: 11, fontWeight: 600, border: `2px solid ${state === 'todo' ? 'var(--fx-linea-2)' : 'var(--fx-morado)'}`,
                background: state === 'done' ? 'var(--fx-morado)' : 'var(--fx-superficie)',
                color: state === 'done' ? 'var(--fx-superficie)' : state === 'now' ? 'var(--fx-morado)' : 'var(--fx-tinta-4)',
              }}>
                {state === 'done' ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: state === 'todo' ? 'var(--fx-tinta-4)' : 'var(--fx-tinta)' }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < current ? 'var(--fx-morado)' : 'var(--fx-linea)' }}/>}
          </span>
        )
      })}
    </div>
  )
}

// ─── Estados de carga / vacío / error ────────────────────────────────────────────────

export function Spinner({ size = 16, color = 'var(--fx-morado)' }: { size?: number; color?: string }) {
  return (
    <span className="spin" style={{
      width: size, height: size, borderRadius: '50%', display: 'inline-block',
      border: `2px solid color-mix(in srgb, ${color} 20%, transparent)`, borderTopColor: color,
    }}/>
  )
}

export function CenterState({ icon, title, sub }: { icon: IcName; title: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 280, gap: 12, textAlign: 'center',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--fx-superficie-2)', display: 'grid', placeItems: 'center' }}>
        <Ic n={icon} s={22} style={{ color: 'var(--fx-tinta-4)' }}/>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fx-tinta)' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: 'var(--fx-tinta-3)', marginTop: 4, maxWidth: 380 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function LoadingBlock({ minHeight = 280 }: { minHeight?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight, gap: 10, color: 'var(--fx-tinta-3)' }}>
      <Spinner/>
      <span style={{ fontSize: 13 }}>Cargando…</span>
    </div>
  )
}
