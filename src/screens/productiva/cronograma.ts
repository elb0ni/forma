// ─── Cronograma de visitas + bitácoras (GET /etapas-productivas/:id/cronograma)
// Las reglas de tiempo viven en el backend (forma_server/src/bitacora/
// cronograma.ts); aquí solo los tipos y formateo.

export type TipoMomentoCron = 'PLANEACION' | 'SEGUIMIENTO' | 'EVALUACION'
export type ModalidadVisita = 'PRESENCIAL' | 'VIRTUAL'

export interface VisitaProgramada {
  id: number
  tipo_momento: TipoMomentoCron | 'EXTRA'
  fecha: string          // aaaa-mm-dd
  hora: string | null    // HH:MM
  modalidad: ModalidadVisita
  nota: string | null
}

export interface MomentoCronograma {
  tipo: TipoMomentoCron
  ventana_desde: string
  ventana_hasta: string
  fecha_sugerida: string
  habilitado_desde: string   // antes de esta fecha no se puede registrar
  estado: 'REALIZADO' | 'PROGRAMADO' | 'SIN_PROGRAMAR'
  alerta: 'VENCIDO' | 'EN_VENTANA' | 'FUTURO' | null
  seguimiento_id: number | null
  fecha_realizada: string | null
  realizado_fuera_de_ventana: boolean
  visita: VisitaProgramada | null
  visita_fuera_de_ventana: boolean
  visita_vencida: boolean
}

export interface VisitaExtra {
  origen: 'REALIZADO' | 'PROGRAMADO'
  seguimiento_id: number | null
  visita_id: number | null
  fecha: string
  hora?: string | null
  modalidad: string
  nota: string | null
}

export type EstadoBitacora = 'FUTURA' | 'PENDIENTE' | 'BORRADOR' | 'ENTREGADA' | 'DEVUELTA' | 'APROBADA'

export interface ActividadBitacora {
  descripcion: string
  fecha_inicio: string
  fecha_fin: string
  evidencia: string
  observaciones: string
}

export interface Bitacora {
  numero: number
  periodo_inicio: string
  periodo_fin: string
  fecha_limite: string
  estado: EstadoBitacora
  vencida: boolean
  abierta: boolean
  entregada_at: string | null
  revisada_at: string | null
  observacion_instructor: string | null
  total_actividades: number
  actividades?: ActividadBitacora[]
}

export interface ResumenBitacoras {
  total: number
  aprobadas: number
  por_revisar: number
  devueltas: number
  vencidas: number
  esperadas_a_hoy: number
}

export interface Cronograma {
  hoy: string
  fecha_inicio: string
  fecha_fin_estimada: string
  momentos: MomentoCronograma[]
  extras: VisitaExtra[]
  visitas: VisitaProgramada[]
  bitacoras: Bitacora[]
  resumen_bitacoras: ResumenBitacoras
  // Último código enviado al correo del aprendiz y su último ingreso al portal.
  acceso: { generado_at: string; ultimo_ingreso_at: string | null } | null
  correos_aprendiz: string[]
}

export interface DocumentoBitacora {
  etapa: {
    aprendiz_nombre: string
    aprendiz_documento: string
    aprendiz_tipo_documento: string | null
    aprendiz_telefono: string | null
    aprendiz_email_institucional: string | null
    centro_nombre: string | null
    regional: string | null
    programa_nombre: string
    numero_ficha: string
    modalidad: string
    empresa_nombre: string | null
    empresa_nit: string | null
    jefe_inmediato_nombre: string | null
    jefe_inmediato_cargo: string | null
    jefe_inmediato_telefono: string | null
    jefe_inmediato_email: string | null
    instructor_nombre: string
    instructor_email: string | null
    fecha_inicio: string
    fecha_fin_estimada: string
  }
  bitacora: Bitacora
  total_bitacoras: number
  firmas: { aprendiz: string | null; jefe: string | null; instructor: string | null }
}

export const MOMENTO_META: Record<TipoMomentoCron, { n: number; label: string; ventana: string; color: string; bg: string }> = {
  PLANEACION:  { n: 1, label: 'Planeación',          ventana: 'Primeras 2 semanas',       color: '#4f46e5', bg: '#eef2ff' },
  SEGUIMIENTO: { n: 2, label: 'Seguimiento parcial', ventana: 'A mitad de la etapa',      color: '#0891b2', bg: '#ecfeff' },
  EVALUACION:  { n: 3, label: 'Evaluación final',    ventana: 'Últimos 15 días',          color: '#7c3aed', bg: '#f5f3ff' },
}

export const ESTADO_BITACORA_META: Record<EstadoBitacora, { label: string; tone: 'neutral' | 'outline' | 'ok' | 'warn' | 'err' | 'blue' | 'purple'; color: string }> = {
  FUTURA:    { label: 'Aún no inicia', tone: 'outline', color: '#d4d4d8' },
  PENDIENTE: { label: 'Sin diligenciar', tone: 'neutral', color: '#a1a1aa' },
  BORRADOR:  { label: 'Borrador',      tone: 'neutral', color: '#71717a' },
  ENTREGADA: { label: 'Por revisar',   tone: 'blue',    color: '#2563eb' },
  DEVUELTA:  { label: 'Devuelta',      tone: 'warn',    color: '#ca8a04' },
  APROBADA:  { label: 'Aprobada',      tone: 'ok',      color: '#15803d' },
}

// Fechas "aaaa-mm-dd" sin pasar por UTC (new Date('2026-09-24') en Colombia
// daría el 23).
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic']
export function fdia(iso: string | null | undefined, conAnio = true): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return conAnio ? `${d} ${MESES[m - 1]} ${y}` : `${d} ${MESES[m - 1]}`
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 864e5)
}

export function mensajeError(e: unknown, def: string): string {
  const m = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message
  return Array.isArray(m) ? m.join(' · ') : m ?? def
}
