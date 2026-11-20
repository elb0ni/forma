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

// FORMA empieza a operar este día: lo que arrancó práctica antes es histórico
// y no se mide (p. ej. fichas en práctica sin instructor).
export const FORMA_INICIO = '2026-10-01'

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
  PROXIMA:     { label: 'Próxima a práctica', icon: 'calendar',    fg: 'var(--fx-morado-tinta)', bg: 'var(--fx-morado-suave)', bd: 'var(--fx-morado-linea)', dot: 'var(--fx-morado)' },
  EN_PRACTICA: { label: 'En práctica',        icon: 'briefcase',   fg: 'var(--fx-morado-tinta)', bg: 'var(--fx-morado-suave)', bd: 'var(--fx-morado-linea)', dot: 'var(--fx-morado)' },
  EN_CIERRE:   { label: 'En cierre',          icon: 'clock',       fg: 'var(--fx-aviso)', bg: 'var(--fx-aviso-suave)', bd: 'var(--fx-aviso-linea)', dot: 'var(--fx-aviso)' },
  FINALIZADA:  { label: 'Finalizada',         icon: 'checkCircle', fg: 'var(--fx-tinta-2)', bg: 'var(--fx-superficie-2)', bd: 'var(--fx-linea)', dot: 'var(--fx-tinta-4)' },
}
