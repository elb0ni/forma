import { useEffect, useState } from 'react'
import { SoloLecturaCtx, useSoloLectura } from './soloLectura'
import { useAuthStore } from '../../store/auth'
import { Ic, Card, Btn, Tag, Bdg } from '../../components/ui'
import type { IcName } from '../../components/ui'
import { fd, Seg, InlineAlert, CenterState, LoadingBlock } from '../shared/parts'
import {
  SectionIntro, FactoresBlock, MetaRow, EmptyHint, EstadoBdg, FirmasYUbicacion,
  FirmasCaptura, firmasVacias, firmasCompletas, subirFirma,
} from './parts'
import type { FirmasEstado, Firmante, FirmaFuente } from './parts'
import { bloqueoDe, firmaFuenteDe } from './momentos'
import type { Bloqueo } from './momentos'
import { ReportePreview } from './ReportePreview'
import { Bloque, Campo, Dato, DatoLargo, Aviso } from './Gfpi023Campos'
import { PlanTrabajoEditor } from './PlanTrabajoEditor'
import { CronogramaTab } from './CronogramaTab'
import { BitacorasTab } from './BitacorasTab'
import type { Cronograma } from './cronograma'
import { PlanTrabajoVista } from './PlanTrabajoVista'
import { planDesdeGuardado, planAGuardar, erroresPlan } from './planTrabajo'
import type { PlanEstado } from './planTrabajo'
import {
  MODALIDAD_LABEL, MODALIDAD_TIENE_EMPRESA, ESTADO_META,
  FACTORES_TECNICOS, FACTORES_ACTITUDINALES, factoresDesde, factoresAJson,
  normalizeSeguimiento, MODALIDAD_FORMACION_LABEL, TIPO_DOC_LABEL,
} from './types'
import type {
  EtapaProductiva, SeguimientoProductivo, EstadoAprendiz, FactorItem,
  TipoSeguimiento, ResultadoFinal, FichaVentana,
} from './types'
import { ProgresoPracticaTarjeta } from '../shared/ProgresoPractica'
import type { AprendizPractica } from '../shared/AprendicesPractica'
import api from '../../lib/api'
import { soloDigitos } from '../../lib/input'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type TabId = 'general' | 'cronograma' | 'planeacion' | 'seguimientos' | 'evaluacion' | 'bitacoras'

// El progreso de la práctica (mismo que el popover de la lista de aprendices)
// necesita al aprendiz con su último corte de juicios; acá se arma con la
// etapa y el estado calculado que ya trae esta vista.
function aprendizDesde(etapa: EtapaProductiva, estado: EstadoAprendiz): AprendizPractica {
  const j = estado.avance_juicios
  return {
    aprendiz_id: etapa.aprendiz_id,
    etapa_id: etapa.id,
    numero_documento: etapa.aprendiz_documento ?? '',
    tipo_documento: etapa.aprendiz_tipo_documento ?? '',
    nombre_completo: etapa.aprendiz_nombre ?? '',
    modalidad: etapa.modalidad,
    etapa_estado: etapa.estado,
    resultado_final: etapa.resultado_final,
    etapa_instructor_nombre: etapa.instructor_nombre ?? null,
    total_ra: j?.total_ra ?? null,
    ra_aprobados: j?.ra_aprobados ?? null,
    ra_no_aprobados: j?.ra_no_aprobados ?? null,
    ra_sin_evaluar: j?.ra_sin_evaluar ?? null,
    fecha_reporte: j?.fecha_reporte ?? null,
    caso: estado.estado,
  }
}
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

// Momento del que se pueden reutilizar las firmas: el más reciente ya firmado
// por completo dentro de la misma etapa -- así el instructor no vuelve a
// dibujar las mismas 3 firmas en cada momento.
// La vista previa es opcional: el trabajo es diligenciar el formato. Se
// recuerda por navegador si el instructor prefiere tenerla abierta.
const PREVIEW_KEY = 'forma.ep.verPreview'

function leerVerPreview(): boolean {
  try { return localStorage.getItem(PREVIEW_KEY) === '1' } catch { return false }
}

function guardarVerPreview(v: boolean) {
  try { localStorage.setItem(PREVIEW_KEY, v ? '1' : '0') } catch { /* sin almacenamiento: solo dura la sesión */ }
}

// ─── Contenedor: carga la etapa + su estado real y enruta entre tabs ───────────

