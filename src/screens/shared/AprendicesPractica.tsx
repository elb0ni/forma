import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { Ic, Card, Ava, Bdg, Modal } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { ProgresoPracticaPopover } from './ProgresoPractica'
import type { AnclaPopover } from './ProgresoPractica'

// ─── Tipos y helpers compartidos entre la vista de coordinador/admin
// (FichasAdmin) y la del instructor (InstFichas) para el roster de
// aprendices de una ficha en etapa práctica -- viene de
// GET /fichas/:id/detalle (campo `aprendices`), sin restricción de
// rol en el backend.

export type CasoAprendizPractica = 'SIN_ALTERNATIVA' | 'LISTO_PARA_INICIAR' | 'EN_CURSO' | 'TERMINADA_SIN_JUICIO' | 'CONCLUIDA'

export interface AprendizPractica {
  aprendiz_id: number | null
  etapa_id: number | null
  numero_documento: string; tipo_documento: string; nombre_completo: string
  modalidad: string | null; etapa_estado: string | null; resultado_final: 'APROBADO' | 'NO_APROBADO' | null
  etapa_instructor_nombre: string | null
  total_ra: number | null; ra_aprobados: number | null; ra_no_aprobados: number | null; ra_sin_evaluar: number | null
  fecha_reporte: string | null
  caso: CasoAprendizPractica
}

export interface InstructorPracticaInfo { nombre: string; fecha_inicio: string }

export const MODALIDAD_LABEL: Record<string, string> = {
  CONTRATO_APRENDIZAJE: 'Contrato de aprendizaje',
  VINCULO_LABORAL: 'Vínculo laboral',
  MONITORIA: 'Monitoría',
  UNIDAD_PRODUCTIVA: 'Unidad productiva',
}

// ─── Los 5 casos del aprendiz en etapa práctica ─────────────────────────────
// El backend (ficha.service.ts::casoAprendizPractica) ya clasifica cada
// aprendiz en uno de estos 5 casos cruzando el último reporte de juicios de
// SofiaPlus con su etapa_productiva. Acá los etiquetamos y los mostramos SIEMPRE
// en el orden de su número de caso (Caso 1 → Caso 5) -- así la barra de resumen
// y la agrupación de la tabla leen igual que la referencia del modal "Casos".
//
//   CONCLUIDA            (Caso 1) → juicios en 10/10, solo falta certificar en Sofia.
//   TERMINADA_SIN_JUICIO (Caso 2) → ya terminó la práctica (tenemos la sesión final)
//                                   pero Sofia todavía no carga el juicio 10/10.
//   EN_CURSO             (Caso 3) → con alternativa asignada y juicios al día (9/10),
//                                   etapa productiva abierta. Necesita seguimiento.
//   LISTO_PARA_INICIAR   (Caso 4) → juicios 9/10 pero sin alternativa elegida;
//                                   ya puede empezar.
//   SIN_ALTERNATIVA      (Caso 5) → le falta más de un juicio y no tiene alternativa
//                                   ni cómo asignársela. Crítico.
export const CASO_ORDER: CasoAprendizPractica[] = [
  'CONCLUIDA',
  'TERMINADA_SIN_JUICIO',
  'EN_CURSO',
  'LISTO_PARA_INICIAR',
  'SIN_ALTERNATIVA',
]

type CasoTone = 'ok' | 'err' | 'warn' | 'accent' | 'neutral' | 'blue'

export const CASO_META: Record<CasoAprendizPractica, {
  label: string; tone: CasoTone; color: string; icon: IcName; hint: string
}> = {
  EN_CURSO: {
    label: 'Con seguimiento', tone: 'accent', color: '#4f46e5', icon: 'briefcase',
    hint: 'Con alternativa y juicios al día (9/10). Necesita seguimiento.',
  },
  CONCLUIDA: {
    label: 'Por certificar', tone: 'ok', color: '#16a34a', icon: 'checkCircle',
    hint: 'Juicios en 10/10. Solo falta certificar en SENA Sofia.',
  },
  TERMINADA_SIN_JUICIO: {
    label: 'Falta juicio final', tone: 'blue', color: '#0891b2', icon: 'clock',
    hint: 'Ya terminó la práctica; Sofia aún no carga el juicio 10/10.',
  },
  LISTO_PARA_INICIAR: {
    label: 'Puede iniciar', tone: 'warn', color: '#d97706', icon: 'target',
    hint: 'Juicios 9/10 pero no ha elegido alternativa. Ya puede empezar.',
  },
  SIN_ALTERNATIVA: {
    label: 'Crítico', tone: 'err', color: '#dc2626', icon: 'alert',
    hint: 'Le falta más de un juicio y no tiene alternativa ni cómo asignarla.',
  },
}

