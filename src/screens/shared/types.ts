// Tipos compartidos entre las vistas de SuperAdmin y Coordinador (detalle de
// una coordinación académica: sus fichas, instructores y programas).

export interface InstructorRow {
  id:                     string
  nombre_completo:        string
  email:                  string
  numero_documento:       string
  activo:                 number
  ultimo_acceso:          string | null
  competencias_asignadas: number
  fichas:                 number
  sesiones:               number
  avance:                 number
}

export interface FichaRow {
  id:                number
  numero_ficha:      string
  estado:            string
  jornada:           string | null
  fecha_fin_lectiva: string
  programa_nombre:   string
  programa_codigo:   string
  tiene_disenio_curricular: number
  dias_restantes:    number
  instructores:      number
  competencias:      number
  avance:            number
}

export interface ProgramaRow {
  id:              number
  nombre:          string
  codigo:          string
  nivel_formacion: string
  tiene_disenio_curricular: number
  fichas_activas:  number
}

export interface CoordDetalle {
  coordinacion: {
    id: number; nombre: string; activa: number
    centro: { id: number; nombre: string; codigo: string; ciudad: string }
  }
  coordinador: {
    id: string; nombre_completo: string; email: string
    numero_documento: string; activo: number; ultimo_acceso: string | null
  } | null
  kpi: {
    fichas_activas: number; fichas_total: number; instructores: number
    instructores_activos_semana: number; programas: number
    avance_promedio: number; sesiones_semana: number; ras_cerrados: number
  }
  instructores: InstructorRow[]
  fichas:       FichaRow[]
  programas:    ProgramaRow[]
}
