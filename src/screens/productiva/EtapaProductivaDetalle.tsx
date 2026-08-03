import { useEffect, useState } from 'react'
import { Ic, Card, Btn, Tag, Bdg } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { fd, Seg, InlineAlert, CenterState, LoadingBlock } from '../shared/parts'
import {
  Field, SectionIntro, FactoresBlock, MetaRow, EmptyHint, EstadoBdg, FirmasYUbicacion,
  FirmasCaptura, firmasVacias, firmasCompletas, subirFirma,
} from './parts'
import type { FirmasEstado, Firmante } from './parts'
import {
  MODALIDAD_LABEL, MODALIDAD_TIENE_EMPRESA,
  FACTORES_TECNICOS, FACTORES_ACTITUDINALES, factoresDesde, factoresAJson,
  lineasATexto, textoALineas,
} from './types'
import type {
  EtapaProductiva, SeguimientoProductivo, EstadoAprendiz, FactorItem,
  TipoSeguimiento, ResultadoFinal, EstadoEtapaProductiva,
} from './types'
import api from '../../lib/api'

type TabId = 'general' | 'planeacion' | 'seguimientos' | 'evaluacion'
type EtapaConSeguimientos = EtapaProductiva & { seguimientos: SeguimientoProductivo[] }

const MODALIDAD_SEG_OPTS = [
  { value: 'PRESENCIAL', label: 'Presencial' },
  { value: 'VIRTUAL', label: 'Virtual' },
  { value: 'TELEFONICA', label: 'Telefónica' },
]

// Sube las firmas capturadas en el formulario justo después de crear el
// momento (ya con su id) -- así el instructor firma antes de guardar, en vez
// de tener que volver a entrar al registro para hacerlo.
async function subirFirmas(seguimientoId: number, firmas: FirmasEstado, requiereJefe: boolean): Promise<void> {
  const entries: [Firmante, string | null][] = [
    ['instructor', firmas.instructor],
    ['aprendiz', firmas.aprendiz],
    ...(requiereJefe ? [['jefe', firmas.jefe] as [Firmante, string | null]] : []),
  ]
  for (const [firmante, dataUrl] of entries) {
    if (dataUrl) await subirFirma(seguimientoId, firmante, dataUrl)
  }
}

// ─── Contenedor: carga la etapa + su estado real y enruta entre tabs ───────────

