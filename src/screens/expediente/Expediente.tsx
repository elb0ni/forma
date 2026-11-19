// Expediente de una etapa productiva: lo que reemplaza al detalle por tabs.
// Una sola columna vertebral (los 3 momentos del GFPI-F-023), la línea de la
// etapa arriba y, al lado, lo que el instructor necesita mirar: bitácoras,
// visitas y cómo va. Todo lo demás está a un clic, en un panel lateral.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import api from '../../lib/api'
import { useAuthStore } from '../../store/auth'
import { Lienzo, Frase, Estado, Panel, Indicadores, Boton, PanelLateral, LineaEtapa } from '../../ui'
import { NOMBRE_MOMENTO, NUM_MOMENTO, estadoMomento, estadoBitacora, fdia, fdiaAnio, RELLENO } from '../../ui/estados'
import type { BitacoraVista, Estado as EstadoT, Tono } from '../../ui/estados'
import { SoloLecturaCtx } from '../productiva/soloLectura'
import { GeneralTab, PlaneacionTab, SeguimientosTab, EvaluacionTab } from '../productiva/EtapaProductivaDetalle'
import { ReportePreview } from '../productiva/ReportePreview'
import { CronogramaTab } from '../productiva/CronogramaTab'
import { AccesoAprendiz } from '../productiva/BitacorasTab'
import { bloqueoDe, firmaFuenteDe } from '../productiva/momentos'
import { MODALIDAD_LABEL, MODALIDAD_TIENE_EMPRESA, normalizeSeguimiento } from '../productiva/types'
import type { EtapaConSeguimientos, EstadoAprendiz } from '../productiva/types'
import type { Cronograma, ResumenBitacoras, TipoMomentoCron } from '../productiva/cronograma'
import { LecturaBitacora } from './LecturaBitacora'
import { factoresPorMomento, fraseExpediente, historiaEtapa, momentosEnPlazo, resumenFirmas } from './analisis'
import type { Habilitacion } from './analisis'
import './expediente.css'

export type AbrirEn = 'cronograma' | 'planeacion' | 'seguimientos' | 'evaluacion' | 'bitacoras'

const TIPO_DE: Record<'planeacion' | 'seguimientos' | 'evaluacion', TipoMomentoCron> = {
  planeacion: 'PLANEACION', seguimientos: 'SEGUIMIENTO', evaluacion: 'EVALUACION',
}
const ORDEN: TipoMomentoCron[] = ['PLANEACION', 'SEGUIMIENTO', 'EVALUACION']

type Lateral = null | 'documento' | 'datos' | 'visitas' | 'habilitacion' | { bitacora: number }