// `soloLectura`: sin acciones de registro/edición. Por defecto se activa para
// el coordinador (ve la etapa, no la diligencia); ver ./soloLectura.ts.
export function EtapaProductivaDetalle({ etapaId, onBack, initialTab = 'general', backLabel = 'Etapa productiva', soloLectura }: {
  etapaId: number; onBack: () => void; initialTab?: TabId; backLabel?: string; soloLectura?: boolean
}) {
  "use no memo"
  const rol = useAuthStore(s => s.user?.rol)
  const lectura = soloLectura ?? rol === 'COORD_ACADEMICO'
  const [etapa, setEtapa] = useState<EtapaConSeguimientos | null>(null)
  const [estadoCalc, setEstadoCalc] = useState<EstadoAprendiz | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<TabId>(initialTab)
  const [verPreview, setVerPreview] = useState(leerVerPreview)

  // Cronograma de visitas + bitácoras: aparte para no bloquear el detalle si
  // falla (p. ej. si la migración de bitácoras aún no se ha corrido).
  const [crono, setCrono] = useState<Cronograma | null>(null)
  const [cronoErr, setCronoErr] = useState<string | null>(null)
  const pedirCrono = (id: number) =>
    api.get<Cronograma>(`/etapas-productivas/${id}/cronograma`)
      .then(r => { setCrono(r.data); setCronoErr(null) })
      .catch(e => setCronoErr(e?.response?.data?.message ?? 'No se pudo cargar el cronograma.'))
  const loadCrono = () => { void pedirCrono(etapaId) }

  function load() {
    void pedirCrono(etapaId)
    api.get<EtapaConSeguimientos>(`/etapas-productivas/${etapaId}`)
      .then(r => {
        setEtapa({ ...r.data, seguimientos: (r.data.seguimientos ?? []).map(normalizeSeguimiento) })
        return api.get<EstadoAprendiz>(`/aprendices/${r.data.aprendiz_id}/estado`)
      })
      .then(r => setEstadoCalc(r.data))
      .catch(e => setError(e?.response?.data?.message ?? 'No se pudo cargar el registro.'))
  }
  useEffect(load, [etapaId])

  const back = (
    <button onClick={onBack} style={{ fontSize: 12.5, color: 'var(--fx-tinta-2)', display: 'flex', gap: 6, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 16, alignItems: 'center', fontFamily: 'inherit' }}>
      <Ic n="arrowLeft" s={14}/>{backLabel}
    </button>
  )

  if (error) return <div style={{ maxWidth: 1100 }}>{back}<Card style={{ padding: 24 }}><CenterState icon="alert" title="Registro no disponible" sub={error}/></Card></div>
  if (!etapa || !estadoCalc) return <div style={{ maxWidth: 1100 }}>{back}<LoadingBlock/></div>

  const planeacion = etapa.seguimientos.find(s => s.tipo_momento === 'PLANEACION') ?? null
  const seguimientos = etapa.seguimientos.filter(s => s.tipo_momento === 'SEGUIMIENTO')
  const evaluacion = etapa.seguimientos.find(s => s.tipo_momento === 'EVALUACION') ?? null
  const requiereJefe = MODALIDAD_TIENE_EMPRESA[etapa.modalidad]
  const firmaFuente = firmaFuenteDe(etapa.seguimientos)

  // El punto va solo en el próximo momento por diligenciar, no en todos los pendientes.
  const seguimientoOficial = seguimientos.some(s => !s.motivo_extraordinario)
  const proximo: TabId | null = !planeacion ? 'planeacion'
    : !seguimientoOficial ? 'seguimientos'
    : !evaluacion ? 'evaluacion'
    : null
  const porRevisar = crono?.resumen_bitacoras.por_revisar ?? 0
  type TabDef = { id: TabId; label: string; icon: IcName; badge?: 'ok' | 'warn' | 'count'; count?: number }
  // Los 4 tabs del formato (GFPI-F-023) van juntos; cronograma y bitácoras son
  // herramientas de control y se muestran aparte, a la derecha.
  const TABS: TabDef[] = [
    { id: 'general', label: 'Información general', icon: 'user' },
    { id: 'planeacion', label: 'Planeación', icon: 'target', badge: planeacion ? 'ok' : proximo === 'planeacion' ? 'warn' : undefined },
    { id: 'seguimientos', label: 'Seguimientos', icon: 'list', badge: proximo === 'seguimientos' ? 'warn' : seguimientos.length ? 'count' : undefined },
    { id: 'evaluacion', label: 'Evaluación', icon: 'checkCircle', badge: evaluacion ? 'ok' : proximo === 'evaluacion' ? 'warn' : undefined },
  ]
  const TABS_CONTROL: TabDef[] = [
    { id: 'cronograma', label: 'Cronograma', icon: 'calendar' },
    { id: 'bitacoras', label: 'Bitácoras', icon: 'fileText', badge: porRevisar ? 'count' : undefined, count: porRevisar },
  ]
  const tabBtn = (t: TabDef) => {
    const active = tab === t.id
    return (
      <button key={t.id} onClick={() => setTab(t.id)} style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '10px 4px', marginBottom: -1,
        background: 'none', border: 'none', borderBottom: `2px solid ${active ? 'var(--fx-morado)' : 'transparent'}`,
        color: active ? 'var(--fx-tinta)' : 'var(--fx-tinta-3)', fontSize: 12.5, fontWeight: active ? 600 : 500,
        cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
      }}>
        <Ic n={t.icon} s={13} style={{ color: active ? 'var(--fx-morado)' : 'var(--fx-tinta-4)' }}/>
        {t.label}
        {t.badge === 'ok' && <Ic n="checkCircle" s={12} style={{ color: 'var(--fx-ok)' }}/>}
        {t.badge === 'warn' && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--fx-aviso)' }}/>}
        {t.badge === 'count' && (
          <span style={{ fontSize: 10, fontFamily: '"JetBrains Mono", monospace', background: 'var(--fx-superficie-2)', borderRadius: 10, padding: '1px 6px', color: 'var(--fx-tinta-2)' }}>
            {t.count ?? seguimientos.length}
          </span>
        )}
      </button>
    )
  }

  return (
    <SoloLecturaCtx.Provider value={lectura}>
    <div style={{ maxWidth: 1400, margin: '0 auto' }}>
      {back}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--fx-tinta)' }}>{etapa.aprendiz_nombre}</h2>
          <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: 'var(--fx-tinta-2)' }}>
            <Tag>{MODALIDAD_LABEL[etapa.modalidad]}</Tag>
            {etapa.empresa_nombre && <span>{etapa.empresa_nombre}</span>}
            <span style={{ color: 'var(--fx-linea-2)' }}>·</span>
            <span style={{ fontFamily: '"JetBrains Mono", monospace' }}>{etapa.aprendiz_documento}</span>
            <span style={{ color: 'var(--fx-linea-2)' }}>·</span>
            <EstadoBdg estado={estadoCalc.estado}/>
          </div>
        </div>
        <Btn
          variant="secondary"
          size="sm"
          icon="eye"
          onClick={() => { const v = !verPreview; setVerPreview(v); guardarVerPreview(v) }}
        >
          {verPreview ? 'Ocultar vista previa' : 'Ver vista previa del formato'}
        </Btn>
      </div>

      <ProgresoPracticaTarjeta
        a={aprendizDesde(etapa, estadoCalc)}
        etapa={etapa}
        badge={ESTADO_META[estadoCalc.estado]}
        modalidad={MODALIDAD_LABEL[etapa.modalidad]}
      />

      {estadoCalc.caso === 2 && (
        <InlineAlert tone="warn" icon="clock" style={{ marginBottom: 20 }}>
          La evaluación ya quedó registrada en FORMA, pero el último reporte de SofiaPlus todavía no refleja el juicio de "etapa productiva" como evaluado. Se actualizará solo cuando se cargue el próximo corte semanal.
        </InlineAlert>
      )}

      <div className={`ep-layout${verPreview ? '' : ' ep-layout--solo'}`}>
        {/* Izquierda: los 4 tabs donde el instructor va diligenciando */}
        <div className="ep-layout__editor">
          <div className="ep-tabs" style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--fx-linea)', marginBottom: 24, overflowX: 'auto' }}>
            {TABS.map(tabBtn)}
            <span style={{ flex: 1, minWidth: 16 }}/>
            <span style={{ alignSelf: 'center', width: 1, height: 18, background: 'var(--fx-linea)', margin: '0 6px' }}/>
            {TABS_CONTROL.map(tabBtn)}
          </div>

          {tab === 'general' && <GeneralTab etapa={etapa} onSaved={load}/>}
          {(tab === 'cronograma' || tab === 'bitacoras') && !crono && (
            cronoErr
              ? <InlineAlert tone="warn" icon="alert">{cronoErr}</InlineAlert>
              : <LoadingBlock/>
          )}
          {tab === 'cronograma' && crono && (
            <CronogramaTab etapaId={etapa.id} crono={crono} onChanged={setCrono} onIrA={setTab}/>
          )}
          {tab === 'bitacoras' && crono && (
            <BitacorasTab etapaId={etapa.id} crono={crono} aprendizNombre={etapa.aprendiz_nombre ?? ''} onChanged={loadCrono}/>
          )}
          {tab === 'planeacion' && <PlaneacionTab etapa={etapa} etapaId={etapa.id} requiereJefe={requiereJefe} planeacion={planeacion} firmaFuente={firmaFuente} onChanged={load}/>}
          {tab === 'seguimientos' && (
            <SeguimientosTab etapa={etapa} etapaId={etapa.id} requiereJefe={requiereJefe} planeacion={planeacion} seguimientos={seguimientos} firmaFuente={firmaFuente} bloqueo={bloqueoDe(crono, 'SEGUIMIENTO')} onChanged={load}/>
          )}
          {tab === 'evaluacion' && (
            <EvaluacionTab etapa={etapa} etapaId={etapa.id} visitas={seguimientos.length} requiereJefe={requiereJefe} planeacion={planeacion} evaluacion={evaluacion} firmaFuente={firmaFuente} bloqueo={bloqueoDe(crono, 'EVALUACION')} onChanged={load}/>
          )}
        </div>

        {/* Derecha, opcional: vista previa del reporte, se arma con lo registrado */}
        {verPreview && (
          <div className="ep-layout__preview">
            <ReportePreview etapa={etapa}/>
          </div>
        )}
      </div>
    </div>
    </SoloLecturaCtx.Provider>
  )
}