export function EtapaProductivaDetalle({ etapaId, onBack }: { etapaId: number; onBack: () => void }) {
  "use no memo"
  const [etapa, setEtapa] = useState<EtapaConSeguimientos | null>(null)
  const [estadoCalc, setEstadoCalc] = useState<EstadoAprendiz | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>('general')

  function load() {
    api.get<EtapaConSeguimientos>(`/etapas-productivas/${etapaId}`)
      .then(r => {
        setEtapa(r.data)
        return api.get<EstadoAprendiz>(`/aprendices/${r.data.aprendiz_id}/estado`)
      })
      .then(r => setEstadoCalc(r.data))
      .catch(e => setError(e?.response?.data?.message ?? 'No se pudo cargar el registro.'))
  }
  useEffect(load, [etapaId])

  const back = (
    <button onClick={onBack} style={{ fontSize: 12.5, color: '#52525b', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
      <Ic n="arrowLeft" s={14}/>Etapa productiva
    </button>
  )

  if (error) return <div style={{ maxWidth: 1100 }}>{back}<Card style={{ padding: 24 }}><CenterState icon="alert" title="Registro no disponible" sub={error}/></Card></div>
  if (!etapa || !estadoCalc) return <div style={{ maxWidth: 1100 }}>{back}<LoadingBlock/></div>

  const planeacion = etapa.seguimientos.find(s => s.tipo_momento === 'PLANEACION') ?? null
  const seguimientos = etapa.seguimientos.filter(s => s.tipo_momento === 'SEGUIMIENTO')
  const evaluacion = etapa.seguimientos.find(s => s.tipo_momento === 'EVALUACION') ?? null
  const requiereJefe = MODALIDAD_TIENE_EMPRESA[etapa.modalidad]

  const TABS: { id: TabId; label: string; icon: IcName; badge?: 'ok' | 'warn' | 'count' }[] = [
    { id: 'general', label: 'Información general', icon: 'user' },
    { id: 'planeacion', label: 'Planeación', icon: 'target', badge: planeacion ? 'ok' : 'warn' },
    { id: 'seguimientos', label: 'Seguimientos', icon: 'list', badge: seguimientos.length ? 'count' : undefined },
    { id: 'evaluacion', label: 'Evaluación', icon: 'checkCircle', badge: evaluacion ? 'ok' : 'warn' },
  ]

  return (
    <div style={{ maxWidth: 1100 }}>
      {back}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: '#0a0a0b' }}>{etapa.aprendiz_nombre}</h2>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: '#52525b' }}>
            <Tag>{MODALIDAD_LABEL[etapa.modalidad]}</Tag>
            {etapa.empresa_nombre && <span>{etapa.empresa_nombre}</span>}
            <span style={{ color: '#d4d4d8' }}>·</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{etapa.aprendiz_documento}</span>
            <span style={{ color: '#d4d4d8' }}>·</span>
            <EstadoBdg estado={estadoCalc.estado}/>
          </div>
        </div>
      </div>

      {estadoCalc.caso === 2 && (
        <InlineAlert tone="warn" icon="clock" style={{ marginBottom: 20 }}>
          La evaluación ya quedó registrada en FORMA, pero el último reporte de SofiaPlus todavía no refleja el juicio de "etapa productiva" como evaluado. Se actualizará solo cuando se cargue el próximo corte semanal.
        </InlineAlert>
      )}

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid #e4e4e7', marginBottom: 24, overflowX: 'auto' }}>
        {TABS.map(t => {
          const active = tab === t.id
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '10px 4px', marginBottom: -1,
              background: 'none', border: 'none', borderBottom: `2px solid ${active ? '#4f46e5' : 'transparent'}`,
              color: active ? '#0a0a0b' : '#71717a', fontSize: 12.5, fontWeight: active ? 600 : 500,
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>
              <Ic n={t.icon} s={13} style={{ color: active ? '#4f46e5' : '#a1a1aa' }}/>
              {t.label}
              {t.badge === 'ok' && <Ic n="checkCircle" s={12} style={{ color: '#15803d' }}/>}
              {t.badge === 'warn' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ca8a04' }}/>}
              {t.badge === 'count' && (
                <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', background: '#f1f1f3', borderRadius: 10, padding: '1px 6px', color: '#52525b' }}>
                  {seguimientos.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'general' && <GeneralTab etapa={etapa} onSaved={load}/>}
      {tab === 'planeacion' && <PlaneacionTab etapaId={etapa.id} requiereJefe={requiereJefe} planeacion={planeacion} onChanged={load}/>}
      {tab === 'seguimientos' && (
        <SeguimientosTab etapaId={etapa.id} requiereJefe={requiereJefe} planeacion={planeacion} seguimientos={seguimientos} onChanged={load}/>
      )}
      {tab === 'evaluacion' && (
        <EvaluacionTab etapaId={etapa.id} requiereJefe={requiereJefe} planeacion={planeacion} evaluacion={evaluacion} onChanged={load}/>
      )}
    </div>
  )
}

// ─── Tab: Información general ───────────────────────────────────────────────────

const ESTADOS_MANUALES: EstadoEtapaProductiva[] = ['EN_EJECUCION', 'SUSPENDIDA', 'APLAZADA', 'CANCELADA']

function GeneralTab({ etapa, onSaved }: { etapa: EtapaConSeguimientos; onSaved: () => void }) {
  "use no memo"
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [fechaInicio, setFechaInicio] = useState(etapa.fecha_inicio?.slice(0, 10) ?? '')
  const [fechaFin, setFechaFin] = useState(etapa.fecha_fin_estimada?.slice(0, 10) ?? '')
  const [empresaNombre, setEmpresaNombre] = useState(etapa.empresa_nombre ?? '')
  const [empresaNit, setEmpresaNit] = useState(etapa.empresa_nit ?? '')
  const [empresaDireccion, setEmpresaDireccion] = useState(etapa.empresa_direccion ?? '')
  const [empresaLat, setEmpresaLat] = useState(etapa.empresa_lat != null ? String(etapa.empresa_lat) : '')
  const [empresaLng, setEmpresaLng] = useState(etapa.empresa_lng != null ? String(etapa.empresa_lng) : '')
  const [jefeNombre, setJefeNombre] = useState(etapa.jefe_inmediato_nombre ?? '')
  const [jefeCargo, setJefeCargo] = useState(etapa.jefe_inmediato_cargo ?? '')
  const [jefeTelefono, setJefeTelefono] = useState(etapa.jefe_inmediato_telefono ?? '')
  const [jefeEmail, setJefeEmail] = useState(etapa.jefe_inmediato_email ?? '')
  const [estado, setEstado] = useState<EstadoEtapaProductiva>(etapa.estado)
  const [resultado, setResultado] = useState<ResultadoFinal | ''>(etapa.resultado_final ?? '')

  const tieneEmpresa = MODALIDAD_TIENE_EMPRESA[etapa.modalidad]

  function usarUbicacionActual() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(pos => {
      setEmpresaLat(String(pos.coords.latitude))
      setEmpresaLng(String(pos.coords.longitude))
    })
  }

  async function guardar() {
    setBusy(true); setErr(null)
    try {
      await api.patch(`/etapas-productivas/${etapa.id}`, {
        fecha_inicio: fechaInicio || undefined,
        fecha_fin_estimada: fechaFin || undefined,
        empresa_nombre: tieneEmpresa ? (empresaNombre || undefined) : undefined,
        empresa_nit: tieneEmpresa ? (empresaNit || undefined) : undefined,
        empresa_direccion: tieneEmpresa ? (empresaDireccion || undefined) : undefined,
        empresa_lat: tieneEmpresa && empresaLat ? Number(empresaLat) : undefined,
        empresa_lng: tieneEmpresa && empresaLng ? Number(empresaLng) : undefined,
        jefe_inmediato_nombre: tieneEmpresa ? (jefeNombre || undefined) : undefined,
        jefe_inmediato_cargo: tieneEmpresa ? (jefeCargo || undefined) : undefined,
        jefe_inmediato_telefono: tieneEmpresa ? (jefeTelefono || undefined) : undefined,
        jefe_inmediato_email: tieneEmpresa ? (jefeEmail || undefined) : undefined,
        estado,
        resultado_final: resultado || undefined,
      })
      setEditing(false); onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar.')
    } finally { setBusy(false) }
  }

  if (!editing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Card style={{ padding: 16 }}>
          <MetaRow label="Aprendiz" value={etapa.aprendiz_nombre}/>
          <MetaRow label="Instructor de seguimiento" value={etapa.instructor_nombre}/>
          <MetaRow label="Alternativa / modalidad" value={MODALIDAD_LABEL[etapa.modalidad]}/>
          <MetaRow label="Fecha inicio" value={fd(etapa.fecha_inicio)}/>
          <MetaRow label="Fecha fin estimada" value={fd(etapa.fecha_fin_estimada)}/>
          <MetaRow label="Estado del proceso" value={<Bdg tone="neutral">{etapa.estado}</Bdg>}/>
        </Card>
        {tieneEmpresa && (
          <Card style={{ padding: 16 }}>
            <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Ente co-formador</div>
            <MetaRow label="Empresa" value={etapa.empresa_nombre || '—'}/>
            <MetaRow label="NIT" value={etapa.empresa_nit || '—'}/>
            <MetaRow label="Dirección" value={etapa.empresa_direccion || '—'}/>
            <MetaRow label="Jefe inmediato" value={etapa.jefe_inmediato_nombre || '—'}/>
            <MetaRow label="Cargo" value={etapa.jefe_inmediato_cargo || '—'}/>
            <MetaRow label="Contacto" value={etapa.jefe_inmediato_telefono || etapa.jefe_inmediato_email || '—'}/>
          </Card>
        )}
        <div><Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar información</Btn></div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ padding: 20 }}>
        <SectionIntro title="Datos de la formación"/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Fecha inicio"><input type="date" className="nx-input" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)}/></Field>
          <Field label="Fecha fin estimada"><input type="date" className="nx-input" value={fechaFin} onChange={e => setFechaFin(e.target.value)}/></Field>
        </div>
      </Card>

      {tieneEmpresa && (
        <Card style={{ padding: 20 }}>
          <SectionIntro title="Ente co-formador"/>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field label="Nombre empresa"><input className="nx-input" value={empresaNombre} onChange={e => setEmpresaNombre(e.target.value)}/></Field>
            <Field label="NIT"><input className="nx-input" value={empresaNit} onChange={e => setEmpresaNit(e.target.value)}/></Field>
            <Field label="Dirección" style={{ gridColumn: '1 / -1' }}><input className="nx-input" value={empresaDireccion} onChange={e => setEmpresaDireccion(e.target.value)}/></Field>
            <Field label="Latitud" hint="Referencia para validar cercanía en los seguimientos"><input className="nx-input" value={empresaLat} onChange={e => setEmpresaLat(e.target.value)}/></Field>
            <Field label="Longitud"><input className="nx-input" value={empresaLng} onChange={e => setEmpresaLng(e.target.value)}/></Field>
          </div>
          <button onClick={usarUbicacionActual} style={{ fontSize: 11.5, color: '#4f46e5', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginTop: 8 }}>
            Usar mi ubicación actual
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
            <Field label="Nombre del jefe inmediato"><input className="nx-input" value={jefeNombre} onChange={e => setJefeNombre(e.target.value)}/></Field>
            <Field label="Cargo"><input className="nx-input" value={jefeCargo} onChange={e => setJefeCargo(e.target.value)}/></Field>
            <Field label="Contacto telefónico"><input className="nx-input" value={jefeTelefono} onChange={e => setJefeTelefono(e.target.value)}/></Field>
            <Field label="Correo electrónico"><input className="nx-input" value={jefeEmail} onChange={e => setJefeEmail(e.target.value)}/></Field>
          </div>
        </Card>
      )}

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Estado del proceso" sub="Normalmente cambia solo al registrar la Evaluación final. Ajusta manualmente solo para suspensiones, aplazamientos o correcciones."/>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Estado">
            <select className="nx-input" value={estado} onChange={e => setEstado(e.target.value as EstadoEtapaProductiva)}>
              <option value={etapa.estado}>{etapa.estado} (actual)</option>
              {ESTADOS_MANUALES.filter(s => s !== etapa.estado).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Resultado final" hint="Solo si necesitas corregirlo">
            <select className="nx-input" value={resultado} onChange={e => setResultado(e.target.value as ResultadoFinal | '')}>
              <option value="">Sin definir</option>
              <option value="APROBADO">Aprobado</option>
              <option value="NO_APROBADO">No aprobado</option>
            </select>
          </Field>
        </div>
      </Card>

      {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={() => setEditing(false)} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar'}</Btn>
      </div>
    </div>
  )
}

// ─── Tab: Planeación (única vez) ────────────────────────────────────────────────

function PlaneacionTab({ etapaId, requiereJefe, planeacion, onChanged }: {
  etapaId: number; requiereJefe: boolean; planeacion: SeguimientoProductivo | null; onChanged: () => void
}) {
  "use no memo"
  const [editing, setEditing] = useState(!planeacion)

  if (!editing && planeacion) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InlineAlert tone="ok" icon="checkCircle" title="Planeación registrada">
          El plan de trabajo de la etapa productiva quedó concertado.
        </InlineAlert>
        <Card style={{ padding: 16 }}>
          <MetaRow label="Fecha de diligenciamiento" value={fd(planeacion.fecha_realizada)}/>
          <MetaRow label="Fecha afiliación ARL" value={fd(planeacion.fecha_afiliacion_arl)}/>
          <MetaRow label="N.º póliza ARL" value={planeacion.numero_poliza_arl || '—'}/>
          <MetaRow label="Horario" value={planeacion.horario || '—'}/>
          <MetaRow label="Modalidad" value={planeacion.tipo_seguimiento}/>
        </Card>
        <Card style={{ padding: 16 }}>
          {([
            ['Competencias a desarrollar', lineasATexto(planeacion.plan_trabajo?.competencias)],
            ['Resultados de aprendizaje', lineasATexto(planeacion.plan_trabajo?.resultados_aprendizaje)],
            ['Actividades a desarrollar', lineasATexto(planeacion.plan_trabajo?.actividades)],
            ['Evidencias de aprendizaje', lineasATexto(planeacion.plan_trabajo?.evidencias)],
            ['Observaciones adicionales', planeacion.observaciones_instructor ?? ''],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: value ? '#18181b' : '#a1a1aa', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{value || 'Sin diligenciar'}</div>
            </div>
          ))}
        </Card>
        <FirmasYUbicacion seguimiento={planeacion} requiereJefe={requiereJefe} onChanged={onChanged}/>
        <div><Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar planeación</Btn></div>
      </div>
    )
  }

  return <PlaneacionForm etapaId={etapaId} requiereJefe={requiereJefe} planeacion={planeacion} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged() }}/>
}

