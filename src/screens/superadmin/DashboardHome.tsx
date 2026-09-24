import { useState, useEffect, useMemo } from 'react'
import { Ic, Card, Prog } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { diasHasta, centroLabel } from '../shared/parts'
import type { FichaRow } from '../shared/FichasAdmin'
import { faseFicha } from '../shared/fichaFase'
import type { FaseFicha } from '../shared/fichaFase'
import type { CentroResumen } from '../shared/types'
import './DashboardHome.css'

function Sk({ w, h, r = 5, delay = 0 }: { w: string | number; h: number; r?: number; delay?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: r, animationDelay: `${delay}ms` }}/>
}

function EmptyState({ icon, title, sub }: { icon: IcName; title: string; sub: string }) {
  return (
    <Card style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
      <Ic n={icon} s={24} style={{ color: '#a1a1aa' }}/>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#71717a' }}>{sub}</div>
    </Card>
  )
}

// ─── Lenguaje visual de fase operativa ─────────────────────────────────────────
// Mismas 4 fases que FichasAdmin (PRÓXIMA / EN PRÁCTICA / EN CIERRE / FINALIZADA),
// para que el dashboard y el catálogo hablen el mismo idioma. Colores propios,
// separados para que se distingan bien en una dona.

type EstadoFilt = '' | 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: '',             label: 'Todas'        },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA',   label: 'Finalizadas'  },
  { key: 'SUSPENDIDA',   label: 'Suspendidas'  },
]

const PRACTICA_COLOR = '#4f46e5'

const FASES: FaseFicha[] = ['PROXIMA', 'EN_PRACTICA', 'EN_CIERRE', 'FINALIZADA']
const FASE_LABEL: Record<FaseFicha, string> = {
  PROXIMA: 'Próxima a práctica', EN_PRACTICA: 'En práctica', EN_CIERRE: 'En cierre', FINALIZADA: 'Finalizada',
}
const FASE_COLOR: Record<FaseFicha, string> = {
  PROXIMA: '#818cf8', EN_PRACTICA: '#4f46e5', EN_CIERRE: '#d97706', FINALIZADA: '#d4d4d8',
}

// ─── Dona multi-segmento (un total, N arcos) ───────────────────────────────────

interface Segmento { key: string; label: string; value: number; color: string }