// ─── Tab: Información general ───────────────────────────────────────────────────

export function GeneralTab({ etapa, onSaved }: { etapa: EtapaConSeguimientos; onSaved: () => void }) {
  "use no memo"
  const soloLectura = useSoloLectura()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const [fechaInicio, setFechaInicio] = useState(etapa.fecha_inicio?.slice(0, 10) ?? '')
  const [fechaFin, setFechaFin] = useState(etapa.fecha_fin_estimada?.slice(0, 10) ?? '')
  const [empresaNombre, setEmpresaNombre] = useState(etapa.empresa_nombre ?? '')
  const [empresaNit, setEmpresaNit] = useState(etapa.empresa_nit ?? '')
  const [empresaDireccion, setEmpresaDireccion] = useState(etapa.empresa_direccion ?? '')
  const [empresaEmail, setEmpresaEmail] = useState(etapa.empresa_email ?? '')
  const [jefeNombre, setJefeNombre] = useState(etapa.jefe_inmediato_nombre ?? '')
  const [jefeCargo, setJefeCargo] = useState(etapa.jefe_inmediato_cargo ?? '')
  const [jefeTelefono, setJefeTelefono] = useState(etapa.jefe_inmediato_telefono ?? '')
  const [jefeEmail, setJefeEmail] = useState(etapa.jefe_inmediato_email ?? '')
  const [otroNombre, setOtroNombre] = useState(etapa.otro_contacto_nombre ?? '')
  const [otroTelefono, setOtroTelefono] = useState(etapa.otro_contacto_telefono ?? '')
  const [asisteNombre, setAsisteNombre] = useState(etapa.asiste_nombre ?? '')
  const [asisteTipo, setAsisteTipo] = useState(etapa.asiste_tipo ?? '')
  const [asisteTelefono, setAsisteTelefono] = useState(etapa.asiste_telefono ?? '')
  const [aprEmail, setAprEmail] = useState(etapa.aprendiz_email ?? '')
  const [aprEmailInst, setAprEmailInst] = useState(etapa.aprendiz_email_institucional ?? '')
  const [aprTelefono, setAprTelefono] = useState(etapa.aprendiz_telefono ?? '')
  const [aprDireccion, setAprDireccion] = useState(etapa.aprendiz_direccion ?? '')

  const [ficha, setFicha] = useState<FichaVentana | null>(null)
  useEffect(() => {
    if (!etapa.ficha_id) return
    let vivo = true
    api.get<{ ficha: FichaVentana }>(`/fichas/${etapa.ficha_id}/detalle`)
      .then(r => { if (vivo) setFicha(r.data.ficha) })
      .catch(() => {})
    return () => { vivo = false }
  }, [etapa.ficha_id])

  const tieneEmpresa = MODALIDAD_TIENE_EMPRESA[etapa.modalidad]
  // El formato exige el teléfono del instructor de seguimiento: sin él no se guarda.
  const sinTelefonoInstructor = !etapa.instructor_telefono?.trim()

  // La sección de discapacidad solo aparece si se registró algo; en edición
  // queda plegada ("si aplica") como en el formulario de creación.
  const hayApoyo = !!(etapa.asiste_nombre || etapa.asiste_tipo || etapa.asiste_telefono)
  const [apoyoAbierto, setApoyoAbierto] = useState(hayApoyo)

  // Los mismos bloques se pintan en lectura y en edición: en lectura cada
  // campo es un `Dato` y en edición un input. Así el instructor no tiene que
  // reubicarse al entrar a editar -- es el mismo documento, no otra pantalla.
  const campo = (valor: string, set: (v: string) => void, extra?: { tipo?: string; placeholder?: string; soloNum?: boolean }) =>
    editing
      ? <input
          type={extra?.tipo ?? 'text'}
          inputMode={extra?.soloNum ? 'numeric' : undefined}
          className="nx-input"
          value={valor}
          onChange={e => set(extra?.soloNum ? soloDigitos(e.target.value) : e.target.value)}
          placeholder={extra?.placeholder}
        />
      : <Dato valor={extra?.tipo === 'date' ? (valor ? fd(valor) : null) : (valor || null)} mono={extra?.soloNum}/>

  // Datos del aprendiz: dirección y teléfono obligatorios, y al menos un correo.
  const [intentado, setIntentado] = useState(false)
  const errores: Record<string, string> = {}
  if (!aprDireccion.trim()) errores.aprDireccion = 'Obligatoria.'
  if (!aprTelefono.trim()) errores.aprTelefono = 'Obligatorio.'
  if (aprEmail.trim() && !EMAIL_RE.test(aprEmail.trim())) errores.aprEmail = 'Correo no válido.'
  if (aprEmailInst.trim() && !EMAIL_RE.test(aprEmailInst.trim())) errores.aprEmailInst = 'Correo no válido.'
  if (!aprEmail.trim() && !aprEmailInst.trim()) {
    errores.aprEmail = errores.aprEmailInst = 'Registra al menos un correo: personal o institucional.'
  }
  const ver = (k: string) => (editing && intentado ? errores[k] : undefined)

  async function guardar() {
    setIntentado(true)
    if (sinTelefonoInstructor) {
      setErr('No se puede guardar: el instructor de seguimiento no tiene teléfono registrado.')
      return
    }
    if (Object.keys(errores).length > 0) {
      setErr('Faltan datos obligatorios del aprendiz. Revisa lo marcado en rojo.')
      return
    }
    setBusy(true); setErr(null)
    try {
      await api.patch(`/etapas-productivas/${etapa.id}`, {
        fecha_inicio: fechaInicio || undefined,
        fecha_fin_estimada: fechaFin || undefined,
        empresa_nombre: tieneEmpresa ? (empresaNombre || undefined) : undefined,
        empresa_nit: tieneEmpresa ? (empresaNit || undefined) : undefined,
        empresa_direccion: tieneEmpresa ? (empresaDireccion || undefined) : undefined,
        empresa_email: tieneEmpresa ? (empresaEmail || undefined) : undefined,
        jefe_inmediato_nombre: tieneEmpresa ? (jefeNombre || undefined) : undefined,
        jefe_inmediato_cargo: tieneEmpresa ? (jefeCargo || undefined) : undefined,
        jefe_inmediato_telefono: tieneEmpresa ? (jefeTelefono || undefined) : undefined,
        jefe_inmediato_email: tieneEmpresa ? (jefeEmail || undefined) : undefined,
        otro_contacto_nombre: tieneEmpresa ? (otroNombre || undefined) : undefined,
        otro_contacto_telefono: tieneEmpresa ? (otroTelefono || undefined) : undefined,
        asiste_nombre: asisteNombre || undefined,
        asiste_tipo: asisteTipo || undefined,
        asiste_telefono: asisteTelefono || undefined,
        // Vacío se manda como '' para poder borrar el dato del aprendiz.
        aprendiz_email: aprEmail.trim(),
        aprendiz_email_institucional: aprEmailInst.trim(),
        aprendiz_telefono: aprTelefono,
        aprendiz_direccion: aprDireccion.trim(),
      })
      setEditing(false); onSaved()
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setErr(Array.isArray(m) ? m.join(' · ') : m ?? 'No se pudo guardar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="g23">
      <Bloque n={1} titulo="Información general" cols={3}>
        <Campo label="Centro de formación" ancho><Dato valor={ficha?.centro_nombre}/></Campo>
        <Campo label="Nivel formativo"><Dato valor={ficha?.nivel_formacion}/></Campo>
        <Campo label="Programa de formación" ancho><Dato valor={ficha?.programa_nombre ?? etapa.programa_nombre}/></Campo>
        <Campo label="No. grupo"><Dato valor={ficha?.numero_ficha ?? etapa.numero_ficha} mono/></Campo>
        <Campo label="Modalidad de formación">
          <Dato valor={ficha?.modalidad_formacion ? MODALIDAD_FORMACION_LABEL[ficha.modalidad_formacion] : null}/>
        </Campo>
        <Campo label="Alternativa / modalidad"><Dato valor={MODALIDAD_LABEL[etapa.modalidad]}/></Campo>
        <Campo label="Fecha fin etapa lectiva">
          <Dato valor={ficha?.fecha_fin_lectiva ? fd(ficha.fecha_fin_lectiva) : null} mono/>
        </Campo>
        <Campo label="Fecha de inicio" required>{campo(fechaInicio, setFechaInicio, { tipo: 'date' })}</Campo>
        <Campo label="Fecha fin estimada" required>{campo(fechaFin, setFechaFin, { tipo: 'date' })}</Campo>
        <Campo label="Fin real"><Dato valor={etapa.fecha_fin_real ? fd(etapa.fecha_fin_real) : null}/></Campo>
      </Bloque>

      <Bloque n={2} titulo="Datos del aprendiz">
        <Campo label="Nombre completo" ancho><Dato valor={etapa.aprendiz_nombre}/></Campo>
        <Campo label="Tipo de documento">
          <Dato valor={etapa.aprendiz_tipo_documento ? (TIPO_DOC_LABEL[etapa.aprendiz_tipo_documento] ?? etapa.aprendiz_tipo_documento) : null}/>
        </Campo>
        <Campo label="N° de identificación"><Dato valor={etapa.aprendiz_documento} mono/></Campo>
        <Campo label="Correo electrónico personal" error={ver('aprEmail')}>{campo(aprEmail, setAprEmail, { tipo: 'email', placeholder: 'correo@ejemplo.com' })}</Campo>
        <Campo label="Contacto telefónico" required error={ver('aprTelefono')}>{campo(aprTelefono, setAprTelefono, { soloNum: true })}</Campo>
        <Campo label="Dirección" required error={ver('aprDireccion')}>{campo(aprDireccion, setAprDireccion, { placeholder: 'Dirección de residencia' })}</Campo>
        <Campo label="Correo electrónico institucional" error={ver('aprEmailInst')}>{campo(aprEmailInst, setAprEmailInst, { placeholder: '@sena.edu.co' })}</Campo>
        {editing && (
          <span className="g23-col2" style={{ fontSize: 11.5, color: 'var(--fx-tinta-3)' }}>
            Debe quedar al menos un correo: personal o institucional.
          </span>
        )}
      </Bloque>

      <Bloque n={3} titulo="Datos del instructor de seguimiento" origen="su perfil" cols={3}>
        <Campo label="Nombre"><Dato valor={etapa.instructor_nombre}/></Campo>
        <Campo label="Correo electrónico institucional"><Dato valor={etapa.instructor_email}/></Campo>
        <Campo label="Contacto telefónico"><Dato valor={etapa.instructor_telefono} mono/></Campo>
        {sinTelefonoInstructor && (
          <Aviso>
            El formato exige el teléfono del instructor de seguimiento y no está registrado.
            Regístralo en <strong>Configuración → Perfil</strong>; hasta entonces no se puede
            guardar la información general.
          </Aviso>
        )}
      </Bloque>

      {tieneEmpresa && (
        <Bloque n={4} titulo="Datos del ente co-formador">
          <Campo label="Nombre empresa o entidad" ancho>{campo(empresaNombre, setEmpresaNombre)}</Campo>
          <Campo label="NIT">{campo(empresaNit, setEmpresaNit, { soloNum: true })}</Campo>
          <Campo label="Correo electrónico">{campo(empresaEmail, setEmpresaEmail)}</Campo>
          <Campo label="Dirección" ancho>{campo(empresaDireccion, setEmpresaDireccion)}</Campo>
          <Campo label="Jefe inmediato / tutor">{campo(jefeNombre, setJefeNombre)}</Campo>
          <Campo label="Cargo">{campo(jefeCargo, setJefeCargo)}</Campo>
          <Campo label="Contacto telefónico">{campo(jefeTelefono, setJefeTelefono, { soloNum: true })}</Campo>
          <Campo label="Correo electrónico del jefe">{campo(jefeEmail, setJefeEmail)}</Campo>
          <Campo label="Nombre otro contacto">{campo(otroNombre, setOtroNombre)}</Campo>
          <Campo label="Teléfono institucional">{campo(otroTelefono, setOtroTelefono, { soloNum: true })}</Campo>
        </Bloque>
      )}

      {!editing && hayApoyo && (
        <Bloque n={tieneEmpresa ? 5 : 4} titulo="Persona en situación de discapacidad" cols={3} medio>
          <Campo label="Nombre de quien lo asiste"><Dato valor={etapa.asiste_nombre}/></Campo>
          <Campo label="Tipo de asistencia"><Dato valor={etapa.asiste_tipo}/></Campo>
          <Campo label="Contacto telefónico"><Dato valor={etapa.asiste_telefono} mono/></Campo>
        </Bloque>
      )}
      {editing && (
        <section className="g23-bloque">
          <button type="button" className="g23-toggle" onClick={() => setApoyoAbierto(v => !v)}>
            <span className="g23-bloque__n">{tieneEmpresa ? 5 : 4}</span>
            <span className="g23-toggle__t">Persona en situación de discapacidad</span>
            <span className="g23-toggle__hint">si aplica</span>
            <Ic n={apoyoAbierto ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: 'var(--fx-tinta-4)' }}/>
          </button>
          {apoyoAbierto && (
            <div className="g23-bloque__body g23-bloque__body--3" style={{ borderTop: '1px solid var(--fx-superficie-2)' }}>
              <Campo label="Nombre de quien lo asiste">{campo(asisteNombre, setAsisteNombre)}</Campo>
              <Campo label="Tipo de asistencia">{campo(asisteTipo, setAsisteTipo, { placeholder: 'Lenguaje de señas, apoyo visual…' })}</Campo>
              <Campo label="Contacto telefónico">{campo(asisteTelefono, setAsisteTelefono, { soloNum: true })}</Campo>
            </div>
          )}
        </section>
      )}


      {err && <div style={{ fontSize: 12, color: 'var(--fx-atraso)' }}>{err}</div>}

      <div style={{ display: 'flex', justifyContent: editing ? 'flex-end' : 'flex-start', gap: 10 }}>
        {editing ? (
          <>
            <Btn variant="secondary" onClick={() => { setEditing(false); setIntentado(false); setErr(null) }} disabled={busy}>Cancelar</Btn>
            <Btn variant="accent" icon="check" disabled={busy} onClick={() => void guardar()}>{busy ? 'Guardando…' : 'Guardar'}</Btn>
          </>
        ) : !soloLectura && (
          <Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar información</Btn>
        )}
      </div>
    </div>
  )
}


// ─── Tab: Planeación (única vez) ────────────────────────────────────────────────

export function PlaneacionTab({ etapa, etapaId, requiereJefe, planeacion, firmaFuente, onChanged }: {
  etapa: EtapaConSeguimientos; etapaId: number; requiereJefe: boolean
  planeacion: SeguimientoProductivo | null
  firmaFuente: FirmaFuente | null; onChanged: () => void
}) {
  "use no memo"
  const soloLectura = useSoloLectura()
  const [editing, setEditing] = useState(!planeacion && !soloLectura)

  if (soloLectura && !planeacion) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="clock" text="El instructor todavía no ha registrado la planeación."/></Card>
  }

  if (!editing && planeacion) {
    const plan = planeacion.plan_trabajo
    return (
      <div className="g23">
        <InlineAlert tone="ok" icon="checkCircle" title="Planeación registrada">
          El plan de trabajo de la etapa productiva quedó concertado.
        </InlineAlert>

        <Bloque n={1} titulo="Fechas y afiliación" cols={3}>
          <Campo label="Inicio etapa productiva"><Dato valor={fd(etapa.fecha_inicio)} mono/></Campo>
          <Campo label="Fin etapa productiva"><Dato valor={fd(etapa.fecha_fin_estimada)} mono/></Campo>
          <Campo label="Afiliación a la ARL"><Dato valor={planeacion.fecha_afiliacion_arl ? fd(planeacion.fecha_afiliacion_arl) : null} mono/></Campo>
          <Campo label="N.º de póliza ARL"><Dato valor={planeacion.numero_poliza_arl} mono/></Campo>
          <Campo label="Horario" ancho><Dato valor={planeacion.horario}/></Campo>
        </Bloque>

        <Bloque n={2} titulo="Concertación del plan de trabajo">
          <PlanTrabajoVista plan={plan}/>
          {planeacion.observaciones_instructor?.trim() && (
            <Campo label="Observaciones adicionales" ancho><DatoLargo valor={planeacion.observaciones_instructor}/></Campo>
          )}
        </Bloque>

        <Bloque n={3} titulo="Diligenciamiento" cols={3}>
          <Campo label="Fecha"><Dato valor={fd(planeacion.fecha_realizada)} mono/></Campo>
          <Campo label="Modalidad"><Dato valor={planeacion.tipo_seguimiento}/></Campo>
          <Campo label="Grabación">
            <Dato valor={planeacion.enlace_grabacion ? 'Registrada' : null}/>
          </Campo>
        </Bloque>

        <FirmasYUbicacion seguimiento={planeacion} requiereJefe={requiereJefe} onChanged={onChanged}/>
        {!soloLectura && <div><Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar planeación</Btn></div>}
      </div>
    )
  }

  return (
    <PlaneacionForm
      etapa={etapa}
      etapaId={etapaId}
      requiereJefe={requiereJefe}
      planeacion={planeacion}
      firmaFuente={firmaFuente}
      onCancel={() => setEditing(false)}
      onSaved={() => { setEditing(false); onChanged() }}
    />
  )
}

