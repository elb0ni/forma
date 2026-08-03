import type { StatusTone } from '../shared/parts'

export interface ResumenInstructor {
  sesiones_semana:          number
  sesiones_semana_anterior: number
  horas_semana:             number
  avance_promedio:          number
  ras_cerrados:             number
  ras_total:                number
  por_validar:              number
  competencias_asignadas:   number
}

export interface ActividadDia {
  fecha: string
  count: number
  horas: number
}

export interface FichaInstructor {
  id:                     number
  numero_ficha:           string
  estado:                 string
  fecha_inicio:           string
  fecha_fin_lectiva:      string
  sede:                   string | null
  jornada:                string | null
  programa_nombre:        string
  programa_codigo:        string
  nivel_formacion:        string
  competencias_asignadas: number
  competencias_completas: number
  dias_restantes:         number
  avance:                 number
  status:                 StatusTone
  etapa_actual:           'LECTIVA' | 'PRACTICA'
  es_lectiva:             boolean
  es_practica:            boolean
}

export interface RAItem {
  id:          number
  numero:      string
  descripcion: string
  avance:      number
  status:      StatusTone
  completado:  boolean
}

export interface CompetenciaDetalle {
  asignacion_id:          number
  competencia_id:         number
  codigo_norma:           string
  nombre:                 string
  tipo:                   string
  horas_maximas:          number
  horas_ejecutadas:       number
  avance:                 number
  status:                 StatusTone
  ra_completados:         number
  ra_total:               number
  resultados_aprendizaje: RAItem[]
}

export interface SesionResumen {
  id:               number
  fecha:            string
  horas_ejecutadas: number
  tipo_sesion:      string
  estado_sesion:    string
  competencia_nombre: string
  ras:              number
  conocimientos:    number
  criterios:        number
}

export interface FichaDetalle {
  ficha: {
    id:                 number
    numero_ficha:       string
    estado:             string
    fecha_inicio:       string
    fecha_fin_lectiva:  string
    sede:               string | null
    jornada:            string | null
    programa_id:        number
    programa_nombre:    string
    programa_codigo:    string
    programa_version:   number
    nivel_formacion:    string
    horas_programa:     number
    coordinador_nombre: string
    coordinacion_nombre: string
    dias_restantes:     number
  }
  kpi: {
    avance:           number
    horas_ejecutadas: number
    ras_cerrados:     number
    ras_total:        number
  }
  competencias: CompetenciaDetalle[]
  sesiones:     SesionResumen[]
}

export interface SesionListItem {
  id:                 number
  fecha:              string
  horas_ejecutadas:   number
  tipo_sesion:        string
  estado_sesion:      string
  ficha_id:           number
  numero_ficha:       string
  competencia_nombre: string
  codigo_norma:       string
  programa_codigo:    string
  programa_nombre:    string
  ras:                number
  conocimientos:      number
  criterios:          number
}

export interface SesionDetalle {
  id:                 number
  fecha:              string
  horas_ejecutadas:   number
  tipo_sesion:        string
  estado_sesion:      string
  observaciones:      string | null
  ficha_id:           number
  numero_ficha:       string
  sede:               string | null
  competencia_nombre: string
  codigo_norma:       string
  programa_codigo:    string
  programa_nombre:    string
  instructor_nombre:  string
  instructor_documento?:  string | null
  instructor_firma?:      string | null
  coordinador_nombre?:    string | null
  coordinador_documento?: string | null
  coordinador_firma?:     string | null
  resultados_aprendizaje: { id: number; numero: string; descripcion: string }[]
  conocimientos:      { id: number; descripcion: string; tipo: string }[]
  criterios:          { id: number; descripcion: string; cobertura: number }[]
  materiales?:        MaterialSesion[]
}

export type TipoMaterial = 'DEVOLUTIVO' | 'CONSUMO' | 'DIDACTICO' | 'AMBIENTE'

export interface MaterialSesion {
  id?:          number
  tipo:         TipoMaterial
  nombre:       string
  cantidad?:    number | null
  unidad?:      string | null
  descripcion?: string | null
}

export interface AsignacionItem {
  asignacion_id:      number
  ficha_id:           number
  numero_ficha:       string
  competencia_id:     number
  competencia_nombre: string
  codigo_norma:       string
  programa_nombre:    string
  programa_codigo:    string
  sede:               string | null
  jornada:            string | null
  avance:             number
  status:             StatusTone
}

export interface CurriculoAsignacion {
  asignacion: {
    id:                 number
    ficha_id:           number
    numero_ficha:       string
    competencia_id:     number
    competencia_nombre: string
    codigo_norma:       string
    programa_nombre:    string
    programa_codigo:    string
  }
  resultados_aprendizaje: {
    id: number; numero: string; descripcion: string
    avance: number; status: StatusTone; completado: boolean
  }[]
  conocimientos: {
    id: number; tipo: 'PROCESO' | 'SABER'; descripcion: string
    ra_id: number | null; completado: boolean
  }[]
  criterios: {
    id: number; descripcion: string; ra_id: number | null
    cobertura: number; completado: boolean
  }[]
}

export interface Evidencia {
  id:               number
  sesion_id:        number
  tipo_evidencia:   'CONOCIMIENTO' | 'DESEMPENO' | 'PRODUCTO'
  medio:            'ENLACE' | 'ARCHIVO'
  titulo:           string
  descripcion:      string | null
  enlace_url:       string | null
  archivo_ruta:     string | null
  nombre_archivo:   string | null
  mime:             string | null
  tamano:           number | null
  estado_revision:  'PENDIENTE' | 'APROBADA' | 'RECHAZADA'
  created_at:       string
}

export interface ReporteInstructor {
  generado:          string
  instructor_nombre: string
  centro_nombre:     string
  resumen: {
    fichas:                number
    avance_promedio:       number
    competencias_cerradas: number
    sesiones:              number
    horas:                 number
  }
  fichas: {
    id:                number
    numero_ficha:      string
    programa_nombre:   string
    jornada:           string | null
    avance:            number
    status:            StatusTone
    fecha_fin_lectiva: string
    estado:            string
  }[]
}
