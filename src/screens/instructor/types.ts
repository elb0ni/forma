import type { IcName } from '../../components/ui'
// Contrato del módulo "instructores" del backend (forma_server, commit 51c1d71).
// Mantenido a mano, snake_case igual que el resto de tipos del front.

// ─── GET /instructores/mi/fichas ────────────────────────────────────────────────
// Fichas donde el instructor autenticado es instructor de seguimiento a la
// etapa productiva (asignacion_practica ACTIVA). El backend ya las devuelve
// acotadas a práctica y ordenadas por fecha de cierre.
export interface FichaInstructor {
  id:                      number
  numero_ficha:            string
  estado:                  string   // EN_EJECUCION | FINALIZADA | SUSPENDIDA
  jornada:                 string | null
  sede:                    string | null
  fecha_inicio_productiva: string | null
  fecha_fin_productiva:    string | null
  dias_restantes:          number | null   // DATEDIFF(fin, hoy); negativo = vencida
  programa_nombre:         string
  programa_codigo:         string
  nivel_formacion:         string
  asignado_desde:          string | null
  aprendices:              number   // total en el reporte de juicios
  aprendices_en_seguimiento: number // de esos, con etapa productiva EN_EJECUCION
}

// ─── GET /instructores/mi/resumen ──────────────────────────────────────────────
export interface InstructorResumen {
  fichas_practica:           number
  aprendices_en_seguimiento: number
  en_curso:                  number
  sin_juicio:                number   // TERMINADA sin resultado_final (falta juicio Sofia)
  aprobadas:                 number
  no_aprobadas:              number
  seguimientos_total:        number
  seguimientos_30d:          number
  ultimo_registro:           string | null
  momentos_atrasados:        number
}

// ─── GET /instructores/mi/agenda ──────────────────────────────────────────────
export interface AgendaItem {
  etapa_id:           number
  aprendiz_id:        number
  aprendiz_nombre:    string
  numero_documento:   string
  numero_ficha:       string
  empresa_nombre:     string | null
  ultimo_seguimiento: string | null
  motivo:             string
  fecha:              string | null
}

export interface InstructorAgenda {
  atrasados:           AgendaItem[]
  proximos:            AgendaItem[]
  total_en_seguimiento: number
}

// ─── GET /instructores/mi/proyeccion ─────────────────────────────────────────
// Calendario: los momentos que ya existen (realizados o programados) más los
// que el backend proyecta sobre las fechas de cada etapa -- planeación al
// arranque, seguimiento a mitad de camino, evaluación al cierre. `origen`
// distingue una fecha real de una estimación; la UI no debe mezclarlas.
export type TipoMomentoProyectado = 'PLANEACION' | 'SEGUIMIENTO' | 'EVALUACION'
export type OrigenMomento = 'REALIZADO' | 'PROGRAMADO' | 'PROYECTADO'
export type EstadoMomento = 'HECHO' | 'VENCIDO' | 'FUTURO'

export interface MomentoProyectado {
  etapa_id:           number
  aprendiz_id:        number
  aprendiz_nombre:    string
  numero_documento:   string
  numero_ficha:       string
  empresa_nombre:     string | null
  tipo:               TipoMomentoProyectado
  numero_seguimiento: number | null
  fecha:              string   // aaaa-mm-dd
  origen:             OrigenMomento
  estado:             EstadoMomento
}

export interface ProyeccionInstructor {
  hoy:      string
  momentos: MomentoProyectado[]
}

// ─── GET /instructores/mi/historial ──────────────────────────────────────────
// Trazabilidad del propio instructor: cada momento (planeación / seguimiento /
// evaluación) que registró, en orden cronológico (lo más reciente primero).
// Qué tipo de registro es (ver instructores.service.ts::historial). Los
// campos del momento (tipo_momento, concepto, firma...) solo vienen llenos en
// MOMENTO y MOMENTO_EDITADO.
export type ClaseHistorial = 'MOMENTO' | 'MOMENTO_EDITADO' | 'ETAPA_REGISTRADA' | 'ETAPA_ACTUALIZADA' | 'VISITA'

export interface HistorialEvento {
  key:                   string   // único entre clases (el id se repite)
  clase:                 ClaseHistorial
  detalle:               string | null
  id:                    number
  tipo_momento:          'PLANEACION' | 'SEGUIMIENTO' | 'EVALUACION' | null
  numero_seguimiento:    number
  tipo_seguimiento:      string | null   // PRESENCIAL | VIRTUAL | TELEFONICA
  concepto:              string | null   // FAVORABLE | NO_FAVORABLE | PENDIENTE
  motivo_extraordinario: string | null
  fecha:                 string | null   // fecha_realizada
  registrado_at:         string          // created_at (cuándo lo diligenció)
  firmado:               boolean
  firmado_at:            string | null
  tiene_ubicacion:       boolean
  ubicacion_ok:          boolean
  etapa_id:              number
  modalidad:             string
  empresa_nombre:        string | null
  resultado_final:       'APROBADO' | 'NO_APROBADO' | null
  aprendiz_nombre:       string
  aprendiz_documento:    string
  numero_ficha:          string
}

// Compartidos por la página Historial y la tarjeta "Actividad reciente" del Home.
export const CONCEPTO_META: Record<string, { label: string; tone: 'ok' | 'err' | 'warn' | 'neutral' }> = {
  FAVORABLE:    { label: 'Favorable',     tone: 'ok' },
  NO_FAVORABLE: { label: 'No favorable',  tone: 'err' },
  PENDIENTE:    { label: 'Sin concepto',  tone: 'neutral' },
}

