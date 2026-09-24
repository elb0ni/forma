// ─── Tipos: Etapa Productiva (GFPI-F-023 V06) ───────────────────────────────────
// Alineados 1:1 con las respuestas reales de forma_server (aprendiz,
// etapa-productiva, seguimiento-productivo). Los nombres de campo son
// snake_case a propósito, igual que el resto de tipos del frontend
// (src/types.ts, screens/shared/types.ts): no hay generación automática desde
// el backend, así que el contrato se mantiene a mano.

export type TipoDocumento = 'CC' | 'CE' | 'TI' | 'PP'
export type EstadoFormacionAprendiz =
  | 'EN_LECTIVA' | 'EN_PRODUCTIVA' | 'APLAZADO' | 'RETIRADO' | 'CERTIFICADO' | 'NO_CERTIFICADO'

export interface Aprendiz {
  id: number
  ficha_id: number
  tipo_documento: TipoDocumento
  numero_documento: string
  nombre_completo: string
  email: string | null
  telefono: string | null
  estado_formacion: EstadoFormacionAprendiz
}

export type ModalidadEtapaProductiva =
  | 'CONTRATO_APRENDIZAJE' | 'VINCULO_LABORAL' | 'MONITORIA' | 'UNIDAD_PRODUCTIVA'
export type EstadoEtapaProductiva =
  | 'PENDIENTE_INICIO' | 'EN_EJECUCION' | 'SUSPENDIDA' | 'APLAZADA' | 'TERMINADA' | 'CANCELADA'
export type ResultadoFinal = 'APROBADO' | 'NO_APROBADO'

export const MODALIDAD_LABEL: Record<ModalidadEtapaProductiva, string> = {
  CONTRATO_APRENDIZAJE: 'Contrato de aprendizaje',
  VINCULO_LABORAL: 'Vínculo laboral',
  MONITORIA: 'Monitoría',
  UNIDAD_PRODUCTIVA: 'Unidad productiva',
}

// Modalidades que sí tienen un ente co-formador (empresa/jefe inmediato) —
// en MONITORIA/UNIDAD_PRODUCTIVA esos campos suelen quedar vacíos.
export const MODALIDAD_TIENE_EMPRESA: Record<ModalidadEtapaProductiva, boolean> = {
  CONTRATO_APRENDIZAJE: true,
  VINCULO_LABORAL: true,
  MONITORIA: false,
  UNIDAD_PRODUCTIVA: false,
}

export interface EtapaProductiva {
  id: number
  aprendiz_id: number
  instructor_id: string
  modalidad: ModalidadEtapaProductiva
  empresa_nombre: string | null
  empresa_nit: string | null
  empresa_direccion: string | null
  empresa_lat: number | null
  empresa_lng: number | null
  jefe_inmediato_nombre: string | null
  jefe_inmediato_telefono: string | null
  jefe_inmediato_email: string | null
  jefe_inmediato_cargo: string | null
  // GFPI-F-023 (migración 008)
  empresa_email: string | null
  otro_contacto_nombre: string | null
  otro_contacto_telefono: string | null
  asiste_nombre: string | null
  asiste_tipo: string | null
  asiste_telefono: string | null
  fecha_inicio: string
  fecha_fin_estimada: string
  fecha_fin_real: string | null
  estado: EstadoEtapaProductiva
  resultado_final: ResultadoFinal | null
  // Vienen ya resueltos por el join del backend (findAll/findOne)
  aprendiz_nombre?: string
  aprendiz_documento?: string
  aprendiz_tipo_documento?: TipoDocumento
  numero_ficha?: string
  programa_codigo?: string
  programa_version?: string | number
  programa_nombre?: string
  instructor_nombre?: string
  // Último snapshot semanal de SofiaPlus para este aprendiz (solo en el
  // listado, vía LEFT JOIN) -- permite que la lista distinga una etapa
  // TERMINADA con juicio ya confirmado de una que aún no lo refleja.
  ra_sin_evaluar?: number | null
}

