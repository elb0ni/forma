import type { CSSProperties, ReactNode } from 'react'
import './ui.css'

// ─── Icons ────────────────────────────────────────────────────────────────────

export type IcName =
  | 'home' | 'folder' | 'bell' | 'layers' | 'list' | 'sparkles' | 'users' | 'user'
  | 'briefcase' | 'shield' | 'cog' | 'check' | 'checkCircle' | 'x' | 'alert' | 'info'
  | 'clock' | 'flame' | 'plus' | 'minus' | 'search' | 'download' | 'upload' | 'edit'
  | 'trash' | 'refresh' | 'copy' | 'eye' | 'chevronDown' | 'chevronRight' | 'chevronLeft'
  | 'arrowRight' | 'arrowLeft' | 'calendar' | 'trend' | 'logout' | 'lock' | 'key'
  | 'fileText' | 'more' | 'pin' | 'target' | 'external' | 'filter'

const PATHS: Record<IcName, ReactNode> = {
  home:        <><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9h14v-9"/></>,
  folder:      <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2h9A1.5 1.5 0 0 1 21 8.5V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6.5Z"/>,
  bell:        <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7Z"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  layers:      <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 18 9 5 9-5"/></>,
  list:        <><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><circle cx="5" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="5" cy="18" r="1" fill="currentColor" stroke="none"/></>,
  sparkles:    <><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m6 6 2.5 2.5"/><path d="m15.5 15.5 2.5 2.5"/><path d="M18 6l-2.5 2.5"/><path d="M8.5 15.5 6 18"/></>,
  users:       <><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19.5c.7-3 3-4.5 5.5-4.5s4.8 1.5 5.5 4.5"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5c3 .2 4.7 1.7 5 5"/></>,
  user:        <><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-3.5 4-5 7-5s6 1.5 7 5"/></>,
  briefcase:   <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/></>,
  shield:      <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>,
  cog:         <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 5.1l.1.1a1.6 1.6 0 0 0 1.8.3 1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8c.2.6.8 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></>,
  check:       <polyline points="4 12 10 18 20 6"/>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/></>,
  x:           <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  alert:       <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17.5" r=".6" fill="currentColor" stroke="none"/></>,
  info:        <><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".7" fill="currentColor" stroke="none"/></>,
  clock:       <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 16 14"/></>,
  flame:       <path d="M12 3s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 1-3s.5 2 2 2c0-3 2-5 2-8Z"/>,
  plus:        <><path d="M12 5v14"/><path d="M5 12h14"/></>,
  minus:       <path d="M5 12h14"/>,
  search:      <><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.5-4.5"/></>,
  download:    <><path d="M12 4v12"/><polyline points="7 11 12 16 17 11"/><path d="M5 20h14"/></>,
  upload:      <><path d="M12 20V8"/><polyline points="7 13 12 8 17 13"/><path d="M5 4h14"/></>,
  edit:        <path d="m4 20 4-1 11-11-3-3L5 16l-1 4Z"/>,
  trash:       <><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7"/></>,
  refresh:     <><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><polyline points="21 3 21 8 16 8"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><polyline points="3 21 3 16 8 16"/></>,
  copy:        <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
  eye:         <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></>,
  chevronDown: <polyline points="6 9 12 15 18 9"/>,
  chevronRight:<polyline points="9 6 15 12 9 18"/>,
  chevronLeft: <polyline points="15 6 9 12 15 18"/>,
  arrowRight:  <><path d="M5 12h14"/><polyline points="13 6 19 12 13 18"/></>,
  arrowLeft:   <><path d="M19 12H5"/><polyline points="11 18 5 12 11 6"/></>,
  calendar:    <><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3.5 10h17"/></>,
  trend:       <><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></>,
  logout:      <><path d="M9 5H5v14h4"/><polyline points="14 8 19 12 14 16"/><path d="M19 12H9"/></>,
  lock:        <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  key:         <><circle cx="8" cy="14" r="4"/><path d="m11 11 9-9"/><path d="m17 5 3 3"/><path d="m14 8 3 3"/></>,
  fileText:    <><path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M8 13h8"/><path d="M8 17h5"/></>,
  more:        <><circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/></>,
  pin:         <><path d="M12 21v-7"/><path d="M8 4h8l-1 6 3 2H6l3-2-1-6Z"/></>,
  target:      <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></>,
  external:    <><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v6H4V4h6"/></>,
  filter:      <polygon points="4 4 20 4 14 12.5 14 18 10 20 10 12.5 4 4"/>,
}

export function Ic({ n, s = 16, sw = 1.6, style: st, className: cl }: {
  n: IcName; s?: number; sw?: number; style?: CSSProperties; className?: string
}) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      style={st} className={cl} aria-hidden="true">
      {PATHS[n]}
    </svg>
  )
}

// ─── BrandMark ────────────────────────────────────────────────────────────────

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x=".5" y=".5" width="23" height="23" rx="6" fill="#0a0a0b"/>
      <path d="M6 16V8h1.6l2.2 3.2L12 8h1.4v8H12v-5.2L9.8 14h-.4L7.2 10.8V16H6Z" fill="#fff"/>
      <circle cx="17.5" cy="14.5" r="1.6" fill="#4f46e5"/>
    </svg>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const TONES = [
  '#dbeafe:#1d4ed8', '#dcfce7:#15803d', '#fef9c3:#a16207',
  '#ffe4e6:#be123c', '#f3e8ff:#7e22ce', '#e0f2fe:#0369a1',
]

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
}

function avaTone(name: string): [string, string] {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length
  return TONES[hash].split(':') as [string, string]
}

