import { useState } from 'react'
import { useSoloLectura } from './soloLectura'
import { Ic, Btn } from '../../components/ui'
import api from '../../lib/api'
import { MOMENTO_META, fdia, diasEntre, mensajeError } from './cronograma'
import type {
  Cronograma, MomentoCronograma, ModalidadVisita, TipoMomentoCron, VisitaExtra, VisitaProgramada,
} from './cronograma'
import '../instructor/instructor.css'
import './cronograma.css'

// ─── Tab: Cronograma ────────────────────────────────────────────────────────────
// Responde en palabras simples "¿cuándo tengo que ir?". Arriba, lo siguiente
// que toca; debajo, las 3 visitas del formato en orden (planeación en las
// primeras 2 semanas, seguimiento a mitad de la etapa, evaluación en los
// últimos 15 días) y las visitas extra. Las reglas de fechas están en el
// backend (bitacora/cronograma.ts).

type IrA = 'planeacion' | 'seguimientos' | 'evaluacion' | 'bitacoras'

const irA = (t: TipoMomentoCron): IrA =>
  t === 'PLANEACION' ? 'planeacion' : t === 'SEGUIMIENTO' ? 'seguimientos' : 'evaluacion'

const dias = (n: number) => `${n} día${n === 1 ? '' : 's'}`
const modo = (m: string) => (m === 'VIRTUAL' ? 'virtual' : m === 'TELEFONICA' ? 'telefónica' : 'presencial')

// Estado de una visita, en una frase.
function situacion(m: MomentoCronograma, hoy: string): { tono: 'ok' | 'info' | 'warn' | 'err' | 'neutral'; texto: string } {
  if (m.estado === 'REALIZADO') {
    return { tono: 'ok', texto: `Hecha el ${fdia(m.fecha_realizada)}${m.realizado_fuera_de_ventana ? ' (fuera del rango sugerido)' : ''}.` }
  }
  const quedan = diasEntre(hoy, m.ventana_hasta)
  if (m.visita) {
    const cuando = `${fdia(m.visita.fecha)}${m.visita.hora ? `, ${m.visita.hora}` : ''} · ${modo(m.visita.modalidad)}`
    if (m.visita_vencida) return { tono: 'err', texto: `Estaba agendada para el ${cuando} y no se ha registrado.` }
    return { tono: 'info', texto: `Agendada para el ${cuando}.` }
  }
  if (m.alerta === 'VENCIDO') return { tono: 'err', texto: `Se pasó el plazo hace ${dias(-quedan)} y no se ha hecho.` }
  if (m.alerta === 'EN_VENTANA') return { tono: 'warn', texto: quedan === 0 ? 'Ya puedes hacerla. Hoy es el último día.' : `Ya puedes hacerla. Quedan ${dias(quedan)}.` }
  if (hoy < m.habilitado_desde) return { tono: 'neutral', texto: `Todavía no. Se podrá registrar desde el ${fdia(m.habilitado_desde)}.` }
  return { tono: 'warn', texto: `Ya se acerca: puedes registrarla desde ahora (su ventana abre el ${fdia(m.ventana_desde)}).` }
}

// Un punto en el calendario: un momento (realizado, agendado o sugerido) o una
// visita extra. Mismo lenguaje visual que la Agenda del instructor.
interface Evento {
  key: string
  tipo: TipoMomentoCron | 'EXTRA'
  fecha: string
  origen: 'REALIZADO' | 'PROGRAMADO' | 'SUGERIDO'
  vencido: boolean
  momento: MomentoCronograma | null
  extra: VisitaExtra | null
}

const EXTRA_META = { corto: 'S+', label: 'Seguimiento adicional', color: '#ea580c', bg: '#fff7ed' }
const metaDe = (t: TipoMomentoCron | 'EXTRA') =>
  t === 'EXTRA' ? EXTRA_META : { corto: `M${MOMENTO_META[t].n}`, label: `Visita ${MOMENTO_META[t].n} · ${MOMENTO_META[t].label}`, color: MOMENTO_META[t].color, bg: MOMENTO_META[t].bg }

const MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function inicioGrilla(anio: number, mes: number): Date {
  const dow = (new Date(anio, mes, 1).getDay() + 6) % 7   // 0 = lunes
  return new Date(anio, mes, 1 - dow)
}