export type TipoMomento = 'PLANEACION' | 'SEGUIMIENTO' | 'EVALUACION'
export type TipoSeguimiento = 'PRESENCIAL' | 'VIRTUAL' | 'TELEFONICA'
export type Concepto = 'FAVORABLE' | 'NO_FAVORABLE' | 'PENDIENTE'
export type ValorFactor = 'SATISFACTORIO' | 'POR_MEJORAR'

export interface FactorItem {
  variable: string
  label: string
  valor: ValorFactor | null
  observacion: string
}

// Las 8 variables técnicas y 5 actitudinales/comportamentales son fijas en el
// formato (se repiten idénticas en Momento 2, Momento 3 y el Anexo).
export const FACTORES_TECNICOS: { variable: string; label: string }[] = [
  { variable: 'aplicacion_conocimiento', label: 'Aplicación de conocimiento' },
  { variable: 'mejora_continua',         label: 'Mejora continua' },
  { variable: 'fortalecimiento_ocup',    label: 'Fortalecimiento ocupacional' },
  { variable: 'oportunidad_calidad',     label: 'Oportunidad y calidad' },
  { variable: 'responsabilidad_amb',     label: 'Responsabilidad ambiental' },
  { variable: 'administracion_recursos', label: 'Administración de recursos' },
  { variable: 'seguridad_salud',         label: 'Seguridad y salud en el trabajo' },
  { variable: 'documentacion_etapa',     label: 'Documentación etapa productiva' },
]

export const FACTORES_ACTITUDINALES: { variable: string; label: string }[] = [
  { variable: 'relaciones_interp',  label: 'Relaciones interpersonales' },
  { variable: 'trabajo_equipo',     label: 'Trabajo en equipo' },
  { variable: 'solucion_problemas', label: 'Solución de problemas' },
  { variable: 'cumplimiento',       label: 'Cumplimiento' },
  { variable: 'organizacion',       label: 'Organización' },
]

export function nuevosFactores(base: { variable: string; label: string }[]): FactorItem[] {
  return base.map(f => ({ ...f, valor: null, observacion: '' }))
}

// Reconstruye los FactorItem (con label) a partir del valoracion_json que
// devuelve el backend ({tecnicos:[{variable,valor,observacion}], ...}) — si no
// hay grilla guardada todavía, arranca en blanco.
export function factoresDesde(
  base: { variable: string; label: string }[],
  guardados: { variable: string; valor: ValorFactor; observacion?: string | null }[] | undefined,
): FactorItem[] {
  return base.map(f => {
    const g = guardados?.find(x => x.variable === f.variable)
    return { ...f, valor: g?.valor ?? null, observacion: g?.observacion ?? '' }
  })
}

// Payload que espera el backend (sin "label", que es solo de UI).
export function factoresAJson(items: FactorItem[]) {
  return items.map(({ variable, valor, observacion }) => ({ variable, valor, observacion: observacion || undefined }))
}

export interface PlanTrabajo {
  competencias: string[]
  resultados_aprendizaje: string[]
  actividades: string[]
  evidencias: string[]
}

export function planTrabajoVacio(): PlanTrabajo {
  return { competencias: [], resultados_aprendizaje: [], actividades: [], evidencias: [] }
}

// El formato pide texto libre; en la UI se edita como textarea (una idea por
// línea) y se convierte a/desde el arreglo que persiste el backend.
export function lineasATexto(v: string[] | undefined): string { return (v ?? []).join('\n') }
export function textoALineas(v: string): string[] { return v.split('\n').map(s => s.trim()).filter(Boolean) }

// Vínculo actividad -> evidencia. El formato es texto libre, así que viaja en
// el propio texto: "A1. Crear objetos…" en actividades y "A1. Crea la base de
// datos…" en evidencias. Lo genera y lo lee PlanTrabajoEditor.

const RE_NUM_ACTIVIDAD = /^A(\d+)\.\s/

export function numeroActividad(linea: string): number | null {
  const m = RE_NUM_ACTIVIDAD.exec(linea.trim())
  return m ? Number(m[1]) : null
}