export function Ava({ name = '?', size = 28 }: { name?: string; size?: number }) {
  const [bg, fg] = avaTone(name)
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 600,
      fontSize: Math.max(10, size * 0.36), flexShrink: 0,
    }}>
      {initials(name)}
    </div>
  )
}

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger'
type BtnSize    = 'sm' | 'md' | 'lg'

export function Btn({ variant = 'primary', size = 'md', icon, iconRight, onClick, disabled, children, style: s }: {
  variant?: BtnVariant; size?: BtnSize; icon?: IcName; iconRight?: IcName
  onClick?: () => void; disabled?: boolean; children?: ReactNode; style?: CSSProperties
}) {
  const ic = size === 'sm' ? 13 : 14
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn--${variant} btn--${size}`}
      style={s}
    >
      {icon     && <Ic n={icon}      s={ic}/>}
      {children}
      {iconRight && <Ic n={iconRight} s={ic}/>}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────

type BdgTone = 'neutral' | 'accent' | 'outline' | 'ok' | 'warn' | 'err' | 'blue' | 'green' | 'purple'

export function Bdg({ tone = 'neutral', icon, children }: {
  tone?: BdgTone; icon?: IcName; children: ReactNode
}) {
  return (
    <span className={`bdg bdg--${tone}`}>
      {icon && <Ic n={icon} s={11}/>}
      {children}
    </span>
  )
}

// Estado de digitalización del diseño curricular — lenguaje visual único en toda la app.
export function DigBadge({ dig }: { dig: boolean }) {
  return dig
    ? <Bdg tone="ok"   icon="checkCircle">Digitalizado</Bdg>
    : <Bdg tone="warn" icon="alert">Sin digitalizar</Bdg>
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, style: s, onClick }: {
  children: ReactNode; style?: CSSProperties; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      className={`card${onClick ? ' card--clickable' : ''}`}
      style={s}
    >
      {children}
    </div>
  )
}

// ─── Tag ──────────────────────────────────────────────────────────────────────

export function Tag({ children, style: s }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="tag" style={s}>
      {children}
    </span>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  ok: '#16a34a', done: '#16a34a', warn: '#ca8a04',
  risk: '#ea580c', crit: '#dc2626', off: '#a1a1aa',
}

export function Prog({ value = 0, status, height = 6, showLabel, style: s }: {
  value?: number; status?: string; height?: number; showLabel?: boolean; style?: CSSProperties
}) {
  const v   = Math.max(0, Math.min(100, value))
  const col = status ? (STATUS_DOT[status] ?? '#4f46e5') : '#4f46e5'
  return (
    <div className="prog" style={s}>
      <div className="prog__track" style={{ height, borderRadius: height }}>
        <div className="prog__fill" style={{ width: `${v}%`, background: col, borderRadius: height }}/>
      </div>
      {showLabel && (
        <span className="prog__label">{v}%</span>
      )}
    </div>
  )
}

// ─── Modal ──────────────────────────────────────────────────────────────────────

export function Modal({ title, icon, onClose, children, footer, width = 420 }: {
  title?: string; icon?: IcName; onClose: () => void
  children: ReactNode; footer?: ReactNode; width?: number
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card pop-in" style={{ width }} onClick={e => e.stopPropagation()}>
        {title && (
          <div className="modal-head">
            <div className="modal-head__title">
              {icon && <Ic n={icon} s={16} style={{ color: '#4f46e5' }}/>}
              {title}
            </div>
            <button className="modal-head__close" onClick={onClose} aria-label="Cerrar">
              <Ic n="x" s={15}/>
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ─── Paginación ─────────────────────────────────────────────────────────────────

export function Pager({ page, pageCount, total, pageSize, onPage, noun = 'registros' }: {
  page: number; pageCount: number; total: number; pageSize: number
  onPage: (p: number) => void; noun?: string
}) {
  if (pageCount <= 1) return null

  const from = page * pageSize + 1
  const to   = Math.min(total, (page + 1) * pageSize)

  // Ventana de páginas alrededor de la actual (máx. 5 números)
  const start = Math.max(0, Math.min(page - 2, pageCount - 5))
  const end   = Math.min(pageCount, start + 5)
  const pages: number[] = []
  for (let i = start; i < end; i++) pages.push(i)

  return (
    <div className="pager">
      <div className="pager__info">
        Mostrando <strong>{from}–{to}</strong> de <strong>{total}</strong> {noun}
      </div>
      <div className="pager__controls">
        <button className="pager__btn" onClick={() => onPage(page - 1)} disabled={page === 0} aria-label="Anterior">
          <Ic n="chevronLeft" s={14}/>
        </button>
        {pages.map(p => (
          <button
            key={p}
            className={`pager__num${p === page ? ' pager__num--active' : ''}`}
            onClick={() => onPage(p)}
          >
            {p + 1}
          </button>
        ))}
        <button className="pager__btn" onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1} aria-label="Siguiente">
          <Ic n="chevronRight" s={14}/>
        </button>
      </div>
    </div>
  )
}

// ─── Metric card ──────────────────────────────────────────────────────────────

export function Metric({ label, value, delta, deltaTone = 'neutral', sub, icon }: {
  label: string; value: string | number; delta?: string
  deltaTone?: 'up' | 'down' | 'neutral'; sub?: string; icon?: IcName
}) {
  const dColor = { up: '#15803d', down: '#b91c1c', neutral: '#52525b' }[deltaTone]
  return (
    <Card style={{ padding: 20 }}>
      <div className="metric__header">
        <div className="metric__label">{label}</div>
        {icon && <Ic n={icon} s={16} style={{ color: '#a1a1aa' }}/>}
      </div>
      <div className="metric__values">
        <div className="metric__value">{value}</div>
        {delta && (
          <div className="metric__delta" style={{ color: dColor }}>{delta}</div>
        )}
      </div>
      {sub && <div className="metric__sub">{sub}</div>}
    </Card>
  )
}