function Donut2({ segments, size = 132, stroke = 20 }: { segments: Segmento[]; size?: number; stroke?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  let acc = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1f1f3" strokeWidth={stroke} fill="none"/>
      {total > 0 && segments.filter(s => s.value > 0).map(s => {
        const dash = (s.value / total) * circ
        const node = (
          <circle
            key={s.key} cx={size / 2} cy={size / 2} r={r}
            stroke={s.color} strokeWidth={stroke} fill="none"
            strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={-acc}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          >
            <title>{`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}</title>
          </circle>
        )
        acc += dash
        return node
      })}
    </svg>
  )
}

// ─── Gráfico: calendario de cierres / entradas a práctica ──────────────────────
// Barras por mes. "Cierres": fichas en práctica por mes de fin de etapa
// productiva (+ bin de vencidas). "Entradas": fichas próximas por mes de inicio.
// Cada barra apila con-instructor / sin-instructor.

interface Bin { key: string; label: string; con: number; sin: number; venc?: boolean }

function ymLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const mes = new Date(y, m - 1, 1).toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')
  return m === 1 ? `${mes} ${String(y).slice(2)}` : mes
}

function buildBins(fichas: FichaRow[], mode: 'cierres' | 'entradas', hoy: string): Bin[] {
  const now = new Date(`${hoy}T00:00:00`)
  const horizon: string[] = []
  for (let i = 0; i < 9; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1)
    horizon.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  const lastYm = horizon[horizon.length - 1]

  const bins: Bin[] = []
  if (mode === 'cierres') bins.push({ key: 'venc', label: 'Vencidas', con: 0, sin: 0, venc: true })
  for (const ym of horizon) bins.push({ key: ym, label: ymLabel(ym), con: 0, sin: 0 })
  bins.push({ key: 'luego', label: 'Luego', con: 0, sin: 0 })

  for (const f of fichas) {
    if (f.estado !== 'EN_EJECUCION') continue
    const fase = faseFicha(f)
    let iso: string | null
    if (mode === 'cierres') {
      if (fase !== 'EN_PRACTICA' && fase !== 'EN_CIERRE') continue
      iso = f.fecha_fin_productiva
    } else {
      if (fase !== 'PROXIMA') continue
      iso = f.fecha_inicio_productiva
    }
    if (!iso) continue
    const d = iso.slice(0, 10)
    const ym = d.slice(0, 7)
    let slot: Bin | undefined
    if (mode === 'cierres' && d < hoy) slot = bins[0]
    else if (ym > lastYm) slot = bins[bins.length - 1]
    else slot = bins.find(b => b.key === ym) ?? bins[bins.length - 1]
    if (!slot) continue
    if (f.instructor_practica) slot.con++
    else slot.sin++
  }
  return bins
}

const CHART_H = 104

// ─── Panorama: pastel (fichas por fase) + barra (calendario) en una tarjeta ────
// Los dos gráficos del resumen viven juntos y compactos: a la izquierda la
// composición por fase (dona), a la derecha cuándo cierran/entran las fichas por
// mes. Antes eran dos tarjetas apiladas que ocupaban media pantalla.

function PanoramaResumen({ segments, fichas, filtrado }: {
  segments: Segmento[]; fichas: FichaRow[]; filtrado: boolean
}) {
  "use no memo"
  const [mode, setMode] = useState<'cierres' | 'entradas'>('cierres')
  const hoy = new Date().toISOString().slice(0, 10)
  const bins = buildBins(fichas, mode, hoy).filter(b => b.key !== 'luego' || b.con + b.sin > 0)
  const max = Math.max(1, ...bins.map(b => b.con + b.sin))
  const totalSin = bins.reduce((a, b) => a + b.sin, 0)
  const barVacio = bins.every(b => b.con + b.sin === 0)
  const total = segments.reduce((a, s) => a + s.value, 0)

  return (
    <Card style={{ padding: 20 }}>
      <div className="panorama">
        {/* Dona: fichas por fase operativa */}
        <div className="panorama__pie">
          <div className="section-title" style={{ marginBottom: 12 }}>
            Fichas por fase{filtrado ? ' · filtro' : ''}
          </div>
          <div className="panorama__donut-row">
            <div className="panorama__donut">
              <Donut2 segments={segments} size={104} stroke={16}/>
              <div className="panorama__donut-center">
                <span className="panorama__donut-total">{total}</span>
                <span className="panorama__donut-cap">fichas</span>
              </div>
            </div>
          </div>
          <div className="panorama__legend">
            {segments.map(s => {
              const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
              return (
                <div key={s.key} className="panorama__legend-row" title={`${s.label}: ${s.value} (${pct}%)`}>
                  <span className="panorama__legend-dot" style={{ background: s.color }}/>
                  <span className="panorama__legend-label">{s.label}</span>
                  <span className="panorama__legend-val">{s.value}</span>
                  <span className="panorama__legend-pct">{pct}%</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Barra: cuándo cierran / entran por mes */}
        <div className="panorama__bar">
          <div className="panorama__bar-head">
            <div>
              <div className="section-title" style={{ marginBottom: 2 }}>
                {mode === 'cierres' ? 'Cuándo cierran (fin de práctica)' : 'Cuándo entran a práctica'}
              </div>
              <div className="panorama__bar-hint">
                por mes · <span style={{ color: '#b91c1c' }}>rojo</span> = sin instructor
              </div>
            </div>
            <div className="mini-toggle">
              <button className={mode === 'cierres' ? 'on' : ''} onClick={() => setMode('cierres')}>Cierres</button>
              <button className={mode === 'entradas' ? 'on' : ''} onClick={() => setMode('entradas')}>Entradas</button>
            </div>
          </div>

          {barVacio ? (
            <div className="panorama__bar-empty">
              <Ic n="calendar" s={18} style={{ color: '#a1a1aa' }}/>
              {mode === 'cierres'
                ? 'Ninguna ficha en práctica tiene fecha de cierre.'
                : 'No hay fichas próximas a iniciar práctica.'}
            </div>
          ) : (
            <>
              <div className="cierres-chart">
                {bins.map(b => {
                  const tot = b.con + b.sin
                  const h = Math.round((tot / max) * CHART_H)
                  return (
                    <div key={b.key} className="cierres-col">
                      <div className="cierres-val">{tot > 0 ? tot : ''}</div>
                      <div className="cierres-bar-wrap" style={{ height: CHART_H }}>
                        {tot > 0 && (
                          <div className="cierres-bar" style={{ height: h }}>
                            {b.sin > 0 && <div style={{ height: `${(b.sin / tot) * 100}%`, background: '#dc2626' }} title={`Sin instructor: ${b.sin}`}/>}
                            {b.con > 0 && <div style={{ height: `${(b.con / tot) * 100}%`, background: b.venc ? '#9f1239' : PRACTICA_COLOR }} title={`Con instructor: ${b.con}`}/>}
                          </div>
                        )}
                      </div>
                      <div className={`cierres-lbl${b.venc ? ' venc' : ''}`}>{b.label}</div>
                    </div>
                  )
                })}
              </div>
              <div className="panorama__bar-legend">
                <span><span className="panorama__legend-dot" style={{ background: PRACTICA_COLOR }}/>Con instructor</span>
                <span><span className="panorama__legend-dot" style={{ background: '#dc2626' }}/>Sin instructor{totalSin > 0 ? ` · ${totalSin}` : ''}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── KPI cards ──────────────────────────────────────────────────────────────────
// Regionales, todos en lenguaje de etapa práctica -- salen del rollup de
// GET /centros/resumen (agregado) + el conteo por fecha sobre GET /fichas.

interface Agregado {
  enPractica: number; sinInstructor: number; aprendices: number
  instrTotal: number; instrPractica: number
  centros: number; coordinaciones: number; cobertura: number
}

function KpiCards({ agg, fichasFiltradas }: { agg: Agregado; fichasFiltradas: FichaRow[] }) {
  const enEjecucion = fichasFiltradas.filter(f => f.estado === 'EN_EJECUCION').length
  const conDias = fichasFiltradas
    .filter(f => f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA')
    .map(f => diasHasta(f.fecha_fin_productiva))
    .filter((d): d is number => d != null)
  const vencidas = conDias.filter(d => d < 0).length
  const cierranPronto = conDias.filter(d => d >= 0 && d <= 30).length
  const conInstr = agg.enPractica - agg.sinInstructor

  return (
    <>
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Fichas en práctica</div>
          <Ic n="briefcase" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {agg.enPractica}
          <span className="kpi2-value-sub"> / {enEjecucion} en ejecución</span>
        </div>
        <div className="kpi2-sub" style={{ color: vencidas > 0 ? '#dc2626' : cierranPronto > 0 ? '#c2410c' : undefined }}>
          {vencidas > 0
            ? `${vencidas} vencida${vencidas === 1 ? '' : 's'} sin cerrar`
            : cierranPronto > 0 ? `${cierranPronto} cierran en ≤30 días` : 'Ninguna cierra en los próximos 30 días'}
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Aprendices en práctica</div>
          <Ic n="users" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">{agg.aprendices}</div>
        <div className="kpi2-sub">con etapa productiva en ejecución</div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Cobertura de instructor</div>
          <Ic n="shield" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {agg.cobertura}<span className="kpi2-value-sub">%</span>
        </div>
        <Prog value={agg.cobertura} style={{ marginTop: 10 }}/>
        <div className="kpi2-sub" style={{ color: agg.sinInstructor > 0 ? '#c2410c' : undefined }}>
          {conInstr}/{agg.enPractica} con instructor
          {agg.sinInstructor > 0 && ` · ${agg.sinInstructor} sin asignar`}
        </div>
      </Card>

      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Instructores con práctica</div>
          <Ic n="users" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {agg.instrPractica}
          <span className="kpi2-value-sub"> / {agg.instrTotal}</span>
        </div>
        <div className="kpi2-sub">{agg.centros} centros · {agg.coordinaciones} coordinaciones</div>
      </Card>
    </>
  )
}

// ─── Listas de fichas por fecha (vencidas / cierran pronto / van a práctica) ────

interface FichaConDias { f: FichaRow; dias: number }

function fichasConDias(fichas: FichaRow[], fechaFn: (f: FichaRow) => string | null, tope: number): FichaConDias[] {
  return fichas
    .map(f => ({ f, dias: diasHasta(fechaFn(f)) }))
    .filter((x): x is FichaConDias => x.dias != null && x.dias <= tope)
    .sort((a, b) => a.dias - b.dias)
}

function diasLabel(dias: number): string { return dias < 0 ? `${Math.abs(dias)}d vencida` : dias === 0 ? 'Hoy' : `${dias}d` }
function diasColor(dias: number): string { return dias < 0 ? '#dc2626' : dias <= 7 ? '#c2410c' : '#a16207' }

// ─── Panel de alertas de fecha ──────────────────────────────────────────────

type AlertaId = 'vencidas' | 'cierran' | 'transicion'

function AlertasFichas({ vencidas, cierranPronto, vanAPractica, onOpenFicha }: {
  vencidas: FichaConDias[]; cierranPronto: FichaConDias[]; vanAPractica: FichaConDias[]
  onOpenFicha?: (id: number) => void
}) {
  "use no memo"
  const grupos: { id: AlertaId; label: string; items: FichaConDias[]; color: string; icon: IcName }[] = [
    { id: 'vencidas',   label: 'Vencidas',        items: vencidas,      color: '#dc2626', icon: 'alert' },
    { id: 'cierran',    label: 'Cierran pronto',  items: cierranPronto, color: '#c2410c', icon: 'clock' },
    { id: 'transicion', label: 'Van a práctica',  items: vanAPractica,  color: '#4338ca', icon: 'briefcase' },
  ]
  const primeraConDatos = grupos.find(g => g.items.length > 0)?.id ?? 'vencidas'
  const [tab, setTab] = useState<AlertaId>(primeraConDatos)
  const [q, setQ] = useState('')

  const activo = grupos.find(g => g.id === tab)!
  const ql = q.trim().toLowerCase()
  const view = activo.items.filter(({ f }) => !ql
    || f.numero_ficha.toLowerCase().includes(ql)
    || f.programa_nombre.toLowerCase().includes(ql)
    || f.programa_codigo.toLowerCase().includes(ql))

  return (
    <Card style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid #e4e4e7' }}>
        {grupos.map(g => {
          const active = g.id === tab
          return (
            <button
              key={g.id}
              onClick={() => { setTab(g.id); setQ('') }}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                padding: '13px 10px', border: 'none', borderBottom: active ? `2px solid ${g.color}` : '2px solid transparent',
                background: active ? '#fafafa' : '#fff', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                fontSize: 12.5, fontWeight: active ? 600 : 500, color: active ? '#18181b' : '#71717a',
                transition: 'all 120ms',
              }}
            >
              <Ic n={g.icon} s={13} style={{ color: g.color }}/>
              {g.label}
              <span style={{
                fontSize: 10.5, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                background: g.items.length > 0 ? g.color : '#e4e4e7', color: g.items.length > 0 ? '#fff' : '#a1a1aa',
                padding: '1px 6px', borderRadius: 10,
              }}>{g.items.length}</span>
            </button>
          )
        })}
      </div>

      {activo.items.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #f1f1f3', position: 'relative' }}>
          <Ic n="search" s={13} style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: '#a1a1aa' }}/>
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder={`Buscar en ${activo.items.length} ficha${activo.items.length === 1 ? '' : 's'}…`}
            style={{
              width: '100%', height: 32, padding: '0 10px 0 30px', border: '1px solid #e4e4e7', borderRadius: 7,
              fontSize: 12.5, color: '#18181b', fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>
      )}

      {view.length === 0 ? (
        <div style={{ padding: 32 }}>
          <EmptyState
            icon="checkCircle"
            title={activo.items.length === 0 ? `Sin fichas en "${activo.label.toLowerCase()}"` : 'Sin resultados'}
            sub={activo.items.length === 0 ? 'Nada que reportar en esta categoría por ahora.' : `Ninguna ficha coincide con "${q}".`}
          />
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {view.map(({ f, dias }, i) => (
            <div
              key={f.id}
              className={onOpenFicha ? 'nx-row' : undefined}
              onClick={() => onOpenFicha?.(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px',
                borderBottom: i < view.length - 1 ? '1px solid #f1f1f3' : 'none',
                cursor: onOpenFicha ? 'pointer' : 'default',
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 700, background: '#f1f1f3', color: '#52525b', padding: '2px 6px', borderRadius: 4 }}>{f.programa_codigo}</span>
                  <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 600, color: '#0a0a0b' }}># {f.numero_ficha}</span>
                </div>
                <div style={{ fontSize: 12, color: '#52525b', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.programa_nombre}</div>
              </div>
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fontWeight: 700, color: diasColor(dias), whiteSpace: 'nowrap', textAlign: 'right' }}>{diasLabel(dias)}</span>
              {onOpenFicha && <Ic n="chevronRight" s={14} style={{ color: '#d4d4d8', flexShrink: 0 }}/>}
            </div>
          ))}
        </div>
      )}

      {activo.items.length > 0 && (
        <div style={{ padding: '9px 16px', borderTop: '1px solid #f1f1f3', fontSize: 11.5, color: '#a1a1aa', background: '#fafafa' }}>
          {view.length === activo.items.length ? `${view.length} ficha${view.length === 1 ? '' : 's'}` : `${view.length} de ${activo.items.length} fichas`}
        </div>
      )}
    </Card>
  )
}

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function ResumenTab({ todas, filtradas, onOpenFicha }: {
  todas: FichaRow[]; filtradas: FichaRow[]; onOpenFicha?: (id: number) => void
}) {
  const faseSegs: Segmento[] = FASES.map(k => ({
    key: k, label: FASE_LABEL[k], color: FASE_COLOR[k],
    value: filtradas.filter(f => faseFicha(f) === k).length,
  }))

  const activasFiltradas = filtradas.filter(f => f.estado === 'EN_EJECUCION')
  const enPractica  = activasFiltradas.filter(f => f.etapa_actual_teorica === 'PRACTICA')
  const vencidas    = fichasConDias(enPractica, f => f.fecha_fin_productiva, -1)
  const cierranPronto = fichasConDias(enPractica, f => f.fecha_fin_productiva, 30).filter(x => x.dias >= 0)

  const enLectiva = activasFiltradas.filter(f => f.etapa_actual_teorica !== 'PRACTICA')
  const vanAPractica = fichasConDias(enLectiva, f => f.fecha_inicio_productiva ?? f.fecha_fin_lectiva, 30)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PanoramaResumen segments={faseSegs} fichas={filtradas} filtrado={filtradas.length !== todas.length}/>

      <div>
        <div className="section-title">Fichas que requieren seguimiento por fecha</div>
        <AlertasFichas vencidas={vencidas} cierranPronto={cierranPronto} vanAPractica={vanAPractica} onOpenFicha={onOpenFicha}/>
      </div>
    </div>
  )
}

// ─── Tabs: ranking por centro / por coordinación ──────────────────────────────
// Directo del rollup de GET /centros/resumen -- ya trae la señal real de práctica
// (cobertura, aprendices, sin instructor) por centro y por coordinación.

interface RankRow {
  id: number | string; nombre: string; sub?: string
  enPractica: number; aprendices: number; sinInstructor: number
  extra: number; cobertura: number
}

// Ranking por centro como barras horizontales (más legible que la tabla): el
// largo es "fichas en práctica", el segmento rojo son las que están sin
// instructor. Ordenado por volumen.
function CentroBarras({ rows }: { rows: RankRow[] }) {
  if (rows.length === 0) return <EmptyState icon="folder" title="Sin datos" sub="No hay práctica activa para mostrar."/>
  const filas = [...rows].sort((a, b) => b.enPractica - a.enPractica)
  const max = Math.max(1, ...filas.map(r => r.enPractica))
  const totalSin = filas.reduce((a, r) => a + r.sinInstructor, 0)

  return (
    <Card style={{ padding: 20 }}>
      <div className="section-title">Fichas en práctica por centro</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
        {filas.map(r => {
          const con = r.enPractica - r.sinInstructor
          return (
            <div key={r.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 5 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</span>
                <span style={{ fontSize: 11, color: '#71717a', fontFamily: '"JetBrains Mono", monospace', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {r.enPractica} fichas · {r.aprendices} apr · {r.cobertura}%
                </span>
              </div>
              <div style={{ display: 'flex', height: 13, background: '#f4f4f5', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${(con / max) * 100}%`, background: PRACTICA_COLOR, transition: 'width 400ms ease' }} title={`Con instructor: ${con}`}/>
                <div style={{ width: `${(r.sinInstructor / max) * 100}%`, background: '#dc2626', transition: 'width 400ms ease' }} title={`Sin instructor: ${r.sinInstructor}`}/>
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#52525b' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: PRACTICA_COLOR }}/>Con instructor
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#52525b' }}>
          <span style={{ width: 9, height: 9, borderRadius: 2, background: '#dc2626' }}/>Sin instructor
        </span>
        {totalSin > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#b91c1c', fontWeight: 600 }}>
            {totalSin} ficha{totalSin === 1 ? '' : 's'} sin instructor en la regional
          </span>
        )}
      </div>
    </Card>
  )
}

function RankingTable({ filas, columnaNombre, extraLabel }: {
  filas: RankRow[]; columnaNombre: string; extraLabel: string
}) {
  if (filas.length === 0) return <EmptyState icon="folder" title="Sin datos" sub="No hay práctica activa para mostrar."/>
  return (
    <Card style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr className="data-table__head-row">
            <th className="data-table__th">{columnaNombre}</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>En práctica</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Aprendices</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Sin instructor</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>{extraLabel}</th>
            <th className="data-table__th" style={{ minWidth: 150 }}>Cobertura</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
              <td className="data-table__td--name">
                {r.nombre}
                {r.sub && <div style={{ fontSize: 11, color: '#a1a1aa', fontWeight: 400, marginTop: 2 }}>{r.sub}</div>}
              </td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: PRACTICA_COLOR }}>{r.enPractica}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right' }}>{r.aprendices}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: r.sinInstructor > 0 ? '#dc2626' : '#a1a1aa' }}>{r.sinInstructor}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: r.extra > 0 ? '#c2410c' : '#a1a1aa' }}>{r.extra}</td>
              <td className="data-table__td" style={{ minWidth: 150 }}>
                <Prog value={r.cobertura} showLabel/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  )
}