export function Expediente({ etapaId, onBack, backLabel = 'Volver', soloLectura, abrir }: {
  etapaId: number
  onBack: () => void
  backLabel?: string
  soloLectura?: boolean
  abrir?: AbrirEn
}) {
  const rol = useAuthStore((s) => s.user?.rol)
  const lectura = soloLectura ?? rol === 'COORD_ACADEMICO'

  const [etapa, setEtapa] = useState<EtapaConSeguimientos | null>(null)
  const [crono, setCrono] = useState<Cronograma | null>(null)
  const [cronoErr, setCronoErr] = useState<string | null>(null)
  const [hab, setHab] = useState<Habilitacion | null>(null)
  const [estadoCalc, setEstadoCalc] = useState<EstadoAprendiz | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lateral, setLateral] = useState<Lateral>(abrir === 'cronograma' ? 'visitas' : null)
  const [abiertos, setAbiertos] = useState<Set<TipoMomentoCron> | null>(
    abrir && abrir in TIPO_DE ? new Set([TIPO_DE[abrir as keyof typeof TIPO_DE]]) : null,
  )
  const refs = useRef<Partial<Record<TipoMomentoCron, HTMLElement | null>>>({})
  const bitsRef = useRef<HTMLElement | null>(null)

  // Si se entró pidiendo las bitácoras, la primera vez que llega el cronograma
  // se baja hasta ellas y se abre la primera sin leer.
  const yaBajo = useRef(abrir !== 'bitacoras')
  const cargarCrono = useCallback(() => {
    api.get<Cronograma>(`/etapas-productivas/${etapaId}/cronograma`)
      .then((r) => {
        setCrono(r.data); setCronoErr(null)
        if (yaBajo.current) return
        yaBajo.current = true
        const sinLeer = (r.data.bitacoras as BitacoraVista[]).find((b) => b.estado === 'ENTREGADA' && !b.leida_at)
        if (sinLeer) setLateral({ bitacora: sinLeer.numero })
        requestAnimationFrame(() => bitsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      })
      .catch((e) => setCronoErr(e?.response?.data?.message ?? 'No se pudo cargar el cronograma.'))
  }, [etapaId])

  const cargar = useCallback(() => {
    cargarCrono()
    api.get<EtapaConSeguimientos>(`/etapas-productivas/${etapaId}`)
      .then((r) => {
        setEtapa({ ...r.data, seguimientos: (r.data.seguimientos ?? []).map(normalizeSeguimiento) })
        const id = r.data.aprendiz_id
        api.get<Habilitacion>(`/aprendices/${id}/habilitacion`).then((h) => setHab(h.data)).catch(() => setHab(null))
        api.get<EstadoAprendiz>(`/aprendices/${id}/estado`).then((h) => setEstadoCalc(h.data)).catch(() => setEstadoCalc(null))
      })
      .catch((e) => setError(e?.response?.data?.message ?? 'No se pudo cargar el expediente.'))
  }, [etapaId, cargarCrono])

  useEffect(cargar, [cargar])

  const cerrar = useCallback(() => setLateral(null), [])

  const estados = useMemo(() => {
    const r = {} as Record<TipoMomentoCron, EstadoT>
    for (const t of ORDEN) {
      const m = crono?.momentos.find((x) => x.tipo === t)
      const hecho = etapa?.seguimientos.some((s) => s.tipo_momento === t)
      r[t] = m && crono ? estadoMomento(m, crono.hoy) : hecho ? { tono: 'hecho', texto: 'Registrado' } : { tono: 'futuro', texto: 'Sin registrar' }
    }
    return r
  }, [crono, etapa])

  if (error) {
    return (
      <Lienzo>
        <Boton tipo="suave" onClick={onBack}>← {backLabel}</Boton>
        <div style={{ marginTop: 16 }}><Frase tono="atraso">{error}</Frase></div>
      </Lienzo>
    )
  }
  if (!etapa) {
    return (
      <Lienzo>
        <Boton tipo="suave" onClick={onBack}>← {backLabel}</Boton>
        <p className="fx-texto-3" style={{ marginTop: 16 }}>Cargando el expediente…</p>
      </Lienzo>
    )
  }

  const planeacion = etapa.seguimientos.find((s) => s.tipo_momento === 'PLANEACION') ?? null
  const seguimientos = etapa.seguimientos.filter((s) => s.tipo_momento === 'SEGUIMIENTO')
  const evaluacion = etapa.seguimientos.find((s) => s.tipo_momento === 'EVALUACION') ?? null
  const requiereJefe = MODALIDAD_TIENE_EMPRESA[etapa.modalidad]
  const firmaFuente = firmaFuenteDe(etapa.seguimientos)

  // El momento que toca: el primero que no está hecho. Ese va abierto.
  const actual = ORDEN.find((t) => estados[t].tono !== 'hecho' && estados[t].tono !== 'aviso') ?? null
  const abiertosEf = abiertos ?? new Set(actual ? [actual] : [])
  const alternar = (t: TipoMomentoCron) => {
    const n = new Set(abiertosEf)
    if (n.has(t)) n.delete(t)
    else n.add(t)
    setAbiertos(n)
  }
  const irAMomento = (t: TipoMomentoCron) => {
    const n = new Set(abiertosEf)
    n.add(t)
    setAbiertos(n)
    setLateral(null)
    requestAnimationFrame(() => refs.current[t]?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const frase = crono ? fraseExpediente(crono, hab) : null
  const bits = (crono?.bitacoras ?? []) as BitacoraVista[]

  const cuerpoMomento: Record<TipoMomentoCron, ReactNode> = {
    PLANEACION: <PlaneacionTab etapa={etapa} etapaId={etapa.id} requiereJefe={requiereJefe} planeacion={planeacion} firmaFuente={firmaFuente} onChanged={cargar}/>,
    SEGUIMIENTO: <SeguimientosTab etapa={etapa} etapaId={etapa.id} requiereJefe={requiereJefe} planeacion={planeacion} seguimientos={seguimientos} firmaFuente={firmaFuente} bloqueo={bloqueoDe(crono, 'SEGUIMIENTO')} onChanged={cargar}/>,
    EVALUACION: <EvaluacionTab etapa={etapa} etapaId={etapa.id} visitas={seguimientos.length} requiereJefe={requiereJefe} planeacion={planeacion} evaluacion={evaluacion} firmaFuente={firmaFuente} bloqueo={bloqueoDe(crono, 'EVALUACION')} onChanged={cargar}/>,
  }
  const notaMomento = (t: TipoMomentoCron): string | null => {
    if (t === 'SEGUIMIENTO' && seguimientos.length > 1) return `${seguimientos.length} registrados (con extraordinarios)`
    const s = etapa.seguimientos.find((x) => x.tipo_momento === t)
    if (!s) return null
    return s.firmado_at ? 'Firmado' : 'Falta firmar'
  }

  return (
    <SoloLecturaCtx.Provider value={lectura}>
      <Lienzo className="ex">
        <Boton tipo="suave" onClick={onBack}>← {backLabel}</Boton>

        <header className="ex-cab">
          <div style={{ minWidth: 0 }}>
            <div className="fx-eyebrow">Ficha {etapa.numero_ficha ?? '—'} · {etapa.programa_nombre ?? 'Programa'}</div>
            <h1 className="fx-titulo">{etapa.aprendiz_nombre}</h1>
            <div className="ex-sub fx-texto-2">
              <span>{MODALIDAD_LABEL[etapa.modalidad]}</span>
              {etapa.empresa_nombre && <span>{etapa.empresa_nombre}</span>}
              <span className="fx-num">{etapa.aprendiz_documento}</span>
              {etapa.instructor_nombre && <span>Instructor: {etapa.instructor_nombre}</span>}
            </div>
          </div>
          <div className="ex-acciones">
            <button type="button" className="ex-hab" onClick={() => setLateral('habilitacion')} title="Ver lo que dice SofiaPlus">
              <EstadoHabilitacion hab={hab}/>
            </button>
            <Boton tipo="suave" onClick={() => setLateral('datos')}>Datos de la etapa</Boton>
            <Boton onClick={() => setLateral('documento')}>Ver como documento oficial</Boton>
          </div>
        </header>

        {frase && <Frase tono={frase.tono}>{frase.texto}</Frase>}
        {estadoCalc?.caso === 2 && (
          <p className="ex-nota">La evaluación ya está en FORMA, pero SofiaPlus todavía no muestra el juicio de la etapa productiva. Se actualiza con la próxima lectura.</p>
        )}
        {cronoErr && <p className="ex-nota">{cronoErr}</p>}

        {crono && (
          <Panel className="ex-linea" sinCuerpo>
            <div className="fx-linea-envoltura">
              <LineaEtapa crono={crono} onMomento={irAMomento} onBitacora={(n) => setLateral({ bitacora: n })}/>
            </div>
          </Panel>
        )}

        <div className="ex-rejilla">
          <div className="ex-columna">
            <h2 className="fx-eyebrow ex-titulo-col">Los momentos del formato GFPI-F-023</h2>
            {ORDEN.map((t) => {
              const abierto = abiertosEf.has(t)
              const est = estados[t]
              const nota = notaMomento(t)
              return (
                <section
                  key={t}
                  className="ex-momento"
                  data-abierto={abierto || undefined}
                  data-actual={t === actual || undefined}
                  ref={(el) => { refs.current[t] = el }}
                >
                  <button type="button" className="ex-momento-cab" onClick={() => alternar(t)} aria-expanded={abierto}>
                    <span className="ex-momento-num" data-tono={est.tono}>{NUM_MOMENTO[t]}</span>
                    <span className="ex-momento-nombre">{NOMBRE_MOMENTO[t]}</span>
                    <Estado tono={est.tono}>{est.texto}</Estado>
                    {nota && <span className="fx-texto-3 ex-momento-nota">{nota}</span>}
                    <span className="ex-momento-flecha" aria-hidden>{abierto ? '−' : '+'}</span>
                  </button>
                  {abierto && <div className="ex-momento-cuerpo fx-legado">{cuerpoMomento[t]}</div>}
                </section>
              )
            })}
          </div>

          <aside className="ex-lado">
            <section ref={bitsRef}>
              <Panel titulo="Bitácoras" accion={crono && <span className="fx-texto-3 fx-num">{resumenCorto(bits)}</span>}>
                {!crono ? <p className="fx-texto-3">Cargando…</p> : (
                  <>
                    <div className="ex-bits">
                      {bits.map((b) => {
                        const e = estadoBitacora(b, crono.hoy)
                        return (
                          <button
                            type="button" key={b.numero} className="ex-bit" data-tono={e.tono}
                            title={`Bitácora ${b.numero} · ${fdia(b.periodo_inicio)} – ${fdia(b.periodo_fin)} · ${e.texto}`}
                            onClick={() => setLateral({ bitacora: b.numero })}
                          >
                            <span className="fx-num">{b.numero}</span>
                            {(b.dificultades ?? 0) > 0 && <i className="ex-bit-marca" title="Reportó dificultades"/>}
                          </button>
                        )
                      })}
                    </div>
                    <Leyenda/>
                    <p className="fx-texto-3" style={{ marginTop: 10 }}>{accesoTexto(crono)}</p>
                  </>
                )}
              </Panel>
            </section>

            <Panel titulo="Visitas" accion={<Boton tipo="suave" onClick={() => setLateral('visitas')}>{lectura ? 'Ver agenda' : 'Agendar'}</Boton>}>
              {!crono ? <p className="fx-texto-3">Cargando…</p> : <Visitas crono={crono}/>}
            </Panel>

            {crono && <Analisis etapa={etapa} crono={crono}/>}
          </aside>
        </div>

        <LoQuePaso etapa={etapa} crono={crono}/>

        {/* ─── Paneles laterales ─── */}
        <PanelLateral abierto={lateral === 'documento'} titulo="Documento oficial GFPI-F-023" sub="Se arma con lo registrado en los tres momentos." onCerrar={cerrar} ancho={900}>
          <div className="fx-legado"><ReportePreview etapa={etapa}/></div>
        </PanelLateral>
        <PanelLateral abierto={lateral === 'datos'} titulo="Datos de la etapa" sub="Empresa, jefe inmediato, contactos y fechas." onCerrar={cerrar} ancho={760}>
          <div className="fx-legado"><GeneralTab etapa={etapa} onSaved={cargar}/></div>
        </PanelLateral>
        <PanelLateral abierto={lateral === 'visitas'} titulo="Agenda de visitas" sub="Cuándo va cada momento y las visitas acordadas." onCerrar={cerrar} ancho={860}>
          {crono && (
            <div className="fx-legado">
              <CronogramaTab
                etapaId={etapa.id} crono={crono} onChanged={setCrono}
                onIrA={(t) => (t === 'bitacoras' ? (setLateral(null), bitsRef.current?.scrollIntoView({ behavior: 'smooth' })) : irAMomento(TIPO_DE[t]))}
              />
              <div style={{ marginTop: 16 }}><AccesoAprendiz crono={crono} aprendizNombre={etapa.aprendiz_nombre ?? ''}/></div>
            </div>
          )}
        </PanelLateral>
        <PanelLateral abierto={lateral === 'habilitacion'} titulo="Habilitación en SofiaPlus" sub="Lo que reporta la lectura de juicios, y sus cambios." onCerrar={cerrar}>
          <DetalleHabilitacion hab={hab}/>
        </PanelLateral>
        {typeof lateral === 'object' && lateral && crono && (
          <PanelLateral
            abierto titulo={`Bitácora ${lateral.bitacora}`}
            sub={periodoDe(crono, lateral.bitacora)}
            onCerrar={cerrar} ancho={640}
          >
            <LecturaBitacora
              key={lateral.bitacora}
              etapaId={etapa.id} numero={lateral.bitacora} hoy={crono.hoy}
              onCambio={(lista: BitacoraVista[], resumen: ResumenBitacoras) => setCrono((c) => (c ? { ...c, bitacoras: lista, resumen_bitacoras: resumen } : c))}
              onNavegar={(n) => setLateral({ bitacora: n })}
              total={bits.length}
            />
          </PanelLateral>
        )}
      </Lienzo>
    </SoloLecturaCtx.Provider>
  )
}

function periodoDe(crono: Cronograma, n: number) {
  const b = crono.bitacoras.find((x) => x.numero === n)
  return b ? `Quincena del ${fdia(b.periodo_inicio)} al ${fdia(b.periodo_fin)} · plazo ${fdia(b.fecha_limite)}` : undefined
}

function resumenCorto(bits: BitacoraVista[]) {
  const entregadas = bits.filter((b) => b.entregada_at).length
  const leidas = bits.filter((b) => b.leida_at || b.estado === 'APROBADA').length
  return `${entregadas}/${bits.length} entregadas · ${leidas} leídas`
}

function accesoTexto(crono: Cronograma) {
  const a = crono.acceso
  if (!a) return 'El aprendiz aún no ha entrado a "Mi etapa".'
  if (a.ultimo_ingreso_at) return `Último ingreso del aprendiz a "Mi etapa": ${fdiaAnio(a.ultimo_ingreso_at)}.`
  return `Pidió un código el ${fdia(a.generado_at)}, pero no ha entrado.`
}

const LEYENDA: { tono: Tono; texto: string }[] = [
  { tono: 'hecho', texto: 'Leída' },
  { tono: 'info', texto: 'Sin leer' },
  { tono: 'aviso', texto: 'Corrección' },
  { tono: 'atraso', texto: 'Atrasada' },
  { tono: 'futuro', texto: 'Próxima' },
]
function Leyenda() {
  return (
    <div className="ex-leyenda">
      {LEYENDA.map((l) => (
        <span key={l.tono}><i style={{ background: RELLENO[l.tono] }}/>{l.texto}</span>
      ))}
    </div>
  )
}

function EstadoHabilitacion({ hab }: { hab: Habilitacion | null }) {
  if (!hab || !hab.estado_sofia) return <Estado tono="neutro">Sin lectura de SofiaPlus</Estado>
  if (!hab.habilitado) return <Estado tono="atraso">SofiaPlus: {hab.estado_sofia.toLowerCase()}</Estado>
  if (hab.sin_verificar) return <Estado tono="aviso">Habilitado · lectura vieja ({fdia(hab.verificado_el)})</Estado>
  return <Estado tono="hecho">Habilitado · verificado el {fdia(hab.verificado_el)}</Estado>
}

const CAMPO: Record<string, string> = {
  estado_aprendiz: 'Estado en SofiaPlus',
  puede_iniciar: 'Puede iniciar la práctica',
  ra_practica_juicio: 'Juicio de la etapa productiva',
}
function DetalleHabilitacion({ hab }: { hab: Habilitacion | null }) {
  if (!hab || !hab.estado_sofia) {
    return <p className="fx-texto-2">Todavía no hay una lectura de juicios de SofiaPlus para este aprendiz. El robot la hace cada semana para las fichas en práctica.</p>
  }
  return (
    <div className="ex-hab-detalle">
      <EstadoHabilitacion hab={hab}/>
      <p className="fx-texto-2">
        Última lectura: <strong>{fdiaAnio(hab.verificado_el)}</strong>.
        {hab.sin_verificar && ' Tiene más de 14 días: el dato puede estar desactualizado.'}
      </p>
      <h4 className="fx-eyebrow" style={{ marginTop: 18 }}>Cambios registrados</h4>
      {hab.eventos.length === 0 ? (
        <p className="fx-texto-3">Sin cambios desde que FORMA empezó a leer esta ficha.</p>
      ) : (
        <ul className="ex-eventos">
          {hab.eventos.map((e, i) => (
            <li key={i}>
              <span className="fx-num fx-texto-3">{fdia(e.fecha_reporte)}</span>
              <span>{CAMPO[e.campo] ?? e.campo}: {e.antes ?? '—'} → <strong>{e.despues ?? '—'}</strong></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Visitas({ crono }: { crono: Cronograma }) {
  const proximas = crono.visitas.filter((v) => v.fecha >= crono.hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const sinAgendar = crono.momentos.filter((m) => m.estado === 'SIN_PROGRAMAR')
  return (
    <div className="ex-visitas">
      {proximas.length === 0 && <p className="fx-texto-3">No hay visitas agendadas.</p>}
      {proximas.slice(0, 4).map((v) => (
        <div key={v.id} className="ex-visita">
          <span className="fx-num ex-visita-dia">{fdia(v.fecha)}{v.hora ? ` · ${v.hora.slice(0, 5)}` : ''}</span>
          <span>{v.tipo_momento === 'EXTRA' ? 'Visita extra' : NOMBRE_MOMENTO[v.tipo_momento]} · {v.modalidad === 'VIRTUAL' ? 'virtual' : 'presencial'}</span>
        </div>
      ))}
      {sinAgendar.length > 0 && (
        <p className="fx-texto-3" style={{ marginTop: 8 }}>
          Sin fecha: {sinAgendar.map((m) => `${NOMBRE_MOMENTO[m.tipo].toLowerCase()} (sugerida ${fdia(m.fecha_sugerida)})`).join(', ')}.
        </p>
      )}
    </div>
  )
}

function Analisis({ etapa, crono }: { etapa: EtapaConSeguimientos; crono: Cronograma }) {
  const plazo = momentosEnPlazo(crono)
  const firmas = resumenFirmas(etapa)
  const factores = factoresPorMomento(etapa)
  const bits = crono.bitacoras as BitacoraVista[]
  const esperadas = bits.filter((b) => b.estado !== 'FUTURA' && crono.hoy > b.fecha_limite).length
  const aTiempo = bits.filter((b) => b.entregada_at && !b.entregada_tarde).length
  const entregadas = bits.filter((b) => b.entregada_at).length
  const leidas = bits.filter((b) => b.leida_at || b.estado === 'APROBADA').length
  const dificultades = bits.filter((b) => (b.dificultades ?? 0) > 0).length
  return (
    <Panel titulo="Cómo va">
      <Indicadores items={[
        { k: 'Momentos en plazo', v: plazo.hechos ? `${plazo.enPlazo}/${plazo.hechos}` : '—', nota: plazo.hechos ? 'de los registrados' : 'aún sin registrar', tono: plazo.enPlazo < plazo.hechos ? 'atraso' : undefined },
        { k: 'Bitácoras al día', v: `${entregadas}/${Math.max(esperadas, entregadas)}`, nota: `${aTiempo} a tiempo`, tono: entregadas < esperadas ? 'atraso' : undefined },
        { k: 'Leídas', v: entregadas ? `${leidas}/${entregadas}` : '—', nota: 'por el instructor' },
        { k: 'Con dificultades', v: String(dificultades), nota: 'bitácoras', tono: dificultades ? 'atraso' : undefined },
      ]}/>
      {factores.length > 0 && (
        <div className="ex-factores">
          <h4 className="fx-eyebrow">Factores satisfactorios</h4>
          {factores.map((f) => (
            <div key={f.nombre} className="ex-factor">
              <div className="ex-factor-cab"><span>{f.nombre}</span><span className="fx-num">{f.satisfactorios}/{f.total}</span></div>
              <div className="ex-barra"><i style={{ width: `${f.total ? (f.satisfactorios / f.total) * 100 : 0}%` }}/></div>
              {f.porMejorar.length > 0 && <div className="fx-texto-3">Por mejorar: {f.porMejorar.join(', ')}</div>}
            </div>
          ))}
        </div>
      )}
      {firmas.conUbicacion > 0 && (
        <p className="fx-texto-3" style={{ marginTop: 12 }}>
          Firmas con ubicación: {firmas.conUbicacion}
          {firmas.fueraDeRango > 0 ? `, ${firmas.fueraDeRango} lejos de la empresa` : ', todas cerca de la empresa'}
          {firmas.masLejana != null && ` (la más lejana a ${Math.round(firmas.masLejana)} m)`}.
        </p>
      )}
    </Panel>
  )
}

function LoQuePaso({ etapa, crono }: { etapa: EtapaConSeguimientos; crono: Cronograma | null }) {
  const [todo, setTodo] = useState(false)
  const ev = historiaEtapa(etapa, crono)
  const lista = todo ? ev : ev.slice(0, 5)
  return (
    <Panel titulo="Lo que pasó" className="ex-historia" accion={ev.length > 5 && <Boton tipo="suave" onClick={() => setTodo(!todo)}>{todo ? 'Ver menos' : `Ver todo (${ev.length})`}</Boton>}>
      <ul className="ex-eventos">
        {lista.map((e, i) => (
          <li key={i}><span className="fx-num fx-texto-3">{fdiaAnio(e.fecha)}</span><span>{e.texto}</span></li>
        ))}
      </ul>
    </Panel>
  )
}
