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
  telefono:                  string | null
  rol:                       UserRole
  centro_formacion?:         string
  centro_formacion_id:       number | null
  coordinacion_academica_id: number | null
  activo:                    boolean
  primer_login:              boolean
  ultimo_acceso:             string
}

// ─── Programas (cartera de fichas, sin diseño curricular) ──────────────────────
// FORMA se recortó a la etapa práctica: un programa ya no tiene competencias/RA,
// funciona como cartera de fichas. `GET /api/programas` devuelve el rollup de
// práctica de todas las fichas de cada programa. Lo consumen la pantalla de
// Programas y el selector de programa de FichaForm.

export interface ProgramaResumen {
  id: number
  nombre: string
  codigo: string
  version: number
  nivel_formacion: string
  titulo_otorga: string
  estado: 'VIGENTE' | 'INACTIVO'
  fecha_inicio: string | null
  created_at: string
  updated_at: string
  // rollup de práctica de sus fichas:
  fichas_total: number
  fichas_activas: number          // estado EN_EJECUCION
  fichas_finalizadas: number
  fichas_en_practica: number      // EN_EJECUCION + etapa teórica PRACTICA
  fichas_sin_instructor: number   // de las anteriores, sin instructor de práctica -> ALERTA
  centros: number
  coordinaciones: number
  proxima_a_practica: string | null // fecha más cercana en que una ficha entra a práctica
}