const cobertura = (enPractica: number, sinInstructor: number) =>
  enPractica > 0 ? Math.round(((enPractica - sinInstructor) / enPractica) * 100) : 0

// ─── Acciones rápidas ───────────────────────────────────────────────────────────

const QUICK_ACTIONS: [IcName, string, string, string][] = [
  ['layers',    'Ver programas',      'Catálogo regional de formación', 'admin-programas'],
  ['users',     'Gestionar usuarios', 'Instructores y coordinadores',   'admin-usuarios'],
  ['briefcase', 'Gestionar fichas',   'Fichas en etapa práctica',       'admin-fichas'],
  ['shield',    'Centros y coordinaciones', 'Estructura regional',      'admin-centros'],
]

function QuickActions({ onNav }: { onNav?: (id: string) => void }) {
  return (
    <Card style={{ overflow: 'hidden' }}>
      <div className="qa-card-header">Acciones rápidas</div>
      {QUICK_ACTIONS.map(([ic, label, hint, dest], i) => (
        <button
          key={dest}
          onClick={() => onNav?.(dest)}
          className="qa-row"
          style={{ borderBottom: i < QUICK_ACTIONS.length - 1 ? '1px solid #f1f1f3' : 'none' }}
        >
          <div className="qa-icon"><Ic n={ic} s={16}/></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="qa-label">{label}</div>
            <div className="qa-hint">{hint}</div>
          </div>
          <Ic n="chevronRight" s={14} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
        </button>
      ))}
    </Card>
  )
}

