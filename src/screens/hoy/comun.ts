// Traducción de lo que manda el motor de pendientes (backend) a los tonos y
// palabras del sistema visual nuevo. Lo comparten "Hoy" y "Aprendices".
import type { Tono } from '../../ui/estados'
import { fdia } from '../../ui/estados'
import type {
  CasillaBitacora, EstadoAprendiz, EstadoCasilla, EstadoMomentoAprendiz, GrupoPendiente, SituacionAprendiz,
} from '../instructor/types'

export const TONO_MOMENTO: Record<EstadoMomentoAprendiz, Tono> = {
  HECHO: 'hecho', VENCIDO: 'atraso', ABIERTO: 'toca', AGENDADO: 'info', PROXIMO: 'futuro',
}

export const CASILLA: Record<EstadoCasilla, { tono: Tono; texto: string }> = {
  LEIDA: { tono: 'hecho', texto: 'Leída' },
  SIN_LEER: { tono: 'info', texto: 'Entregada, sin leer' },
  CORRECCION: { tono: 'aviso', texto: 'Corrección pedida' },
  ATRASADA: { tono: 'atraso', texto: 'Atrasada' },
  POR_ENTREGAR: { tono: 'toca', texto: 'Por entregar' },
  ABIERTA: { tono: 'neutro', texto: 'Abierta' },
  FUTURA: { tono: 'futuro', texto: 'Próxima' },
}

export const SITUACION: Record<SituacionAprendiz, { tono: Tono; corto: string }> = {
  ATRASADO: { tono: 'atraso', corto: 'Atrasado' },
  LE_TOCA: { tono: 'toca', corto: 'Le toca' },
  AL_DIA: { tono: 'hecho', corto: 'Al día' },
  COMPLETO: { tono: 'hecho', corto: 'Completo' },
}

export const GRUPO: Record<GrupoPendiente, Tono> = { URGENTE: 'atraso', TE_TOCA: 'toca', VIGILAR: 'neutro' }

export function lineaMiniDe(a: EstadoAprendiz) {
  return {
    momentos: a.momentos.map((m) => ({ tipo: m.tipo, tono: TONO_MOMENTO[m.estado], texto: m.texto })),
    bitacoras: (a.bitacoras ?? []).map((b: CasillaBitacora) => ({
      numero: b.numero, tono: CASILLA[b.estado].tono, texto: `${CASILLA[b.estado].texto} · cierra el ${fdia(b.fin)}`,
    })),
  }
}

export function resumenBitacoras(a: EstadoAprendiz): { tono: Tono; texto: string } {
  const c = a.bitacoras ?? []
  const sinLeer = c.filter((b) => b.estado === 'SIN_LEER').length
  const atrasadas = c.filter((b) => b.estado === 'ATRASADA').length
  if (sinLeer) return { tono: 'info', texto: `${sinLeer} por leer` }
  if (atrasadas) return { tono: 'atraso', texto: `${atrasadas} sin entregar` }
  const leidas = c.filter((b) => b.estado === 'LEIDA').length
  return { tono: 'neutro', texto: c.length ? `${leidas} de ${c.length} leídas` : '—' }
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export function fechaLarga(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const dia = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  return `${DIAS[dia]} ${d} de ${MESES[m - 1]}`
}

export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
