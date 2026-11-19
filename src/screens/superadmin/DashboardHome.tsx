import { useState, useEffect, useMemo } from 'react'
import { Ic, Card, Prog } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { centroLabel } from '../shared/parts'
import type { FichaRow } from '../shared/FichasAdmin'
import { faseFicha, FORMA_INICIO } from '../shared/fichaFase'
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
// productiva. "Entradas": fichas próximas por mes de inicio. Lo rojo son solo
// las fichas que arrancaron práctica desde FORMA_INICIO sin instructor: antes
// de esa fecha no se mide.
interface Bin { key: string; label: string; total: number; sin: number; fichas: FichaRow[] }

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
  const bins: Bin[] = horizon.map(ym => ({ key: ym, label: ymLabel(ym), total: 0, sin: 0, fichas: [] }))
  const luego: Bin = { key: 'luego', label: 'Luego', total: 0, sin: 0, fichas: [] }

  for (const f of fichas) {
    if (f.estado !== 'EN_EJECUCION') continue
    const fase = faseFicha(f)
    const iso = mode === 'cierres'
      ? (fase === 'EN_PRACTICA' ? f.fecha_fin_productiva : null)
      : (fase === 'PROXIMA' ? f.fecha_inicio_productiva : null)
    if (!iso) continue
    const d = iso.slice(0, 10)
    if (d < hoy) continue
    const slot = d.slice(0, 7) > lastYm ? luego : (bins.find(b => b.key === d.slice(0, 7)) ?? luego)
    slot.total++
    slot.fichas.push(f)
    const inicio = (f.fecha_inicio_productiva ?? '').slice(0, 10)
    if (!f.instructor_practica && inicio >= FORMA_INICIO && inicio <= hoy) slot.sin++
  }
  return luego.total ? [...bins, luego] : bins
}

const CHART_H = 104

// ─── Panorama: pastel (fichas por fase) + barra (calendario) en una tarjeta ────
// Los dos gráficos del resumen viven juntos y compactos: a la izquierda la
// composición por fase (dona), a la derecha cuándo cierran/entran las fichas por
// mes. Antes eran dos tarjetas apiladas que ocupaban media pantalla.

function PanoramaResumen({ segments, fichas, filtrado, onOpenFicha }: {
  segments: Segmento[]; fichas: FichaRow[]; filtrado: boolean; onOpenFicha?: (id: number) => void
}) {
  "use no memo"
  const [mode, setMode] = useState<'cierres' | 'entradas'>('cierres')
  const [sel, setSel] = useState<string | null>(null)
  const hoy = new Date().toISOString().slice(0, 10)
  const bins = buildBins(fichas, mode, hoy)
  const max = Math.max(1, ...bins.map(b => b.total))
  const totalSin = bins.reduce((a, b) => a + b.sin, 0)
  const barVacio = bins.every(b => b.total === 0)
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
                fichas por mes · toca una barra para ver cuáles{totalSin > 0 && <> · <span style={{ color: '#b91c1c' }}>rojo</span> = sin instructor</>}
              </div>
            </div>
            <div className="mini-toggle">
              <button className={mode === 'cierres' ? 'on' : ''} onClick={() => { setMode('cierres'); setSel(null) }}>Cierres</button>
              <button className={mode === 'entradas' ? 'on' : ''} onClick={() => { setMode('entradas'); setSel(null) }}>Entradas</button>
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
                  const tot = b.total
                  const h = Math.round((tot / max) * CHART_H)
                  return (
                    <button key={b.key} type="button" disabled={tot === 0}
                      className={`cierres-col cierres-col--btn${sel === b.key ? ' cierres-col--sel' : ''}`}
                      onClick={() => setSel(sel === b.key ? null : b.key)}
                      title={tot ? `Ver las ${tot} fichas de ${b.label}` : undefined}>
                      <div className="cierres-val">{tot > 0 ? tot : ''}</div>
                      <div className="cierres-bar-wrap" style={{ height: CHART_H }}>
                        {tot > 0 && (
                          <div className="cierres-bar" style={{ height: h }} title={`${b.label}: ${tot} fichas`}>
                            {b.sin > 0 && <div style={{ height: `${(b.sin / tot) * 100}%`, background: '#dc2626' }} title={`Sin instructor: ${b.sin}`}/>}
                            <div style={{ height: `${((tot - b.sin) / tot) * 100}%`, background: PRACTICA_COLOR }}/>
                          </div>
                        )}
                      </div>
                      <div className="cierres-lbl">{b.label}</div>
                    </button>
                  )
                })}
              </div>
              {totalSin > 0 && (
                <div className="panorama__bar-legend">
                  <span><span className="panorama__legend-dot" style={{ background: '#dc2626' }}/>Sin instructor · {totalSin} (práctica iniciada desde el {FORMA_INICIO.split('-').reverse().join('/')})</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      {sel && (() => {
        const b = bins.find(x => x.key === sel)
        return b && b.fichas.length > 0
          ? <DetalleMes bin={b} mode={mode} onCerrar={() => setSel(null)} onOpenFicha={onOpenFicha}/>
          : null
      })()}
    </Card>
  )
}

