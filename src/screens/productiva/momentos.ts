// Ayudas de los momentos del GFPI-F-023, compartidas por el detalle viejo y
// el expediente nuevo.
import type { Cronograma } from './cronograma'
import { fdia } from './cronograma'
import type { SeguimientoProductivo } from './types'
import type { FirmaFuente } from './parts'

export interface Bloqueo { desde: string; ventana: string }

export function firmaFuenteDe(seguimientos: SeguimientoProductivo[]): FirmaFuente | null {
  const firmados = seguimientos.filter(s => s.firmado_at)
  if (firmados.length === 0) return null
  const s = [...firmados].sort((a, b) => (b.firmado_at ?? '').localeCompare(a.firmado_at ?? ''))[0]
  const etiqueta = s.tipo_momento === 'PLANEACION' ? 'la planeación'
    : s.tipo_momento === 'EVALUACION' ? 'la evaluación'
    : `el seguimiento N.º ${s.numero_seguimiento}`
  return { seguimientoId: s.id, fecha: s.fecha_realizada, etiqueta }
}

// Un momento se puede registrar desde 7 días antes de su ventana.
export function bloqueoDe(crono: Cronograma | null, tipo: 'SEGUIMIENTO' | 'EVALUACION'): Bloqueo | null {
  const m = crono?.momentos.find(x => x.tipo === tipo)
  if (!crono || !m || m.estado === 'REALIZADO' || crono.hoy >= m.habilitado_desde) return null
  return { desde: fdia(m.habilitado_desde), ventana: `${fdia(m.ventana_desde)} – ${fdia(m.ventana_hasta)}` }
}