// ─── Columnas JSON del seguimiento (plan_trabajo / valoracion_json) ────────────
// El prod corre MariaDB, donde `JSON` es un alias de LONGTEXT: mysql2 solo
// autoparsea las columnas cuyo tipo nativo es JSON (MySQL 8), así que desde
// MariaDB llegan como texto (o, si el driver las trae binarias, como un Buffer
// serializado {type:'Buffer',data:[…]}). Se normaliza a objeto al recibir.
function parseCampoJson<T>(v: unknown): T | null {
  if (v == null) return null
  if (typeof v === 'object') {
    const b = v as { type?: string; data?: number[] }
    if (b.type === 'Buffer' && Array.isArray(b.data)) {
      try { return JSON.parse(new TextDecoder().decode(new Uint8Array(b.data))) as T } catch { return null }
    }
    return v as T
  }
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return null
    try { return JSON.parse(t) as T } catch { return null }
  }
  return null
}

export function normalizeSeguimiento(s: SeguimientoProductivo): SeguimientoProductivo {
  return {
    ...s,
    plan_trabajo: parseCampoJson<PlanTrabajo>(s.plan_trabajo),
    valoracion_json: parseCampoJson<SeguimientoProductivo['valoracion_json']>(s.valoracion_json),
  }
}

export interface SeguimientoProductivo {
  id: number
  etapa_productiva_id: number
  numero_seguimiento: number
  tipo_momento: TipoMomento
  tipo_seguimiento: TipoSeguimiento
  fecha_programada: string | null
  fecha_realizada: string | null
  concepto: Concepto
  valoracion_json: { tecnicos: { variable: string; valor: ValorFactor; observacion?: string | null }[]; actitudinales: { variable: string; valor: ValorFactor; observacion?: string | null }[] } | null
  plan_trabajo: PlanTrabajo | null
  fecha_afiliacion_arl: string | null
  numero_poliza_arl: string | null
  horario: string | null
  enlace_grabacion: string | null
  motivo_extraordinario: string | null
  observaciones_instructor: string | null
  observaciones_aprendiz: string | null
  observaciones_coformador: string | null
  plan_mejoramiento: string | null
  retro_coformador: string | null
  retro_instructor: string | null
  retro_aprendiz: string | null
  ubicacion_lat: number | null
  ubicacion_lng: number | null
  ubicacion_precision_m: number | null
  distancia_empresa_m: number | null
  ubicacion_alerta: boolean
  firma_instructor_ruta: string | null
  firma_jefe_ruta: string | null
  firma_aprendiz_ruta: string | null
  firmado_at: string | null
}

// ─── Instructor de práctica por ficha (uno solo para toda la ficha) ────────────
// A diferencia de la etapa lectiva (instructor por competencia vía
// `asignacion`), en etapa productiva un único instructor hace seguimiento a
// todos los aprendices de la ficha. Es la fuente de la que se deriva
// etapa_productiva.instructor_id — no se elige por aprendiz individual.

export type EstadoAsignacionPractica = 'ACTIVA' | 'FINALIZADA'

export interface AsignacionPractica {
  id: number
  ficha_id: number
  instructor_id: string
  fecha_inicio: string
  fecha_fin: string | null
  estado: EstadoAsignacionPractica
  instructor_nombre?: string
}

// ─── Estado calculado (Caso 1-4), lo resuelve el backend en GET /aprendices/:id/estado ─

export type EstadoCalculado = 'SIN_ALTERNATIVA' | 'EN_CURSO' | 'TERMINADA_SIN_JUICIO' | 'CONCLUIDA'

export interface EstadoAprendiz {
  aprendiz_id: number
  caso: 1 | 2 | 3 | 4
  estado: EstadoCalculado
  etapa_productiva: { id: number; estado: EstadoEtapaProductiva; resultado_final: ResultadoFinal | null } | null
  avance_juicios: {
    total_ra: number | null; ra_aprobados: number | null; ra_no_aprobados: number | null
    ra_sin_evaluar: number; estado_aprendiz: string; fecha_reporte: string
  } | null
}