function PlaneacionForm({ etapaId, requiereJefe, planeacion, onCancel, onSaved }: {
  etapaId: number; requiereJefe: boolean; planeacion: SeguimientoProductivo | null; onCancel: () => void; onSaved: () => void
}) {
  "use no memo"
  const [modalidad, setModalidad] = useState<TipoSeguimiento>(planeacion?.tipo_seguimiento ?? 'PRESENCIAL')
  const [fechaArl, setFechaArl] = useState(planeacion?.fecha_afiliacion_arl?.slice(0, 10) ?? '')
  const [polizaArl, setPolizaArl] = useState(planeacion?.numero_poliza_arl ?? '')
  const [horario, setHorario] = useState(planeacion?.horario ?? '')
  const [enlace, setEnlace] = useState(planeacion?.enlace_grabacion ?? '')
  const [competencias, setCompetencias] = useState(lineasATexto(planeacion?.plan_trabajo?.competencias))
  const [resultados, setResultados] = useState(lineasATexto(planeacion?.plan_trabajo?.resultados_aprendizaje))
  const [actividades, setActividades] = useState(lineasATexto(planeacion?.plan_trabajo?.actividades))
  const [evidencias, setEvidencias] = useState(lineasATexto(planeacion?.plan_trabajo?.evidencias))
  const [obs, setObs] = useState(planeacion?.observaciones_instructor ?? '')
  const [firmas, setFirmas] = useState<FirmasEstado>(firmasVacias())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // Al crear (no al editar): sin firmas no hay planeación concertada.
  const puedeGuardar = !!competencias.trim() && (!!planeacion || firmasCompletas(firmas, requiereJefe))

  async function guardar() {
    setBusy(true); setErr(null)
    const planTrabajo = {
      competencias: textoALineas(competencias),
      resultados_aprendizaje: textoALineas(resultados),
      actividades: textoALineas(actividades),
      evidencias: textoALineas(evidencias),
    }
    try {
      if (planeacion) {
        await api.patch(`/seguimientos-productivos/${planeacion.id}`, {
          tipo_seguimiento: modalidad,
          fecha_afiliacion_arl: fechaArl || undefined, numero_poliza_arl: polizaArl || undefined,
          horario: horario || undefined, enlace_grabacion: enlace || undefined,
          plan_trabajo: planTrabajo, observaciones_instructor: obs || undefined,
        })
      } else {
        const res = await api.post<SeguimientoProductivo>('/seguimientos-productivos', {
          etapa_productiva_id: etapaId, tipo_momento: 'PLANEACION',
          tipo_seguimiento: modalidad,
          fecha_afiliacion_arl: fechaArl || undefined, numero_poliza_arl: polizaArl || undefined,
          horario: horario || undefined, enlace_grabacion: enlace || undefined,
          plan_trabajo: planTrabajo, observaciones_instructor: obs || undefined,
        })
        await subirFirmas(res.data.id, firmas, requiereJefe)
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar la planeación.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionIntro title="Planeación de la etapa productiva" sub="Se realiza por una única vez, al inicio de la etapa productiva. La fecha de diligenciamiento queda fijada automáticamente al guardar."/>

      <Card style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Fecha de afiliación a la ARL"><input type="date" className="nx-input" value={fechaArl} onChange={e => setFechaArl(e.target.value)}/></Field>
          <Field label="N.º póliza ARL" hint="Si aplica"><input className="nx-input" value={polizaArl} onChange={e => setPolizaArl(e.target.value)}/></Field>
          <Field label="Horario" hint="Diurno/nocturno, días y hora"><input className="nx-input" value={horario} onChange={e => setHorario(e.target.value)}/></Field>
        </div>
        <Field label="Modalidad" style={{ marginTop: 14 }}>
          <Seg name="modPlaneacion" value={modalidad} onChange={v => setModalidad(v as TipoSeguimiento)} options={MODALIDAD_SEG_OPTS}/>
        </Field>
        <Field label="Enlace de grabación" hint="Si se realiza de forma virtual" style={{ marginTop: 14 }}>
          <input className="nx-input" placeholder="https://…" value={enlace} onChange={e => setEnlace(e.target.value)}/>
        </Field>
      </Card>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Concertación del plan de trabajo" sub="Una idea por línea."/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Competencias a desarrollar" required hint="Competencias del programa relacionadas">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={competencias} onChange={e => setCompetencias(e.target.value)}/>
          </Field>
          <Field label="Resultados de aprendizaje">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={resultados} onChange={e => setResultados(e.target.value)}/>
          </Field>
          <Field label="Actividades a desarrollar" hint="Durante los meses de etapa productiva">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={actividades} onChange={e => setActividades(e.target.value)}/>
          </Field>
          <Field label="Evidencias de aprendizaje" hint="Que generará el aprendiz de acuerdo con cada actividad">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={evidencias} onChange={e => setEvidencias(e.target.value)}/>
          </Field>
          <Field label="Observaciones adicionales" hint="Opcional">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={obs} onChange={e => setObs(e.target.value)}/>
          </Field>
        </div>
      </Card>

      {!planeacion && (
        <FirmasCaptura requiereJefe={requiereJefe} value={firmas} onChange={setFirmas}/>
      )}

      {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar || busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar planeación'}</Btn>
      </div>
    </div>
  )
}

// ─── Tab: Seguimientos (se repite; incluye extraordinarios) ────────────────────

function SeguimientosTab({ etapaId, requiereJefe, planeacion, seguimientos, onChanged }: {
  etapaId: number; requiereJefe: boolean; planeacion: SeguimientoProductivo | null
  seguimientos: SeguimientoProductivo[]; onChanged: () => void
}) {
  "use no memo"
  const [creando, setCreando] = useState(false)
  const [abiertoId, setAbiertoId] = useState<number | null>(null)

  if (!planeacion) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="lock" text="Completa primero la Planeación para poder registrar seguimientos."/></Card>
  }

  const items = [...seguimientos].sort((a, b) => b.numero_seguimiento - a.numero_seguimiento)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <SectionIntro title="Seguimientos a la etapa productiva" sub="Un registro por cada visita o contacto durante la ejecución; marca 'extraordinario' si ocurre por fuera del seguimiento regular."/>
        {!creando && <Btn variant="accent" icon="plus" onClick={() => setCreando(true)}>Nuevo seguimiento</Btn>}
      </div>

      {creando && (
        <SeguimientoForm etapaId={etapaId} requiereJefe={requiereJefe} onCancel={() => setCreando(false)} onSaved={() => { setCreando(false); onChanged() }}/>
      )}

      {items.length === 0 && !creando ? (
        <Card style={{ padding: 24 }}><EmptyHint icon="list" text="Aún no hay seguimientos registrados. Agrega el primero cuando realices la visita."/></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(s => (
            <SeguimientoItem key={s.id} s={s} requiereJefe={requiereJefe} open={abiertoId === s.id}
              onToggle={() => setAbiertoId(o => o === s.id ? null : s.id)} onChanged={onChanged}/>
          ))}
        </div>
      )}
    </div>
  )
}

