import type { ReactNode } from 'react'
import { BrandMark, Card } from '../../components/ui'
import { fd, diasHasta } from '../shared/parts'
import { FirmaImg } from './parts'
import type { Firmante } from './parts'
import {
  MODALIDAD_LABEL, MODALIDAD_TIENE_EMPRESA,
  FACTORES_TECNICOS, FACTORES_ACTITUDINALES, factoresDesde,
} from './types'
import type {
  EtapaProductiva, SeguimientoProductivo, PlanTrabajo, EstadoEtapaProductiva, TipoSeguimiento, FactorItem,
} from './types'
import { estructurarPlan } from './planTrabajo'
import './ReportePreview.css'

// ─── Vista previa del reporte GFPI-F-023 ──────────────────────────────────────
// Documento que se arma en vivo con lo que el instructor va registrando en los
// 4 tabs de EtapaProductivaDetalle (etapa + sus seguimientos). No hay endpoint
// que lo genere: se renderiza en el frontend desde los datos ya cargados. Lo
// que falta se muestra como campo vacío / "Pendiente", con el aspecto del
// formato oficial (encabezado SENA, secciones numeradas, grillas, firmas).

type EtapaConSeguimientos = EtapaProductiva & { seguimientos: SeguimientoProductivo[] }

const ESTADO_EP_LABEL: Record<EstadoEtapaProductiva, string> = {
  PENDIENTE_INICIO: 'Pendiente de inicio',
  EN_EJECUCION: 'En ejecución',
  SUSPENDIDA: 'Suspendida',
  APLAZADA: 'Aplazada',
  TERMINADA: 'Terminada',
  CANCELADA: 'Cancelada',
}

const TIPO_SEG_LABEL: Record<TipoSeguimiento, string> = {
  PRESENCIAL: 'Presencial', VIRTUAL: 'Virtual', TELEFONICA: 'Telefónica',
}

// fd() de shared/parts devuelve '—' para vacío; acá queremos null para poder
// pintar el placeholder "Pendiente".
function fecha(s: string | null | undefined): string | null {
  const t = fd(s)
  return t === '—' ? null : t
}

// ─── Piezas ──────────────────────────────────────────────────────────────────

function Valor({ children, mono }: { children: string | null | undefined; mono?: boolean }) {
  if (!children) return <span className="rp__field-value rp__empty">Pendiente</span>
  return <span className={`rp__field-value${mono ? ' rp__field-value--mono' : ''}`}>{children}</span>
}

function Campo({ label, value, mono, wide }: {
  label: string; value: string | null | undefined; mono?: boolean; wide?: boolean
}) {
  return (
    <div className={`rp__field${wide ? ' rp__field--wide' : ''}`}>
      <span className="rp__field-label">{label}</span>
      <Valor mono={mono}>{value}</Valor>
    </div>
  )
}

function BloqueTexto({ label, value }: { label: string; value: string }) {
  return (
    <div className="rp__block">
      <div className="rp__block-label">{label}</div>
      <div className={`rp__block-value${value ? '' : ' rp__empty'}`}>{value || 'Sin diligenciar'}</div>
    </div>
  )
}