// Las fichas de una barra: de qué centro, programa y coordinación son, con sus
// fechas de práctica, aprendices e instructor. El resumen por centro filtra.
function DetalleMes({ bin, mode, onCerrar, onOpenFicha }: {
  bin: Bin; mode: 'cierres' | 'entradas'; onCerrar: () => void; onOpenFicha?: (id: number) => void
}) {
  "use no memo"
  const [centro, setCentro] = useState<string | null>(null)
  const porCentro = [...bin.fichas.reduce((m, f) => {
    const k = f.centro_nombre ?? 'Sin centro'
    return m.set(k, (m.get(k) ?? 0) + 1)
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const lista = bin.fichas
    .filter(f => !centro || (f.centro_nombre ?? 'Sin centro') === centro)
    .sort((a, b) => (mode === 'entradas'
      ? (a.fecha_inicio_productiva ?? '').localeCompare(b.fecha_inicio_productiva ?? '')
      : (a.fecha_fin_productiva ?? '').localeCompare(b.fecha_fin_productiva ?? ''))
      || a.programa_nombre.localeCompare(b.programa_nombre, 'es'))
  // Del reporte de juicios; si la ficha aún no está ahí, los activos del PE-04.
  const nAprendices = (f: FichaRow) => f.aprendices || f.sofia_total_activos || 0
  const aprendices = lista.reduce((a, f) => a + nAprendices(f), 0)
  const sinInstr = lista.filter(f => !f.instructor_practica).length
  // Entradas: quién puede iniciar según el último reporte de juicios (scraper).
  const conJuicios = mode === 'entradas' ? lista.filter(f => f.aprendices_pueden != null) : []
  const pueden = conJuicios.reduce((a, f) => a + (f.aprendices_pueden ?? 0), 0)
  const noPueden = conJuicios.reduce((a, f) => a + (f.aprendices_no_pueden ?? 0), 0)
  const sinReporte = mode === 'entradas' ? lista.length - conJuicios.length : 0
  const fecha = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }).replace('.', '') : '—')
  const coord = (n: string | null) => (n ? n.replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '') : 'Sin coordinación')

  return (
    <div className="dm">
      <div className="dm__cab">
        <div>
          <div className="dm__titulo">
            {mode === 'entradas' ? 'Entran a práctica' : 'Cierran práctica'} en {bin.label === 'Luego' ? 'meses posteriores' : bin.label}
          </div>
          <div className="dm__sub">
            {lista.length} ficha{lista.length === 1 ? '' : 's'} · {aprendices.toLocaleString('es-CO')} aprendices
            {sinInstr > 0 && ` · ${sinInstr} aún sin instructor`}
            {conJuicios.length > 0 && (
              <> · <span style={{ color: '#15803d' }}>{pueden.toLocaleString('es-CO')} pueden iniciar</span>
                {' · '}<span style={{ color: '#b45309' }}>{noPueden.toLocaleString('es-CO')} aún no</span></>
            )}
            {sinReporte > 0 && ` · ${sinReporte} ficha${sinReporte === 1 ? '' : 's'} sin reporte de juicios`}
          </div>
        </div>
        <button type="button" className="dm__cerrar" onClick={onCerrar} aria-label="Cerrar"><Ic n="x" s={14}/></button>
      </div>

      <div className="dm__centros">
        {porCentro.map(([c, n]) => (
          <button key={c} type="button" className={`dm__centro${centro === c ? ' dm__centro--on' : ''}`} onClick={() => setCentro(centro === c ? null : c)}>
            {c === 'Sin centro' ? c : centroLabel(c)} <b>{n}</b>
          </button>
        ))}
      </div>

      <div className="dm__tabla-scroll">
        <table className="dm__tabla">
          <thead>
            <tr>
              <th>Ficha</th><th>Programa</th><th>Centro · coordinación</th>
              <th>Práctica</th><th className="dm__num">Aprendices</th><th>Instructor</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(f => (
              <tr key={f.id} onClick={() => onOpenFicha?.(f.id)} className={onOpenFicha ? 'dm__fila--click' : undefined}>
                <td><span className="dm__mono">{f.numero_ficha}</span></td>
                <td>
                  <div className="dm__prog" title={f.programa_nombre}>{f.programa_nombre}</div>
                  <div className="dm__meta">{[f.nivel_formacion, f.jornada ?? f.sofia_jornada, f.modalidad_formacion, f.sofia_municipio].filter(Boolean).join(' · ') || f.programa_codigo}</div>
                </td>
                <td>
                  <div>{f.centro_nombre ? centroLabel(f.centro_nombre) : '—'}</div>
                  <div className="dm__meta" title={f.coordinacion_nombre ?? undefined}>{coord(f.coordinacion_nombre)}</div>
                </td>
                <td className="dm__nowrap">
                  <div>{fecha(f.fecha_inicio_productiva)} → {fecha(f.fecha_fin_productiva)}</div>
                </td>
                <td className="dm__num">
                  {mode === 'entradas' && f.aprendices_pueden != null ? (
                    <span title={`Reporte de juicios del ${fecha(f.juicios_fecha ?? null)}`}>
                      <span style={{ color: '#15803d', fontWeight: 600 }}>{f.aprendices_pueden}</span> pueden
                      <div className="dm__meta">{f.aprendices_no_pueden ?? 0} aún no</div>
                    </span>
                  ) : (nAprendices(f) || '—')}
                </td>
                <td>{f.instructor_practica ?? <span className="dm__meta">Sin asignar</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

function ResumenTab({ todas, filtradas, onOpenFicha }: {
  todas: FichaRow[]; filtradas: FichaRow[]; onOpenFicha?: (id: number) => void
}) {
  const faseSegs: Segmento[] = FASES.map(k => ({
    key: k, label: FASE_LABEL[k], color: FASE_COLOR[k],
    value: filtradas.filter(f => faseFicha(f) === k).length,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PanoramaResumen segments={faseSegs} fichas={filtradas} filtrado={filtradas.length !== todas.length} onOpenFicha={onOpenFicha}/>
    </div>
  )
}

// ─── Tabs: por centro / por coordinación ────────────────────────────────────
// Cómo se reparten las fichas en ejecución por fase de la etapa práctica
// (calculada con fechas, mismos colores de la dona). Sin cobertura de
// instructor: las asignaciones actuales son simulación y eso se mide desde
// FORMA_INICIO.

interface Grupo {
  key: string; nombre: string; sub: string | null; centro: string
  proximas: number; proximas3m: number; enPractica: number; enCierre: number; aprendices: number
}
type Agrupar = 'centro' | 'coordinacion'
const FASES_BARRA: { k: 'proximas3m' | 'enPractica' | 'enCierre'; fase: FaseFicha; label: string }[] = [
  { k: 'enPractica', fase: 'EN_PRACTICA', label: 'En práctica' },
  { k: 'enCierre',   fase: 'EN_CIERRE',   label: 'En cierre' },
  { k: 'proximas3m', fase: 'PROXIMA',     label: 'Entran en 3 meses' },
]

function agrupar(fichas: FichaRow[], por: Agrupar): Grupo[] {
  const hoy = new Date()
  const en3m = new Date(hoy.getFullYear(), hoy.getMonth() + 3, hoy.getDate()).toISOString().slice(0, 10)
  const m = new Map<string, Grupo>()
  for (const f of fichas) {
    if (f.estado !== 'EN_EJECUCION') continue
    const fase = faseFicha(f)
    if (fase === 'FINALIZADA') continue
    const centro = f.centro_nombre ? centroLabel(f.centro_nombre) : 'Sin centro'
    const key = por === 'centro' ? `c${f.centro_formacion_id}` : `${f.centro_formacion_id}-${f.coordinacion_academica_id ?? 'sin'}`
    const g = m.get(key) ?? {
      key, centro,
      nombre: por === 'centro' ? centro : (f.coordinacion_nombre ?? 'Sin coordinación').replace(/^Coordinaci[oó]n Acad[eé]mica de /i, ''),
      sub: por === 'centro' ? null : (f.coordinacion_academica_id ? f.coordinador_nombre : 'Sus fichas aún no tienen coordinación'),
      proximas: 0, proximas3m: 0, enPractica: 0, enCierre: 0, aprendices: 0,
    }
    if (fase === 'PROXIMA') {
      g.proximas++
      if ((f.fecha_inicio_productiva ?? '9999').slice(0, 10) <= en3m) g.proximas3m++
    } else if (fase === 'EN_PRACTICA') {
      g.enPractica++; g.aprendices += f.aprendices_en_practica
    } else {
      g.enCierre++; g.aprendices += f.aprendices_en_practica
    }
    m.set(key, g)
  }
  const sinCoord = (g: Grupo) => (g.nombre === 'Sin coordinación' ? 1 : 0)
  return [...m.values()].sort((a, b) => sinCoord(a) - sinCoord(b) || b.enPractica - a.enPractica
    || b.proximas3m - a.proximas3m || a.nombre.localeCompare(b.nombre, 'es'))
}

function FilaGrupo({ g, max, i }: { g: Grupo; max: number; i: number }) {
  const total = g.proximas3m + g.enPractica + g.enCierre
  return (
    <div className={`pg-fila${g.nombre === 'Sin coordinación' ? ' pg-fila--sin' : ''}`} style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <div className="pg-fila__nombre">
        <span title={g.nombre}>{g.nombre}</span>
        {g.sub && <small>{g.sub}</small>}
      </div>
      <div className="pg-fila__barra" title={`${g.enPractica} en práctica · ${g.enCierre} en cierre · ${g.proximas3m} entran en 3 meses (${g.proximas} próximas en total)`}>
        <div className="pg-fila__pista" style={{ width: `${(total / max) * 100}%` }}>
          {FASES_BARRA.map(({ k, fase }) => g[k] > 0 && (
            <span key={k} style={{ flexGrow: g[k], background: FASE_COLOR[fase] }}/>
          ))}
        </div>
      </div>
      <div className="pg-dato"><b>{g.enPractica + g.enCierre}</b><span>en práctica</span></div>
      <div className="pg-dato"><b>{g.proximas3m}</b><span>entran en 3 meses</span></div>
      <div className="pg-dato"><b>{g.aprendices.toLocaleString('es-CO')}</b><span>aprendices en práctica</span></div>
    </div>
  )
}

function PanoramaGrupos({ fichas, por }: { fichas: FichaRow[]; por: Agrupar }) {
  "use no memo"
  const [centro, setCentro] = useState<string | null>(null)
  const grupos = agrupar(fichas, por)
  if (grupos.length === 0) return <EmptyState icon="folder" title="Sin datos" sub="No hay fichas en ejecución para mostrar."/>
  const centros = [...new Set(grupos.map(g => g.centro))].sort((a, b) => a.localeCompare(b, 'es'))
  const visibles = grupos.filter(g => !centro || g.centro === centro)
  const max = Math.max(1, ...visibles.map(g => g.proximas3m + g.enPractica + g.enCierre))
  const porCentro = por === 'coordinacion' && !centro
    ? centros.map(c => ({ c, gs: visibles.filter(g => g.centro === c) })).filter(x => x.gs.length)
    : [{ c: null as string | null, gs: visibles }]

  return (
    <Card style={{ padding: 20 }}>
      <div className="pg-cab">
        <div className="section-title" style={{ marginBottom: 0 }}>
          Fichas en ejecución por {por === 'centro' ? 'centro' : 'coordinación'}
        </div>
        <div className="pg-leyenda">
          {FASES_BARRA.map(({ fase, label }) => (
            <span key={fase}><i style={{ background: FASE_COLOR[fase] }}/>{label}</span>
          ))}
        </div>
      </div>
      {por === 'coordinacion' && (
        <div className="pg-centros">
          <button type="button" className={`pg-centro${!centro ? ' pg-centro--on' : ''}`} onClick={() => setCentro(null)}>Todos</button>
          {centros.map(c => (
            <button key={c} type="button" className={`pg-centro${centro === c ? ' pg-centro--on' : ''}`} onClick={() => setCentro(centro === c ? null : c)}>{c}</button>
          ))}
        </div>
      )}
      {porCentro.map(({ c, gs }) => (
        <div key={c ?? 'todos'} className="pg-grupo">
          {c && <div className="pg-grupo__titulo">{c}</div>}
          {gs.map((g, i) => <FilaGrupo key={g.key} g={g} max={max} i={i}/>)}
        </div>
      ))}
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
  // El subdirector ve su centro, no la regional.
  const yo = useAuthStore(st => st.user)
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
          <div className="dash-header__eyebrow">{yo?.rol === 'SUBDIRECTOR' ? `Subdirección · ${yo.centro_formacion ?? 'tu centro'}` : 'Dirección Regional Atlántico'}</div>
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
          ) : (
            <PanoramaGrupos key={tab} fichas={fichasFiltradas} por={tab === 'centro' ? 'centro' : 'coordinacion'}/>
          )}
        </div>
        <aside className="dash-lower__side">
          <QuickActions onNav={onNav}/>
        </aside>
      </div>
    </div>
  )
}