function SeguimientoItem({ s, requiereJefe, open, onToggle, onChanged }: {
  s: SeguimientoProductivo; requiereJefe: boolean; open: boolean; onToggle: () => void; onChanged: () => void
}) {
  const tecnicos = factoresDesde(FACTORES_TECNICOS, s.valoracion_json?.tecnicos)
  const actitudinales = factoresDesde(FACTORES_ACTITUDINALES, s.valoracion_json?.actitudinales)
  const total = tecnicos.length + actitudinales.length
  const satisfactorios = [...tecnicos, ...actitudinales].filter(f => f.valor === 'SATISFACTORIO').length
  const extraordinario = !!s.motivo_extraordinario

  return (
    <Card style={{ overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, fontFamily: '"JetBrains Mono", monospace', flexShrink: 0,
          background: extraordinario ? '#ffedd5' : '#eef2ff', color: extraordinario ? '#c2410c' : '#4f46e5',
        }}>#{s.numero_seguimiento}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#18181b', fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha_realizada)}</span>
            <Bdg tone="neutral">{s.tipo_seguimiento}</Bdg>
            {extraordinario && <Bdg tone="warn">Extraordinario</Bdg>}
            <span style={{ fontSize: 11.5, color: '#71717a' }}>{satisfactorios}/{total} satisfactorio</span>
          </div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: '#a1a1aa', flexShrink: 0 }}/>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid #f1f1f3', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {extraordinario && (
            <div>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 4 }}>Motivo del seguimiento extraordinario</div>
              <div style={{ fontSize: 12.5, color: '#18181b' }}>{s.motivo_extraordinario}</div>
            </div>
          )}
          {s.enlace_grabacion && (
            <a href={s.enlace_grabacion} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Ic n="external" s={12}/>Grabación del momento
            </a>
          )}
          <FactoresBlock titulo="Factores técnicos" items={tecnicos} readOnly/>
          <FactoresBlock titulo="Factores actitudinales y comportamentales" items={actitudinales} readOnly/>
          {([
            ['Observaciones del instructor', s.observaciones_instructor],
            ['Observaciones del aprendiz', s.observaciones_aprendiz],
            ['Observaciones del ente co-formador', s.observaciones_coformador],
          ] as [string, string | null][]).map(([label, value]) => value && (
            <div key={label}>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: '#18181b', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
          <FirmasYUbicacion seguimiento={s} requiereJefe={requiereJefe} onChanged={onChanged}/>
        </div>
      )}
    </Card>
  )
}

