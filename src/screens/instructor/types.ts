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
export interface HistorialEvento {
  id:                    number
  tipo_momento:          'PLANEACION' | 'SEGUIMIENTO' | 'EVALUACION'
  numero_seguimiento:    number
  tipo_seguimiento:      string   // PRESENCIAL | VIRTUAL | TELEFONICA
  concepto:              string   // FAVORABLE | NO_FAVORABLE | PENDIENTE
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
  if (e.tipo_momento === 'PLANEACION') return 'Planeación'
  if (e.tipo_momento === 'EVALUACION') return 'Evaluación final'
  return `Seguimiento N.º ${e.numero_seguimiento}`
}

export interface InstructorHistorial {
  total:     number
  actividad: { fecha: string; count: number }[]   // heatmap, últimos ~6 meses
  eventos:   HistorialEvento[]
}