// Plan de trabajo en el reporte: cada competencia con sus RA y cada actividad
// con sus evidencias, en vez de cuatro listas sueltas que hay que emparejar.
function PlanDoc({ plan }: { plan: PlanTrabajo | null | undefined }) {
  const { grupos, acts, ras, comps, nEv } = estructurarPlan(plan)
  return (
    <>
      <div className="rp__block">
        <div className="rp__block-label rp__plan-cab">
          <span>Competencias y resultados de aprendizaje</span>
          <span className="rp__plan-n">{comps.length} comp. · {ras.length} RA</span>
        </div>
        {grupos.length === 0 && <div className="rp__empty">Sin diligenciar</div>}
        {grupos.map((g, gi) => (
          <div key={gi} className="rp__plan-grupo">
            <div className="rp__plan-comp">
              {g.comp
                ? <>{g.comp.codigo && <span className="rp__plan-cod">{g.comp.codigo}</span>}{g.comp.nombre}</>
                : <span className="rp__plan-otros">Otros resultados</span>}
            </div>
            {g.ras.map(r => (
              <div key={r.i} className="rp__plan-item">
                <span className="rp__plan-num">{r.numero ?? r.i}</span>
                <span>{r.texto}</span>
              </div>
            ))}
            {g.ras.length === 0 && <div className="rp__plan-item rp__empty">Sin resultados de aprendizaje</div>}
          </div>
        ))}
      </div>

      <div className="rp__block">
        <div className="rp__block-label rp__plan-cab">
          <span>Actividades y evidencias</span>
          <span className="rp__plan-n">{acts.length} act. · {nEv} evid.</span>
        </div>
        {acts.length === 0 && <div className="rp__empty">Sin diligenciar</div>}
        {acts.map((a, i) => (
          <div key={i} className="rp__plan-grupo">
            <div className="rp__plan-act">
              <span className="rp__plan-a">A{i + 1}</span>
              <span>{a.texto}</span>
            </div>
            {a.evs.map((e, j) => (
              <div key={j} className="rp__plan-ev">{e}</div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function Seccion({ n, title, tag, children }: {
  n: string; title: string
  tag?: { kind: 'ok' | 'pend' | 'count'; text: string }
  children: ReactNode
}) {
  return (
    <section className="rp__section">
      <div className="rp__section-head">
        <span className="rp__section-n">{n}</span>
        <span className="rp__section-title">{title}</span>
        {tag && <span className={`rp__section-tag rp__section-tag--${tag.kind}`}>{tag.text}</span>}
      </div>
      <div className="rp__section-body">{children}</div>
    </section>
  )
}

function Pendiente({ text }: { text: string }) {
  return <div className="rp__pend">{text}</div>
}

function Grilla({ titulo, items }: { titulo: string; items: FactorItem[] }) {
  return (
    <table className="rp__grilla">
      <caption>{titulo}</caption>
      <thead>
        <tr><th>Variable</th><th>Valoración</th><th>Observación / compromiso</th></tr>
      </thead>
      <tbody>
        {items.map(f => (
          <tr key={f.variable}>
            <td>{f.label}</td>
            <td>
              {f.valor === 'SATISFACTORIO'
                ? <span className="rp__v-ok">Satisfactorio</span>
                : f.valor === 'POR_MEJORAR'
                  ? <span className="rp__v-mej">Por mejorar</span>
                  : <span className="rp__v-none">—</span>}
            </td>
            <td>{f.observacion || <span className="rp__v-none">—</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Firmas({ s, requiereJefe }: { s: SeguimientoProductivo; requiereJefe: boolean }) {
  const campos: [string, string | null, Firmante][] = [
    ['Instructor de seguimiento', s.firma_instructor_ruta, 'instructor'],
    ['Aprendiz', s.firma_aprendiz_ruta, 'aprendiz'],
    ...(requiereJefe ? [['Ente co-formador', s.firma_jefe_ruta, 'jefe'] as [string, string | null, Firmante]] : []),
  ]
  return (
    <>
      <div className={`rp__firmas${requiereJefe ? '' : ' rp__firmas--2'}`}>
        {campos.map(([rol, ruta, firmante]) => (
          <div key={rol} className="rp__firma">
            <div className="rp__firma-slot">
              {ruta
                ? <FirmaImg seguimientoId={s.id} firmante={firmante} ruta={ruta} height={38}/>
                : <span className="rp__firma-status rp__firma-status--pend">·</span>}
            </div>
            <div className="rp__firma-line"/>
            <div className="rp__firma-role">{rol}</div>
            <div className="rp__firma-date">{ruta ? 'Firmado' : 'Pendiente'}</div>
          </div>
        ))}
      </div>
      {s.firmado_at && (
        <div className="rp__ubic">Firmas completas · {fecha(s.firmado_at)}</div>
      )}
      {s.ubicacion_lat != null && s.ubicacion_lng != null && (
        <div className={`rp__ubic${s.ubicacion_alerta ? ' rp__ubic--alerta' : ''}`}>
          📍 Registrado desde {Number(s.ubicacion_lat).toFixed(4)}, {Number(s.ubicacion_lng).toFixed(4)}
          {s.distancia_empresa_m != null && ` · a ${s.distancia_empresa_m} m de la empresa`}
          {s.ubicacion_alerta && ' · fuera de rango'}
        </div>
      )}
    </>
  )
}

// ─── Cuerpos por momento ─────────────────────────────────────────────────────

function CuerpoPlaneacion({ s, requiereJefe }: { s: SeguimientoProductivo; requiereJefe: boolean }) {
  return (
    <>
      <div className="rp__grid">
        <Campo label="Diligenciada" value={fecha(s.fecha_realizada)}/>
        <Campo label="Modalidad" value={TIPO_SEG_LABEL[s.tipo_seguimiento]}/>
        <Campo label="Afiliación ARL" value={fecha(s.fecha_afiliacion_arl)}/>
        <Campo label="N.º póliza ARL" value={s.numero_poliza_arl}/>
        <Campo label="Horario" value={s.horario} wide/>
      </div>
      <PlanDoc plan={s.plan_trabajo}/>
      {s.observaciones_instructor && <BloqueTexto label="Observaciones adicionales" value={s.observaciones_instructor}/>}
      <Firmas s={s} requiereJefe={requiereJefe}/>
    </>
  )
}

function CuerpoSeguimiento({ s, requiereJefe }: { s: SeguimientoProductivo; requiereJefe: boolean }) {
  const tecnicos = factoresDesde(FACTORES_TECNICOS, s.valoracion_json?.tecnicos)
  const actitudinales = factoresDesde(FACTORES_ACTITUDINALES, s.valoracion_json?.actitudinales)
  const obs: [string, string | null][] = [
    ['Observaciones del instructor', s.observaciones_instructor],
    ['Observaciones del aprendiz', s.observaciones_aprendiz],
    ['Observaciones del ente co-formador', s.observaciones_coformador],
  ]
  return (
    <div className="rp__sub">
      <div className="rp__sub-head">
        <span className="rp__sub-n">Seguimiento N.º {s.numero_seguimiento}</span>
        <span>{fecha(s.fecha_realizada) ?? 'sin fecha'}</span>
        <span>· {TIPO_SEG_LABEL[s.tipo_seguimiento]}</span>
        {s.motivo_extraordinario && <span className="rp__sub-tag">Extraordinario</span>}
      </div>
      <div className="rp__sub-body">
        {s.motivo_extraordinario && (
          <BloqueTexto label="Motivo del seguimiento extraordinario" value={s.motivo_extraordinario}/>
        )}
        <Grilla titulo="Factores técnicos" items={tecnicos}/>
        <Grilla titulo="Factores actitudinales y comportamentales" items={actitudinales}/>
        {obs.filter(([, v]) => v).map(([label, v]) => (
          <BloqueTexto key={label} label={label} value={v ?? ''}/>
        ))}
        <Firmas s={s} requiereJefe={requiereJefe}/>
      </div>
    </div>
  )
}

function CuerpoEvaluacion({ s, etapa, requiereJefe }: {
  s: SeguimientoProductivo; etapa: EtapaConSeguimientos; requiereJefe: boolean
}) {
  const tecnicos = factoresDesde(FACTORES_TECNICOS, s.valoracion_json?.tecnicos)
  const actitudinales = factoresDesde(FACTORES_ACTITUDINALES, s.valoracion_json?.actitudinales)
  const juicio = etapa.resultado_final
  const jClass = juicio === 'APROBADO' ? 'aprobado' : juicio === 'NO_APROBADO' ? 'noaprobado' : 'pend'
  return (
    <>
      <div className="rp__grid">
        <Campo label="Fecha" value={fecha(s.fecha_realizada)}/>
        <Campo label="Modalidad" value={TIPO_SEG_LABEL[s.tipo_seguimiento]}/>
      </div>
      <Grilla titulo="Factores técnicos" items={tecnicos}/>
      <Grilla titulo="Factores actitudinales y comportamentales" items={actitudinales}/>
      <BloqueTexto label="Retroalimentación · ente co-formador" value={s.retro_coformador ?? ''}/>
      <BloqueTexto label="Retroalimentación · instructor de seguimiento" value={s.retro_instructor ?? ''}/>
      <BloqueTexto label="Retroalimentación · aprendiz" value={s.retro_aprendiz ?? ''}/>
      <div className={`rp__juicio rp__juicio--${jClass}`}>
        <span className="rp__juicio-label">Juicio de evaluación</span>
        <span className={`rp__juicio-value rp__juicio-value--${jClass}`}>
          {juicio === 'APROBADO' ? 'Aprobado' : juicio === 'NO_APROBADO' ? 'No aprobado' : 'Sin emitir'}
        </span>
      </div>
      <Firmas s={s} requiereJefe={requiereJefe}/>
    </>
  )
}

// ─── Documento ───────────────────────────────────────────────────────────────

export function ReportePreview({ etapa }: { etapa: EtapaConSeguimientos }) {
  const requiereJefe = MODALIDAD_TIENE_EMPRESA[etapa.modalidad]
  const planeacion = etapa.seguimientos.find(s => s.tipo_momento === 'PLANEACION') ?? null
  const seguimientos = etapa.seguimientos
    .filter(s => s.tipo_momento === 'SEGUIMIENTO')
    .sort((a, b) => a.numero_seguimiento - b.numero_seguimiento)
  const evaluacion = etapa.seguimientos.find(s => s.tipo_momento === 'EVALUACION') ?? null
  const hoy = new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  const momentosCompletos = (planeacion ? 1 : 0) + (seguimientos.length ? 1 : 0) + (evaluacion ? 1 : 0)
  const momentos = etapa.seguimientos
  const firmados = momentos.filter(m => m.firmado_at).length
  const diasCierre = diasHasta(etapa.fecha_fin_estimada)
  const diasTxt = etapa.resultado_final ? 'Cerrada'
    : diasCierre == null ? '—'
    : diasCierre < 0 ? `${Math.abs(diasCierre)} d venc.`
    : `${diasCierre} d`

  const kpis: { label: string; value: string }[] = [
    { label: 'Momentos', value: `${momentosCompletos}/3` },
    { label: 'Seguimientos', value: String(seguimientos.length) },
    { label: 'Firmas OK', value: momentos.length ? `${firmados}/${momentos.length}` : '—' },
    { label: 'Cierre estimado', value: diasTxt },
  ]

  return (
    <Card style={{ padding: 40 }}>
      <div className="rp">
        <div className="rp__head">
          <div className="rp__head-brand">
            <BrandMark size={22}/>
            <div>
              <div className="rp__brand-name">FORMA</div>
              <div className="rp__brand-tag">Plataforma de seguimiento de etapa productiva</div>
            </div>
          </div>
          <div className="rp__head-meta">
            <div>SENA · Regional Atlántico</div>
            <div>Formato GFPI-F-023 · V06</div>
            <div>Generado · {hoy}</div>
          </div>
        </div>

        <h1 className="rp__title">Seguimiento y evaluación de la etapa productiva</h1>
        <div className="rp__subtitle">
          {etapa.aprendiz_nombre ?? 'Aprendiz'} · {MODALIDAD_LABEL[etapa.modalidad]}
          {etapa.aprendiz_documento ? ` · Doc. ${etapa.aprendiz_documento}` : ''}
        </div>

        <div className="rp__kpis">
          {kpis.map(k => (
            <div key={k.label} className="rp__kpi">
              <div className="rp__kpi-label">{k.label}</div>
              <div className="rp__kpi-value">{k.value}</div>
            </div>
          ))}
        </div>

        <div className="rp__progress">
          <span className={`rp__chip rp__chip--${planeacion ? 'ok' : 'pend'}`}>
            {planeacion ? '✓' : '·'} Planeación
          </span>
          <span className={`rp__chip${seguimientos.length ? '' : ' rp__chip--pend'}`}>
            Seguimientos {seguimientos.length}
          </span>
          <span className={`rp__chip rp__chip--${evaluacion ? 'ok' : 'pend'}`}>
            {evaluacion ? '✓' : '·'} Evaluación
          </span>
        </div>

        <Seccion n="1" title="Identificación">
          <div className="rp__grid">
            <Campo label="Aprendiz" value={etapa.aprendiz_nombre}/>
            <Campo label="Documento" value={etapa.aprendiz_documento} mono/>
            <Campo label="Instructor" value={etapa.instructor_nombre}/>
            <Campo label="Alternativa" value={MODALIDAD_LABEL[etapa.modalidad]}/>
            <Campo label="Fecha inicio" value={fecha(etapa.fecha_inicio)}/>
            <Campo label="Fin estimada" value={fecha(etapa.fecha_fin_estimada)}/>
            <Campo label="Fin real" value={fecha(etapa.fecha_fin_real)}/>
            <Campo label="Estado" value={ESTADO_EP_LABEL[etapa.estado]}/>
          </div>
        </Seccion>

        {requiereJefe && (
          <Seccion n="1.1" title="Ente co-formador">
            <div className="rp__grid">
              <Campo label="Empresa" value={etapa.empresa_nombre}/>
              <Campo label="NIT" value={etapa.empresa_nit} mono/>
              <Campo label="Dirección" value={etapa.empresa_direccion} wide/>
              <Campo label="Jefe inmediato" value={etapa.jefe_inmediato_nombre}/>
              <Campo label="Cargo" value={etapa.jefe_inmediato_cargo}/>
              <Campo label="Teléfono" value={etapa.jefe_inmediato_telefono} mono/>
              <Campo label="Correo" value={etapa.jefe_inmediato_email}/>
            </div>
          </Seccion>
        )}

        <Seccion
          n="2"
          title="Momento 1 · Planeación y concertación del plan de trabajo"
          tag={planeacion ? { kind: 'ok', text: 'Registrada' } : { kind: 'pend', text: 'Pendiente' }}
        >
          {planeacion
            ? <CuerpoPlaneacion s={planeacion} requiereJefe={requiereJefe}/>
            : <Pendiente text="La planeación aún no se ha registrado. Se diligencia una sola vez, al inicio de la etapa."/>}
        </Seccion>

        <Seccion
          n="3"
          title="Momento 2 · Seguimientos a la etapa productiva"
          tag={seguimientos.length
            ? { kind: 'count', text: String(seguimientos.length) }
            : { kind: 'pend', text: 'Pendiente' }}
        >
          {seguimientos.length === 0
            ? <Pendiente text="Aún no se registran seguimientos. Se agrega uno por cada visita o contacto durante la ejecución."/>
            : seguimientos.map(s => <CuerpoSeguimiento key={s.id} s={s} requiereJefe={requiereJefe}/>)}
        </Seccion>

        <Seccion
          n="4"
          title="Momento 3 · Evaluación final de la etapa productiva"
          tag={evaluacion ? { kind: 'ok', text: 'Registrada' } : { kind: 'pend', text: 'Pendiente' }}
        >
          {evaluacion
            ? <CuerpoEvaluacion s={evaluacion} etapa={etapa} requiereJefe={requiereJefe}/>
            : <Pendiente text="La evaluación final aún no se ha registrado. Se diligencia una sola vez, al terminar la etapa."/>}
        </Seccion>

        <div className="rp__footer">
          <span>FORMA · GFPI-F-023 V06 · {etapa.aprendiz_nombre ?? 'Aprendiz'}</span>
          <span>{etapa.seguimientos.length} registro{etapa.seguimientos.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </Card>
  )
}
