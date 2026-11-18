import api from '../../lib/api'

// Tipos y utilidades compartidas por las vistas de Integridad (catálogo, por
// asignar, diseños).

export const INTEGRIDAD_BASE = '/dashboard/superadmin/integridad'

export interface Coordinacion { id: number; nombre: string; centro_formacion_id: number; coordinador_nombre: string | null }

export interface Regla {
  id: number; centro_formacion_id: number; centro_nombre: string
  nivel_formacion: string; jornada: string; modalidad_formacion: string
  programa_nombre: string; municipio: string | null; coordinador_nombre: string | null
  coordinacion_academica_id: number | null; coordinacion_nombre: string | null
  origen: 'IMPORTADO' | 'MANUAL' | 'FICHAS'; actualizada: string; fichas: number; no_coinciden: number
}

export interface Importacion {
  confirmado: boolean; filas: number; reglas: number; nuevas: number; cambian: number; sin_cambio: number
  coordinadores: { escrito: string; centro: string; coordinacion_academica_id: number | null; coordinacion_nombre: string | null; usuario: string | null; reglas: number }[]
  errores: { fila: number; mensaje: string }[]
}

// "Coordinación Académica de Tecnologías de la Información…" -> "Tecnologías de la Información…"
export const coordCorta = (n: string | null | undefined) => (n ?? '').replace(/^Coordinaci[oó]n Acad[eé]mica de /i, '')

export function mensajeError(e: unknown, porDefecto: string): string {
  const m = (e as { response?: { data?: { message?: unknown } } })?.response?.data?.message
  return Array.isArray(m) ? m.join('. ') : typeof m === 'string' ? m : porDefecto
}

export const n = (x: number) => x.toLocaleString('es-CO')

// Descarga el catálogo en Excel: un centro o el consolidado.
export async function descargarCatalogo(centroId?: number) {
  try {
    const r = await api.get<Blob>('/integridad/catalogo/excel', {
      params: centroId ? { centro_id: centroId } : {},
      responseType: 'blob',
    })
    const nombre = /filename="([^"]+)"/.exec(String(r.headers['content-disposition'] ?? ''))?.[1] ?? 'catalogo.xlsx'
    const url = URL.createObjectURL(r.data)
    const a = document.createElement('a')
    a.href = url; a.download = nombre; a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    alert(mensajeError(e, 'No se pudo descargar el catálogo.'))
  }
}