function casoRank(c: CasoAprendizPractica): number {
  const i = CASO_ORDER.indexOf(c)
  return i < 0 ? CASO_ORDER.length : i
}

// Numeración "Caso 1"…"Caso 5" -- es la de forma_server
// (ficha.service.ts::casoAprendizPractica, c1–c5) y coincide con CASO_ORDER, que
// es el orden en que todo se muestra en pantalla. Se usa como referencia en el
// modal de ayuda (CasosAyudaModal); en el resto de la pantalla (badge, grupo,
// leyenda) se muestra el nombre descriptivo (CASO_META[c].label).
const CASO_NUM: Record<CasoAprendizPractica, number> = {
  CONCLUIDA: 1,
  TERMINADA_SIN_JUICIO: 2,
  EN_CURSO: 3,
  LISTO_PARA_INICIAR: 4,
  SIN_ALTERNATIVA: 5,
}

function casoNombre(c: CasoAprendizPractica): string {
  return CASO_META[c].label
}

// Orden del roster: primero por número de caso (CASO_ORDER, Caso 1 → Caso 5), y
// dentro de cada caso por avance de juicios (menos RA sin evaluar primero) y
// luego alfabético.
function ordenarAprendices(rows: AprendizPractica[]): AprendizPractica[] {
  return [...rows].sort((a, b) =>
    casoRank(a.caso) - casoRank(b.caso)
    || (a.ra_sin_evaluar ?? 99) - (b.ra_sin_evaluar ?? 99)
    || a.nombre_completo.localeCompare(b.nombre_completo, 'es'),
  )
}

export function casoBadge(r: AprendizPractica): { label: string; tone: CasoTone } {
  // Un aprendiz "por certificar" que ya trae resultado NO_APROBADO de Sofia no
  // es un cierre feliz -- se marca en rojo.
  const noAprob = r.caso === 'CONCLUIDA' && r.resultado_final === 'NO_APROBADO'
  const m = CASO_META[r.caso]
  return { label: casoNombre(r.caso), tone: noAprob ? 'err' : m.tone }
}

// ─── Modal de ayuda: qué significa cada uno de los 5 casos ───────────────────
function CasosAyudaModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="Los 5 casos del aprendiz en práctica" icon="info" width={460} onClose={onClose}>
      <div style={{ fontSize: 12, color: '#71717a', marginBottom: 12 }}>
        El backend clasifica a cada aprendiz cruzando su reporte de juicios de SENA Sofia con su
        etapa productiva. En la tabla y la barra sólo se muestra "Caso N"; acá está qué es cada uno.
      </div>
      {CASO_ORDER.map((c, i) => {
        const m = CASO_META[c]
        return (
          <div
            key={c}
            style={{
              display: 'flex', gap: 11, padding: '11px 0',
              borderTop: i === 0 ? 'none' : '1px solid #f1f1f3',
            }}
          >
            <div style={{ width: 26, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 1 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: m.color }}/>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <Ic n={m.icon} s={13} style={{ color: m.color }}/>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#0a0a0b' }}>Caso {CASO_NUM[c]}</span>
                <span style={{ fontSize: 12, color: '#52525b' }}>· {m.label}</span>
              </div>
              <div style={{ fontSize: 12, color: '#71717a', lineHeight: 1.45, marginTop: 3 }}>{m.hint}</div>
            </div>
          </div>
        )
      })}
    </Modal>
  )
}

// ─── Resumen de estados (reemplaza la tira de KPIs sueltos) ──────────────────

export interface KpiAprendicesPractica {
  aprendices_total: number
  sin_alternativa: number
  listos_para_iniciar: number
  en_curso: number
  terminada_sin_juicio: number
  concluidos: number
}

const KPI_KEY: Record<CasoAprendizPractica, keyof KpiAprendicesPractica> = {
  EN_CURSO: 'en_curso',
  CONCLUIDA: 'concluidos',
  TERMINADA_SIN_JUICIO: 'terminada_sin_juicio',
  LISTO_PARA_INICIAR: 'listos_para_iniciar',
  SIN_ALTERNATIVA: 'sin_alternativa',
}

