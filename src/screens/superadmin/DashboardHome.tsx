import { useState, useEffect, useMemo } from 'react'
import { Ic, Card, Prog } from '../../components/ui'
import type { IcName } from '../../components/ui'
import api from '../../lib/api'
import { diasHasta } from '../shared/parts'
import type { FichaRow } from '../shared/FichasAdmin'
import './DashboardHome.css'

// Solo los campos estructurales de `/dashboard/super-admin/resumen` que
// siguen aplicando sin currículo -- el resto del payload (programas
// digitalizados, fichas en riesgo por avance lectivo, etc.) ya no se usa.
interface ResumenKPI {
  instructores_activos_semana:  number
  instructores_total_asignados: number
}

interface CentroMin { id: number; nombre: string; codigo: string; coordinaciones_academicas: number }
interface CoordMin  { id: number; nombre: string; centro_formacion_id: number | null }

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

// ─── Estado/etapa: mismos colores que ya usan EstadoPill/EtapaPill en
// FichasAdmin.tsx, para que el lenguaje visual sea el mismo en toda la app ──

type EstadoFilt = '' | 'EN_EJECUCION' | 'FINALIZADA' | 'SUSPENDIDA'

const ESTADO_CHIPS: { key: EstadoFilt; label: string }[] = [
  { key: '',             label: 'Todas'        },
  { key: 'EN_EJECUCION', label: 'En ejecución' },
  { key: 'FINALIZADA',   label: 'Finalizadas'  },
  { key: 'SUSPENDIDA',   label: 'Suspendidas'  },
]

// Paleta validada con scripts/validate_palette.js (skill dataviz): teal para
// "En ejecución" en vez del verde original (que junto al rojo de
// "Suspendida" y el azul de "Finalizada" quedaba demasiado cerca en tono);
// #0d9488 / #2563eb / #dc2626 pasan las 5 verificaciones (lightness, chroma,
// separación CVD, piso de visión normal y contraste). El gris de "Lectiva"
// es intencional (categoría recesiva frente a "Práctica"), pero se sube a
// #71717a para cruzar el piso de contraste 3:1; su chroma floor sigue en
// FAIL a propósito (mitigado con el label directo en la leyenda).
const ESTADO_COLOR: Record<string, string> = { EN_EJECUCION: '#0d9488', FINALIZADA: '#2563eb', SUSPENDIDA: '#dc2626' }
const ESTADO_LABEL: Record<string, string> = { EN_EJECUCION: 'En ejecución', FINALIZADA: 'Finalizada', SUSPENDIDA: 'Suspendida' }
const PRACTICA_COLOR = '#4f46e5'
const LECTIVA_COLOR  = '#71717a'

// ─── Barra apilada genérica (un total, N segmentos con color fijo por categoría) ─
// Estilo "segmented progress bar" delgado: cada categoría es su propia
// píldora redondeada separada por un gap real (no un borde blanco cortando
// la barra) -- mark spec del skill dataviz (extremos redondeados, 2px+ de
// separación entre fills). A esta altura no entra texto legible dentro del
// segmento, así que valor y % van en la leyenda de abajo (label directo).

interface Segmento { key: string; label: string; value: number; color: string }

