// ─── Roles ────────────────────────────────────────────────────────────────────

export type UserRole =
  | 'SUPER_ADMIN'
  | 'SUBDIRECTOR'
  | 'COORD_MISIONAL'
  | 'COORD_ACADEMICO'
  | 'INSTRUCTOR'

export interface AuthUser {
  id:                        string
  nombre_completo:           string
  email:                     string
  rol:                       UserRole
  centro_formacion?:         string
  centro_formacion_id:       number | null
  coordinacion_academica_id: number | null
  activo:                    boolean
  primer_login:              boolean
  ultimo_acceso:             string
}

// ─── Diseño curricular ────────────────────────────────────────────────────────

export interface RA {
  numero: string
  descripcion: string
  orden: number
}

export interface Conocimiento {
  descripcion: string
  tipo: 'PROCESO' | 'SABER'
  ra_numero: string | null
  requiere_revision_ra: boolean
  confianza_nli: number | null
  orden: number
  origen_asignacion_ra?: string
}

export interface Criterio {
  descripcion: string
  ra_numero: string | null
  orden: number
}

export interface Competencia {
  codigo_norma: string
  nombre: string
  tipo: string
  horas_maximas: number
  tipo_agrupacion: string
  orden: number
  resultados_aprendizaje: RA[]
  conocimientos: Conocimiento[]
  criterios: Criterio[]
}

export interface Programa {
  nombre: string
  codigo: string
  version: string
  nivel_formacion: string
  horas_lectivas: number
  horas_productivas: number
  titulo_otorga: string
  fecha_inicio: string
  competencias: Competencia[]
  alertas: string[]
  nli_aplicado?: boolean
}

// ─── API responses ────────────────────────────────────────────────────────────

export interface ProgramaListItem {
  id: number
  nombre: string
  codigo: string
  version: string
  nivel_formacion: string
  horas_lectivas: number
  horas_productivas?: number
  estado: 'VIGENTE' | 'INACTIVO'
  tiene_disenio_curricular: number
  fichas_activas: number
  total_competencias: number
  total_ra: number
  total_conocimientos: number
  total_criterios: number
  created_at: string
}

export interface CompetenciaResumen {
  id: number
  codigo_norma: string
  nombre: string
  tipo: string
  horas_maximas: number
  orden: number
  total_ra: number
  total_conocimientos: number
  total_criterios: number
  resultados_aprendizaje?: { id: number; numero: string; descripcion: string; orden: number }[]
  conocimientos?: { id: number; ra_id: number | null; tipo: 'PROCESO' | 'SABER'; descripcion: string }[]
  criterios?: { id: number; ra_id: number | null; descripcion: string }[]
}

export interface ProgramaDetalle {
  id: number
  nombre: string
  codigo: string
  version: string
  nivel_formacion: string
  horas_lectivas: number
  horas_productivas: number
  titulo_otorga: string
  descripcion?: string
  estado: 'VIGENTE' | 'INACTIVO'
  tiene_disenio_curricular?: number
  centros: { id: number; nombre: string; codigo: string }[]
  created_at: string
  competencias: CompetenciaResumen[]
}
