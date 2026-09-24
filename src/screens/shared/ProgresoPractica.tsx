import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Ic, Ava, Bdg } from '../../components/ui'
import api from '../../lib/api'
import type { AprendizPractica } from './AprendicesPractica'
import type { EtapaProductiva, SeguimientoProductivo, TipoMomento } from '../productiva/types'
import './ProgresoPractica.css'

// ─── Progreso de la etapa práctica (popover al pasar sobre un aprendiz) ──────
// Para cualquier aprendiz de la ficha: una línea con los hitos del camino
// completo, de la lectiva a la certificación, para ver de un vistazo en qué
// punto va y qué sigue:
//
//   Lectiva al día → Alternativa → M1 Planeación → M2 Seguimiento
//                  → M3 Evaluación → Certificación
//
// Los momentos salen de la etapa productiva (GET /etapas-productivas/:id),
// que se pide al primer hover y queda en caché mientras dure la página.

type EtapaConSeguimientos = EtapaProductiva & { seguimientos: SeguimientoProductivo[] }

const cache = new Map<number, Promise<EtapaConSeguimientos>>()
function pedirEtapa(id: number): Promise<EtapaConSeguimientos> {
  let p = cache.get(id)
  if (!p) {
    p = api.get<EtapaConSeguimientos>(`/etapas-productivas/${id}`).then(r => r.data)
    p.catch(() => cache.delete(id))   // un fallo no queda cacheado
    cache.set(id, p)
  }
  return p
}

const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
function dia(s: string | null | undefined): Date | null {
  const m = s ? /^(\d{4})-(\d{2})-(\d{2})/.exec(s) : null
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
function corta(s: string | null | undefined): string | null {
  const d = dia(s)
  return d ? `${d.getDate()} ${MES[d.getMonth()]}` : null
}
const DIA_MS = 86_400_000
function diasEntre(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / DIA_MS) }

type EstadoHito = 'hecho' | 'actual' | 'pendiente'
interface Hito { label: string; sub: string | null; estado: EstadoHito }

function hitos(a: AprendizPractica, etapa: EtapaConSeguimientos | null): Hito[] {
  const segs = etapa?.seguimientos ?? []
  const del = (t: TipoMomento) => segs.filter(s => s.tipo_momento === t)
  const hechos = (t: TipoMomento) => del(t).filter(s => s.fecha_realizada)
    .sort((x, y) => (x.fecha_realizada ?? '').localeCompare(y.fecha_realizada ?? ''))
  const programado = (t: TipoMomento) => del(t).find(s => !s.fecha_realizada && s.fecha_programada)?.fecha_programada

  const momento = (t: TipoMomento) => {
    const h = hechos(t)
    if (h.length) return { ok: true, sub: t === 'SEGUIMIENTO' && h.length > 1 ? `${h.length} realizados` : corta(h[h.length - 1].fecha_realizada) }
    const p = programado(t)
    return { ok: false, sub: p ? `prog. ${corta(p)}` : null }
  }

  const m1 = momento('PLANEACION'), m2 = momento('SEGUIMIENTO'), m3 = momento('EVALUACION')
  const base: { label: string; sub: string | null; ok: boolean }[] = [
    // "Crítico" es justamente quien aún no tiene la lectiva al día (le falta más de un juicio).
    { label: 'Lectiva', sub: a.total_ra != null ? `${a.ra_aprobados ?? 0}/${a.total_ra} RA` : null, ok: a.caso !== 'SIN_ALTERNATIVA' },
    { label: 'Alternativa', sub: a.etapa_id ? corta(etapa?.fecha_inicio) : null, ok: a.etapa_id != null },
    { label: 'Planeación', sub: m1.sub, ok: m1.ok },
    { label: 'Seguimiento', sub: m2.sub, ok: m2.ok },
    { label: 'Evaluación', sub: m3.sub, ok: m3.ok },
    { label: 'Certificación', sub: a.caso === 'CONCLUIDA' ? 'Juicio 10/10' : null, ok: a.caso === 'CONCLUIDA' },
  ]
  const actual = base.findIndex(h => !h.ok)
  return base.map((h, i) => ({ label: h.label, sub: h.sub, estado: h.ok ? 'hecho' : i === actual ? 'actual' : 'pendiente' }))
}

const SIGUIENTE: Record<string, string> = {
  Lectiva: 'Completar los juicios de la etapa lectiva',
  Alternativa: 'Elegir la alternativa de etapa productiva',
  Planeación: 'Momento 1 · Planeación y concertación del plan',
  Seguimiento: 'Momento 2 · Seguimiento parcial',
  Evaluación: 'Momento 3 · Evaluación final',
  Certificación: 'Juicio final 10/10 y certificación en Sofia',
}