export function momentoLabel(e: HistorialEvento): string {
  switch (e.clase) {
    case 'ETAPA_REGISTRADA':  return 'Registro de etapa productiva'
    case 'ETAPA_ACTUALIZADA': return 'Edición · Información general'
    case 'VISITA':            return 'Visita agendada'
  }
  const m = e.tipo_momento === 'PLANEACION' ? 'Planeación'
    : e.tipo_momento === 'EVALUACION' ? 'Evaluación final'
    : `Seguimiento N.º ${e.numero_seguimiento}`
  return e.clase === 'MOMENTO_EDITADO' ? `Edición · ${m}` : m
}

// Es un registro de momento (planeación / seguimiento / evaluación): solo
// estos tienen concepto, firma y GPS.
export function esMomento(e: HistorialEvento): boolean {
  return e.clase === 'MOMENTO' || e.clase === 'MOMENTO_EDITADO'
}

export interface InstructorHistorial {
  total:     number
  actividad: { fecha: string; count: number }[]   // heatmap, últimos ~6 meses
  eventos:   HistorialEvento[]
}

// Contrato de GET /instructores/mi/pendientes (forma_server,
// instructores/pendientes.ts). El texto ya viene redactado por el backend.
export type GrupoPendiente = 'URGENTE' | 'TE_TOCA' | 'VIGILAR'
export type CategoriaPendiente = 'MOMENTO' | 'VISITA' | 'FICHA' | 'ALERTA'
export type TabEtapa = 'cronograma' | 'planeacion' | 'seguimientos' | 'evaluacion' | 'bitacoras'

export interface Pendiente {
  id:             string
  grupo:          GrupoPendiente
  categoria:      CategoriaPendiente
  titulo:         string
  texto:          string
  fecha:          string | null
  etapa_id:       number | null
  ficha_id:       number | null
  numero_ficha:   string | null
  empresa_nombre: string | null
  tab:            TabEtapa | null
}

export interface PendientesInstructor {
  hoy:        string
  pendientes: Pendiente[]
  conteos:    { urgente: number; te_toca: number; vigilar: number }
  aprendices: EstadoAprendiz[]
  // Señales de bitácoras (por leer, aprendiz que no entrega). Rediseño.
  bitacoras?: SenalBitacora[]
  fallos:     string[]
}

export interface SenalBitacora {
  id:              string
  tipo:            'POR_LEER' | 'SIN_ENTREGAR'
  grupo:           'URGENTE' | 'TE_TOCA'
  etapa_id:        number
  aprendiz_nombre: string
  numero_ficha:    string
  texto:           string
  numeros:         number[]
  dificultades:    boolean
}

export type EstadoCasilla = 'LEIDA' | 'SIN_LEER' | 'CORRECCION' | 'ATRASADA' | 'POR_ENTREGAR' | 'ABIERTA' | 'FUTURA'
export interface CasillaBitacora {
  numero:       number
  estado:       EstadoCasilla
  fin:          string
  limite:       string
  entregada:    string | null
  dificultades: number
}

// Vista Calendario: en qué va cada aprendiz y en qué fechas cae su ciclo.
export type EstadoMomentoAprendiz = 'HECHO' | 'VENCIDO' | 'ABIERTO' | 'AGENDADO' | 'PROXIMO'
export type SituacionAprendiz = 'ATRASADO' | 'LE_TOCA' | 'AL_DIA' | 'COMPLETO'

export interface MomentoAprendiz {
  tipo:       TipoMomentoProyectado
  estado:     EstadoMomentoAprendiz
  texto:      string          // "Hecho el 12 ago", "Venció el 15 ago"...
  fecha:      string | null   // día en que aparece en el calendario
  desde:      string | null   // ventana del momento (cronograma.ts)
  hasta:      string | null
  habilitado: string | null
  visita:     { fecha: string; modalidad: string } | null
}

export interface EstadoAprendiz {
  etapa_id:        number
  aprendiz_nombre: string
  ficha_id:        number
  numero_ficha:    string
  empresa_nombre:  string | null
  inicio:          string | null
  fin:             string | null
  momentos:        MomentoAprendiz[]
  visitas_extra:   { fecha: string; modalidad: string }[]
  situacion:       SituacionAprendiz
  resumen:         string
  tab:             TabEtapa | null
  programa_nombre?: string | null
  bitacoras?:      CasillaBitacora[]
}

// Ícono y color de cada registro del historial (Historial y Home).
type IconoMeta = { icon: IcName; color: string; bg: string }
const MOMENTO_ICON: Record<'PLANEACION' | 'SEGUIMIENTO' | 'EVALUACION', IconoMeta> = {
  PLANEACION:  { icon: 'edit',        color: '#4f46e5', bg: '#eef2ff' },
  SEGUIMIENTO: { icon: 'briefcase',   color: '#0369a1', bg: '#e0f2fe' },
  EVALUACION:  { icon: 'checkCircle', color: '#15803d', bg: '#dcfce7' },
}
const CLASE_ICON: Record<'ETAPA_REGISTRADA' | 'ETAPA_ACTUALIZADA' | 'VISITA', IconoMeta> = {
  ETAPA_REGISTRADA:  { icon: 'user',     color: '#0f766e', bg: '#ccfbf1' },
  ETAPA_ACTUALIZADA: { icon: 'refresh',  color: '#0f766e', bg: '#f0fdfa' },
  VISITA:            { icon: 'calendar', color: '#7c3aed', bg: '#f3e8ff' },
}
export function iconoHistorial(e: HistorialEvento): IconoMeta {
  if (e.clase === 'MOMENTO' || e.clase === 'MOMENTO_EDITADO') {
    return MOMENTO_ICON[e.tipo_momento ?? 'SEGUIMIENTO'] ?? MOMENTO_ICON.SEGUIMIENTO
  }
  return CLASE_ICON[e.clase]
}