// Distribución de los aprendices de la ficha entre los 5 estados, en el mismo
// orden en que aparecen en la tabla. Barra apilada + leyenda.
export function EstadoAprendicesResumen({ kpi }: { kpi: KpiAprendicesPractica }) {
  const [ayuda, setAyuda] = useState(false)
  const conteos = CASO_ORDER.map(c => ({ c, n: Number(kpi[KPI_KEY[c]] ?? 0), m: CASO_META[c] }))
  const total = kpi.aprendices_total || conteos.reduce((s, x) => s + x.n, 0)
  const conValor = conteos.filter(x => x.n > 0)

  return (
    <Card style={{ padding: 16, marginBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: total > 0 ? 12 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>Aprendices</span>
          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 13, color: '#52525b' }}>{total}</span>
        </div>
        <button
          onClick={() => setAyuda(true)}
          aria-label="Qué significa cada caso"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 8px',
            border: '1px solid #e4e4e7', borderRadius: 7, background: '#fff', color: '#52525b',
            fontSize: 11.5, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          }}
        >
          <Ic n="more" s={15}/> Casos
        </button>
      </div>

      {total > 0 && (
        <>
          <div style={{ display: 'flex', height: 8, borderRadius: 5, overflow: 'hidden', gap: 2, marginBottom: 14, background: '#f4f4f5' }}>
            {conValor.map(x => (
              <div key={x.c} style={{ flex: x.n, background: x.m.color, minWidth: 4 }}/>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: '8px 14px' }}>
            {conteos.map(({ c, n, m }) => (
              <div
                key={c}
                style={{ display: 'flex', gap: 7, alignItems: 'center', opacity: n === 0 ? 0.4 : 1 }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: m.color, flexShrink: 0 }}/>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#18181b' }}>{casoNombre(c)}</span>
                <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: '#52525b' }}>{n}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {ayuda && <CasosAyudaModal onClose={() => setAyuda(false)}/>}
    </Card>
  )
}

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

// "24 jul 2026" -- compacto, sin "de X de Y", y tomando el día del string ISO
// para no correrlo por timezone.
function fdISO(s: string | null): string {
  if (!s) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${Number(m[3])} ${MES_CORTO[Number(m[2]) - 1]} ${m[1]}`
  const d = new Date(s)
  return isNaN(d.getTime()) ? '—' : `${d.getDate()} ${MES_CORTO[d.getMonth()]} ${d.getFullYear()}`
}

const TH_S = { padding: '10px 14px', textAlign: 'left' as const, fontWeight: 600 }
const TD_S = { padding: '12px 14px' }

// Roster de aprendices de una ficha en etapa práctica: reemplaza la lista de
// competencias (que deja de aplicar una vez cerrada la etapa lectiva).
// Cruza el reporte de juicios de SofiaPlus con la etapa_productiva de cada
// aprendiz (si ya eligió alternativa) y lo agrupa por los 5 estados de práctica
// (CASO_ORDER), con "en curso" primero. `onOpen` es opcional: si se pasa, cada
// fila es clicable (usado por el instructor para entrar a gestionar el
// seguimiento). `soloConEtapa`: solo hace clicables las filas que ya tienen
// etapa productiva (drill-down de solo lectura desde super admin / coordinación).
export function AprendicesPracticaTable({ aprendices: aprendicesProp, onOpen, soloConEtapa }: {
  aprendices: AprendizPractica[] | undefined
  onOpen?: (a: AprendizPractica) => void
  soloConEtapa?: boolean
}) {
  const aprendices = ordenarAprendices(aprendicesProp ?? [])
  const esClicable = (a: AprendizPractica) => !!onOpen && (!soloConEtapa || a.etapa_id != null)
  const cols = 5 + (onOpen ? 1 : 0)
  const conteoPorCaso = (c: CasoAprendizPractica) => aprendices.reduce((n, a) => n + (a.caso === c ? 1 : 0), 0)

  // Hover sobre cualquier aprendiz: popover con el progreso por hitos. Con un
  // pequeño retardo para no abrirlo al pasar de largo.
  const [hover, setHover] = useState<{ a: AprendizPractica; ancla: AnclaPopover } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const cerrar = useCallback(() => { window.clearTimeout(timer.current); setHover(null) }, [])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  function entrar(a: AprendizPractica, el: HTMLElement) {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const r = el.getBoundingClientRect()
      setHover({ a, ancla: { top: r.top, bottom: r.bottom, left: r.left + 12 } })
    }, 220)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0a0a0b' }}>
          Aprendices · {aprendices.length}
        </div>
      </div>

      {aprendices.length === 0 ? (
        <Card>
          <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <Ic n="fileText" s={26} style={{ color: '#a1a1aa' }}/>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0a0a0b' }}>Sin reporte de juicios</div>
            <div style={{ fontSize: 12.5, color: '#71717a', textAlign: 'center' }}>Todavía no se ha cargado un reporte de avance de juicios para esta ficha.</div>
          </div>
        </Card>
      ) : (
        <Card style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', borderBottom: '1px solid #e4e4e7' }}>
                <th style={TH_S}>Aprendiz</th>
                <th style={TH_S}>Estado</th>
                <th style={TH_S}>Alternativa</th>
                <th style={TH_S}>Juicios</th>
                <th style={TH_S}>Reporte</th>
                {onOpen && <th style={TH_S}/>}
              </tr>
            </thead>
            <tbody>
              {aprendices.map((a, i) => {
                const badge = casoBadge(a)
                const clicable = esClicable(a)
                const nuevoGrupo = i === 0 || aprendices[i - 1].caso !== a.caso
                const gm = CASO_META[a.caso]
                return (
                <Fragment key={a.numero_documento}>
                  {nuevoGrupo && (
                    <tr>
                      <td colSpan={cols} style={{ padding: '12px 14px 7px', background: '#fbfbfc', borderTop: i === 0 ? 'none' : '2px solid #ececef' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <Ic n={gm.icon} s={13} style={{ color: gm.color }}/>
                          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: gm.color }}>{casoNombre(a.caso)}</span>
                          <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: '#a1a1aa' }}>{conteoPorCaso(a.caso)}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr
                    onClick={clicable ? () => onOpen!(a) : undefined}
                    onMouseEnter={e => entrar(a, e.currentTarget)}
                    onMouseLeave={cerrar}
                    className={clicable ? 'nx-row' : undefined}
                    style={{ borderBottom: i < aprendices.length - 1 ? '1px solid #f1f1f3' : 'none', cursor: clicable ? 'pointer' : 'default' }}
                  >
                    <td style={TD_S}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <Ava name={a.nombre_completo} size={22}/>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#18181b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>{a.nombre_completo}</div>
                          <div style={{ fontSize: 10.5, color: '#71717a', fontFamily: '"JetBrains Mono", monospace' }}>{a.tipo_documento} {a.numero_documento}</div>
                        </div>
                      </div>
                    </td>
                    <td style={TD_S}><Bdg tone={badge.tone}>{badge.label}</Bdg></td>
                    <td style={TD_S}>
                      {a.modalidad
                        ? <span style={{ fontSize: 12, color: '#3f3f46' }}>{MODALIDAD_LABEL[a.modalidad] ?? a.modalidad}</span>
                        : <span style={{ fontSize: 11.5, color: '#a1a1aa' }}>Sin elegir</span>}
                    </td>
                    <td style={{ ...TD_S, whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', color: '#15803d' }}>{a.ra_aprobados ?? '—'}/{a.total_ra ?? '—'}</span>
                      {(a.ra_no_aprobados ?? 0) > 0 && (
                        <span style={{ fontSize: 11, color: '#b91c1c', marginLeft: 8 }} title="Resultados de aprendizaje no aprobados">· {a.ra_no_aprobados} no aprob.</span>
                      )}
                    </td>
                    <td style={{ ...TD_S, fontFamily: '"JetBrains Mono", monospace', fontSize: 11.5, color: '#52525b', whiteSpace: 'nowrap' }}>{fdISO(a.fecha_reporte)}</td>
                    {onOpen && (
                      <td style={{ ...TD_S, textAlign: 'right', whiteSpace: 'nowrap', width: 1 }}>
                        {clicable && a.etapa_id
                          ? <span title="Ver seguimientos" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, color: '#4f46e5' }}>Ver <Ic n="chevronRight" s={13}/></span>
                          : soloConEtapa
                            ? <span style={{ fontSize: 11, color: '#c4c4c8' }}>Sin etapa</span>
                            : null}
                      </td>
                    )}
                  </tr>
                </Fragment>
                )
              })}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {hover && (
        <ProgresoPracticaPopover
          key={hover.a.numero_documento}
          a={hover.a}
          badge={casoBadge(hover.a)}
          modalidad={hover.a.modalidad ? MODALIDAD_LABEL[hover.a.modalidad] ?? hover.a.modalidad : null}
          ancla={hover.ancla}
          onClose={cerrar}
        />
      )}
    </div>
  )
}