function PlaneacionForm({ etapa, etapaId, requiereJefe, planeacion, firmaFuente, onCancel, onSaved }: {
  etapa: EtapaConSeguimientos; etapaId: number; requiereJefe: boolean
  planeacion: SeguimientoProductivo | null
  firmaFuente: FirmaFuente | null; onCancel: () => void; onSaved: () => void
}) {
  "use no memo"
  const [modalidad, setModalidad] = useState<TipoSeguimiento>(planeacion?.tipo_seguimiento ?? 'PRESENCIAL')
  const [fechaArl, setFechaArl] = useState(planeacion?.fecha_afiliacion_arl?.slice(0, 10) ?? '')
  const [polizaArl, setPolizaArl] = useState(planeacion?.numero_poliza_arl ?? '')
  const [horario, setHorario] = useState(planeacion?.horario ?? '')
  const [enlace, setEnlace] = useState(planeacion?.enlace_grabacion ?? '')
  const [plan, setPlan] = useState<PlanEstado>(() => planDesdeGuardado(planeacion?.plan_trabajo))
  const [obs, setObs] = useState(planeacion?.observaciones_instructor ?? '')
  const [firmas, setFirmas] = useState<FirmasEstado>(firmasVacias())
  const [busy, setBusy] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const esVirtual = modalidad === 'VIRTUAL'

  // Lo que el formato exige para dar por concertado el plan de trabajo.
  // Cada actividad debe generar al menos una evidencia (lo valida el editor).
  const errores: Record<string, string> = { ...erroresPlan(plan) }
  if (esVirtual && !enlace.trim()) errores.enlace = 'Si el momento fue virtual, el formato pide el enlace de la grabación.'
  // Sin firmas no hay planeación: de ella salen las firmas de las bitácoras.
  // Solo al crearla -- al editar, las firmas ya quedaron registradas.
  const faltanFirmas = !planeacion && !firmasCompletas(firmas, requiereJefe)
  const hayErrores = Object.keys(errores).length > 0
  const ver = (k: string) => (intentado ? errores[k] : undefined)

  const area = (v: string, set: (x: string) => void, filas = 3) => (
    <textarea className="nx-input" rows={filas} style={{ resize: 'vertical', lineHeight: 1.5 }} value={v} onChange={e => set(e.target.value)}/>
  )

  async function guardar() {
    setIntentado(true)
    if (hayErrores) {
      setErr('Faltan datos obligatorios del Momento 1. Revisa lo marcado en rojo.')
      return
    }
    if (faltanFirmas) {
      setErr(`Faltan firmas. La planeación se guarda con las firmas del instructor, el aprendiz${requiereJefe ? ' y el jefe inmediato' : ''}.`)
      return
    }
    setBusy(true); setErr(null)
    const planTrabajo = planAGuardar(plan)
    const payload = {
      tipo_seguimiento: modalidad,
      fecha_afiliacion_arl: fechaArl || undefined,
      numero_poliza_arl: polizaArl || undefined,
      horario: horario || undefined,
      enlace_grabacion: enlace || undefined,
      plan_trabajo: planTrabajo,
      observaciones_instructor: obs || undefined,
    }
    try {
      if (planeacion) {
        await api.patch(`/seguimientos-productivos/${planeacion.id}`, payload)
      } else {
        // Las firmas viajan con la planeación: el backend guarda todo junto
        // o nada, así nunca queda una planeación sin firmar.
        await api.post<SeguimientoProductivo>('/seguimientos-productivos', {
          etapa_productiva_id: etapaId, tipo_momento: 'PLANEACION', ...payload,
          firmas: {
            instructor: firmas.instructor,
            aprendiz: firmas.aprendiz,
            ...(requiereJefe ? { jefe: firmas.jefe } : {}),
          },
        })
      }
      onSaved()
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setErr(Array.isArray(m) ? m.join(' · ') : m ?? 'No se pudo guardar la planeación.')
    } finally { setBusy(false) }
  }

  return (
    <div className="g23">
      <Bloque n={1} titulo="Fechas y afiliación" cols={3}>
        <Campo label="Inicio etapa productiva"><Dato valor={fd(etapa.fecha_inicio)} mono/></Campo>
        <Campo label="Fin etapa productiva"><Dato valor={fd(etapa.fecha_fin_estimada)} mono/></Campo>
        <Campo label="Afiliación a la ARL">
          <input type="date" className="nx-input" value={fechaArl} onChange={e => setFechaArl(e.target.value)}/>
        </Campo>
        <Campo label="N.º de póliza ARL">
          <input className="nx-input" inputMode="numeric" value={polizaArl} onChange={e => setPolizaArl(soloDigitos(e.target.value, 50))}/>
        </Campo>
        <Campo label="Horario" ancho>
          <input className="nx-input" value={horario} onChange={e => setHorario(e.target.value)} placeholder="Diurno, lunes a viernes, 8:00 a 17:00"/>
        </Campo>
      </Bloque>

      <Bloque n={2} titulo="Concertación del plan de trabajo">
        <span className="g23-col2" style={{ fontSize: 11.5, color: 'var(--fx-tinta-3)', marginBottom: -4 }}>
          Marca los resultados de aprendizaje que el aprendiz desarrollará en la empresa: su competencia,
          actividades y evidencias salen del diseño curricular. Todo queda editable.
        </span>
        <div className="g23-col2">
          <PlanTrabajoEditor
            codigo={etapa.programa_codigo}
            version={etapa.programa_version}
            value={plan}
            onChange={setPlan}
            errores={intentado ? errores : {}}
          />
        </div>
        <Campo label="Observaciones adicionales" ancho>{area(obs, setObs, 2)}</Campo>
      </Bloque>

      <Bloque n={3} titulo="Diligenciamiento">
        <Campo label="Modalidad" ancho>
          <Seg name="modPlaneacion" value={modalidad} onChange={v => setModalidad(v as TipoSeguimiento)} options={MODALIDAD_SEG_OPTS}/>
        </Campo>
        <Campo label="Enlace de grabación" ancho error={ver('enlace')}>
          <input className="nx-input" placeholder={esVirtual ? 'https://…' : 'Solo si el momento se realiza de forma virtual'} value={enlace} onChange={e => setEnlace(e.target.value)}/>
        </Campo>
      </Bloque>

      {!planeacion && (
        <FirmasCaptura requiereJefe={requiereJefe} value={firmas} onChange={setFirmas} fuente={firmaFuente}/>
      )}

      {err && <div style={{ fontSize: 12, color: 'var(--fx-atraso)' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={busy} onClick={() => void guardar()}>
          {busy ? 'Guardando…' : 'Guardar planeación'}
        </Btn>
      </div>
    </div>
  )
}


// El seguimiento parcial y la evaluación no se pueden registrar antes de estar
// cerca de su ventana (una semana antes; el backend también lo valida).
// Devuelve desde cuándo se habilita, o null si ya se puede.
// ─── Tab: Seguimientos (se repite; incluye extraordinarios) ────────────────────

export function SeguimientosTab({ etapa, etapaId, requiereJefe, planeacion, seguimientos, firmaFuente, bloqueo, onChanged }: {
  etapa: EtapaConSeguimientos
  etapaId: number; requiereJefe: boolean; planeacion: SeguimientoProductivo | null
  seguimientos: SeguimientoProductivo[]; firmaFuente: FirmaFuente | null; bloqueo: Bloqueo | null; onChanged: () => void
}) {
  "use no memo"
  const soloLectura = useSoloLectura()
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
        {!creando && !soloLectura && <Btn variant="accent" icon="plus" onClick={() => setCreando(true)}>Nuevo seguimiento</Btn>}
      </div>

      {bloqueo && (
        <InlineAlert tone="info" icon="lock">
          El seguimiento parcial (momento 2) se podrá registrar desde el <strong>{bloqueo.desde}</strong> (su ventana es {bloqueo.ventana}).
          Antes de esa fecha solo puedes registrar seguimientos extraordinarios.
        </InlineAlert>
      )}

      {creando && (
        <SeguimientoForm etapa={etapa} etapaId={etapaId} requiereJefe={requiereJefe} firmaFuente={firmaFuente} soloExtraordinario={!!bloqueo} onCancel={() => setCreando(false)} onSaved={() => { setCreando(false); onChanged() }}/>
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
          background: extraordinario ? 'var(--fx-aviso-suave)' : 'var(--fx-morado-suave)', color: extraordinario ? 'var(--fx-aviso)' : 'var(--fx-morado)',
        }}>#{s.numero_seguimiento}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fx-tinta)', fontFamily: '"JetBrains Mono", monospace' }}>{fd(s.fecha_realizada)}</span>
            <Bdg tone="neutral">{s.tipo_seguimiento}</Bdg>
            {extraordinario && <Bdg tone="warn">Extraordinario</Bdg>}
            <span style={{ fontSize: 11.5, color: 'var(--fx-tinta-3)' }}>{satisfactorios}/{total} satisfactorio</span>
          </div>
        </div>
        <Ic n={open ? 'chevronDown' : 'chevronRight'} s={15} style={{ color: 'var(--fx-tinta-4)', flexShrink: 0 }}/>
      </button>
      {open && (
        <div style={{ borderTop: '1px solid var(--fx-superficie-2)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {extraordinario && (
            <div>
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-2)', fontWeight: 600, marginBottom: 4 }}>Motivo del seguimiento extraordinario</div>
              <div style={{ fontSize: 12.5, color: 'var(--fx-tinta)' }}>{s.motivo_extraordinario}</div>
            </div>
          )}
          {s.enlace_grabacion && (
            <a href={s.enlace_grabacion} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--fx-morado)', display: 'flex', alignItems: 'center', gap: 4 }}>
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
              <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-2)', fontWeight: 600, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: 'var(--fx-tinta)', lineHeight: 1.5 }}>{value}</div>
            </div>
          ))}
          <FirmasYUbicacion seguimiento={s} requiereJefe={requiereJefe} onChanged={onChanged}/>
        </div>
      )}
    </Card>
  )
}