// Cabecera + línea de hitos + pie. Lo usan el popover (al pasar sobre un
// aprendiz) y la tarjeta fija del detalle de la etapa productiva.
function ProgresoContenido({ a, etapa, badge, modalidad, cargando, fallo }: {
  a: AprendizPractica
  etapa: EtapaConSeguimientos | null
  badge: { label: string; tone: 'ok' | 'err' | 'warn' | 'accent' | 'neutral' | 'blue' }
  modalidad: string | null
  cargando?: boolean
  fallo?: boolean
}) {
  const hs = hitos(a, etapa)
  const nHechos = hs.filter(h => h.estado === 'hecho').length
  const pct = Math.round((nHechos / hs.length) * 100)
  const iActual = hs.findIndex(h => h.estado === 'actual')
  const actual = iActual >= 0 ? hs[iActual] : undefined
  // La línea se llena hasta la mitad del tramo que llega al hito actual.
  const relleno = iActual < 0 ? 100 : (Math.max(iActual - 0.5, 0) / (hs.length - 1)) * 100

  // Tiempo de práctica según las fechas de la etapa.
  const ini = dia(etapa?.fecha_inicio), fin = dia(etapa?.fecha_fin_estimada)
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const tiempo = ini && fin && diasEntre(ini, fin) > 0 ? (() => {
    const total = diasEntre(ini, fin)
    const van = Math.max(0, Math.min(diasEntre(ini, hoy), total))
    const faltan = diasEntre(hoy, fin)
    return { total, van, pct: Math.round((van / total) * 100), faltan }
  })() : null

  return (
    <>
      <div className="ppr__cab">
        <Ava name={a.nombre_completo} size={30}/>
        <div className="ppr__who">
          <div className="ppr__nombre">{a.nombre_completo}</div>
          <div className="ppr__meta">
            {[modalidad, etapa?.empresa_nombre].filter(Boolean).join(' · ') || `${a.tipo_documento} ${a.numero_documento}`}
          </div>
        </div>
        <div className="ppr__pct">
          <b>{pct}%</b>
          <span>del proceso</span>
        </div>
      </div>

      <div className="ppr__linea">
        <div className="ppr__riel"><div className="ppr__riel-fill" style={{ width: `${relleno}%` }}/></div>
        {hs.map((h, i) => (
          <div key={h.label} className={`ppr__hito ppr__hito--${h.estado}`} style={{ left: `${(i / (hs.length - 1)) * 100}%` }}>
            <span className="ppr__punto">{h.estado === 'hecho' && <Ic n="check" s={9}/>}</span>
            <span className="ppr__label">{h.label}</span>
            {h.sub && <span className="ppr__sub">{h.sub}</span>}
          </div>
        ))}
      </div>

      <div className="ppr__pie">
        <div className="ppr__sig">
          <Bdg tone={badge.tone}>{badge.label}</Bdg>
          {actual ? (
            <span>
              <span className="ppr__sig-l">Siguiente:</span> {SIGUIENTE[actual.label] ?? actual.label}
              {actual.label === 'Lectiva' && (a.ra_sin_evaluar ?? 0) > 0 && <span className="ppr__sig-l"> ({a.ra_sin_evaluar} RA sin evaluar)</span>}
            </span>
          ) : a.resultado_final === 'NO_APROBADO' ? (
            <span className="ppr__vencida">Juicios completos, resultado no aprobado</span>
          ) : (
            <span>Juicios completos: solo falta certificar en Sofia</span>
          )}
        </div>
        {cargando && <div className="ppr__nota">Cargando momentos de la etapa…</div>}
        {fallo && <div className="ppr__nota">No se pudieron cargar los momentos de la etapa.</div>}
        {etapa?.fecha_fin_real ? (
          <div className="ppr__nota">Práctica terminada el {corta(etapa.fecha_fin_real)} {dia(etapa.fecha_fin_real)?.getFullYear()}</div>
        ) : tiempo && (
          <div className="ppr__tiempo">
            <div className="ppr__tiempo-txt">
              <span>Tiempo de práctica · día {tiempo.van} de {tiempo.total}</span>
              <span className={tiempo.faltan < 0 ? 'ppr__vencida' : undefined}>
                {tiempo.faltan < 0 ? `Vencida hace ${-tiempo.faltan} días` : tiempo.faltan === 0 ? 'Termina hoy' : `Termina en ${tiempo.faltan} días`}
              </span>
            </div>
            <div className="ppr__tbar"><div style={{ width: `${tiempo.pct}%` }}/></div>
          </div>
        )}
      </div>
    </>
  )
}

export interface AnclaPopover { top: number; bottom: number; left: number }

export function ProgresoPracticaPopover({ a, badge, modalidad, ancla, onClose }: {
  a: AprendizPractica
  badge: { label: string; tone: 'ok' | 'err' | 'warn' | 'accent' | 'neutral' | 'blue' }
  modalidad: string | null
  ancla: AnclaPopover
  onClose: () => void
}) {
  const [etapa, setEtapa] = useState<EtapaConSeguimientos | null>(null)
  const [cargando, setCargando] = useState(a.etapa_id != null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    if (a.etapa_id == null) return
    let vivo = true
    pedirEtapa(a.etapa_id)
      .then(e => { if (vivo) setEtapa(e) })
      .catch(() => { if (vivo) setFallo(true) })
      .finally(() => { if (vivo) setCargando(false) })
    return () => { vivo = false }
  }, [a.etapa_id])

  // Es informativo y va anclado a la fila: al hacer scroll se cierra.
  useEffect(() => {
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => { window.removeEventListener('scroll', onClose, true); window.removeEventListener('resize', onClose) }
  }, [onClose])

  const ANCHO = 440
  const left = Math.max(12, Math.min(ancla.left, window.innerWidth - ANCHO - 12))
  const abajo = window.innerHeight - ancla.bottom > 280
  const pos = abajo ? { top: ancla.bottom + 6 } : { bottom: window.innerHeight - ancla.top + 6 }

  return createPortal(
    <div className="ppr portal-flotante" style={{ left, width: ANCHO, ...pos }} role="tooltip">
      <ProgresoContenido a={a} etapa={etapa} badge={badge} modalidad={modalidad} cargando={cargando} fallo={fallo}/>
    </div>,
    document.body,
  )
}

// Versión fija (sin portal ni hover) para el detalle de la etapa productiva,
// donde la etapa y sus momentos ya están cargados.
export function ProgresoPracticaTarjeta(props: {
  a: AprendizPractica
  etapa: EtapaConSeguimientos
  badge: { label: string; tone: 'ok' | 'err' | 'warn' | 'accent' | 'neutral' | 'blue' }
  modalidad: string | null
}) {
  return (
    <div className="ppr ppr--fija">
      <ProgresoContenido {...props}/>
    </div>
  )
}
