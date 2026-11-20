import { useState } from 'react'
import { Ic, Card } from '../../components/ui'
import { centroLabel } from '../shared/parts'
import type { FichaRow } from '../shared/FichasAdmin'
import { faseFicha, FORMA_INICIO } from '../shared/fichaFase'
import type { FaseFicha } from '../shared/fichaFase'
import './DashboardHome.css'

// ─── Lenguaje visual de fase operativa ─────────────────────────────────────────
// Mismas 4 fases que FichasAdmin (PRÓXIMA / EN PRÁCTICA / EN CIERRE / FINALIZADA),
// para que el dashboard y el catálogo hablen el mismo idioma. Colores propios,
// separados para que se distingan bien en una dona.

const PRACTICA_COLOR = 'var(--fx-morado)'

const FASES: FaseFicha[] = ['PROXIMA', 'EN_PRACTICA', 'EN_CIERRE', 'FINALIZADA']
const FASE_LABEL: Record<FaseFicha, string> = {
  PROXIMA: 'Próxima a práctica', EN_PRACTICA: 'En práctica', EN_CIERRE: 'En cierre', FINALIZADA: 'Finalizada',
}
const FASE_COLOR: Record<FaseFicha, string> = {
  PROXIMA: 'var(--fx-morado-linea)', EN_PRACTICA: 'var(--fx-morado)', EN_CIERRE: 'var(--fx-aviso)', FINALIZADA: 'var(--fx-linea-2)',
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
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--fx-superficie-2)" strokeWidth={stroke} fill="none"/>
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
                fichas por mes · toca una barra para ver cuáles{totalSin > 0 && <> · <span style={{ color: 'var(--fx-atraso)' }}>rojo</span> = sin instructor</>}
              </div>
            </div>
            <div className="mini-toggle">
              <button className={mode === 'cierres' ? 'on' : ''} onClick={() => { setMode('cierres'); setSel(null) }}>Cierres</button>
              <button className={mode === 'entradas' ? 'on' : ''} onClick={() => { setMode('entradas'); setSel(null) }}>Entradas</button>
            </div>
          </div>

          {barVacio ? (
            <div className="panorama__bar-empty">
              <Ic n="calendar" s={18} style={{ color: 'var(--fx-tinta-4)' }}/>
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
                            {b.sin > 0 && <div style={{ height: `${(b.sin / tot) * 100}%`, background: 'var(--fx-atraso)' }} title={`Sin instructor: ${b.sin}`}/>}
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
                  <span><span className="panorama__legend-dot" style={{ background: 'var(--fx-atraso)' }}/>Sin instructor · {totalSin} (práctica iniciada desde el {FORMA_INICIO.split('-').reverse().join('/')})</span>
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
              <> · <span style={{ color: 'var(--fx-ok)' }}>{pueden.toLocaleString('es-CO')} pueden iniciar</span>
                {' · '}<span style={{ color: 'var(--fx-aviso)' }}>{noPueden.toLocaleString('es-CO')} aún no</span></>
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
                      <span style={{ color: 'var(--fx-ok)', fontWeight: 600 }}>{f.aprendices_pueden}</span> pueden
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
// Regionales, todos en lenguaje de etapa productiva -- salen del rollup de
// GET /centros/resumen (agregado) + el conteo por fecha sobre GET /fichas.

// ─── Tab: Resumen ─────────────────────────────────────────────────────────────

export function ResumenFichas({ todas, filtradas, onOpenFicha }: {
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
// Cómo se reparten las fichas en ejecución por fase de la etapa productiva
// (calculada con fechas, mismos colores de la dona). Sin cobertura de
// instructor: las asignaciones actuales son simulación y eso se mide desde
// FORMA_INICIO.

// ─── Acciones rápidas ───────────────────────────────────────────────────────────

// ─── DashboardHome ─────────────────────────────────────────────────────────────
// Home ejecutivo del super admin, centrado en etapa productiva. Rollup regional
// desde GET /centros/resumen + fichas por fecha desde GET /fichas.