function SeguimientoForm({ etapa, etapaId, requiereJefe, firmaFuente, soloExtraordinario, onCancel, onSaved }: {
  etapa: EtapaConSeguimientos; etapaId: number; requiereJefe: boolean
  firmaFuente: FirmaFuente | null; soloExtraordinario: boolean; onCancel: () => void; onSaved: () => void
}) {
  "use no memo"
  const [modalidad, setModalidad] = useState<TipoSeguimiento>('PRESENCIAL')
  const [enlace, setEnlace] = useState('')
  const [esExtraordinario, setEsExtraordinario] = useState(soloExtraordinario)
  const [motivo, setMotivo] = useState('')
  const [tecnicos, setTecnicos] = useState<FactorItem[]>(factoresDesde(FACTORES_TECNICOS, undefined))
  const [actitudinales, setActitudinales] = useState<FactorItem[]>(factoresDesde(FACTORES_ACTITUDINALES, undefined))
  const [obsInstructor, setObsInstructor] = useState('')
  const [obsAprendiz, setObsAprendiz] = useState('')
  const [obsEnte, setObsEnte] = useState('')
  const [firmas, setFirmas] = useState<FirmasEstado>(firmasVacias())
  const [busy, setBusy] = useState(false)
  const [intentado, setIntentado] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const esVirtual = modalidad === 'VIRTUAL'
  const sinValorar = [...tecnicos, ...actitudinales].filter(f => f.valor === null).length

  const errores: Record<string, string> = {}
  if (esExtraordinario && !motivo.trim()) errores.motivo = 'Obligatorio: explica por qué se sale del momento 2 regular.'
  if (esVirtual && !enlace.trim()) errores.enlace = 'Si el seguimiento fue virtual, el formato pide el enlace de la grabación.'
  const hayErrores = Object.keys(errores).length > 0 || sinValorar > 0 || !firmasCompletas(firmas, requiereJefe)
  const ver = (k: string) => (intentado ? errores[k] : undefined)

  const area = (v: string, set: (x: string) => void, filas = 2) => (
    <textarea className="nx-input" rows={filas} style={{ resize: 'vertical', lineHeight: 1.5 }} value={v} onChange={e => set(e.target.value)}/>
  )

  async function guardar() {
    setIntentado(true)
    if (sinValorar > 0) {
      setErr(`Faltan ${sinValorar} variable${sinValorar === 1 ? '' : 's'} por valorar. El formato pide marcar las 13.`)
      return
    }
    if (!firmasCompletas(firmas, requiereJefe)) {
      setErr('Faltan firmas. El seguimiento no tiene validez sin ellas.')
      return
    }
    if (Object.keys(errores).length > 0) {
      setErr('Faltan datos obligatorios. Revisa lo marcado en rojo.')
      return
    }
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
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setErr(Array.isArray(m) ? m.join(' · ') : m ?? 'No se pudo guardar el seguimiento.')
    } finally { setBusy(false) }
  }

  return (
    <div className="g23">
      <Bloque n={1} titulo="Fechas y modalidad">
        <Campo label="Inicio etapa productiva"><Dato valor={fd(etapa.fecha_inicio)} mono/></Campo>
        <Campo label="Fecha del seguimiento"><Dato valor={null}/></Campo>
        <Campo label="Modalidad del seguimiento" ancho>
          <Seg name="modSeg" value={modalidad} onChange={v => setModalidad(v as TipoSeguimiento)} options={MODALIDAD_SEG_OPTS}/>
        </Campo>
        <Campo label="Enlace de grabación" ancho error={ver('enlace')}>
          <input className="nx-input" placeholder={esVirtual ? 'https://…' : 'Solo si el seguimiento se hace de forma virtual'} value={enlace} onChange={e => setEnlace(e.target.value)}/>
        </Campo>
        <label className="g23-col2" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--fx-tinta-2)', cursor: 'pointer' }}>
          <input type="checkbox" className="nx-check" checked={esExtraordinario} disabled={soloExtraordinario} onChange={e => setEsExtraordinario(e.target.checked)}/>
          Es un seguimiento extraordinario (fuera del momento 2 regular)
        </label>
        {esExtraordinario && (
          <Campo label="Motivo del seguimiento extraordinario" required ancho error={ver('motivo')}>
            {area(motivo, setMotivo)}
          </Campo>
        )}
      </Bloque>

      <FactoresBlock titulo="2 · Factores técnicos" items={tecnicos} onChange={setTecnicos}/>
      <FactoresBlock titulo="3 · Factores actitudinales y comportamentales" items={actitudinales} onChange={setActitudinales}/>

      <Bloque n={4} titulo="Observaciones">
        <Campo label="Complementarias del instructor de seguimiento" ancho>{area(obsInstructor, setObsInstructor)}</Campo>
        <Campo label="Del aprendiz" ancho>{area(obsAprendiz, setObsAprendiz)}</Campo>
        <Campo label="Del responsable del ente co-formador" ancho>{area(obsEnte, setObsEnte)}</Campo>
      </Bloque>

      <FirmasCaptura requiereJefe={requiereJefe} value={firmas} onChange={setFirmas} fuente={firmaFuente}/>

      {err && <div style={{ fontSize: 12, color: 'var(--fx-atraso)' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={busy} onClick={() => void guardar()}>
          {busy ? 'Guardando…' : 'Guardar seguimiento'}
        </Btn>
      </div>
      {hayErrores && intentado && (
        <div style={{ fontSize: 11.5, color: 'var(--fx-tinta-4)', textAlign: 'right' }}>
          {sinValorar > 0 && `${sinValorar} variables sin valorar. `}
          {!firmasCompletas(firmas, requiereJefe) && 'Faltan firmas.'}
        </div>
      )}
    </div>
  )
}


// ─── Tab: Evaluación final (única vez) ──────────────────────────────────────────

export function EvaluacionTab({ etapa, etapaId, visitas, requiereJefe, planeacion, evaluacion, firmaFuente, bloqueo, onChanged }: {
  etapa: EtapaConSeguimientos; visitas: number
  etapaId: number; requiereJefe: boolean; planeacion: SeguimientoProductivo | null
  evaluacion: SeguimientoProductivo | null; firmaFuente: FirmaFuente | null; bloqueo: Bloqueo | null; onChanged: () => void
}) {
  "use no memo"
  const soloLectura = useSoloLectura()
  const [editing, setEditing] = useState(!evaluacion && !soloLectura)

  if (!planeacion) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="lock" text="Completa primero la Planeación para habilitar la evaluación final."/></Card>
  }

  if (soloLectura && !evaluacion) {
    return <Card style={{ padding: 24 }}><EmptyHint icon="clock" text="El instructor todavía no ha registrado la evaluación final."/></Card>
  }

  if (!evaluacion && bloqueo) {
    return (
      <Card style={{ padding: 24 }}>
        <EmptyHint icon="lock" text={`La evaluación final se podrá registrar desde el ${bloqueo.desde}, una semana antes de su ventana (${bloqueo.ventana}).`}/>
      </Card>
    )
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
          <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--fx-tinta-2)', fontWeight: 600, marginBottom: 10 }}>Retroalimentación</div>
          {([
            ['Ente co-formador', evaluacion.retro_coformador],
            ['Instructor de seguimiento', evaluacion.retro_instructor],
            ['Aprendiz', evaluacion.retro_aprendiz],
          ] as [string, string | null][]).map(([label, value]) => (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--fx-tinta-2)', fontWeight: 600, marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12.5, color: value ? 'var(--fx-tinta)' : 'var(--fx-tinta-4)', lineHeight: 1.5 }}>{value || 'Sin diligenciar'}</div>
            </div>
          ))}
        </Card>
        <FirmasYUbicacion seguimiento={evaluacion} requiereJefe={requiereJefe} onChanged={onChanged}/>
        {!soloLectura && <div><Btn variant="secondary" icon="edit" onClick={() => setEditing(true)}>Editar evaluación</Btn></div>}
      </div>
    )
  }

  return <EvaluacionForm etapa={etapa} etapaId={etapaId} visitas={visitas} requiereJefe={requiereJefe} evaluacion={evaluacion} firmaFuente={firmaFuente} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); onChanged() }}/>
}

