// Tipo compartido entre SuperAdmin y Coordinador: metadata estructural de una
// coordinación académica (usada solo para la cabecera de su detalle -- las
// fichas se listan con FichasAdmin/`GET /fichas?coordinacion_id=` y los
// instructores con `GET /usuarios?rol=INSTRUCTOR&coordinacion_id=`, ambos ya
// scoped a etapa productiva).

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
    instructores: number; instructores_activos_semana: number
  }
}
