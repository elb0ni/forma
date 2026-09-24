// ─── Fase operativa de la ficha ─────────────────────────────────────────────────
// FORMA no razona por "estado" (En ejecución / Finalizada de Sofía) ni por
// "etapa lectiva/práctica" -- razona por en qué punto del proceso productivo
// está la ficha. Se deriva de las fechas de etapa productiva + el estado:
//   PRÓXIMA      la etapa productiva todavía no arranca -> preparar (instructor)
//   EN PRÁCTICA  arrancó, la fecha de fin no llegó -> seguimiento en curso
//   EN CIERRE    la fecha de fin ya pasó pero la ficha sigue abierta ->
//                seguimientos y evaluación final pendientes. NO es un error:
//                la práctica dura hasta 6 meses y Sofía marca "Terminada por
//                fecha" mientras los aprendices siguen en la empresa.
//   FINALIZADA   cerrada de verdad -> solo historial
//
// Módulo sin JSX -- lo comparten la tabla de Fichas (super admin / coordinador),
// el dashboard y la vista del instructor. La píldora visual (FasePill) vive en
// shared/FichasAdmin.
import type { IcName } from '../../components/ui'

export type FaseFicha = 'PROXIMA' | 'EN_PRACTICA' | 'EN_CIERRE' | 'FINALIZADA'

export function faseFicha(f: {
  estado: string
  fecha_inicio_productiva: string | null
  fecha_fin_productiva: string | null
}): FaseFicha {
  const hoy = new Date().toISOString().slice(0, 10)
  const ini = f.fecha_inicio_productiva ? f.fecha_inicio_productiva.slice(0, 10) : null
  const fin = f.fecha_fin_productiva ? f.fecha_fin_productiva.slice(0, 10) : null
  if (ini && ini > hoy) return 'PROXIMA'
  if (!fin || fin >= hoy) return 'EN_PRACTICA'
  return f.estado === 'FINALIZADA' ? 'FINALIZADA' : 'EN_CIERRE'
}

export const FASE_META: Record<FaseFicha, {
  label: string; icon: IcName; fg: string; bg: string; bd: string; dot: string
}> = {
  PROXIMA:     { label: 'Próxima a práctica', icon: 'calendar',    fg: '#3730a3', bg: '#eef2ff', bd: '#c7d2fe', dot: '#6366f1' },
  EN_PRACTICA: { label: 'En práctica',        icon: 'briefcase',   fg: '#4338ca', bg: '#e0e7ff', bd: '#a5b4fc', dot: '#4f46e5' },
  EN_CIERRE:   { label: 'En cierre',          icon: 'clock',       fg: '#a16207', bg: '#fef9c3', bd: '#fde68a', dot: '#ca8a04' },
  FINALIZADA:  { label: 'Finalizada',         icon: 'checkCircle', fg: '#52525b', bg: '#f1f1f3', bd: '#e4e4e7', dot: '#a1a1aa' },
}
