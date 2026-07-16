import type { CSSProperties, ReactNode } from 'react'
import { Ic } from '../../components/ui'
import type { IcName } from '../../components/ui'

// ─── Status map (tomado de forma.html) ──────────────────────────────────────────

export type StatusTone = 'ok' | 'done' | 'warn' | 'risk' | 'crit' | 'off'

export const SM: Record<StatusTone, { label: string; fg: string; bg: string; line: string; dot: string }> = {
  ok:   { label: 'EN CAMINO',   fg: '#15803d', bg: '#dcfce7', line: '#86efac', dot: '#16a34a' },
  done: { label: 'COMPLETADO',  fg: '#15803d', bg: '#dcfce7', line: '#86efac', dot: '#16a34a' },
  warn: { label: 'ATENCIÓN',    fg: '#a16207', bg: '#fef9c3', line: '#fde68a', dot: '#ca8a04' },
  risk: { label: 'RIESGO',      fg: '#c2410c', bg: '#ffedd5', line: '#fed7aa', dot: '#ea580c' },
  crit: { label: 'CRÍTICO',     fg: '#b91c1c', bg: '#fee2e2', line: '#fecaca', dot: '#dc2626' },
  off:  { label: 'SIN INICIAR', fg: '#52525b', bg: '#f1f1f3', line: '#d4d4d8', dot: '#a1a1aa' },
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
  const d = new Date(s)
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

export function Donut({ value = 0, size = 56, stroke = 6, color = '#4f46e5', children }: {
  value?: number; size?: number; stroke?: number; color?: string; children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const off = circ - (Math.max(0, Math.min(100, value)) / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f1f3" strokeWidth={stroke} fill="none"/>
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
    <div style={{ display: 'flex', alignItems: 'center', height: 40, border: '1px solid #e4e4e7', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
      <button onClick={() => onChange(Math.max(min, +(value - step).toFixed(2)))}
        style={{ width: 40, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#52525b' }}>
        <Ic n="minus" s={14}/>
      </button>
      <div style={{ flex: 1, textAlign: 'center', fontFamily: '"JetBrains Mono", monospace', fontSize: 16, fontWeight: 600, color: '#0a0a0b' }}>
        {value.toFixed(step < 1 ? 1 : 0)} <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400 }}>{suffix}</span>
      </div>
      <button onClick={() => onChange(Math.min(max, +(value + step).toFixed(2)))}
        style={{ width: 40, height: '100%', border: 'none', background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', color: '#52525b' }}>
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
    <div className="seg" style={{ display: 'inline-flex', padding: 2, background: '#f1f1f3', borderRadius: 8, border: '1px solid #e4e4e7' }}>
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
    info:    { background: '#eef2ff', border: '1px solid #c7d2fe', color: '#312e81' },
    warn:    { background: '#fef9c3', border: '1px solid #fde68a', color: '#a16207' },
    risk:    { background: '#ffedd5', border: '1px solid #fed7aa', color: '#c2410c' },
    crit:    { background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c' },
    ok:      { background: '#dcfce7', border: '1px solid #86efac', color: '#15803d' },
    neutral: { background: '#f1f1f3', border: '1px solid #e4e4e7', color: '#27272a' },
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
                fontSize: 11, fontWeight: 600, border: `2px solid ${state === 'todo' ? '#d4d4d8' : '#4f46e5'}`,
                background: state === 'done' ? '#4f46e5' : '#fff',
                color: state === 'done' ? '#fff' : state === 'now' ? '#4f46e5' : '#a1a1aa',
              }}>
                {state === 'done' ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 12, fontWeight: 500, color: state === 'todo' ? '#a1a1aa' : '#18181b' }}>{s}</span>
            </div>
            {i < steps.length - 1 && <div style={{ flex: 1, height: 1, background: i < current ? '#4f46e5' : '#e4e4e7' }}/>}
          </span>
        )
      })}
    </div>
  )
}

// ─── Estados de carga / vacío / error ────────────────────────────────────────────────

export function Spinner({ size = 16, color = '#4f46e5' }: { size?: number; color?: string }) {
  return (
    <span className="spin" style={{
      width: size, height: size, borderRadius: '50%', display: 'inline-block',
      border: `2px solid ${color}33`, borderTopColor: color,
    }}/>
  )
}

export function CenterState({ icon, title, sub }: { icon: IcName; title: string; sub?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 280, gap: 12, textAlign: 'center',
    }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: '#f1f1f3', display: 'grid', placeItems: 'center' }}>
        <Ic n={icon} s={22} style={{ color: '#a1a1aa' }}/>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: '#71717a', marginTop: 4, maxWidth: 380 }}>{sub}</div>}
      </div>
    </div>
  )
}

export function LoadingBlock({ minHeight = 280 }: { minHeight?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight, gap: 10, color: '#71717a' }}>
      <Spinner/>
      <span style={{ fontSize: 13 }}>Cargando…</span>
    </div>
  )
}