function eventosDe(crono: Cronograma): Evento[] {
  const out: Evento[] = []
  for (const m of crono.momentos) {
    if (m.estado === 'REALIZADO' && m.fecha_realizada) {
      out.push({ key: `m-${m.tipo}`, tipo: m.tipo, fecha: m.fecha_realizada, origen: 'REALIZADO', vencido: false, momento: m, extra: null })
    } else if (m.visita) {
      out.push({ key: `m-${m.tipo}`, tipo: m.tipo, fecha: m.visita.fecha, origen: 'PROGRAMADO', vencido: m.visita_vencida, momento: m, extra: null })
    } else {
      // Sin agenda: se sugiere dentro de la ventana (nunca en el pasado si aún está abierta).
      const f = m.alerta === 'EN_VENTANA' && m.fecha_sugerida < crono.hoy ? crono.hoy : m.fecha_sugerida
      out.push({ key: `m-${m.tipo}`, tipo: m.tipo, fecha: f, origen: 'SUGERIDO', vencido: m.alerta === 'VENCIDO', momento: m, extra: null })
    }
  }
  crono.extras.forEach((x, i) => out.push({
    key: `x-${i}`, tipo: 'EXTRA', fecha: x.fecha, origen: x.origen === 'REALIZADO' ? 'REALIZADO' : 'PROGRAMADO',
    vencido: x.origen === 'PROGRAMADO' && x.fecha < crono.hoy, momento: null, extra: x,
  }))
  return out.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export function CronogramaTab({ etapaId, crono, onChanged, onIrA }: {
  etapaId: number
  crono: Cronograma
  onChanged: (c: Cronograma) => void
  onIrA: (t: IrA) => void
}) {
  const soloLectura = useSoloLectura()
  // Arranca en el mes de hoy si la etapa está en curso; si no, en su primer mes.
  const mesInicial = crono.hoy >= crono.fecha_inicio && crono.hoy <= crono.fecha_fin_estimada ? crono.hoy : crono.fecha_inicio || crono.hoy
  const [anio, setAnio] = useState(Number(mesInicial.slice(0, 4)))
  const [mes, setMes] = useState(Number(mesInicial.slice(5, 7)) - 1)
  const [sel, setSel] = useState<string | null>(null)
  const [abierto, setAbierto] = useState<string | null>(null)
  const [agendando, setAgendando] = useState<{ tipo: TipoMomentoCron | 'EXTRA'; fecha: string; momento: MomentoCronograma | null } | null>(null)

  if (!crono.fecha_inicio || !crono.fecha_fin_estimada) {
    return <div className="cron-vacio">Registra las fechas de la etapa en "Información general" para ver el cronograma.</div>
  }

  const eventos = eventosDe(crono)
  const porDia: Record<string, Evento[]> = {}
  for (const e of eventos) (porDia[e.fecha] ??= []).push(e)

  // Ventana abierta (momento aún no hecho) que cubre un día: se sombrea.
  const ventanaDe = (iso: string) =>
    crono.momentos.find(m => m.estado !== 'REALIZADO' && iso >= m.ventana_desde && iso <= m.ventana_hasta) ?? null

  const inicio = inicioGrilla(anio, mes)
  const celdas = Array.from({ length: 42 }, (_, i) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + i))
  const obligatorias = eventos.filter(e => e.tipo !== 'EXTRA')
    .sort((a, b) => MOMENTO_META[a.tipo as TipoMomentoCron].n - MOMENTO_META[b.tipo as TipoMomentoCron].n)
  const adicionales = eventos.filter(e => e.tipo === 'EXTRA')
  const diaEventos = sel ? (porDia[sel] ?? []) : []

  // Abrir una fila también lleva el calendario al mes de esa visita.
  const fila = (e: Evento) => (
    <EventoFila
      e={e}
      hoy={crono.hoy}
      abierto={abierto === e.key}
      onToggle={() => {
        setAbierto(a => (a === e.key ? null : e.key))
        setAnio(Number(e.fecha.slice(0, 4))); setMes(Number(e.fecha.slice(5, 7)) - 1)
      }}
      etapaId={etapaId}
      onChanged={onChanged}
      onAgendar={() => e.momento && setAgendando({ tipo: e.tipo, fecha: e.momento.visita?.fecha ?? e.fecha, momento: e.momento })}
      onIr={() => onIrA(e.tipo === 'EXTRA' ? 'seguimientos' : irA(e.tipo))}
    />
  )

  const siguiente = crono.momentos.find(m => m.estado !== 'REALIZADO') ?? null
  const rb = crono.resumen_bitacoras

  function mover(delta: number) {
    const d = new Date(anio, mes + delta, 1)
    setAnio(d.getFullYear()); setMes(d.getMonth()); setSel(null); setAgendando(null)
  }
  function irHoy() {
    setAnio(Number(crono.hoy.slice(0, 4))); setMes(Number(crono.hoy.slice(5, 7)) - 1); setSel(crono.hoy); setAgendando(null)
  }


  return (
    <div className="cron">
      <Siguiente m={siguiente} hoy={crono.hoy}/>

      <div className="cal-wrap">
        <div className="cron-card" style={{ overflow: 'hidden' }}>
          <div className="cal-head">
            <div className="cal-head__titulo">{MES[mes]} <span className="cal-head__anio">{anio}</span></div>
            <div className="cal-head__nav">
              <button className="cal-nav" onClick={() => mover(-1)} aria-label="Mes anterior"><Ic n="chevronLeft" s={15}/></button>
              <button className="cal-hoy" onClick={irHoy}>Hoy</button>
              <button className="cal-nav" onClick={() => mover(1)} aria-label="Mes siguiente"><Ic n="chevronRight" s={15}/></button>
            </div>
          </div>
          <div className="cal-dow">{DOW.map(d => <span key={d}>{d}</span>)}</div>
          <div className="cal-grid">
            {celdas.map(f => {
              const iso = ymd(f)
              const evs = porDia[iso] ?? []
              const v = ventanaDe(iso)
              const fueraEtapa = iso < crono.fecha_inicio || iso > crono.fecha_fin_estimada
              return (
                <button
                  key={iso}
                  onClick={() => { setSel(s => (s === iso ? null : iso)); setAgendando(null); setAbierto(null) }}
                  className={`cal-dia${f.getMonth() !== mes ? ' cal-dia--fuera' : ''}${iso === crono.hoy ? ' cal-dia--hoy' : ''}${sel === iso ? ' cal-dia--sel' : ''}`}
                  style={v && iso !== crono.hoy && sel !== iso ? { background: MOMENTO_META[v.tipo].bg } : fueraEtapa && f.getMonth() === mes ? { opacity: 0.55 } : undefined}
                  title={v ? `Ventana de la visita ${MOMENTO_META[v.tipo].n} · ${MOMENTO_META[v.tipo].label}` : undefined}
                >
                  <span className="cal-dia__num">{f.getDate()}</span>
                  {evs.length > 0 && (
                    <span className="cron-pills">
                      {evs.slice(0, 2).map(e => {
                        const mt = metaDe(e.tipo)
                        return (
                          <span
                            key={e.key}
                            className={`cron-pill${e.origen === 'SUGERIDO' ? ' cron-pill--sug' : ''}${e.origen === 'REALIZADO' ? ' cron-pill--hecha' : ''}${e.vencido ? ' cron-pill--venc' : ''}`}
                            style={{ color: mt.color, borderColor: mt.color, background: e.origen === 'SUGERIDO' ? '#fff' : `${mt.color}1f` }}
                            title={`${mt.label} · ${e.origen === 'REALIZADO' ? 'realizada' : e.origen === 'PROGRAMADO' ? 'agendada' : 'sugerida'}`}
                          >
                            {e.origen === 'REALIZADO' && <Ic n="check" s={9}/>}{mt.corto}<span className="cron-pill__txt"> {e.tipo === 'EXTRA' ? 'Adicional' : MOMENTO_META[e.tipo].label.split(' ')[0]}</span>
                          </span>
                        )
                      })}
                      {evs.length > 2 && <span className="cal-dia__mas">+{evs.length - 2}</span>}
                    </span>
                  )}
                  {evs.some(e => e.vencido) && <span className="cal-dia__alerta"/>}
                </button>
              )
            })}
          </div>
          <div className="cal-leyenda">
            {(['PLANEACION', 'SEGUIMIENTO', 'EVALUACION'] as TipoMomentoCron[]).map(t => (
              <span key={t} className="cal-leyenda__item">
                <span className="cal-punto" style={{ background: MOMENTO_META[t].color, borderColor: MOMENTO_META[t].color }}/>
                {MOMENTO_META[t].label}
              </span>
            ))}
            <span className="cal-leyenda__item">
              <span className="cal-punto" style={{ background: EXTRA_META.color, borderColor: EXTRA_META.color }}/>Seguimiento adicional
            </span>
            <span className="cal-leyenda__item">
              <span className="cron-pill cron-pill--sug" style={{ color: '#71717a', borderColor: '#a1a1aa' }}>M</span>Sugerida (sin agendar)
            </span>
            <span className="cal-leyenda__item">
              <span className="cron-pill" style={{ color: '#4f46e5', borderColor: '#4f46e5', background: '#4f46e51f' }}>M</span>Agendada
            </span>
            <span className="cal-leyenda__item">
              <span style={{ width: 12, height: 10, borderRadius: 3, background: '#eef2ff', display: 'inline-block' }}/>Días para hacerla
            </span>
          </div>
        </div>

        <div>
          <div className="cal-kpis">
            <div className="cal-kpi">
              <span className="cal-kpi__valor">{crono.momentos.filter(m => m.estado === 'REALIZADO').length}/3</span>
              <span className="cal-kpi__label">visitas hechas</span>
            </div>
            <div className={`cal-kpi${eventos.some(e => e.vencido) ? ' cal-kpi--alerta' : ''}`}>
              <span className="cal-kpi__valor">{eventos.filter(e => e.vencido).length}</span>
              <span className="cal-kpi__label">vencidas</span>
            </div>
            <button className="cal-kpi cron-kpi-btn" onClick={() => onIrA('bitacoras')}>
              <span className="cal-kpi__valor">{rb.aprobadas}/{rb.total}</span>
              <span className="cal-kpi__label">bitácoras aprobadas{rb.por_revisar ? ` · ${rb.por_revisar} por revisar` : ''}</span>
            </button>
          </div>

          {agendando && (
            <div className="cron-card" style={{ marginTop: 16 }}>
              <div className="cron-card__head">
                <span className="cron-card__titulo">
                  <Ic n="calendar" s={14}/> {agendando.momento?.visita ? 'Cambiar fecha' : 'Agendar'}: {metaDe(agendando.tipo).label}
                </span>
              </div>
              <FormVisita
                etapaId={etapaId}
                tipo={agendando.tipo}
                visita={agendando.momento?.visita ?? null}
                fechaInicial={agendando.fecha}
                ventana={agendando.momento ? [agendando.momento.ventana_desde, agendando.momento.ventana_hasta] : undefined}
                pedirMotivo={agendando.tipo === 'EXTRA'}
                onCancel={() => setAgendando(null)}
                onSaved={c => { setAgendando(null); onChanged(c) }}
              />
            </div>
          )}

          {/* Día elegido en el calendario: qué hay y qué se puede agendar ahí */}
          {sel && !agendando && (
            <div className="cron-card cron-dia">
              <div className="cron-card__head">
                <span className="cron-card__titulo">{Number(sel.slice(8))} de {MES[Number(sel.slice(5, 7)) - 1].toLowerCase()}</span>
                <span className="cron-card__hint"/>
                <button className="cron-link" onClick={() => setSel(null)}>Cerrar</button>
              </div>
              {diaEventos.length === 0 && <div className="cron-card__vacio">No hay visitas ese día.</div>}
              {diaEventos.map(e => (
                <div key={e.key} className="cron-dia__ev">
                  <span className="cal-item__tag" style={{ color: metaDe(e.tipo).color, background: `${metaDe(e.tipo).color}14` }}>{metaDe(e.tipo).corto}</span>
                  {metaDe(e.tipo).label}
                </div>
              ))}
              {sel >= crono.hoy && !soloLectura && (
                <div className="cron-agendar-dia">
                  <span>Agendar ese día:</span>
                  {crono.momentos.filter(m => m.estado !== 'REALIZADO').map(m => (
                    <button key={m.tipo} className="cron-chip" onClick={() => setAgendando({ tipo: m.tipo, fecha: sel, momento: m })}>
                      Visita {MOMENTO_META[m.tipo].n} · {MOMENTO_META[m.tipo].label}
                    </button>
                  ))}
                  <button className="cron-chip" onClick={() => setAgendando({ tipo: 'EXTRA', fecha: sel, momento: null })}>+ Seguimiento adicional</button>
                </div>
              )}
            </div>
          )}

          {/* Las 3 visitas del instructor: siempre visibles, sin importar el mes */}
          <div className="cron-sec">
            <span>Visitas que debe hacer el instructor</span>
          </div>
          <div className="cron-card" style={{ overflow: 'hidden' }}>
            {obligatorias.map((e, i) => (
              <div key={e.key} style={{ borderBottom: i < obligatorias.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                {fila(e)}
              </div>
            ))}
          </div>

          <div className="cron-sec">
            <span>Seguimientos adicionales</span>
            {!soloLectura && (
              <button className="cron-link" onClick={() => { setSel(null); setAgendando({ tipo: 'EXTRA', fecha: crono.hoy, momento: null }) }}>
                <Ic n="plus" s={12}/> Agregar seguimiento
              </button>
            )}
          </div>
          <div className="cron-card" style={{ overflow: 'hidden' }}>
            {adicionales.length === 0 && (
              <div className="cron-card__vacio">Ninguno. Agrega los que necesites, por ejemplo si hay problemas con el aprendiz o la empresa.</div>
            )}
            {adicionales.map((e, i) => (
              <div key={e.key} style={{ borderBottom: i < adicionales.length - 1 ? '1px solid #f1f1f3' : 'none' }}>
                {fila(e)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Lo siguiente que toca ──────────────────────────────────────────────────────

function Siguiente({ m, hoy }: { m: MomentoCronograma | null; hoy: string }) {
  if (!m) {
    return (
      <div className="cron-sig cron-sig--ok">
        <Ic n="checkCircle" s={18}/>
        <div><strong>Las 3 visitas obligatorias ya están hechas.</strong></div>
      </div>
    )
  }
  const meta = MOMENTO_META[m.tipo]
  const s = situacion(m, hoy)
  return (
    <div className={`cron-sig cron-sig--${s.tono}`}>
      <Ic n={s.tono === 'err' ? 'alert' : 'clock'} s={18}/>
      <div>
        <div className="cron-sig__label">Lo siguiente</div>
        <strong>Visita {meta.n} · {meta.label}:</strong> ir entre el {fdia(m.ventana_desde)} y el {fdia(m.ventana_hasta)}. {s.texto}
      </div>
    </div>
  )
}

// ─── Fila de la lista (como en la Agenda), con acciones al abrirla ─────────────

function EventoFila({ e, hoy, abierto, onToggle, etapaId, onChanged, onAgendar, onIr }: {
  e: Evento; hoy: string; abierto: boolean; onToggle: () => void
  etapaId: number; onChanged: (c: Cronograma) => void; onAgendar: () => void; onIr: () => void
}) {
  const soloLectura = useSoloLectura()
  const meta = metaDe(e.tipo)
  const sugerido = e.origen === 'SUGERIDO'
  const m = e.momento
  const detalle = m
    ? `${situacion(m, hoy).texto} Ventana: ${fdia(m.ventana_desde, false)} – ${fdia(m.ventana_hasta)}.`
    : `${fdia(e.fecha)}${e.extra?.hora ? `, ${e.extra.hora}` : ''} · ${modo(e.extra?.modalidad ?? '')}${e.extra?.nota ? ` · ${e.extra.nota}` : ''}`
  const estado = e.origen === 'REALIZADO' ? 'Realizada' : e.vencido ? 'Vencida' : sugerido ? 'Sugerida' : 'Agendada'
  const claseEstado = e.origen === 'REALIZADO' ? 'hecho' : e.vencido ? 'vencido' : 'futuro'

  async function quitar(id: number) {
    if (!confirm('¿Quitar esta fecha agendada?')) return
    const r = await api.delete<Cronograma>(`/etapas-productivas/${etapaId}/visitas/${id}`)
    onChanged(r.data)
  }

  return (
    <>
      <button onClick={onToggle} className="nx-row cal-item">
        <span className="cal-item__tag" style={{
          color: meta.color,
          borderColor: sugerido ? meta.color : 'transparent',
          background: sugerido ? 'transparent' : `${meta.color}14`,
          borderStyle: sugerido ? 'dashed' : 'solid',
        }}>{meta.corto}</span>
        <span className="cal-item__body">
          <span className="cal-item__nombre">{meta.label}</span>
          <span className="cal-item__meta">{fdia(e.fecha)}{m?.visita?.hora && e.origen === 'PROGRAMADO' ? ` · ${m.visita.hora}` : ''}{m?.visita && e.origen === 'PROGRAMADO' ? ` · ${modo(m.visita.modalidad)}` : ''}</span>
        </span>
        <span className={`cal-item__estado cal-item__estado--${claseEstado}`}>{estado}</span>
        <Ic n={abierto ? 'chevronDown' : 'chevronRight'} s={14} style={{ color: '#d4d4d8', flexShrink: 0 }}/>
      </button>
      {abierto && (
        <div className="cron-fila-det">
          <div>{detalle}</div>
          <div className="cron-paso__acciones">
            {e.origen === 'REALIZADO' ? (
              <button className="cron-link" onClick={onIr}>Ver lo registrado <Ic n="arrowRight" s={12}/></button>
            ) : soloLectura ? null : m ? (
              <>
                <button className="cron-link" onClick={onAgendar}><Ic n="calendar" s={12}/> {m.visita ? 'Cambiar fecha' : 'Agendar'}</button>
                {m.visita && <button className="cron-link cron-link--danger" onClick={() => void quitar(m.visita!.id)}>Quitar fecha</button>}
                {hoy >= m.habilitado_desde && <button className="cron-link" onClick={onIr}>Registrar la visita <Ic n="arrowRight" s={12}/></button>}
              </>
            ) : e.extra?.visita_id != null ? (
              <>
                <button className="cron-link cron-link--danger" onClick={() => void quitar(e.extra!.visita_id!)}>Quitar</button>
                {e.fecha <= hoy && <button className="cron-link" onClick={onIr}>Registrar como seguimiento <Ic n="arrowRight" s={12}/></button>}
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Formulario de visita (programar / reprogramar / extra) ─────────────────────

function FormVisita({ etapaId, tipo, visita, fechaInicial, ventana, pedirMotivo, onCancel, onSaved }: {
  etapaId: number
  tipo: TipoMomentoCron | 'EXTRA'
  visita?: VisitaProgramada | null
  fechaInicial: string
  ventana?: [string, string]
  pedirMotivo?: boolean
  onCancel: () => void
  onSaved: (c: Cronograma) => void
}) {
  const [fecha, setFecha] = useState(fechaInicial)
  const [hora, setHora] = useState(visita?.hora ?? '')
  const [modalidad, setModalidad] = useState<ModalidadVisita>(visita?.modalidad ?? 'PRESENCIAL')
  const [nota, setNota] = useState(visita?.nota ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const fuera = ventana && fecha && (fecha < ventana[0] || fecha > ventana[1])

  async function guardar() {
    if (!fecha) { setErr('Elige la fecha.'); return }
    if (pedirMotivo && !nota.trim()) { setErr('Escribe el motivo de la visita extra.'); return }
    setBusy(true); setErr(null)
    try {
      const r = await api.post<Cronograma>(`/etapas-productivas/${etapaId}/visitas`, {
        tipo_momento: tipo, fecha, hora: hora || undefined, modalidad, nota: nota.trim() || undefined,
      })
      onSaved(r.data)
    } catch (e) {
      setErr(mensajeError(e, 'No se pudo guardar la visita.'))
    } finally { setBusy(false) }
  }

  return (
    <div className="cron-form">
      {ventana && (
        <div className="cron-form__ventana">
          <Ic n="clock" s={12}/> Días para hacerla: {fdia(ventana[0], false)} – {fdia(ventana[1])}
        </div>
      )}
      <div className="cron-form__fila">
        <div className="cron-campo">
          <span>Fecha</span>
          <input type="date" className="nx-input" value={fecha} onChange={e => setFecha(e.target.value)}/>
        </div>
        <div className="cron-campo">
          <span>Hora <em>(opcional)</em></span>
          <input type="time" className="nx-input" value={hora} onChange={e => setHora(e.target.value)}/>
        </div>
        <div className="cron-campo">
          <span>Modalidad</span>
          <div className="cron-modo">
            {(['PRESENCIAL', 'VIRTUAL'] as ModalidadVisita[]).map(m => (
              <button
                key={m}
                type="button"
                className={`cron-modo__op${modalidad === m ? ' cron-modo__op--on' : ''}`}
                onClick={() => setModalidad(m)}
              >
                <Ic n={m === 'PRESENCIAL' ? 'pin' : 'external'} s={12}/>
                {m === 'PRESENCIAL' ? 'Presencial' : 'Virtual'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="cron-campo">
        <span>{pedirMotivo ? 'Motivo' : <>Nota <em>(opcional)</em></>}</span>
        <input className="nx-input" value={nota} maxLength={255} onChange={e => setNota(e.target.value)}
          placeholder={pedirMotivo ? 'Ej.: inasistencias reportadas por la empresa' : 'Ej.: reunión con el jefe inmediato'}/>
      </div>
      {fuera && <div className="cron-aviso">Fuera de la ventana ({fdia(ventana[0], false)} – {fdia(ventana[1])}). Puedes guardarla igual.</div>}
      {err && <div className="cron-aviso cron-aviso--err">{err}</div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Btn variant="secondary" size="sm" onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" size="sm" icon="check" onClick={() => void guardar()} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Btn>
      </div>
    </div>
  )
}
