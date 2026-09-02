import type { StatusTone } from '../shared/parts'

// Ficha del instructor, tal como la devuelve `GET /dashboard/instructor/fichas`.
// `es_lectiva`/`es_practica` siguen viniendo del backend (un instructor puede
// dar clases y además ser instructor de práctica de la misma ficha), pero el
// front ya solo opera sobre `es_practica` -- ver InstFichas.tsx.
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
  dias_restantes:         number
  status:                 StatusTone
  etapa_actual:           'LECTIVA' | 'PRACTICA'
  es_lectiva:             boolean
  es_practica:            boolean
}