function SeguimientoForm({ etapaId, requiereJefe, onCancel, onSaved }: {
  etapaId: number; requiereJefe: boolean; onCancel: () => void; onSaved: () => void
}) {
  "use no memo"
  const [modalidad, setModalidad] = useState<TipoSeguimiento>('PRESENCIAL')
  const [enlace, setEnlace] = useState('')
  const [esExtraordinario, setEsExtraordinario] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [tecnicos, setTecnicos] = useState<FactorItem[]>(factoresDesde(FACTORES_TECNICOS, undefined))
  const [actitudinales, setActitudinales] = useState<FactorItem[]>(factoresDesde(FACTORES_ACTITUDINALES, undefined))
  const [obsInstructor, setObsInstructor] = useState('')
  const [obsAprendiz, setObsAprendiz] = useState('')
  const [obsEnte, setObsEnte] = useState('')
  const [firmas, setFirmas] = useState<FirmasEstado>(firmasVacias())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const puedeGuardar = (!esExtraordinario || !!motivo.trim()) && firmasCompletas(firmas, requiereJefe)

  async function guardar() {
    setBusy(true); setErr(null)
    try {
      const res = await api.post<SeguimientoProductivo>('/seguimientos-productivos', {
        etapa_productiva_id: etapaId, tipo_momento: 'SEGUIMIENTO',
        tipo_seguimiento: modalidad, enlace_grabacion: enlace || undefined,
        motivo_extraordinario: esExtraordinario ? motivo.trim() : undefined,
        valoracion: { tecnicos: factoresAJson(tecnicos), actitudinales: factoresAJson(actitudinales) },
        observaciones_instructor: obsInstructor || undefined,
        observaciones_aprendiz: obsAprendiz || undefined,
        observaciones_coformador: obsEnte || undefined,
      })
      await subirFirmas(res.data.id, firmas, requiereJefe)
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar el seguimiento.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card style={{ padding: 20, border: esExtraordinario ? '1px solid #fed7aa' : '1px solid #c7d2fe' }}>
        <SectionIntro title="Nuevo seguimiento" sub="La fecha queda fijada automáticamente al guardar."/>
        <Field label="Enlace de grabación" hint="Si se hace de forma virtual" style={{ marginBottom: 14 }}>
          <input className="nx-input" placeholder="https://…" value={enlace} onChange={e => setEnlace(e.target.value)}/>
        </Field>
        <Field label="Modalidad del seguimiento" style={{ marginBottom: 14 }}>
          <Seg name="modSeg" value={modalidad} onChange={v => setModalidad(v as TipoSeguimiento)} options={MODALIDAD_SEG_OPTS}/>
        </Field>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: '#3f3f46', cursor: 'pointer', marginBottom: esExtraordinario ? 10 : 16 }}>
          <input type="checkbox" className="nx-check" checked={esExtraordinario} onChange={e => setEsExtraordinario(e.target.checked)}/>
          Es un seguimiento extraordinario (fuera del momento 2 regular)
        </label>
        {esExtraordinario && (
          <Field label="Motivo del seguimiento extraordinario" required style={{ marginBottom: 16 }}>
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={motivo} onChange={e => setMotivo(e.target.value)}/>
          </Field>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          <FactoresBlock titulo="Factores técnicos" items={tecnicos} onChange={setTecnicos}/>
          <FactoresBlock titulo="Factores actitudinales y comportamentales" items={actitudinales} onChange={setActitudinales}/>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Observaciones complementarias del instructor de seguimiento">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={obsInstructor} onChange={e => setObsInstructor(e.target.value)}/>
          </Field>
          <Field label="Observaciones del aprendiz">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={obsAprendiz} onChange={e => setObsAprendiz(e.target.value)}/>
          </Field>
          <Field label="Observaciones del responsable del ente co-formador">
            <textarea className="nx-input" rows={2} style={{ resize: 'vertical' }} value={obsEnte} onChange={e => setObsEnte(e.target.value)}/>
          </Field>
        </div>
      </Card>

      <FirmasCaptura requiereJefe={requiereJefe} value={firmas} onChange={setFirmas}/>

      {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar || busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar seguimiento'}</Btn>
      </div>
    </div>
  )
}

// ─── Tab: Evaluación final (única vez) ──────────────────────────────────────────

function EvaluacionTab({ etapaId, requiereJefe, planeacion, evaluacion, onChanged }: {
  etapaId: number; requiereJefe: boolean; planeacion: SeguimientoProductivo | null
  evaluacion: SeguimientoProductivo | null; onChanged: () => void
}) {
  "use no memo"
  const [editing, setEditing] = useState(!evaluacion)

  if (!planeacion) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="lock" text="Completa primero la Planeación para habilitar la evaluación final."/></Card>
  }

  if (!editing && evaluacion) {
    const tecnicos = factoresDesde(FACTORES_TECNICOS, evaluacion.valoracion_json?.tecnicos)
    const actitudinales = factoresDesde(FACTORES_ACTITUDINALES, evaluacion.valoracion_json?.actitudinales)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <InlineAlert tone="ok" icon="checkCircle" title="Evaluación registrada">
          La etapa productiva quedó evaluada. El estado final del proceso se actualizó automáticamente.
        </InlineAlert>
        <Card style={{ padding: 16 }}>
          <MetaRow label="Fecha de la evaluación" value={fd(evaluacion.fecha_realizada)}/>
          <MetaRow label="Modalidad" value={evaluacion.tipo_seguimiento}/>
        </Card>
        <FactoresBlock titulo="Factores técnicos" items={tecnicos} readOnly/>
        <FactoresBlock titulo="Factores actitudinales y comportamentales" items={actitudinales} readOnly/>
        <Card style={{ padding: 16 }}>
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#52525b', fontWeight: 600, marginBottom: 10 }}>Retroalimentación</div>
          {([
            ['Ente co-formador', evaluacion.retro_coformador],
            ['Instructor de seguimiento', evaluacion.retro_instructor],
            ['Aprendiz', evaluacion.retro_aprendiz],
          ] as [string, string | null][]).map(([label, value]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: '#52525b', fontWeight: 600, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: value ? '#18181b' : '#a1a1aa', lineHeight: 1.5 }}>{value || 'Sin diligenciar'}</div>
            </div>
          ))}
        </Card>
        <FirmasYUbicacion seguimiento={evaluacion} requiereJefe={requiereJefe} onChanged={onChanged}/>
        <div><Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar evaluación</Btn></div>
      </div>
    )
  }

  return <EvaluacionForm etapaId={etapaId} requiereJefe={requiereJefe} evaluacion={evaluacion} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged() }}/>
}