// ─── DashboardHome ─────────────────────────────────────────────────────────────
// Home ejecutivo del super admin, centrado en etapa productiva. Rollup regional
// desde GET /centros/resumen + fichas por fecha desde GET /fichas.
type TabId = 'resumen' | 'centro' | 'coordinacion'
const TABS: { id: TabId; label: string; icon: IcName }[] = [
  { id: 'resumen',      label: 'Resumen',          icon: 'trend'  },
  { id: 'centro',       label: 'Por centro',       icon: 'shield' },
  { id: 'coordinacion', label: 'Por coordinación', icon: 'users'  },
]

export function DashboardHome({ onNav, onOpenFicha }: { onNav?: (id: string) => void; onOpenFicha?: (id: number) => void }) {
  "use no memo"
  const [centros, setCentros] = useState<CentroResumen[] | null>(null)
  const [fichas,  setFichas]  = useState<FichaRow[] | null>(null)
  const [estadoFilt, setEstadoFilt] = useState<EstadoFilt>('')
  const [tab, setTab] = useState<TabId>('resumen')

  useEffect(() => {
    api.get<CentroResumen[]>('/centros/resumen').then(r => setCentros(r.data)).catch(() => setCentros([]))
    api.get<FichaRow[]>('/fichas').then(r => setFichas(r.data)).catch(() => setFichas([]))
  }, [])

  const loading = fichas === null || centros === null

  const fichasFiltradas = useMemo(
    () => (fichas ?? []).filter(f => !estadoFilt || f.estado === estadoFilt),
    [fichas, estadoFilt],
  )

  const agg = useMemo<Agregado>(() => {
    const cs = centros ?? []
    const enPractica     = cs.reduce((a, c) => a + c.fichas_en_practica, 0)
    const sinInstructor  = cs.reduce((a, c) => a + c.fichas_sin_instructor, 0)
    return {
      enPractica,
      sinInstructor,
      aprendices:      cs.reduce((a, c) => a + c.aprendices_en_practica, 0),
      instrTotal:      cs.reduce((a, c) => a + c.instructores_total, 0),
      instrPractica:   cs.reduce((a, c) => a + c.instructores_practica, 0),
      centros:         cs.length,
      coordinaciones:  cs.reduce((a, c) => a + c.coordinaciones, 0),
      cobertura:       cobertura(enPractica, sinInstructor),
    }
  }, [centros])

  const rankCentros = useMemo<RankRow[]>(() =>
    (centros ?? [])
      .map(c => ({
        id: c.id, nombre: centroLabel(c.nombre), sub: `${c.ciudad} · ${c.coordinaciones} coordinaciones`,
        enPractica: c.fichas_en_practica, aprendices: c.aprendices_en_practica,
        sinInstructor: c.fichas_sin_instructor, extra: c.etapas_por_cerrar,
        cobertura: cobertura(c.fichas_en_practica, c.fichas_sin_instructor),
      }))
      .sort((a, b) => b.sinInstructor - a.sinInstructor || b.enPractica - a.enPractica),
    [centros])

  const rankCoords = useMemo<RankRow[]>(() =>
    (centros ?? [])
      .flatMap(c => c.coordinaciones_detalle.map(co => ({
        id: `${c.id}-${co.id}`, nombre: co.nombre, sub: `${centroLabel(c.nombre)}${co.coordinador_nombre ? ` · ${co.coordinador_nombre}` : ''}`,
        enPractica: co.fichas_en_practica, aprendices: co.aprendices_en_practica,
        sinInstructor: co.fichas_sin_instructor, extra: co.instructores,
        cobertura: cobertura(co.fichas_en_practica, co.fichas_sin_instructor),
      })))
      .filter(r => r.enPractica > 0)
      .sort((a, b) => b.sinInstructor - a.sinInstructor || b.enPractica - a.enPractica),
    [centros])

  const counts: Record<EstadoFilt, number> = {
    '':            fichas?.length ?? 0,
    EN_EJECUCION:  fichas?.filter(f => f.estado === 'EN_EJECUCION').length ?? 0,
    FINALIZADA:    fichas?.filter(f => f.estado === 'FINALIZADA').length ?? 0,
    SUSPENDIDA:    fichas?.filter(f => f.estado === 'SUSPENDIDA').length ?? 0,
  }

  return (
    <div>
      <div className="dash-header">
        <div>
          <div className="dash-header__eyebrow">Dirección Regional Atlántico</div>
          <h2 className="dash-header__title">Operación de la etapa práctica</h2>
        </div>
      </div>

      {!loading && (
        <div className="prog-chips" style={{ marginBottom: 20 }}>
          {ESTADO_CHIPS.map(c => (
            <button
              key={c.key || 'todas'}
              onClick={() => setEstadoFilt(c.key)}
              className={`prog-chip${estadoFilt === c.key ? ' prog-chip--active' : ''}`}
            >
              {c.label}
              <span className="prog-chip__count">{counts[c.key]}</span>
            </button>
          ))}
        </div>
      )}

      <div className="kpi-grid">
        {loading
          ? [0, 1, 2, 3].map(i => (
              <Card key={i} style={{ padding: 20 }}>
                <Sk w="55%" h={9} delay={i * 40}/>
                <div style={{ marginTop: 14 }}><Sk w="42%" h={26} delay={i * 40 + 20}/></div>
                <div style={{ marginTop: 8 }}><Sk w="60%" h={10} delay={i * 40 + 35}/></div>
              </Card>
            ))
          : <KpiCards agg={agg} fichasFiltradas={fichasFiltradas}/>}
      </div>

      <div className="dash-lower">
        <div className="dash-lower__main">
          <div className="tab-bar">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`tab-btn${tab === t.id ? ' tab-btn--active' : ' tab-btn--inactive'}`}>
                <Ic n={t.icon} s={14} style={{ color: tab === t.id ? '#0a0a0b' : '#a1a1aa' }}/>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <Card style={{ padding: 40 }}><Sk w="40%" h={16}/></Card>
          ) : tab === 'resumen' ? (
            <ResumenTab todas={fichas} filtradas={fichasFiltradas} onOpenFicha={onOpenFicha}/>
          ) : tab === 'centro' ? (
            <CentroBarras rows={rankCentros}/>
          ) : (
            <RankingTable filas={rankCoords} columnaNombre="Coordinación" extraLabel="Instructores"/>
          )}
        </div>
        <aside className="dash-lower__side">
          <QuickActions onNav={onNav}/>
        </aside>
      </div>
    </div>
  )
}
