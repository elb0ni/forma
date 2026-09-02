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

// ─── Programas (catálogo estructural, sin diseño curricular) ────────────────────
// Una ficha requiere un programa; el catálogo se sigue listando aunque FORMA
// ya no cubre el diseño curricular en sí (RA/competencias/criterios).

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
