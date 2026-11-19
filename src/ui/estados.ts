// Cómo se dice y cómo se ve el estado de cada cosa del flujo. Una sola fuente
// para el expediente, las listas y el portal: misma palabra, mismo tono.
import type { Bitacora, MomentoCronograma, TipoMomentoCron } from '../screens/productiva/cronograma'

export type Tono = 'hecho' | 'toca' | 'atraso' | 'aviso' | 'futuro' | 'info' | 'neutro'

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fdia(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return '—'
  return `${d} ${MESES[m - 1]}`
}

export function fdiaAnio(iso: string | null | undefined): string {
  if (!iso) return '—'
  return `${fdia(iso)} ${iso.slice(0, 4)}`
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 864e5)
}

export const NOMBRE_MOMENTO: Record<TipoMomentoCron, string> = {
  PLANEACION: 'Planeación',
  SEGUIMIENTO: 'Seguimiento',
  EVALUACION: 'Evaluación',
}
export const NUM_MOMENTO: Record<TipoMomentoCron, number> = { PLANEACION: 1, SEGUIMIENTO: 2, EVALUACION: 3 }

export interface Estado { tono: Tono; texto: string }

export function estadoMomento(m: MomentoCronograma, hoy: string): Estado {
  if (m.estado === 'REALIZADO') {
    return m.realizado_fuera_de_ventana
      ? { tono: 'aviso', texto: `Hecho el ${fdia(m.fecha_realizada)}, fuera de plazo` }
      : { tono: 'hecho', texto: `Hecho el ${fdia(m.fecha_realizada)}` }
  }
  if (m.alerta === 'VENCIDO' || m.visita_vencida) {
    return { tono: 'atraso', texto: `Atrasado: el plazo era hasta el ${fdia(m.ventana_hasta)}` }
  }
  if (m.estado === 'PROGRAMADO' && m.visita) {
    return { tono: 'info', texto: `Visita agendada el ${fdia(m.visita.fecha)}` }
  }
  if (m.alerta === 'EN_VENTANA') {
    const quedan = diasEntre(hoy, m.ventana_hasta)
    return { tono: 'toca', texto: quedan <= 0 ? 'Toca hoy: es el último día' : `Toca ahora: quedan ${quedan} días` }
  }
  if (hoy >= m.habilitado_desde) {
    return { tono: 'toca', texto: `Ya se puede: su ventana abre el ${fdia(m.ventana_desde)}` }
  }
  return { tono: 'futuro', texto: `Del ${fdia(m.ventana_desde)} al ${fdia(m.ventana_hasta)}` }
}

// Bitácora tal como se ve en todos lados. El instructor no aprueba: la lee.
export type BitacoraVista = Bitacora & { leida_at?: string | null; dificultades?: number; entregada_tarde?: boolean | number }

export function estadoBitacora(b: BitacoraVista, hoy: string): Estado & { corto: string } {
  if (b.estado === 'APROBADA' || b.leida_at) {
    return { tono: 'hecho', texto: `Leída por el instructor${b.leida_at ? ` el ${fdia(b.leida_at)}` : ''}`, corto: 'Leída' }
  }
  if (b.estado === 'DEVUELTA') return { tono: 'aviso', texto: 'El instructor pidió una corrección', corto: 'Corrección' }
  if (b.estado === 'ENTREGADA') return { tono: 'info', texto: `Entregada el ${fdia(b.entregada_at)}, sin leer`, corto: 'Entregada' }
  if (b.estado === 'FUTURA') return { tono: 'futuro', texto: `Abre el ${fdia(b.periodo_inicio)}`, corto: 'Próxima' }
  if (b.vencida) return { tono: 'atraso', texto: `Atrasada: el plazo era el ${fdia(b.fecha_limite)}`, corto: 'Atrasada' }
  if (hoy > b.periodo_fin) {
    return { tono: 'toca', texto: `Por entregar: el plazo es el ${fdia(b.fecha_limite)}`, corto: 'Por entregar' }
  }
  return { tono: 'neutro', texto: `Abierta hasta el ${fdia(b.periodo_fin)}`, corto: 'Abierta' }
}

// Colores de cada tono para dibujar (SVG y barras), siempre desde los tokens.
export const RELLENO: Record<Tono, string> = {
  hecho: 'var(--fx-ok)',
  toca: 'var(--fx-morado)',
  atraso: 'var(--fx-atraso)',
  aviso: 'var(--fx-aviso)',
  futuro: 'var(--fx-superficie-2)',
  info: 'var(--fx-info)',
  neutro: 'var(--fx-linea-2)',
}