export const ESTADO_META: Record<EstadoCalculado, { label: string; tone: 'warn' | 'accent' | 'ok' | 'err' }> = {
  SIN_ALTERNATIVA:      { label: 'Sin alternativa escogida', tone: 'warn' },
  EN_CURSO:             { label: 'En curso',                 tone: 'accent' },
  TERMINADA_SIN_JUICIO: { label: 'Terminada · falta juicio Sofia', tone: 'warn' },
  CONCLUIDA:            { label: 'Concluida',                tone: 'ok' },
}

export type CasoTono = 'EN_CURSO' | 'SIN_JUICIO' | 'APROBADO' | 'NO_APROBADO' | 'CANCELADA' | 'SUSPENDIDA' | 'APLAZADA'

// Metadatos de cada caso para listas y agrupaciones (etiqueta, tono del Bdg y
// color del punto de grupo). El orden de CASO_TONO_ORDER es por urgencia de
// seguimiento: lo que necesita gestión va primero, los estados terminales al
// final -- se usa tanto para el filtro como para agrupar la tabla.
export const CASO_TONO_META: Record<CasoTono, { label: string; tone: 'warn' | 'accent' | 'ok' | 'err'; color: string }> = {
  EN_CURSO:    { label: 'En curso',           tone: 'accent', color: '#4f46e5' },
  SIN_JUICIO:  { label: 'Falta juicio Sofia', tone: 'warn',   color: '#a16207' },
  SUSPENDIDA:  { label: 'Suspendida',         tone: 'warn',   color: '#ca8a04' },
  APLAZADA:    { label: 'Aplazada',           tone: 'warn',   color: '#d97706' },
  NO_APROBADO: { label: 'No aprobado',        tone: 'err',    color: '#dc2626' },
  APROBADO:    { label: 'Aprobado',           tone: 'ok',     color: '#16a34a' },
  CANCELADA:   { label: 'Cancelada',          tone: 'err',    color: '#b91c1c' },
}

export const CASO_TONO_ORDER: CasoTono[] =
  ['EN_CURSO', 'SIN_JUICIO', 'SUSPENDIDA', 'APLAZADA', 'NO_APROBADO', 'APROBADO', 'CANCELADA']

// Deriva el badge de la lista directo de la fila de etapa_productiva (ya
// trae ra_sin_evaluar vía LEFT JOIN, ver etapa-productiva.service.ts), por
// eso puede distinguir "terminada y confirmada por Sofia" de "terminada pero
// Sofia todavía no lo refleja" sin pedir /estado por cada fila.
export function tonoEtapa(e: EtapaProductiva): { label: string; tone: 'warn' | 'accent' | 'ok' | 'err'; caso: CasoTono } {
  if (e.estado === 'TERMINADA') {
    // Mismo criterio que aprendiz.service.ts::getEstado en el backend: sin
    // snapshot de SofiaPlus, o con el juicio todavía pendiente ahí, cuenta
    // como no confirmado -- aunque en FORMA ya se haya evaluado.
    const sinConfirmarSofia = e.ra_sin_evaluar == null || e.ra_sin_evaluar > 0
    if (sinConfirmarSofia) return { label: 'Terminada · falta juicio Sofia', tone: 'warn', caso: 'SIN_JUICIO' }
    if (e.resultado_final === 'APROBADO') return { label: 'Aprobado', tone: 'ok', caso: 'APROBADO' }
    if (e.resultado_final === 'NO_APROBADO') return { label: 'No aprobado', tone: 'err', caso: 'NO_APROBADO' }
  }
  if (e.estado === 'CANCELADA') return { label: 'Cancelada', tone: 'err', caso: 'CANCELADA' }
  if (e.estado === 'SUSPENDIDA' || e.estado === 'APLAZADA') {
    return { label: e.estado === 'SUSPENDIDA' ? 'Suspendida' : 'Aplazada', tone: 'warn', caso: e.estado }
  }
  return { label: 'En curso', tone: 'accent', caso: 'EN_CURSO' }
}