function SingleStackedBar({ segments, height = 9 }: { segments: Segmento[]; height?: number }) {
  const total = segments.reduce((a, s) => a + s.value, 0)
  const visibles = segments.filter(s => s.value > 0)
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height, background: total === 0 ? '#f1f1f3' : 'transparent', borderRadius: height }}>
        {total === 0
          ? null
          : visibles.map(s => (
            <div
              key={s.key}
              title={`${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`}
              style={{ flex: s.value, background: s.color, borderRadius: height, minWidth: height, transition: 'flex 200ms ease' }}
            />
          ))}
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        {segments.map(s => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0
          return (
            <div key={s.key} className="legend-item" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px 3px 7px',
              borderRadius: 20, background: '#f7f7f8', fontSize: 11.5,
            }}>
              <span className="legend-dot" style={{ background: s.color, width: 7, height: 7, borderRadius: '50%' }}/>
              <span style={{ color: '#52525b' }}>{s.label}</span>
              <strong style={{ color: '#18181b', fontFamily: '"JetBrains Mono", monospace', fontWeight: 700 }}>{s.value}</strong>
              <span style={{ color: '#a1a1aa', fontFamily: '"JetBrains Mono", monospace' }}>{pct}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── KPI cards ──────────────────────────────────────────────────────────────────

function KpiCards({ resumen, fichasFiltradas, centros }: {
  resumen: ResumenKPI | null; fichasFiltradas: FichaRow[]; centros: CentroMin[]
}) {
  const enPractica = fichasFiltradas.filter(f => f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA')
  const conDias = enPractica
    .map(f => ({ f, dias: diasHasta(f.fecha_fin_productiva) }))
    .filter((x): x is { f: FichaRow; dias: number } => x.dias != null)
  const vencidasCount = conDias.filter(x => x.dias < 0).length
  const cierranPronto = conDias.filter(x => x.dias >= 0 && x.dias <= 30).length
  const activasCount = fichasFiltradas.filter(f => f.estado === 'EN_EJECUCION').length

  const activePct = resumen && resumen.instructores_total_asignados > 0
    ? Math.round((resumen.instructores_activos_semana / resumen.instructores_total_asignados) * 100)
    : 0

  const coordinaciones = centros.reduce((a, c) => a + c.coordinaciones_academicas, 0)

  return (
    <>
      {/* Fichas en etapa productiva */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Fichas en etapa práctica</div>
          <Ic n="briefcase" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {enPractica.length}
          <span className="kpi2-value-sub"> / {activasCount} en ejecución</span>
        </div>
        <div className="kpi2-sub" style={{ color: vencidasCount > 0 ? '#dc2626' : cierranPronto > 0 ? '#c2410c' : undefined }}>
          {vencidasCount > 0
            ? `${vencidasCount} vencida${vencidasCount === 1 ? '' : 's'} sin cerrar`
            : cierranPronto > 0 ? `${cierranPronto} cierran en ≤30 días` : 'Ninguna cierra en los próximos 30 días'}
        </div>
      </Card>

      {/* Instructores activos */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Instructores activos</div>
          <Ic n="users" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {resumen?.instructores_activos_semana ?? '—'}
          <span className="kpi2-value-sub"> / {resumen?.instructores_total_asignados ?? '—'}</span>
        </div>
        <Prog value={activePct} style={{ marginTop: 10 }}/>
        <div className="kpi2-sub">{activePct}% activos esta semana</div>
      </Card>

      {/* Estructura regional */}
      <Card style={{ padding: 20 }}>
        <div className="kpi2-head">
          <div className="kpi2-label">Centros y coordinaciones</div>
          <Ic n="shield" s={16} style={{ color: '#4f46e5' }}/>
        </div>
        <div className="kpi2-value">
          {centros.length}
          <span className="kpi2-value-sub"> centros</span>
        </div>
        <div className="kpi2-sub">{coordinaciones} coordinaciones académicas</div>
      </Card>
    </>
  )
}

// ─── Listas de fichas por fecha (vencidas / cierran pronto / van a práctica) ────
// Un mismo componente para las 3: cada una es una lista de fichas con "días"
// (negativo = ya pasó la fecha, positivo = faltan) contra una fecha de
// referencia distinta -- ver los 3 usos en ResumenTab.

interface FichaConDias { f: FichaRow; dias: number }

function fichasConDias(fichas: FichaRow[], fechaFn: (f: FichaRow) => string | null, tope: number): FichaConDias[] {
  return fichas
    .map(f => ({ f, dias: diasHasta(fechaFn(f)) }))
    .filter((x): x is FichaConDias => x.dias != null && x.dias <= tope)
    .sort((a, b) => a.dias - b.dias)
}

// Etiqueta/color compartidos: negativo = ya pasó (crítico), positivo = faltan (alerta).
function diasLabel(dias: number): string { return dias < 0 ? `${Math.abs(dias)}d vencida` : dias === 0 ? 'Hoy' : `${dias}d` }
function diasColor(dias: number): string { return dias < 0 ? '#dc2626' : dias <= 7 ? '#c2410c' : '#a16207' }

// ─── Panel de alertas de fecha: control total en un solo lugar ───────────────
// Las 3 categorías (vencidas / cierran pronto / van a práctica) como tabs de
// un mismo panel en vez de 3 listas apiladas -- con buscador propio y la
// lista COMPLETA con scroll interno (no solo un preview de 8 con "+N más").

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
      {/* Tabs de categoría */}
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

      {/* Buscador de la categoría activa */}
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

      {/* Lista completa, con scroll interno */}
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

      {/* Footer: cuántas se están viendo */}
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
  // El desglose por estado usa SIEMPRE el universo completo (no el filtrado
  // por el chip) -- es lo que le da contexto visual a los chips de arriba.
  const porEstado: Segmento[] = (['EN_EJECUCION', 'FINALIZADA', 'SUSPENDIDA'] as const).map(k => ({
    key: k, label: ESTADO_LABEL[k], value: todas.filter(f => f.estado === k).length, color: ESTADO_COLOR[k],
  }))

  // La etapa (práctica/lectiva) solo tiene sentido sobre fichas activas, y sí
  // respeta el filtro -- responde "de lo que estoy viendo, cuánto ya pasó a práctica".
  const activasFiltradas = filtradas.filter(f => f.estado === 'EN_EJECUCION')
  const porEtapa: Segmento[] = [
    { key: 'PRACTICA', label: 'Práctica', value: activasFiltradas.filter(f => f.etapa_actual_teorica === 'PRACTICA').length, color: PRACTICA_COLOR },
    { key: 'LECTIVA',  label: 'Lectiva',  value: activasFiltradas.filter(f => f.etapa_actual_teorica !== 'PRACTICA').length, color: LECTIVA_COLOR },
  ]

  // En práctica, contra fecha_fin_productiva: lo que ya venció (crítico) vs.
  // lo que cierra en los próximos 30 días.
  const enPractica  = activasFiltradas.filter(f => f.etapa_actual_teorica === 'PRACTICA')
  const vencidas    = fichasConDias(enPractica, f => f.fecha_fin_productiva, -1)
  const cierranPronto = fichasConDias(enPractica, f => f.fecha_fin_productiva, 30).filter(x => x.dias >= 0)

  // Todavía en lectiva, contra fecha_inicio_productiva (si ya se definió) o
  // fecha_fin_lectiva como proxy -- negativo = ya debería haber pasado a
  // práctica y sigue en lectiva.
  const enLectiva = activasFiltradas.filter(f => f.etapa_actual_teorica !== 'PRACTICA')
  const vanAPractica = fichasConDias(enLectiva, f => f.fecha_inicio_productiva ?? f.fecha_fin_lectiva, 30)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <Card style={{ padding: 20 }}>
        <div className="section-title">Fichas por estado · toda la regional</div>
        <SingleStackedBar segments={porEstado}/>

        <div style={{ height: 1, background: '#f1f1f3', margin: '22px 0' }}/>

        <div className="section-title">Etapa de las fichas en ejecución{filtradas.length !== todas.length ? ' · filtro actual' : ''}</div>
        {activasFiltradas.length === 0
          ? <div style={{ fontSize: 12.5, color: '#a1a1aa' }}>Sin fichas en ejecución en el filtro actual.</div>
          : <SingleStackedBar segments={porEtapa}/>}
      </Card>

      <div>
        <div className="section-title">Fichas que requieren seguimiento por fecha</div>
        <AlertasFichas vencidas={vencidas} cierranPronto={cierranPronto} vanAPractica={vanAPractica} onOpenFicha={onOpenFicha}/>
      </div>
    </div>
  )
}

// ─── Tabs: ranking por coordinación / por centro ───────────────────────────────
// Lo más accionable del panel: quién necesita atención primero. Se ordena por
// "cierran pronto" desc -- ninguna llamada nueva, todo agregado client-side
// sobre /fichas (ya cargado) + /coordinaciones o /dashboard/super-admin/centros.

interface FilaRanking { id: number | string; nombre: string; total: number; practica: number; vencidas: number; cierranPronto: number; finalizadas: number }

function agrupar(fichas: FichaRow[], keyFn: (f: FichaRow) => number | string | null, nombres: Map<number | string, string>, fallback: string): FilaRanking[] {
  const map = new Map<number | string, FilaRanking>()
  for (const f of fichas) {
    const key = keyFn(f) ?? '__sin_asignar__'
    if (!map.has(key)) {
      map.set(key, { id: key, nombre: key === '__sin_asignar__' ? fallback : (nombres.get(key) ?? `#${key}`), total: 0, practica: 0, vencidas: 0, cierranPronto: 0, finalizadas: 0 })
    }
    const row = map.get(key)!
    row.total++
    if (f.estado === 'FINALIZADA') row.finalizadas++
    if (f.estado === 'EN_EJECUCION' && f.etapa_actual_teorica === 'PRACTICA') {
      row.practica++
      const d = diasHasta(f.fecha_fin_productiva)
      if (d != null) {
        if (d < 0) row.vencidas++
        else if (d <= 30) row.cierranPronto++
      }
    }
  }
  return [...map.values()].sort((a, b) => b.vencidas - a.vencidas || b.cierranPronto - a.cierranPronto || b.practica - a.practica)
}

function RankingTable({ filas, columnaNombre }: { filas: FilaRanking[]; columnaNombre: string }) {
  if (filas.length === 0) return <EmptyState icon="folder" title="Sin datos" sub="No hay fichas en el filtro actual."/>
  return (
    <Card style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr className="data-table__head-row">
            <th className="data-table__th">{columnaNombre}</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Total</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>En práctica</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Vencidas</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Cierran ≤30d</th>
            <th className="data-table__th" style={{ textAlign: 'right' }}>Finalizadas</th>
            <th className="data-table__th" style={{ minWidth: 140 }}>Práctica / activas</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #f1f1f3' }}>
              <td className="data-table__td--name">{r.nombre}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right' }}>{r.total}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: PRACTICA_COLOR }}>{r.practica}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: r.vencidas > 0 ? '#dc2626' : '#a1a1aa' }}>{r.vencidas}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: r.cierranPronto > 0 ? '#c2410c' : '#a1a1aa' }}>{r.cierranPronto}</td>
              <td className="data-table__td--fichas" style={{ textAlign: 'right', color: ESTADO_COLOR.FINALIZADA }}>{r.finalizadas}</td>
              <td className="data-table__td" style={{ minWidth: 140 }}>
                <Prog value={r.total > 0 ? Math.round((r.practica / r.total) * 100) : 0} showLabel/>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </Card>
  )
}

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
// Home ejecutivo del Super Admin, centrado en etapa productiva: chips de
// estado (filtran todo el panel), KPIs regionales, y 3 vistas (Resumen / Por
// coordinación / Por centro) para decidir dónde hace falta intervenir.
// Todo agregado client-side sobre /fichas -- ninguna llamada nueva al backend.
type TabId = 'resumen' | 'coordinacion' | 'centro'
const TABS: { id: TabId; label: string; icon: IcName }[] = [
  { id: 'resumen',      label: 'Resumen',            icon: 'trend'  },
  { id: 'coordinacion', label: 'Por coordinación',   icon: 'users'  },
  { id: 'centro',       label: 'Por centro',         icon: 'shield' },
]

export function DashboardHome({ onNav, onOpenFicha }: { onNav?: (id: string) => void; onOpenFicha?: (id: number) => void }) {
  "use no memo"
  const [resumen, setResumen] = useState<ResumenKPI | null>(null)
  const [fichas,  setFichas]  = useState<FichaRow[] | null>(null)
  const [centros, setCentros] = useState<CentroMin[] | null>(null)
  const [coords,  setCoords]  = useState<CoordMin[] | null>(null)
  const [estadoFilt, setEstadoFilt] = useState<EstadoFilt>('')
  const [tab, setTab] = useState<TabId>('resumen')

  useEffect(() => {
    api.get<ResumenKPI>('/dashboard/super-admin/resumen').then(r => setResumen(r.data)).catch(() => {})
    api.get<FichaRow[]>('/fichas').then(r => setFichas(r.data)).catch(() => setFichas([]))
    api.get<CentroMin[]>('/dashboard/super-admin/centros').then(r => setCentros(r.data)).catch(() => setCentros([]))
    api.get<CoordMin[]>('/coordinaciones').then(r => setCoords(r.data)).catch(() => setCoords([]))
  }, [])

  const loading = fichas === null || centros === null || coords === null

  const fichasFiltradas = useMemo(
    () => (fichas ?? []).filter(f => !estadoFilt || f.estado === estadoFilt),
    [fichas, estadoFilt],
  )

  const coordNombres = useMemo(() => new Map((coords ?? []).map(c => [c.id, c.nombre])), [coords])
  const centroNombres = useMemo(() => new Map((centros ?? []).map(c => [c.id, `${c.codigo} · ${c.nombre}`])), [centros])

  const porCoordinacion = useMemo(
    () => agrupar(fichasFiltradas, f => f.coordinacion_academica_id, coordNombres, 'Sin coordinación'),
    [fichasFiltradas, coordNombres],
  )
  const porCentro = useMemo(
    () => agrupar(fichasFiltradas, f => f.centro_formacion_id, centroNombres, 'Sin centro'),
    [fichasFiltradas, centroNombres],
  )

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
          <div className="dash-header__eyebrow">Dirección General</div>
          <h2 className="dash-header__title">Operación de la plataforma</h2>
        </div>
      </div>

      {/* Chips de estado -- filtran KPIs, gráficos y rankings de todo el panel */}
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
          ? [0, 1, 2].map(i => (
              <Card key={i} style={{ padding: 20 }}>
                <Sk w="55%" h={9} delay={i * 40}/>
                <div style={{ marginTop: 14 }}><Sk w="42%" h={26} delay={i * 40 + 20}/></div>
                <div style={{ marginTop: 8 }}><Sk w="60%" h={10} delay={i * 40 + 35}/></div>
              </Card>
            ))
          : <KpiCards resumen={resumen} fichasFiltradas={fichasFiltradas} centros={centros}/>}
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
          ) : tab === 'coordinacion' ? (
            <RankingTable filas={porCoordinacion} columnaNombre="Coordinación"/>
          ) : (
            <RankingTable filas={porCentro} columnaNombre="Centro"/>
          )}
        </div>
        <aside className="dash-lower__side">
          <QuickActions onNav={onNav}/>
        </aside>
      </div>
    </div>
  )
}