function EvaluacionForm({ etapaId, requiereJefe, evaluacion, onCancel, onSaved }: {
  etapaId: number; requiereJefe: boolean; evaluacion: SeguimientoProductivo | null; onCancel: () => void; onSaved: () => void
}) {
  "use no memo"
  const [modalidad, setModalidad] = useState<TipoSeguimiento>(evaluacion?.tipo_seguimiento ?? 'PRESENCIAL')
  const [enlace, setEnlace] = useState(evaluacion?.enlace_grabacion ?? '')
  const [tecnicos, setTecnicos] = useState<FactorItem[]>(factoresDesde(FACTORES_TECNICOS, evaluacion?.valoracion_json?.tecnicos))
  const [actitudinales, setActitudinales] = useState<FactorItem[]>(factoresDesde(FACTORES_ACTITUDINALES, evaluacion?.valoracion_json?.actitudinales))
  const [retroCoformador, setRetroCoformador] = useState(evaluacion?.retro_coformador ?? '')
  const [retroInstructor, setRetroInstructor] = useState(evaluacion?.retro_instructor ?? '')
  const [retroAprendiz, setRetroAprendiz] = useState(evaluacion?.retro_aprendiz ?? '')
  const [juicio, setJuicio] = useState<ResultadoFinal | null>(null)
  const [firmas, setFirmas] = useState<FirmasEstado>(firmasVacias())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const puedeGuardar = !!evaluacion || (!!juicio && firmasCompletas(firmas, requiereJefe))

  async function guardar() {
    setBusy(true); setErr(null)
    const valoracion = { tecnicos: factoresAJson(tecnicos), actitudinales: factoresAJson(actitudinales) }
    try {
      if (evaluacion) {
        await api.patch(`/seguimientos-productivos/${evaluacion.id}`, {
          tipo_seguimiento: modalidad, enlace_grabacion: enlace || undefined,
          valoracion, retro_coformador: retroCoformador || undefined,
          retro_instructor: retroInstructor || undefined, retro_aprendiz: retroAprendiz || undefined,
        })
      } else {
        const res = await api.post<SeguimientoProductivo>('/seguimientos-productivos', {
          etapa_productiva_id: etapaId, tipo_momento: 'EVALUACION',
          tipo_seguimiento: modalidad, enlace_grabacion: enlace || undefined,
          valoracion, retro_coformador: retroCoformador || undefined,
          retro_instructor: retroInstructor || undefined, retro_aprendiz: retroAprendiz || undefined,
          resultado_final: juicio,
        })
        await subirFirmas(res.data.id, firmas, requiereJefe)
      }
      onSaved()
    } catch (e: any) {
      setErr(e?.response?.data?.message ?? 'No se pudo guardar la evaluación.')
    } finally { setBusy(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionIntro title="Evaluación de la etapa productiva" sub="Se diligencia una única vez, al finalizar la etapa productiva. La fecha queda fijada automáticamente al guardar."/>

      <Card style={{ padding: 20 }}>
        <Field label="Enlace de grabación" hint="Si se hace de forma virtual">
          <input className="nx-input" placeholder="https://…" value={enlace} onChange={e => setEnlace(e.target.value)}/>
        </Field>
        <Field label="La evaluación se realizó de forma" style={{ marginTop: 14 }}>
          <Seg name="modEval" value={modalidad} onChange={v => setModalidad(v as TipoSeguimiento)} options={MODALIDAD_SEG_OPTS}/>
        </Field>
      </Card>

      <FactoresBlock titulo="Factores técnicos" items={tecnicos} onChange={setTecnicos}/>
      <FactoresBlock titulo="Factores actitudinales y comportamentales" items={actitudinales} onChange={setActitudinales}/>

      <Card style={{ padding: 20 }}>
        <SectionIntro title="Retroalimentación" sub="Una voz por cada parte, o reconocimientos especiales."/>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Ente co-formador"><textarea className="nx-input" rows={3} style={{ resize: 'vertical' }} value={retroCoformador} onChange={e => setRetroCoformador(e.target.value)}/></Field>
          <Field label="Instructor de seguimiento"><textarea className="nx-input" rows={3} style={{ resize: 'vertical' }} value={retroInstructor} onChange={e => setRetroInstructor(e.target.value)}/></Field>
          <Field label="Aprendiz"><textarea className="nx-input" rows={3} style={{ resize: 'vertical' }} value={retroAprendiz} onChange={e => setRetroAprendiz(e.target.value)}/></Field>
        </div>
      </Card>

      {!evaluacion && (
        <Card style={{ padding: 20 }}>
          <SectionIntro title="Juicio de evaluación de la etapa productiva" sub="Selecciona uno de los dos para poder guardar la evaluación."/>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setJuicio('APROBADO')} style={{
              flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${juicio === 'APROBADO' ? '#86efac' : '#e4e4e7'}`,
              background: juicio === 'APROBADO' ? '#dcfce7' : '#fff',
              color: juicio === 'APROBADO' ? '#15803d' : '#3f3f46', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}><Ic n="checkCircle" s={15}/>Aprobado</button>
            <button onClick={() => setJuicio('NO_APROBADO')} style={{
              flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${juicio === 'NO_APROBADO' ? '#fecaca' : '#e4e4e7'}`,
              background: juicio === 'NO_APROBADO' ? '#fee2e2' : '#fff',
              color: juicio === 'NO_APROBADO' ? '#b91c1c' : '#3f3f46', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}><Ic n="x" s={15}/>No aprobado</button>
          </div>
        </Card>
      )}
      {evaluacion && (
        <InlineAlert tone="neutral" icon="info">
          El juicio ya quedó registrado. Si necesitas corregirlo, ajusta el "Resultado final" desde la pestaña Información general.
        </InlineAlert>
      )}

      {!evaluacion && (
        <FirmasCaptura requiereJefe={requiereJefe} value={firmas} onChange={setFirmas}/>
      )}

      {err && <div style={{ fontSize: 12, color: '#b91c1c' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={!puedeGuardar || busy} onClick={guardar}>{busy ? 'Guardando…' : 'Guardar evaluación'}</Btn>
      </div>
    </div>
  )
}