function EvaluacionForm({ etapa, etapaId, visitas, requiereJefe, evaluacion, firmaFuente, onCancel, onSaved }: {
  etapa: EtapaConSeguimientos; etapaId: number; visitas: number; requiereJefe: boolean
  evaluacion: SeguimientoProductivo | null
  firmaFuente: FirmaFuente | null; onCancel: () => void; onSaved: () => void
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
  const [intentado, setIntentado] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const esVirtual = modalidad === 'VIRTUAL'
  const sinValorar = [...tecnicos, ...actitudinales].filter(f => f.valor === null).length
  const errores: Record<string, string> = {}
  if (esVirtual && !enlace.trim()) errores.enlace = 'Si la evaluación fue virtual, el formato pide el enlace de la grabación.'
  const ver = (k: string) => (intentado ? errores[k] : undefined)

  // El formato pide dos cosas en cada retroalimentación: el proceso de
  // formación y el desempeño de las competencias. El modelo guarda un solo
  // campo por parte, así que el placeholder lo recuerda en vez de perderlo.
  const AYUDA_RETRO = 'Proceso de formación del aprendiz y desempeño de las competencias técnicas y actitudinales.'
  const area = (v: string, set: (x: string) => void) => (
    <textarea className="nx-input" rows={3} style={{ resize: 'vertical', lineHeight: 1.5 }} value={v} onChange={e => set(e.target.value)} placeholder={AYUDA_RETRO}/>
  )

  async function guardar() {
    setIntentado(true)
    if (sinValorar > 0) {
      setErr(`Faltan ${sinValorar} variable${sinValorar === 1 ? '' : 's'} por valorar. El formato pide marcar las 13.`)
      return
    }
    if (!evaluacion && !juicio) {
      setErr('Falta el juicio de evaluación: es lo que define si el aprendiz aprueba la etapa.')
      return
    }
    if (!evaluacion && !firmasCompletas(firmas, requiereJefe)) {
      setErr('Faltan firmas. La evaluación no tiene validez sin ellas.')
      return
    }
    if (Object.keys(errores).length > 0) {
      setErr('Faltan datos obligatorios. Revisa lo marcado en rojo.')
      return
    }
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
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
      setErr(Array.isArray(m) ? m.join(' · ') : m ?? 'No se pudo guardar la evaluación.')
    } finally { setBusy(false) }
  }

  return (
    <div className="g23">
      <Bloque n={1} titulo="Fechas y visitas" cols={3}>
        <Campo label="Inicio etapa productiva"><Dato valor={fd(etapa.fecha_inicio)} mono/></Campo>
        <Campo label="Fin de la ejecución">
          <Dato valor={fd(etapa.fecha_fin_real ?? etapa.fecha_fin_estimada)} mono/>
        </Campo>
        {/* El formato pide contar las visitas; se cuentan solas a partir de los
            momentos ya registrados, en vez de pedirle al instructor que recuerde. */}
        <Campo label="Visitas realizadas"><Dato valor={String(visitas)} mono/></Campo>
        <Campo label="La evaluación se realizó en forma" ancho>
          <Seg name="modEval" value={modalidad} onChange={v => setModalidad(v as TipoSeguimiento)} options={MODALIDAD_SEG_OPTS}/>
        </Campo>
        <Campo label="Enlace de grabación" ancho error={ver('enlace')}>
          <input className="nx-input" placeholder={esVirtual ? 'https://…' : 'Solo si la evaluación se hace de forma virtual'} value={enlace} onChange={e => setEnlace(e.target.value)}/>
        </Campo>
      </Bloque>

      <FactoresBlock titulo="2 · Factores técnicos" items={tecnicos} onChange={setTecnicos}/>
      <FactoresBlock titulo="3 · Factores actitudinales y comportamentales" items={actitudinales} onChange={setActitudinales}/>

      <Bloque n={4} titulo="Retroalimentación">
        <Campo label="Del ente co-formador" ancho>{area(retroCoformador, setRetroCoformador)}</Campo>
        <Campo label="Del instructor de seguimiento" ancho>{area(retroInstructor, setRetroInstructor)}</Campo>
        <Campo label="Del aprendiz" ancho>{area(retroAprendiz, setRetroAprendiz)}</Campo>
      </Bloque>

      {!evaluacion && (
        <Bloque n={5} titulo="Juicio de evaluación de la etapa productiva">
          <span className="g23-col2" style={{ fontSize: 11.5, color: 'var(--fx-tinta-3)', marginBottom: -2 }}>
            Define si el aprendiz aprueba la etapa. No se puede guardar sin elegir uno.
          </span>
          <div className="g23-col2" style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setJuicio('APROBADO')} style={{
              flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${juicio === 'APROBADO' ? 'var(--fx-ok-linea)' : 'var(--fx-linea)'}`,
              background: juicio === 'APROBADO' ? 'var(--fx-ok-suave)' : 'var(--fx-superficie)',
              color: juicio === 'APROBADO' ? 'var(--fx-ok)' : 'var(--fx-tinta-2)', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}><Ic n="checkCircle" s={15}/>Aprobado</button>
            <button onClick={() => setJuicio('NO_APROBADO')} style={{
              flex: 1, padding: '14px', borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
              border: `2px solid ${juicio === 'NO_APROBADO' ? 'var(--fx-atraso-linea)' : 'var(--fx-linea)'}`,
              background: juicio === 'NO_APROBADO' ? 'var(--fx-atraso-suave)' : 'var(--fx-superficie)',
              color: juicio === 'NO_APROBADO' ? 'var(--fx-atraso)' : 'var(--fx-tinta-2)', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}><Ic n="x" s={15}/>No aprobado</button>
          </div>
        </Bloque>
      )}

      {!evaluacion && (
        <FirmasCaptura requiereJefe={requiereJefe} value={firmas} onChange={setFirmas} fuente={firmaFuente}/>
      )}

      {err && <div style={{ fontSize: 12, color: 'var(--fx-atraso)' }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <Btn variant="secondary" onClick={onCancel} disabled={busy}>Cancelar</Btn>
        <Btn variant="accent" icon="check" disabled={busy} onClick={() => void guardar()}>
          {busy ? 'Guardando…' : 'Guardar evaluación'}
        </Btn>
      </div>
    </div>
  )
}
