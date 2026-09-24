// Tipo compartido entre SuperAdmin y Coordinador: metadata estructural de una
// coordinación académica (usada solo para la cabecera de su detalle -- las
// fichas se listan con FichasAdmin/`GET /fichas?coordinacion_id=` y los
// instructores con `GET /usuarios?rol=INSTRUCTOR&coordinacion_id=`, ambos ya
// scoped a etapa productiva).

// GET /centros/resumen -> rollup de práctica por centro, con sus coordinaciones.
// Lo consumen la pantalla de Centros y el Dashboard del super admin.
export interface CoordResumen {
  id: number
  nombre: string
  activa: number
  coordinador_nombre: string | null
  fichas_activas: number
  fichas_en_practica: number
  fichas_sin_instructor: number
  aprendices_en_practica: number
  instructores: number
}

export interface CentroResumen {
  id: number
  nombre: string
  codigo: string
  ciudad: string
  regional: string
  activo: number
  coordinaciones: number
  coordinaciones_total: number
  instructores_total: number
  instructores_practica: number
  fichas_total: number
  fichas_activas: number
  fichas_en_practica: number
  fichas_sin_instructor: number
  programas_en_practica: number
  aprendices_en_practica: number
  etapas_por_cerrar: number
  conceptos_por_resolver: number
  proxima_a_practica: string | null
  coordinaciones_detalle: CoordResumen[]
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
    fichas_activas: number; fichas_total: number
    instructores: number; instructores_con_practica: number
    programas: number; seguimientos_total: number
  }
}
